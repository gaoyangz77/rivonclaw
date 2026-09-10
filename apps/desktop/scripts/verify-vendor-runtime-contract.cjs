#!/usr/bin/env node
// @ts-check
// Fast contract check for the packaged OpenClaw vendor runtime.
//
// This intentionally sits between "file exists" checks and full desktop E2E:
// it validates the final runtime payload shape and executes the workspace
// bootstrap path that depends on packaged templates.

const { execFileSync, spawnSync, spawn } = require("child_process");
const http = require("node:http");
const net = require("node:net");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createRequire } = require("module");
const { pathToFileURL } = require("url");
const { resolveElectronPath } = require("../../../scripts/electron-runtime.cjs");
const { assertSelectedPluginDependencies, assertBundledPluginEntries } = require("./vendor-plugin-dependencies.cjs");
const {
  DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS,
  STAGED_VENDOR_SOURCE_PLUGINS,
} = require("./vendor-runtime-plugin-inventory.cjs");

const repoRoot = path.resolve(__dirname, "..", "..", "..");

const REQUIRED_PATHS = [
  "openclaw.mjs",
  "node-version.mjs",
  "package.json",
  "docs/reference/templates/AGENTS.md",
  "docs/reference/templates/BOOT.md",
  "docs/reference/templates/BOOTSTRAP.md",
  "docs/reference/templates/HEARTBEAT.md",
  "docs/reference/templates/IDENTITY.md",
  "docs/reference/templates/SOUL.md",
  "docs/reference/templates/TOOLS.md",
  "docs/reference/templates/USER.md",
  "dist/extensions/acpx/openclaw.plugin.json",
  "dist/extensions/memory-core/openclaw.plugin.json",
  ...DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS.map(
    (pluginId) => `dist-runtime/extensions/${pluginId}/openclaw.plugin.json`,
  ),
  ...STAGED_VENDOR_SOURCE_PLUGINS.map((plugin) => `dist-runtime/extensions/${plugin.id}/index.js`),
  "node_modules/highlight.js/package.json",
  "node_modules/@openclaw/ai/package.json",
  "node_modules/@openclaw/ai/dist/internal/runtime.mjs",
  "node_modules/openclaw/package.json",
  "node_modules/sqlite-vec/package.json",
];

const sqliteVecRuntimePlatform = process.platform === "win32" ? "windows" : process.platform;
const configuredMacRuntimeArch = process.env.RIVONCLAW_MAC_RUNTIME_ARCH;
const sqliteVecRuntimeArch =
  process.platform === "darwin" && ["x64", "arm64"].includes(configuredMacRuntimeArch)
    ? configuredMacRuntimeArch
    : process.arch;
const SQLITE_VEC_PLATFORM_PACKAGE =
  ["darwin", "linux", "windows"].includes(sqliteVecRuntimePlatform) &&
  ["x64", "arm64"].includes(sqliteVecRuntimeArch)
    ? `node_modules/sqlite-vec-${sqliteVecRuntimePlatform}-${sqliteVecRuntimeArch}/package.json`
    : "";
if (SQLITE_VEC_PLATFORM_PACKAGE) REQUIRED_PATHS.push(SQLITE_VEC_PLATFORM_PACKAGE);

const PRUNED_FORBIDDEN_PATHS = [
  "node_modules/@agentclientprotocol/claude-agent-acp",
  "node_modules/@anthropic-ai/claude-agent-sdk",
  "node_modules/@openai/codex",
  "node_modules/@tloncorp/tlon-skill",
  "node_modules/@zed-industries/codex-acp",
  "node_modules/@huggingface/transformers",
  "node_modules/@lancedb/lancedb",
  "node_modules/@microsoft/mxc-sdk",
  "node_modules/@openclaw/libterminal",
  "node_modules/ghostty-web",
  "node_modules/node-pty",
  "node_modules/onnxruntime-common",
  "node_modules/onnxruntime-node",
  "node_modules/onnxruntime-web",
  "extensions/copilot",
  "extensions/copilot-proxy",
  "extensions/github-copilot",
  "extensions/memory-lancedb",
  "extensions/mxc",
  "dist/extensions/copilot",
  "dist/extensions/copilot-proxy",
  "dist/extensions/github-copilot",
  "dist/extensions/memory-lancedb",
  "dist/extensions/mxc",
  "dist-runtime/extensions/copilot",
  "dist-runtime/extensions/copilot-proxy",
  "dist-runtime/extensions/github-copilot",
  "dist-runtime/extensions/memory-lancedb",
  "dist-runtime/extensions/mxc",
];

