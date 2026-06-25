// @ts-check
// Stages official external OpenClaw plugins into vendor/openclaw so they are
// packaged as runtime assets, not as Electron app dependencies.

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const vendorDir = process.env.VENDOR_DIR_OVERRIDE
  ? path.resolve(process.env.VENDOR_DIR_OVERRIDE)
  : path.join(repoRoot, "vendor", "openclaw");
const vendorNodeModulesDir = path.join(vendorDir, "node_modules");
const rootRequire = createRequire(path.join(repoRoot, "package.json"));

const OFFICIAL_PLUGINS = [
  {
    packageName: "@larksuite/openclaw-lark",
    version: "2026.6.10",
    targetDirName: "openclaw-lark",
  },
];

function splitPackageName(packageName) {
  const parts = packageName.split("/");
  return packageName.startsWith("@")
    ? { scope: parts[0], name: parts[1] }
    : { scope: null, name: parts[0] };
}

function packagePathFromNodeModules(nodeModulesDir, packageName) {
  const { scope, name } = splitPackageName(packageName);
  return scope
    ? path.join(nodeModulesDir, scope, name)
    : path.join(nodeModulesDir, name);
}

function packageNodeModulesDir(packageDir, packageName) {
  const { scope } = splitPackageName(packageName);
  return scope ? path.dirname(path.dirname(packageDir)) : path.dirname(packageDir);
}

function readPackageJson(packageDir) {
  return JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"));
}

function resolvePackageDir(packageName, searchNodeModulesDirs) {
  for (const nodeModulesDir of searchNodeModulesDirs) {
    const candidate = packagePathFromNodeModules(nodeModulesDir, packageName);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return fs.realpathSync(candidate);
    }
  }

  const rootSearchPaths = rootRequire.resolve.paths(packageName) ?? [];
  for (const nodeModulesDir of rootSearchPaths) {
    const candidate = packagePathFromNodeModules(nodeModulesDir, packageName);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return fs.realpathSync(candidate);
    }
  }

  throw new Error(`Could not resolve package directory for ${packageName}`);
}

function shouldCopyRuntimeFile(source, root) {
  const rel = path.relative(root, source).replace(/\\/g, "/");
  if (rel === "") return true;
  if (rel === "node_modules" || rel.startsWith("node_modules/")) return false;
  if (rel === ".git" || rel.startsWith(".git/")) return false;
  if (rel === ".cache" || rel.includes("/.cache/")) return false;
  if (rel === ".bin" || rel.includes("/.bin/")) return false;
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

function copyDependencyTree(packageName, sourceSearchDirs, copied = new Set()) {
  if (packageName === "openclaw") return;
  if (copied.has(packageName)) return;
  copied.add(packageName);

  const sourceDir = resolvePackageDir(packageName, sourceSearchDirs);
  const targetDir = packagePathFromNodeModules(vendorNodeModulesDir, packageName);
  copyPackageContents(sourceDir, targetDir);

  const manifest = readPackageJson(sourceDir);
  const childSearchDirs = [
    packageNodeModulesDir(sourceDir, packageName),
    ...sourceSearchDirs,
  ];

  for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
    copyDependencyTree(dependencyName, childSearchDirs, copied);
  }
  for (const dependencyName of Object.keys(manifest.optionalDependencies ?? {})) {
    try {
      copyDependencyTree(dependencyName, childSearchDirs, copied);
    } catch (err) {
      console.warn(
        `[stage-official-vendor-plugins] Optional dependency ${dependencyName} was not staged: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
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
  const pluginSourceDir = resolvePackageDir(plugin.packageName, rootRequire.resolve.paths(plugin.packageName) ?? []);
  const pluginManifest = readPackageJson(pluginSourceDir);
  if (pluginManifest.version !== plugin.version) {
    throw new Error(
      `${plugin.packageName} version mismatch: expected ${plugin.version}, got ${pluginManifest.version}`,
    );
  }

  const pluginTargetDir = path.join(vendorDir, "extensions", plugin.targetDirName);
  copyPackageContents(pluginSourceDir, pluginTargetDir);
  patchPluginRuntime(plugin, pluginTargetDir);

  const sourceSearchDirs = [packageNodeModulesDir(pluginSourceDir, plugin.packageName)];
  for (const dependencyName of Object.keys(pluginManifest.dependencies ?? {})) {
    copyDependencyTree(dependencyName, sourceSearchDirs);
  }
}

function patchPluginRuntime(plugin, pluginTargetDir) {
  if (plugin.packageName !== "@larksuite/openclaw-lark") return;

  const versionHelperPath = path.join(pluginTargetDir, "src", "core", "version.js");
  if (!fs.existsSync(versionHelperPath)) return;

  fs.writeFileSync(
    versionHelperPath,
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "",
      "let cachedVersion;",
      "",
      "function getPluginVersion() {",
      "  if (cachedVersion) return cachedVersion;",
      "  try {",
      "    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');",
      "    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));",
      "    cachedVersion = pkg.version || 'unknown';",
      "  } catch {",
      "    cachedVersion = 'unknown';",
      "  }",
      "  return cachedVersion;",
      "}",
      "",
      "function getPlatform() {",
      "  if (process.platform === 'darwin') return 'mac';",
      "  if (process.platform === 'win32') return 'windows';",
      "  return 'linux';",
      "}",
      "",
      "function getUserAgent() {",
      "  return `openclaw-lark/${getPluginVersion()}/${getPlatform()}`;",
      "}",
      "",
      "module.exports = { getPluginVersion, getPlatform, getUserAgent };",
      "",
    ].join("\n"),
    "utf-8",
  );

  const tokenStorePath = path.join(pluginTargetDir, "src", "core", "token-store.js");
  if (fs.existsSync(tokenStorePath)) {
    const original = fs.readFileSync(tokenStorePath, "utf-8");
    const patched = original.replace(
      "const _require = (0, node_module_1.createRequire)(typeof __filename !== 'undefined' ? __filename : import.meta.url);",
      "const _require = (0, node_module_1.createRequire)(__filename);",
    );
    fs.writeFileSync(tokenStorePath, patched, "utf-8");
  }
}

if (!fs.existsSync(vendorDir)) {
  throw new Error(`vendor/openclaw not found: ${vendorDir}`);
}
if (!fs.existsSync(path.join(vendorDir, "dist", "plugin-sdk"))) {
  throw new Error(`OpenClaw plugin SDK dist is missing: ${path.join(vendorDir, "dist", "plugin-sdk")}`);
}

fs.mkdirSync(vendorNodeModulesDir, { recursive: true });
stageOpenClawSdkShim();
for (const plugin of OFFICIAL_PLUGINS) {
  stagePlugin(plugin);
}

console.log(
  `[stage-official-vendor-plugins] Staged ${OFFICIAL_PLUGINS.length} official plugin(s) into ${vendorDir}`,
);
