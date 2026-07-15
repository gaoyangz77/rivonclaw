/**
 * Startup timing preload script.
 *
 * Injected via NODE_OPTIONS="--require .../startup-timer.cjs" by the launcher.
 * Logs timestamps for key startup phases so we can see where time is spent.
 *
 * Also contains the plugin-sdk Module._resolveFilename fix that prevents jiti
 * from babel-transforming the 17 MB plugin-sdk on every startup.
 *
 * Output goes to stderr so it doesn't interfere with stdout protocol messages.
 */
"use strict";

// ── Windows UTF-8 spawn hook ──
// PowerShell 5.1 encodes pipe output via [Console]::OutputEncoding, which
// defaults to the system OEM code page (e.g. GBK on Chinese Windows).
// The gateway runs headless (no console), so `chcp 65001` has no effect —
// there is no console to set the code page on.
//
// Fix: monkey-patch child_process.spawn to inject UTF-8 encoding setup
// into every PowerShell and cmd.exe invocation. This ensures non-ASCII
// filenames (Chinese, Japanese, Korean, etc.) survive the exec→pipe→Node
// round-trip regardless of the system locale.
if (process.platform === "win32") {
  const cp = require("child_process");
  const origSpawn = cp.spawn;

  cp.spawn = function utf8Spawn(command, args, options) {
    // Normalize overloaded signature: spawn(cmd, opts) vs spawn(cmd, args, opts)
    if (args != null && !Array.isArray(args)) {
      options = args;
      args = [];
    }

    const cmd = String(command).toLowerCase();

    // PowerShell: inject [Console]::OutputEncoding = UTF8 before -Command body
    if (cmd.includes("powershell") || cmd.includes("pwsh")) {
      if (Array.isArray(args)) {
        args = [...args];
        for (let i = 0; i < args.length; i++) {
          if (String(args[i]).toLowerCase() === "-command" && i + 1 < args.length) {
            args[i + 1] =
              "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; " +
              args[i + 1];
            break;
          }
        }
      }
      return origSpawn.call(this, command, args, options);
    }

    // cmd.exe (explicit or shell:true): prepend chcp 65001
    if (cmd.includes("cmd")) {
      if (Array.isArray(args)) {
        args = [...args];
        for (let i = 0; i < args.length; i++) {
          if (String(args[i]).toLowerCase() === "/c" && i + 1 < args.length) {
            args[i + 1] = "chcp 65001>nul & " + args[i + 1];
            break;
          }
        }
      }
      return origSpawn.call(this, command, args, options);
    }

    return origSpawn.call(this, command, args, options);
  };
}

const t0 = performance.now();
let requireCount = 0;
let requireTotalMs = 0;

const fs = require("fs");
const path = require("path");

// Some bundled OpenClaw ESM chunks inline legacy CJS dependencies that still
// reference the free `__dirname` identifier. Since this preload runs before the
// ESM gateway entry, define a conservative process-wide fallback for those
// dependencies without modifying vendor sources.
if (typeof globalThis.__dirname === "undefined") {
  const configuredDistDir = process.env.RIVONCLAW_OPENCLAW_DIST_DIR;
  const entryPath = process.argv[1] || "";
  const entryDir = entryPath ? path.dirname(entryPath) : process.cwd();
  globalThis.__dirname = configuredDistDir || path.join(entryDir, "dist");
}

function logPhase(label) {
  const elapsed = (performance.now() - t0).toFixed(0);
  process.stderr.write(`[startup-timer] +${elapsed}ms ${label}\n`);
}

// Verbose-only variant — gated by RIVONCLAW_STARTUP_DEBUG=1.
// Logs detailed diagnostics (individual slow requires, cache internals, etc.)
// that are useful for perf debugging but noisy in production.
const verbose = !!process.env.RIVONCLAW_STARTUP_DEBUG;
function logPhaseV(label) {
  if (verbose) logPhase(label);
}

logPhase("preload executing");