const PRUNED_FORBIDDEN_CHILD_PREFIXES = [
  { dir: "node_modules/@awesome.me", prefix: "webawesome" },
  { dir: "node_modules/@codemirror", prefix: "" },
  { dir: "node_modules/@github", prefix: "copilot" },
  { dir: "node_modules/@lancedb", prefix: "lancedb" },
  { dir: "node_modules/@lezer", prefix: "" },
  { dir: "node_modules/@typescript", prefix: "typescript-" },
];
const TRANSIENT_TEMP_CLEANUP_CODES = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);

function usage() {
  console.error(
    [
      "Usage:",
      "  node apps/desktop/scripts/verify-vendor-runtime-contract.cjs --vendor <vendor/openclaw>",
      "  node apps/desktop/scripts/verify-vendor-runtime-contract.cjs --archive <vendor-runtime.tar>",
      "",
      "Options:",
      "  --runtime <path>    Electron executable (defaults to explicitly provisioned Desktop Electron)",
      "  --resources <path>  Also verify packaged external plugins and Weixin QR RPCs",
      "  --static-only       Check payload shape only; never reports runtime PASS",
      "  --skip-prune-checks  Do not fail when known-pruned packages are present",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {
    vendorDir: "",
    archivePath: "",
    skipPruneChecks: false,
    runtime: "",
    resourcesDir: "",
    runtimeChild: false,
    staticOnly: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--resources") {
      if (!argv[index + 1]) throw new Error("--resources requires a directory");
      args.resourcesDir = path.resolve(argv[++index]);
      continue;
    }
    if (arg === "--runtime") {
      if (!argv[index + 1]) throw new Error("--runtime requires an executable path");
      args.runtime = path.resolve(argv[++index]);
      continue;
    }
    if (arg === "--runtime-child") { args.runtimeChild = true; continue; }
    if (arg === "--static-only") { args.staticOnly = true; continue; }
    if (arg === "--vendor") {
      args.vendorDir = path.resolve(argv[++index] ?? "");
      continue;
    }
    if (arg === "--archive") {
      args.archivePath = path.resolve(argv[++index] ?? "");
      continue;
    }
    if (arg === "--skip-prune-checks") {
      args.skipPruneChecks = true;
      continue;
    }
    usage();
    process.exit(2);
  }

  if (args.vendorDir && args.archivePath) {
    console.error("[verify-vendor-runtime] Use either --vendor or --archive, not both.");
    process.exit(2);
  }

  if (!args.vendorDir && !args.archivePath) {
    args.vendorDir = path.join(repoRoot, "vendor", "openclaw");
  }

  return args;
}

function assertExists(vendorDir, relPath) {
  const fullPath = path.join(vendorDir, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`missing required runtime path: ${relPath}`);
  }
}

function assertAbsent(vendorDir, relPath) {
  const fullPath = path.join(vendorDir, relPath);
  if (fs.existsSync(fullPath)) {
    throw new Error(`forbidden pruned path is present: ${relPath}`);
  }
}

