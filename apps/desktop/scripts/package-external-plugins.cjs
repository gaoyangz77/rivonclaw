const fs = require("node:fs");
const path = require("node:path");
const { isBuiltin, createRequire } = require("node:module");
const ts = require("typescript");
const { resolvePackage, materializePluginDependencies, assertPluginDependencies } = require("./vendor-plugin-dependencies.cjs");

// Reviewed against each tsdown configuration and emitted bundle. These are
// build inputs, not packages that the standalone plugin loader must install.
const POLICIES = {
  "openclaw-weixin": { bundled: ["@tencent-weixin/openclaw-weixin"] },
  "@rivonclaw/rivonclaw-capability-manager": { bundled: ["@rivonclaw/plugin-sdk", "@rivonclaw/core"] },
  "@rivonclaw/rivonclaw-event-bridge": { bundled: ["@rivonclaw/plugin-sdk"] },
  "@rivonclaw/rivonclaw-mobile-chat-channel": {
    bundled: ["@rivonclaw/plugin-sdk", "@rivonclaw/logger", "ws"],
    // ws has tested pure-JS fallbacks; these are optional native accelerators.
    optionalImports: ["bufferutil", "utf-8-validate"],
  },
  "@rivonclaw/rivonclaw-search-browser-fallback": { bundled: ["@rivonclaw/plugin-sdk"] },
  "@rivonclaw/rivonclaw-cloud-tools": {
    bundled: ["@rivonclaw/plugin-sdk", "adm-zip"],
    copied: { "pdfjs-dist": ["pdfjs/pdf.mjs", "pdfjs/pdf.worker.mjs", "pdfjs/LICENSE"] },
    promoted: { "@napi-rs/canvas": "pdfjs-dist" },
  },
  "@rivonclaw/rivonclaw-cs": { bundled: ["@rivonclaw/plugin-sdk"] },
  "@rivonclaw/rivonclaw-ecom": { bundled: ["@rivonclaw/plugin-sdk"] },
  "@rivonclaw/rivonclaw-local-tools": { bundled: ["@rivonclaw/plugin-sdk"] },
};

function readManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
}

function packageName(specifier) {
  return specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/");
}

function requireLocalFile(root, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() ||
      !fs.realpathSync(file).startsWith(`${fs.realpathSync(root)}${path.sep}`)) {
    throw new Error(`Missing or escaping packaged plugin file: ${file}`);
  }
}

function scanBundleImports(pluginDir) {
  const imports = [];
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.[cm]?js$/.test(entry.name)) {
        requireLocalFile(pluginDir, file);
        const ast = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        function visit(node) {
          let specifier;
          if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
            specifier = node.moduleSpecifier;
          } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && /^(?:__)?require(?:\$\d+)?$/.test(node.expression.text)))) {
            specifier = node.arguments[0];
          }
          if (specifier && ts.isStringLiteralLike(specifier)) {
            const spec = specifier.text;
            if (spec.startsWith(".")) requireLocalFile(pluginDir, path.resolve(path.dirname(file), spec));
            else if (!isBuiltin(spec)) {
              let guarded = false;
              for (let parent = node.parent; parent; parent = parent.parent) {
                if (ts.isTryStatement(parent) && parent.catchClause && node.pos >= parent.tryBlock.pos && node.end <= parent.tryBlock.end) guarded = true;
              }
              imports.push({ specifier: spec, file, guarded });
            }
          }
          // Covers copied PDF.js and the worker URL used by import(moduleUrl).
          if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "URL" &&
              node.arguments?.length === 2 && ts.isStringLiteralLike(node.arguments[0]) &&
              node.arguments[0].text.startsWith(".") && node.arguments[1].getText(ast) === "import.meta.url") {
            requireLocalFile(pluginDir, path.resolve(path.dirname(file), node.arguments[0].text));
          }
          ts.forEachChild(node, visit);
        }
        visit(ast);
      }
    }
  }
  scan(path.join(pluginDir, "dist"));
  return imports;
}