// ── Compile cache diagnostic ──
// Log whether NODE_COMPILE_CACHE is set and how many cache entries exist.
// Helps verify that V8 compile cache is working (2nd+ startup should be faster).
const compileCacheDir = process.env.NODE_COMPILE_CACHE;
if (compileCacheDir) {
  try {
    const entries = fs.readdirSync(compileCacheDir).filter((f) => !f.startsWith("."));
    logPhase(`compile cache: ${compileCacheDir} (${entries.length} entries)`);
    for (const e of entries) {
      const sub = path.join(compileCacheDir, e);
      if (fs.statSync(sub).isDirectory()) {
        const subEntries = fs.readdirSync(sub);
        logPhaseV(`  cache bucket: ${e} (${subEntries.length} files)`);
      }
    }
  } catch {
    logPhase(`compile cache: ${compileCacheDir} (not readable)`);
  }
} else {
  logPhase("compile cache: DISABLED (NODE_COMPILE_CACHE not set)");
}

// ── Hook CJS Module._load ──
const Module = require("module");
const origLoad = Module._load;

// ── Fix: Redirect openclaw/plugin-sdk to the already-loaded module ──
// Extensions use require("openclaw/plugin-sdk") as an external dependency.
// Without this hook, Node.js native require fails (no node_modules/openclaw/),
// causing jiti to fall back to its babel-transform pipeline. jiti's nested
// requires are NOT cached to disk, so the 17 MB plugin-sdk gets babel-
// transformed on EVERY startup (~12 s macOS, ~22 s Windows).
//
// This hook captures the absolute path of plugin-sdk when entry.js first
// loads it via require("./plugin-sdk/index.js"), then redirects all future
// require("openclaw/plugin-sdk") calls to that path. Since the module is
// already in Node's module cache, the redirect is free. jiti's native
// require succeeds → no fallback → no babel → instant extension loading.
//
// ── Optimization: Defer plugin-sdk evaluation ──
// entry.js has a "preload block" (Phase 2.6) that eagerly require()s the
// 15.2 MB plugin-sdk at startup just to warm require.cache. This costs ~2s
// per process on Windows. Since vendor extensions already have plugin-sdk
// inlined (Phase 0.5b), the monolithic plugin-sdk is only needed by third-
// party plugins. We intercept the preload's require(), set the path alias
// without evaluating the 15.2 MB file, and let real loading happen on-demand.
let pluginSdkResolvedPath = null;
let pluginSdkDir = null;
let pluginSdkPreloadSkipped = false;

// ── Proactive plugin-sdk path resolution + preload ──
// Phase 2.6 (entry.js preload) was removed to fix Electron CJS/ESM conflicts.
// Without it, no require("./plugin-sdk/index.js") fires to trigger the deferred
// loading hook below. Resolve the path eagerly here AND load it into
// require.cache so jiti skips its babel transform (~60s → ~2s).
try {
  const entryDir = path.dirname(process.argv[1] || "");
  const candidates = [
    path.join(entryDir, "dist", "plugin-sdk", "index.js"),   // production: vendor's original ESM
    path.join(entryDir, "plugin-sdk", "index.js"),            // if entry is already in dist/
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      pluginSdkResolvedPath = path.resolve(candidate);
      pluginSdkDir = path.dirname(pluginSdkResolvedPath);
      pluginSdkPreloadSkipped = true;
      // Actually load the module so it lands in require.cache.
      // This is CJS context (--require preload), no ESM/CJS conflict.
      const t0 = performance.now();
      logPhase(`plugin-sdk found at: ${pluginSdkResolvedPath}`);
      require(pluginSdkResolvedPath);
      const loadMs = (performance.now() - t0).toFixed(0);
      logPhase(`plugin-sdk preloaded into require.cache in ${loadMs}ms`);
      break;
    }
  }
} catch (e) {
  // Non-critical — the deferred hook will still try to capture the path
  logPhase(`plugin-sdk proactive preload FAILED: ${e.message}`);
}

