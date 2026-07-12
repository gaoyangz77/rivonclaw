#!/usr/bin/env node
// @ts-check
// Fast contract check for the packaged OpenClaw vendor runtime.
//
// This intentionally sits between "file exists" checks and full desktop E2E:
// it validates the final runtime payload shape and executes the workspace
// bootstrap path that depends on packaged templates.

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

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
  "extensions/openclaw-lark/openclaw.plugin.json",
  "node_modules/highlight.js/package.json",
  "node_modules/@larksuiteoapi/node-sdk/package.json",
  "node_modules/openclaw/package.json",
];

const PRUNED_FORBIDDEN_PATHS = [
  "node_modules/@agentclientprotocol/claude-agent-acp",
  "node_modules/@anthropic-ai/claude-agent-sdk",
  "node_modules/@openai/codex",
  "node_modules/@tloncorp/tlon-skill",
  "node_modules/@zed-industries/codex-acp",
];

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

function extractArchive(archivePath) {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`archive not found: ${archivePath}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivonclaw-vendor-runtime-"));
  const tarFlags = archivePath.endsWith(".gz") ? "-xzf" : "-xf";
  execFileSync("tar", [tarFlags, archivePath, "-C", tempDir], { stdio: "inherit" });
  return tempDir;
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
  await ensureAgentWorkspace({ dir: workspaceDir, ensureBootstrapFiles: true });

  for (const fileName of ["AGENTS.md", "SOUL.md", "TOOLS.md", "BOOTSTRAP.md"]) {
    const filePath = path.join(workspaceDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`workspace bootstrap did not create ${fileName}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const extractedDir = args.archivePath ? extractArchive(args.archivePath) : "";
  const vendorDir = extractedDir || args.vendorDir;

  if (!fs.existsSync(vendorDir)) {
    throw new Error(`vendor runtime not found: ${vendorDir}`);
  }

  for (const relPath of REQUIRED_PATHS) {
    assertExists(vendorDir, relPath);
  }

  if (!args.skipPruneChecks) {
    for (const relPath of PRUNED_FORBIDDEN_PATHS) {
      assertAbsent(vendorDir, relPath);
    }
  }

  await runWorkspaceBootstrapSmoke(vendorDir);

  console.log(`[verify-vendor-runtime] PASS ${vendorDir}`);
}

main().catch((error) => {
  console.error(
    `[verify-vendor-runtime] FAIL: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
