#!/usr/bin/env node
// @ts-check
// Fast contract check for the packaged OpenClaw vendor runtime.
//
// This intentionally sits between "file exists" checks and full desktop E2E:
// it validates the final runtime payload shape and executes the workspace
// bootstrap path that depends on packaged templates.

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createRequire } = require("module");
const { pathToFileURL } = require("url");
const {
  DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS,
  STAGED_VENDOR_SOURCE_PLUGINS,
} = require("./vendor-runtime-plugin-inventory.cjs");

const repoRoot = path.resolve(__dirname, "..", "..", "..");

const REQUIRED_PATHS = [
  "openclaw.mjs",
  "package.json",
  "src/agents/templates/HEARTBEAT.md",
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
  ...STAGED_VENDOR_SOURCE_PLUGINS.map((plugin) => `dist-runtime/extensions/${plugin.id}/index.ts`),
  "node_modules/highlight.js/package.json",
  "node_modules/@larksuiteoapi/node-sdk/package.json",
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
      "  --skip-prune-checks  Do not fail when known-pruned packages are present",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {
    vendorDir: "",
    archivePath: "",
    skipPruneChecks: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
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
    .filter((name) => /^workspace[A-Za-z0-9_-]*\.js$/u.test(name))
    .sort();
  if (matches.length === 0) {
    throw new Error("missing dist/workspace*.js bundle");
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
    const platformPackageDir = path.dirname(path.join(vendorDir, SQLITE_VEC_PLATFORM_PACKAGE));
    const nativeExtension = fs
      .readdirSync(platformPackageDir, { withFileTypes: true })
      .find(
        (entry) =>
          entry.isFile() &&
          (entry.name.endsWith(".dylib") ||
            entry.name.endsWith(".so") ||
            entry.name.endsWith(".dll")),
      );
    if (!nativeExtension) {
      throw new Error(
        `sqlite-vec target package has no native extension: ${path.relative(vendorDir, platformPackageDir)}`,
      );
    }
    return;
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
}

function runNoHostPackageManagerStartupSmoke(vendorDir) {
  const configuredTimeout = Number(process.env.RIVONCLAW_VENDOR_RUNTIME_DOCTOR_TIMEOUT_MS);
  const timeout =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 90_000;
  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rivonclaw-no-npm-smoke-"));
  const smokeStateDir = path.join(smokeRoot, "state");
  const emptyBinDir = path.join(smokeRoot, "empty-bin");
  const configPath = path.join(smokeRoot, "openclaw.json");
  fs.mkdirSync(smokeStateDir, { recursive: true });
  fs.mkdirSync(emptyBinDir, { recursive: true });
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
          allow: DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS,
          entries: Object.fromEntries(
            DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS.map((pluginId) => [pluginId, { enabled: true }]),
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
        env: {
          ...process.env,
          CI: "1",
          HOME: smokeRoot,
          PATH: emptyBinDir,
          OPENCLAW_STATE_DIR: smokeStateDir,
          OPENCLAW_CONFIG_PATH: configPath,
          OPENCLAW_BUNDLED_PLUGINS_DIR: path.join(vendorDir, "dist-runtime", "extensions"),
        },
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
    if (/spawn\s+(?:npm(?:\.cmd)?|npx(?:\.cmd)?|pnpm(?:\.cmd)?)\b/iu.test(output)) {
      throw new Error(`OpenClaw attempted to use a host package manager:\n${output.slice(-4_000)}`);
    }
    if (!output.includes("Doctor complete")) {
      throw new Error(`OpenClaw doctor did not complete:\n${output.slice(-4_000)}`);
    }

    const listResult = spawnSync(
      process.execPath,
      [path.join(vendorDir, "openclaw.mjs"), "plugins", "list", "--json"],
      {
        encoding: "utf8",
        timeout,
        maxBuffer: 20 * 1024 * 1024,
        env: {
          ...process.env,
          CI: "1",
          HOME: smokeRoot,
          PATH: emptyBinDir,
          OPENCLAW_STATE_DIR: smokeStateDir,
          OPENCLAW_CONFIG_PATH: configPath,
          OPENCLAW_BUNDLED_PLUGINS_DIR: path.join(vendorDir, "dist-runtime", "extensions"),
        },
      },
    );
    const listOutput = `${listResult.stdout ?? ""}\n${listResult.stderr ?? ""}`;
    if (listResult.error) throw listResult.error;
    if (listResult.status !== 0) {
      throw new Error(
        `OpenClaw plugin inventory failed without a host package manager ` +
          `(status ${listResult.status}):\n${listOutput.slice(-4_000)}`,
      );
    }
    const inventory = JSON.parse(listResult.stdout || "{}");
    const plugins = Array.isArray(inventory) ? inventory : inventory.plugins;
    if (!Array.isArray(plugins)) {
      throw new Error(`OpenClaw plugin inventory returned unexpected JSON: ${listResult.stdout}`);
    }
    for (const pluginId of DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS) {
      const plugin = plugins.find((entry) => entry?.id === pluginId);
      if (!plugin) {
        throw new Error(`OpenClaw did not discover required bundled plugin ${pluginId}`);
      }
      if (plugin.status === "error") {
        throw new Error(
          `OpenClaw failed to load required bundled plugin ${pluginId}: ` +
            `${String(plugin.error ?? "unknown error")}`,
        );
      }
    }
  } finally {
    removeTempDirBestEffort(smokeRoot);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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

    if (!args.skipPruneChecks) {
      for (const relPath of PRUNED_FORBIDDEN_PATHS) {
        assertAbsent(vendorDir, relPath);
      }
      for (const entry of PRUNED_FORBIDDEN_CHILD_PREFIXES) {
        assertNoChildPrefix(vendorDir, entry);
      }
    }

    await runWorkspaceBootstrapSmoke(vendorDir);
    await runOpenClawAiRuntimeSmoke(vendorDir);
    await runSqliteVecRuntimeSmoke(vendorDir);
    runNoHostPackageManagerStartupSmoke(vendorDir);

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

module.exports = { removeTempDirBestEffort };