const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveWithPluginSdk(
  request,
  parent,
  isMain,
  options,
) {
  if (pluginSdkResolvedPath) {
    if (request === "openclaw/plugin-sdk") {
      return pluginSdkResolvedPath;
    }
    if (request.startsWith("openclaw/plugin-sdk/")) {
      // e.g. "openclaw/plugin-sdk/account-id" → "<sdk-dir>/account-id"
      const subpath = request.slice("openclaw/plugin-sdk/".length);
      return origResolveFilename.call(
        this,
        path.join(pluginSdkDir, subpath),
        parent,
        isMain,
        options,
      );
    }
  }
  return origResolveFilename.call(this, request, parent, isMain, options);
};

Module._load = function timedLoad(request, parent, isMain) {
  requireCount++;
  const start = performance.now();

  // Capture plugin-sdk path from the first require("...plugin-sdk/index.js").
  // We do NOT skip the load — the module must land in require.cache so that
  // jiti finds it and returns immediately instead of running its slow babel
  // ESM→CJS transform on the 21 MB bundle (~60s on Windows).
  //
  // This runs in CJS context (--require preload), so there is no ESM/CJS
  // dual-loading conflict (the reason Phase 2.6 entry.js injection was removed).
  if (!pluginSdkPreloadSkipped && /plugin-sdk[/\\]index\.js$/.test(request)) {
    pluginSdkPreloadSkipped = true;
    try {
      pluginSdkResolvedPath = origResolveFilename.call(
        Module,
        request,
        parent,
        isMain,
      );
      pluginSdkDir = path.dirname(pluginSdkResolvedPath);
      logPhaseV(`plugin-sdk loading into require.cache: ${pluginSdkResolvedPath}`);
    } catch {
      // Non-critical — extensions will still load via jiti fallback
    }
    // Fall through to origLoad so the module is actually loaded and cached.
  }

  const result = origLoad.call(this, request, parent, isMain);
  const dur = performance.now() - start;
  requireTotalMs += dur;

  if (dur > 100) {
    const shortReq =
      request.length > 60 ? "..." + request.slice(-57) : request;
    logPhaseV(`require("${shortReq}") took ${dur.toFixed(0)}ms`);
  }
  return result;
};

// Log when the event loop starts processing (= all top-level ESM code done).
setImmediate(() => {
  logPhase(
    `event loop started (${requireCount} requires/${requireTotalMs.toFixed(0)}ms)`,
  );
});

// Log when the gateway starts listening (detect via stdout write)
const origStdoutWrite = process.stdout.write;
process.stdout.write = function (chunk, ...args) {
  const str = typeof chunk === "string" ? chunk : chunk.toString();
  if (str.includes("listening on") || str.includes("http server listening")) {
    logPhase("gateway listening (READY)");
    // Flush V8 compile cache to disk immediately. Critical on Windows where
    // the process is force-killed via `taskkill /T /F` — without an explicit
    // flush, V8 never writes the cache and every startup pays full parse cost.
    try {
      if (typeof Module.flushCompileCache === "function") {
        Module.flushCompileCache();
        logPhaseV("compile cache flushed to disk");
      }
    } catch {
      // Non-critical — cache will be written at next graceful exit (if any)
    }
  }
  return origStdoutWrite.call(this, chunk, ...args);
};

// Log at process exit for total lifetime
process.on("exit", () => {
  logPhaseV("process exiting");
});

// ── Low-overhead rolling performance samples ──
// Desktop consumes these internal lines without writing them to the user log.
// When OpenClaw emits a liveness warning, Desktop writes one bounded burst with
// the preceding 60 seconds and following 20 seconds of samples.
const performanceSamplerOwnerPid = process.env.RIVONCLAW_PERF_SAMPLER_OWNER_PID;
const ownsPerformanceSampler =
  !performanceSamplerOwnerPid || performanceSamplerOwnerPid === String(process.pid);
if (!performanceSamplerOwnerPid) {
  // Descendants inherit this marker and skip sampling, keeping the Desktop
  // ring buffer scoped to the root Gateway process.
  process.env.RIVONCLAW_PERF_SAMPLER_OWNER_PID = String(process.pid);
}