function assertDesktopPluginInventory(vendorDir) {
  const vendorVersion = JSON.parse(
    fs.readFileSync(path.join(vendorDir, "package.json"), "utf8"),
  ).version;
  for (const pluginId of DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS) {
    const pluginDir = path.join(vendorDir, "dist-runtime", "extensions", pluginId);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginDir, "openclaw.plugin.json"), "utf8"),
    );
    const packageJson = JSON.parse(fs.readFileSync(path.join(pluginDir, "package.json"), "utf8"));
    if (manifest.id !== pluginId) {
      throw new Error(
        `bundled plugin id mismatch for ${pluginId}: manifest declares ${String(manifest.id)}`,
      );
    }
    if (packageJson.version !== vendorVersion) {
      throw new Error(
        `bundled plugin ${pluginId} version ${String(packageJson.version)} ` +
          `does not match OpenClaw ${String(vendorVersion)}`,
      );
    }
  }
}

function assertNoChildPrefix(vendorDir, { dir, prefix }) {
  const fullDir = path.join(vendorDir, dir);
  if (!fs.existsSync(fullDir)) return;
  const match = fs.readdirSync(fullDir).find((name) => name.startsWith(prefix));
  if (match) {
    throw new Error(`forbidden pruned path is present: ${path.posix.join(dir, match)}`);
  }
}