function preparePluginManifest(sourceDir, pluginDir, vendorExports) {
  const source = readManifest(sourceDir);
  const policy = POLICIES[source.name];
  if (!policy) throw new Error(`Unreviewed packaged plugin: ${source.name}`);
  const manifest = structuredClone(source);
  const entries = source.openclaw?.extensions;
  if (!Array.isArray(entries) || !entries.length) throw new Error(`No runtime entries: ${source.name}`);
  for (const entry of entries) requireLocalFile(pluginDir, path.resolve(pluginDir, entry));
  const imports = scanBundleImports(pluginDir);
  const bundled = [...policy.bundled, ...Object.keys(policy.copied ?? {})];
  for (const name of bundled) {
    if (imports.some((item) => packageName(item.specifier) === name)) {
      throw new Error(`Claimed bundled dependency still imported: ${source.name} > ${name}`);
    }
    for (const file of policy.copied?.[name] ?? []) requireLocalFile(pluginDir, path.join(pluginDir, "dist", file));
    for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
      if (manifest[field]) delete manifest[field][name];
    }
  }
  const rootSources = {};
  for (const [name, owner] of Object.entries(policy.promoted ?? {})) {
    const ownerDir = resolvePackage(owner, sourceDir);
    if (!ownerDir) throw new Error(`Missing copied dependency source: ${owner}`);
    const ownerManifest = readManifest(ownerDir);
    const range = ownerManifest.dependencies?.[name] ?? ownerManifest.optionalDependencies?.[name];
    if (!range) throw new Error(`Missing declared external: ${owner} > ${name}`);
    rootSources[name] = resolvePackage(name, ownerDir);
    if (!rootSources[name]) throw new Error(`Missing installed external: ${name}`);
    manifest.dependencies ??= {};
    manifest.dependencies[name] = range;
  }
  for (const { specifier, file, guarded } of imports) {
    if (specifier.startsWith("openclaw/plugin-sdk/")) {
      if (!vendorExports[`./${specifier.slice("openclaw/".length)}`]) throw new Error(`Unexported OpenClaw SDK: ${specifier}`);
      continue;
    }
    if (policy.optionalImports?.includes(specifier) && guarded) continue;
    const name = packageName(specifier);
    if (!manifest.dependencies?.[name] && !manifest.optionalDependencies?.[name]) {
      throw new Error(`Undeclared packaged external: ${source.name} > ${specifier} (${file})`);
    }
  }
  // Do not turn future source dependencies into silent build-only exemptions.
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    if (!imports.some((item) => packageName(item.specifier) === name)) {
      throw new Error(`Unreviewed runtime dependency without emitted import: ${source.name} > ${name}`);
    }
  }
  return { manifest, rootSources, imports };
}

function packageExternalPlugins(resourcesDir, repoRoot, target = { platform: process.platform, arch: process.arch }) {
  const vendorExports = readManifest(path.join(repoRoot, "vendor", "openclaw")).exports;
  const results = [];
  for (const base of ["extensions", "extensions-merchant"]) {
    const root = path.join(resourcesDir, base);
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const pluginDir = path.join(root, entry.name);
      if (!entry.isDirectory() || !fs.existsSync(path.join(pluginDir, "openclaw.plugin.json"))) continue;
      const sourceDir = path.join(repoRoot, base, entry.name);
      const { manifest, rootSources, imports } = preparePluginManifest(sourceDir, pluginDir, vendorExports);
      fs.writeFileSync(path.join(pluginDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
      materializePluginDependencies(repoRoot, pluginDir, sourceDir, { rootSources, target });
      assertPluginDependencies(pluginDir, [pluginDir]);
      for (const { specifier, file, guarded } of imports) {
        if (specifier.startsWith("openclaw/plugin-sdk/")) continue;
        if (POLICIES[manifest.name].optionalImports?.includes(specifier) && guarded) continue;
        const resolved = createRequire(file).resolve(specifier);
        requireLocalFile(pluginDir, resolved);
      }
      results.push({ name: manifest.name, dependencies: Object.keys(manifest.dependencies ?? {}) });
    }
  }
  console.log(`[package-external-plugins] ${JSON.stringify(results)}`);
  return results;
}

module.exports = { preparePluginManifest, packageExternalPlugins, scanBundleImports };