if (ownsPerformanceSampler) {
  try {
    const {
      constants: perfConstants,
      monitorEventLoopDelay,
      performance: perf,
      PerformanceObserver,
    } = require("perf_hooks");
    const samplePrefix = "[desktop-perf-sample] ";
    const configuredInterval = Number(process.env.RIVONCLAW_PERF_SAMPLE_INTERVAL_MS);
    const sampleIntervalMs = Number.isFinite(configuredInterval)
      ? Math.max(50, configuredInterval)
      : 5_000;
    const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
    let lastWallAt = performance.now();
    let lastCpuUsage = process.cpuUsage();
    let lastEventLoopUtilization = perf.eventLoopUtilization();
    let gcWindow = createGcWindow();

    function createGcWindow() {
      return {
        count: 0,
        totalMs: 0,
        maxMs: 0,
        minor: 0,
        major: 0,
        incremental: 0,
        weakCallback: 0,
        unknown: 0,
      };
    }

    function roundMetric(value, digits = 1) {
      if (!Number.isFinite(value)) return 0;
      const factor = 10 ** digits;
      return Math.round(value * factor) / factor;
    }

    const gcObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = Number(entry.duration) || 0;
        const kind = entry.detail?.kind;
        gcWindow.count++;
        gcWindow.totalMs += duration;
        gcWindow.maxMs = Math.max(gcWindow.maxMs, duration);
        if (kind === perfConstants.NODE_PERFORMANCE_GC_MINOR) gcWindow.minor++;
        else if (kind === perfConstants.NODE_PERFORMANCE_GC_MAJOR) gcWindow.major++;
        else if (kind === perfConstants.NODE_PERFORMANCE_GC_INCREMENTAL) gcWindow.incremental++;
        else if (kind === perfConstants.NODE_PERFORMANCE_GC_WEAKCB) gcWindow.weakCallback++;
        else gcWindow.unknown++;
      }
    });

    gcObserver.observe({ entryTypes: ["gc"] });
    eventLoopDelay.enable();
    eventLoopDelay.reset();

    const sampleTimer = setInterval(() => {
      const now = performance.now();
      const intervalMs = Math.max(1, now - lastWallAt);
      const cpuUsage = process.cpuUsage(lastCpuUsage);
      const currentEventLoopUtilization = perf.eventLoopUtilization();
      const eventLoopUtilization = perf.eventLoopUtilization(
        currentEventLoopUtilization,
        lastEventLoopUtilization,
      ).utilization;
      const memory = process.memoryUsage();
      const sample = {
        ts: Date.now(),
        intervalMs: roundMetric(intervalMs),
        cpu: {
          userMs: roundMetric(cpuUsage.user / 1_000),
          systemMs: roundMetric(cpuUsage.system / 1_000),
          coreRatio: roundMetric((cpuUsage.user + cpuUsage.system) / 1_000 / intervalMs, 3),
        },
        eventLoop: {
          utilization: roundMetric(eventLoopUtilization, 3),
          p99Ms: roundMetric(eventLoopDelay.percentile(99) / 1_000_000),
          maxMs: roundMetric(eventLoopDelay.max / 1_000_000),
        },
        memory: {
          rssBytes: memory.rss,
          heapUsedBytes: memory.heapUsed,
          externalBytes: memory.external,
          arrayBuffersBytes: memory.arrayBuffers ?? 0,
        },
        gc: {
          ...gcWindow,
          totalMs: roundMetric(gcWindow.totalMs),
          maxMs: roundMetric(gcWindow.maxMs),
        },
      };

      lastWallAt = now;
      lastCpuUsage = process.cpuUsage();
      lastEventLoopUtilization = currentEventLoopUtilization;
      gcWindow = createGcWindow();
      eventLoopDelay.reset();
      process.stderr.write(`${samplePrefix}${JSON.stringify(sample)}\n`);
    }, sampleIntervalMs);
    sampleTimer.unref();

    process.on("exit", () => {
      clearInterval(sampleTimer);
      eventLoopDelay.disable();
      gcObserver.disconnect();
    });
  } catch (error) {
    logPhaseV(`performance sampler unavailable: ${error.message}`);
  }
}
