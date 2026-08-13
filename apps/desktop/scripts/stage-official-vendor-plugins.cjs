// @ts-check
// Stages official external OpenClaw plugins from the pinned vendor checkout
// into dist-runtime so supported Desktop settings never require npm on a
// customer machine.

const fs = require("fs");
const path = require("path");
const { STAGED_VENDOR_SOURCE_PLUGINS } = require("./vendor-runtime-plugin-inventory.cjs");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const vendorDir = process.env.VENDOR_DIR_OVERRIDE
  ? path.resolve(process.env.VENDOR_DIR_OVERRIDE)
  : path.join(repoRoot, "vendor", "openclaw");
const vendorNodeModulesDir = path.join(vendorDir, "node_modules");
const OBSOLETE_STAGED_PLUGIN_DIRS = [
  "extensions/openclaw-groq-provider",
  "extensions/openclaw-lark",
  "dist-runtime/extensions/openclaw-lark",
];

function readPackageJson(packageDir) {
  return JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"));
}

function shouldCopyRuntimeFile(source, root) {
  const rel = path.relative(root, source).replace(/\\/g, "/");
  if (rel === "") return true;
  if (rel === "node_modules" || rel.startsWith("node_modules/")) return false;
  if (rel === ".git" || rel.startsWith(".git/")) return false;
  if (rel === ".cache" || rel.includes("/.cache/")) return false;
  if (rel === ".bin" || rel.includes("/.bin/")) return false;
  if (/^(?:README\.md|tsconfig\.json)$/iu.test(rel)) return false;
  if (/(?:^|\/)(?:test-api|.+\.(?:test|spec|live\.test))\.[cm]?[jt]sx?$/u.test(rel)) return false;
  return true;
}

function copyPackageContents(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    dereference: true,
    filter: (source) => shouldCopyRuntimeFile(source, sourceDir),
  });
}

function stageOpenClawSdkShim() {
  const targetRoot = path.join(vendorNodeModulesDir, "openclaw");
  fs.rmSync(targetRoot, { recursive: true, force: true });
  const sourceSdkDir = path.join(vendorDir, "dist", "plugin-sdk");
  const targetSdkDir = path.join(targetRoot, "dist", "plugin-sdk");
  fs.mkdirSync(targetSdkDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceSdkDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const sourceSpecifier = `../../../../dist/plugin-sdk/${entry.name}`;
    fs.writeFileSync(
      path.join(targetSdkDir, entry.name),
      `export * from ${JSON.stringify(sourceSpecifier)};\n`,
      "utf-8",
    );
  }

  fs.writeFileSync(
    path.join(targetRoot, "package.json"),
    JSON.stringify(
      {
        name: "openclaw",
        version: readPackageJson(vendorDir).version,
        type: "module",
        exports: {
          "./plugin-sdk": "./dist/plugin-sdk/index.js",
          "./plugin-sdk/*": "./dist/plugin-sdk/*.js",
        },
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
}

function stagePlugin(plugin) {
  const pluginSourceDir = path.join(vendorDir, "extensions", plugin.id);
  if (!fs.existsSync(path.join(pluginSourceDir, "package.json"))) {
    throw new Error(`Pinned vendor plugin source is missing: extensions/${plugin.id}`);
  }
  const pluginManifest = readPackageJson(pluginSourceDir);
  if (pluginManifest.name !== plugin.packageName) {
    throw new Error(
      `${plugin.id} package mismatch: expected ${plugin.packageName}, got ${pluginManifest.name}`,
    );
  }
  if (Object.keys(pluginManifest.dependencies ?? {}).length > 0) {
    throw new Error(
      `${plugin.packageName} gained runtime dependencies; update Desktop staging before release`,
    );
  }

  const pluginTargetDir = path.join(vendorDir, "dist-runtime", "extensions", plugin.id);
  copyPackageContents(pluginSourceDir, pluginTargetDir);
}

if (!fs.existsSync(vendorDir)) {
  throw new Error(`vendor/openclaw not found: ${vendorDir}`);
}
if (!fs.existsSync(path.join(vendorDir, "dist", "plugin-sdk"))) {
  throw new Error(
    `OpenClaw plugin SDK dist is missing: ${path.join(vendorDir, "dist", "plugin-sdk")}`,
  );
}

fs.mkdirSync(vendorNodeModulesDir, { recursive: true });
for (const relativeDir of OBSOLETE_STAGED_PLUGIN_DIRS) {
  fs.rmSync(path.join(vendorDir, relativeDir), { recursive: true, force: true });
}
stageOpenClawSdkShim();
for (const plugin of STAGED_VENDOR_SOURCE_PLUGINS) {
  stagePlugin(plugin);
}

console.log(
  `[stage-official-vendor-plugins] Staged ${STAGED_VENDOR_SOURCE_PLUGINS.length} ` +
    `pinned vendor plugin(s) into ${vendorDir}`,
);