function extractArchive(archivePath) {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`archive not found: ${archivePath}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivonclaw-vendor-runtime-"));
  const tarFlags = archivePath.endsWith(".gz") ? "-xzf" : "-xf";
  execFileSync("tar", [tarFlags, archivePath, "-C", tempDir], { stdio: "inherit" });
  return tempDir;
}

function removeTempDirBestEffort(tempDir, remove = fs.rmSync) {
  try {
    remove(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    return true;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (!TRANSIENT_TEMP_CLEANUP_CODES.has(code)) {
      throw error;
    }
    console.warn(
      `[verify-vendor-runtime] WARN: could not remove temporary directory ${tempDir}: ${code}`,
    );
    return false;
  }
}

function findWorkspaceBundles(vendorDir) {
  const distDir = path.join(vendorDir, "dist");
  const entries = fs.readdirSync(distDir, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^workspace[A-Za-z0-9_-]*\.(?:js|mjs)$/u.test(name))
    .sort();
  if (matches.length === 0) {
    throw new Error("missing dist/workspace*.js or dist/workspace*.mjs bundle");
  }
  return matches.map((name) => path.join(distDir, name));
}

async function runWorkspaceBootstrapSmoke(vendorDir) {
  let ensureAgentWorkspace = null;
  for (const workspaceBundle of findWorkspaceBundles(vendorDir)) {
    const workspaceModule = await import(pathToFileURL(workspaceBundle).href);
    ensureAgentWorkspace = Object.values(workspaceModule).find(
      (value) => typeof value === "function" && value.name === "ensureAgentWorkspace",
    );
    if (ensureAgentWorkspace) break;
  }

  if (typeof ensureAgentWorkspace !== "function") {
    throw new Error("workspace bundle does not export ensureAgentWorkspace");
  }

  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivonclaw-workspace-smoke-"));
  try {
    await ensureAgentWorkspace({ dir: workspaceDir, ensureBootstrapFiles: true });

    for (const fileName of ["AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md", "BOOTSTRAP.md"]) {
      const filePath = path.join(workspaceDir, fileName);
      if (!fs.existsSync(filePath)) {
        throw new Error(`workspace bootstrap did not create ${fileName}`);
      }
    }
  } finally {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}

async function runOpenClawAiRuntimeSmoke(vendorDir) {
  const requireFromVendor = createRequire(path.join(vendorDir, "package.json"));
  const runtimePath = requireFromVendor.resolve("@openclaw/ai/internal/runtime");
  await import(pathToFileURL(runtimePath).href);
}

async function runSqliteVecRuntimeSmoke(vendorDir) {
  if (!SQLITE_VEC_PLATFORM_PACKAGE) {
    throw new Error(
      `sqlite-vec does not support runtime target ${sqliteVecRuntimePlatform}-${sqliteVecRuntimeArch}`,
    );
  }

  if (sqliteVecRuntimeArch !== process.arch) {
    throw new Error(`Cannot execute ${sqliteVecRuntimeArch} runtime checks using ${process.arch}; pass the target Electron executable`);
  }

  const requireFromVendor = createRequire(path.join(vendorDir, "package.json"));
  const sqliteVecPath = requireFromVendor.resolve("sqlite-vec");
  const sqliteVec = await import(pathToFileURL(sqliteVecPath).href);
  if (typeof sqliteVec.getLoadablePath !== "function") {
    throw new Error("sqlite-vec runtime did not export getLoadablePath");
  }
  const extensionPath = sqliteVec.getLoadablePath();
  if (!fs.existsSync(extensionPath)) {
    throw new Error(`sqlite-vec native extension is missing: ${extensionPath}`);
  }
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  try {
    const omitted = db.prepare("SELECT sqlite_compileoption_used('OMIT_LOAD_EXTENSION') AS omitted").get().omitted;
    if (omitted === 0) {
      const extensionDb = new DatabaseSync(":memory:", { allowExtension: true });
      try {
        extensionDb.loadExtension(extensionPath);
        extensionDb.prepare("SELECT vec_version() AS version").get();
      } finally { extensionDb.close(); }
    } else {
      console.log("[verify-vendor-runtime] SQLite extension loading disabled by Electron; using OpenClaw fallback");
    }
  } finally { db.close(); }
}

function isolatedEnvironment(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => {
    const key = name.toUpperCase();
    return !key.startsWith("OPENCLAW_") && !key.startsWith("FS_SAFE_") &&
      !["PATH", "NODE_OPTIONS", "NODE_PATH", "NODE_COMPILE_CACHE", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "XDG_CONFIG_HOME"].includes(key);
  }));
}

function assertNoLifecycleMarkers(vendorDir) {
  for (const marker of [".openclaw-lifecycle-pending", "dist/openclaw-install-guard"]) {
    assertAbsent(vendorDir, marker);
  }
}

async function runNodeRuntimeSmoke(vendorDir) {
  if (!process.versions.electron) throw new Error("Runtime contract must execute under Electron, not host Node");
  const contract = await import(pathToFileURL(path.join(vendorDir, "node-version.mjs")).href);
  if (typeof contract.isSupportedOpenClawNodeVersion !== "function" ||
      !contract.isSupportedOpenClawNodeVersion(process.versions.node)) {
    throw new Error(`Electron ${process.versions.electron} embeds unsupported Node ${process.versions.node}: ${contract.SUPPORTED_NODE_VERSIONS}`);
  }
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  try {
    const version = db.prepare("SELECT sqlite_version() AS version").get().version;
    const semver = createRequire(require.resolve("node-abi"))("semver");
    if (!semver.satisfies(version, ">=3.51.3 || >=3.50.7 <3.51.0 || >=3.44.6 <3.45.0")) {
      throw new Error(`Unsafe SQLite WAL runtime: ${version}`);
    }
    const value = "text-\u4e2d\ud83d\ude80\u0000tail";
    if (db.prepare("SELECT ? AS value").get(value).value !== value) throw new Error("node:sqlite TEXT roundtrip is lossy");
    console.log(`[verify-vendor-runtime] Electron ${process.versions.electron}, Node ${process.versions.node}, ABI ${process.versions.modules}, SQLite ${version}`);
  } finally { db.close(); }
}

const PACKAGE_MANAGER_ATTEMPT = /spawn\s+(?:npm(?:\.cmd)?|npx(?:\.cmd)?|pnpm(?:\.cmd)?)\b/iu;

function probeGatewayReady(port) {
  return new Promise((resolve) => {
    const request = http.get({ host: "127.0.0.1", port, path: "/readyz", timeout: 1000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try { resolve(response.statusCode === 200 && JSON.parse(body).ready === true); }
        catch { resolve(false); }
      });
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(false));
  });
}

async function runGatewayStartupSmoke(vendorDir, smokeRoot, env, timeout) {
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const assigned = server.address().port;
      server.close((error) => error ? reject(error) : resolve(assigned));
    });
  });
  const child = spawn(process.execPath, [path.join(vendorDir, "openclaw.mjs"), "gateway", "run", "--port", String(port), "--bind", "loopback"], {
    cwd: smokeRoot, stdio: ["ignore", "pipe", "pipe"],
    env: { ...env, OPENCLAW_NO_RESPAWN: "1", OPENCLAW_SKIP_CHANNELS: "1", OPENCLAW_DISABLE_BONJOUR: "1", OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: "1" },
  });
  let output = "";
  let spawnError;
  let exited = false;
  let packageManagerAttempt = false;
  const capture = (chunk) => {
    const text = String(chunk);
    packageManagerAttempt ||= PACKAGE_MANAGER_ATTEMPT.test(output.slice(-200) + text);
    output = (output + text).slice(-20_000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.once("error", (error) => { spawnError = error; });
  const closed = new Promise((resolve) => child.once("close", () => { exited = true; resolve(); }));
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitForClose = (ms) => new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    closed.then(() => { clearTimeout(timer); resolve(); });
  });
  try {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (exited) throw new Error(`Gateway exited before readiness (${child.exitCode}):\n${output}`);
      if (packageManagerAttempt) throw new Error(`Gateway attempted a host package manager:\n${output}`);
      if (await probeGatewayReady(port)) {
        if (packageManagerAttempt || exited) throw new Error(`Gateway failed while becoming ready:\n${output}`);
        console.log(`[verify-vendor-runtime] Gateway /readyz ready with empty PATH on port ${port}`);
        return;
      }
      await delay(200);
    }
    throw new Error(`Gateway readiness timed out after ${timeout}ms:\n${output}`);
  } finally {
    if (!exited) {
      child.kill("SIGTERM");
      await waitForClose(3000);
      if (!exited) child.kill("SIGKILL");
      await waitForClose(3000);
      if (!exited) throw new Error("Gateway smoke process did not exit after cleanup");
    }
  }
}

function packagedPluginInventory(resourcesDir) {
  if (!resourcesDir) return { ids: [], roots: [] };
  const roots = ["extensions", "extensions-merchant"].map((name) => path.join(resourcesDir, name))
    .filter((root) => fs.existsSync(root));
  const ids = roots.flatMap((root) => fs.readdirSync(root).flatMap((name) => {
    const file = path.join(root, name, "openclaw.plugin.json");
    return fs.existsSync(file) ? [JSON.parse(fs.readFileSync(file, "utf8")).id] : [];
  }));
  for (const id of ["openclaw-weixin", "rivonclaw-event-bridge", "rivonclaw-capability-manager", "rivonclaw-mobile-chat-channel", "rivonclaw-search-browser-fallback"]) {
    if (!ids.includes(id)) throw new Error(`Missing packaged external plugin ${id}`);
  }
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate packaged external plugin IDs");
  return { ids, roots };
}

function assertLoadedPluginInventory(inventory, ids, verifyWeixin = false) {
  const plugins = Array.isArray(inventory)
    ? inventory.map((entry) => ({ ...entry.plugin, gatewayMethods: entry.gatewayMethods }))
    : inventory.plugins;
  if (!Array.isArray(plugins)) throw new Error("OpenClaw plugin inventory returned unexpected JSON");
  for (const id of ids) {
    const plugin = plugins.find((entry) => entry?.id === id);
    if (!plugin) throw new Error(`OpenClaw did not discover required plugin ${id}`);
    if (plugin.status !== "loaded") throw new Error(`OpenClaw failed to load required plugin ${id}: ${plugin.error ?? "unknown error"}`);
  }
  if (verifyWeixin) {
    const methods = plugins.find((entry) => entry.id === "openclaw-weixin")?.gatewayMethods ?? [];
    for (const method of ["rivonclaw.weixin.login.start", "rivonclaw.weixin.login.wait"]) {
      if (!methods.includes(method)) throw new Error(`Missing Weixin QR RPC ${method}`);
    }
  }
}

async function runNoHostPackageManagerStartupSmoke(vendorDir, resourcesDir = "") {
  const external = packagedPluginInventory(resourcesDir);
  const requiredIds = [...DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS, ...external.ids];
  const configuredTimeout = Number(process.env.RIVONCLAW_VENDOR_RUNTIME_DOCTOR_TIMEOUT_MS);
  const timeout =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 90_000;
  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivonclaw-no-npm-smoke-"));
  const smokeStateDir = path.join(smokeRoot, "state");
  const emptyBinDir = path.join(smokeRoot, "empty-bin");
  const configPath = path.join(smokeRoot, "openclaw.json");
  fs.mkdirSync(smokeStateDir, { recursive: true });
  fs.mkdirSync(emptyBinDir, { recursive: true });
  const env = {
    ...isolatedEnvironment(), CI: "1", HOME: smokeRoot, USERPROFILE: smokeRoot,
    APPDATA: smokeRoot, LOCALAPPDATA: smokeRoot, XDG_CONFIG_HOME: smokeRoot,
    PATH: emptyBinDir, ELECTRON_RUN_AS_NODE: "1",
    OPENCLAW_STATE_DIR: smokeStateDir, OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_BUNDLED_PLUGINS_DIR: path.join(vendorDir, "dist-runtime", "extensions"),
    RIVONCLAW_PANEL_PORT: "1",
  };
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        gateway: {
          mode: "local",
          auth: { mode: "token", token: "runtime-contract-token" },
        },
        memory: { search: { enabled: false } },
        channels: {
          feishu: {
            accounts: {
              default: { appId: "cli_runtime_contract", appSecret: "not-a-real-secret" },
            },
          },
        },
        plugins: {
          allow: requiredIds,
          load: { paths: external.roots },
          entries: Object.fromEntries(
            requiredIds.map((pluginId) => [pluginId, { enabled: true, hooks: { allowConversationAccess: true } }]),
          ),
        },
      },
      null,
      2,
    ),
  );

  try {
    const result = spawnSync(
      process.execPath,
      [path.join(vendorDir, "openclaw.mjs"), "doctor", "--fix", "--non-interactive"],
      {
        encoding: "utf8",
        timeout,
        maxBuffer: 20 * 1024 * 1024,
        env,
      },
    );
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(
        `OpenClaw doctor failed without a host package manager (status ${result.status}):\n${output.slice(-4_000)}`,
      );
    }
    if (PACKAGE_MANAGER_ATTEMPT.test(output)) {
      throw new Error(`OpenClaw attempted to use a host package manager:\n${output.slice(-4_000)}`);
    }
    if (!output.includes("Doctor complete")) {
      throw new Error(`OpenClaw doctor did not complete:\n${output.slice(-4_000)}`);
    }

    const listResult = spawnSync(
      process.execPath,
      [path.join(vendorDir, "openclaw.mjs"), "plugins", "inspect", "--all", "--runtime", "--json"],
      {
        encoding: "utf8",
        timeout,
        maxBuffer: 20 * 1024 * 1024,
        env,
      },
    );
    const listOutput = `${listResult.stdout ?? ""}\n${listResult.stderr ?? ""}`;
    if (PACKAGE_MANAGER_ATTEMPT.test(listOutput)) throw new Error(`Plugin inspection attempted a host package manager:\n${listOutput}`);
    if (listResult.error) throw listResult.error;
    if (listResult.status !== 0) {
      throw new Error(
        `OpenClaw plugin inventory failed without a host package manager ` +
          `(status ${listResult.status}):\n${listOutput.slice(-4_000)}`,
      );
    }
    const inventory = JSON.parse(listResult.stdout || "{}");
    assertLoadedPluginInventory(inventory, requiredIds, external.ids.includes("openclaw-weixin"));
    console.log(`[verify-vendor-runtime] Loaded ${requiredIds.length} plugins (${external.ids.length} packaged external); Weixin QR RPCs ${external.ids.length ? "verified" : "not requested"}`);
    await runGatewayStartupSmoke(vendorDir, smokeRoot, env, timeout);
  } finally {
    removeTempDirBestEffort(smokeRoot);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.staticOnly && !args.runtimeChild) {
    const result = spawnSync(args.runtime || resolveElectronPath(), [__filename, ...process.argv.slice(2), "--runtime-child"], {
      stdio: "inherit", env: { ...isolatedEnvironment(), ELECTRON_RUN_AS_NODE: "1" },
      timeout: 600_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Electron runtime contract failed (exit ${result.status})`);
    return;
  }
  const extractedDir = args.archivePath ? extractArchive(args.archivePath) : "";
  const vendorDir = extractedDir || args.vendorDir;
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivonclaw-runtime-contract-state-"));
  const previousStateDir = process.env.OPENCLAW_STATE_DIR;
  const previousConfigPath = process.env.OPENCLAW_CONFIG_PATH;

  process.env.OPENCLAW_STATE_DIR = stateDir;
  process.env.OPENCLAW_CONFIG_PATH = path.join(stateDir, "openclaw.json");

  try {
    if (!fs.existsSync(vendorDir)) {
      throw new Error(`vendor runtime not found: ${vendorDir}`);
    }

    for (const relPath of REQUIRED_PATHS) {
      assertExists(vendorDir, relPath);
    }
    assertDesktopPluginInventory(vendorDir);
    assertNoLifecycleMarkers(vendorDir);
    assertSelectedPluginDependencies(vendorDir);
    assertBundledPluginEntries(vendorDir);
    findWorkspaceBundles(vendorDir);

    if (!args.skipPruneChecks) {
      for (const relPath of PRUNED_FORBIDDEN_PATHS) {
        assertAbsent(vendorDir, relPath);
      }
      for (const entry of PRUNED_FORBIDDEN_CHILD_PREFIXES) {
        assertNoChildPrefix(vendorDir, entry);
      }
    }

    if (args.staticOnly) {
      console.log(`[verify-vendor-runtime] STATIC ONLY ${vendorDir}; runtime checks not executed`);
      return;
    }
    await runNodeRuntimeSmoke(vendorDir);
    await runWorkspaceBootstrapSmoke(vendorDir);
    await runOpenClawAiRuntimeSmoke(vendorDir);
    await runSqliteVecRuntimeSmoke(vendorDir);
    await runNoHostPackageManagerStartupSmoke(vendorDir, args.resourcesDir);

    console.log(`[verify-vendor-runtime] PASS ${vendorDir}`);
  } finally {
    // Imported runtime modules can briefly retain SQLite/file handles on
    // Windows. Cleanup must not reverse an otherwise successful contract
    // check; the process exits immediately and the OS temp directory remains
    // eligible for later cleanup.
    removeTempDirBestEffort(stateDir);
    if (extractedDir) {
      removeTempDirBestEffort(extractedDir);
    }
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    if (previousConfigPath === undefined) {
      delete process.env.OPENCLAW_CONFIG_PATH;
    } else {
      process.env.OPENCLAW_CONFIG_PATH = previousConfigPath;
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      `[verify-vendor-runtime] FAIL: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}

module.exports = { removeTempDirBestEffort, findWorkspaceBundles, isolatedEnvironment, assertNoLifecycleMarkers, runNodeRuntimeSmoke, runGatewayStartupSmoke, runNoHostPackageManagerStartupSmoke, packagedPluginInventory, assertLoadedPluginInventory };
