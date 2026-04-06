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
  if (str.includes("listening on")) {
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
