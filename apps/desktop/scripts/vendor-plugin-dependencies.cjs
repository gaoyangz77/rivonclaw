const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS } = require("./vendor-runtime-plugin-inventory.cjs");

function readManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
}

function assertWithin(root, target) {
  const real = fs.realpathSync(target);
  if (!real.startsWith(`${fs.realpathSync(root)}${path.sep}`)) {
    throw new Error(`Runtime dependency escapes vendor payload: ${target} -> ${real}`);
  }
  return real;
}

function resolvePackage(name, fromDir) {
  if (!/^(?:@[\w.-]+\/)?[\w.-]+$/.test(name)) throw new Error(`Invalid package name: ${name}`);
  const requireFrom = createRequire(path.join(fromDir, "package.json"));
  // A declared npm dependency can share a builtin name (for example buffer/).
  // Query a subpath so Node supplies package paths instead of builtin null.
  for (const parent of requireFrom.resolve.paths(`${name}/package.json`) ?? []) {
    const candidate = path.join(parent, name);
    if (fs.existsSync(path.join(candidate, "package.json"))) return fs.realpathSync(candidate);
  }
  return null;
}

function runtimeDependencies(manifest) {
  return Object.entries({ ...manifest.peerDependencies, ...manifest.dependencies, ...manifest.optionalDependencies })
    .filter(([name]) => name !== "openclaw")
    .map(([name, range]) => ({
      name, range,
      optional: Object.hasOwn(manifest.optionalDependencies ?? {}, name) ||
        (!Object.hasOwn(manifest.dependencies ?? {}, name) && manifest.peerDependenciesMeta?.[name]?.optional === true),
    }));
}

function assertVersion(name, range, dir) {
  // Reuse the installed semver implementation used by node-abi, not a partial
  // parser that could accept a wrong hoisted version after vendor pruning.
  const semver = createRequire(require.resolve("node-abi"))("semver");
  const version = readManifest(dir).version;
  if (!semver.validRange(range) || !semver.satisfies(version, range)) {
    throw new Error(`Runtime dependency ${name}@${version} does not satisfy ${range}`);
  }
}

function readDependencyLock(vendorDir) {
  const file = path.join(vendorDir, "pnpm-lock.yaml");
  if (!fs.existsSync(file)) return null;
  const yaml = createRequire(path.join(vendorDir, "package.json"))("yaml");
  const documents = yaml.parseAllDocuments(fs.readFileSync(file, "utf8"));
  for (const document of documents) {
    if (document.errors.length) throw document.errors[0];
  }
  // pnpm 11/12 puts its optional bootstrap lock first and the project lock
  // second. Never merge bootstrap resolutions into the runtime graph.
  const locks = documents.map((document) => document.toJS());
  const isBootstrap = (lock) => lock?.importers?.["."] &&
    ["configDependencies", "packageManagerDependencies"].some((key) => Object.hasOwn(lock.importers["."], key));
  const lock = locks.at(-1);
  if (locks.length < 1 || locks.length > 2 || (locks.length === 2 && !isBootstrap(locks[0])) ||
    isBootstrap(lock) || !lock?.snapshots || !lock?.importers) {
    throw new Error(`Invalid runtime dependency lockfile: ${file}`);
  }
  return lock;
}

function lockedDependencyRange(lock, vendorDir, parent, fromDir, name, range, source) {
  if (!lock) return range;
  const importer = lock.importers[path.relative(vendorDir, fromDir).replace(/\\/g, "/") || "."];
  const parentKey = `${parent.name}@${parent.version}`;
  const snapshots = importer ? [importer] : Object.entries(lock.snapshots)
    .filter(([key]) => key === parentKey || key.startsWith(`${parentKey}(`))
    .map(([, snapshot]) => snapshot);
  const references = snapshots.flatMap((snapshot) => {
    const reference = snapshot.optionalDependencies?.[name] ?? snapshot.dependencies?.[name];
    return reference === undefined ? [] : [typeof reference === "string" ? reference : reference.version];
  });
  if (!references.length) return range;

  const installed = readManifest(source);
  // Frozen lock edges already encode global/scoped overrides, npm aliases and
  // peer contexts. Validate those exact resolutions, not a second override parser.
  const locators = [installed.version, `${installed.name}@${installed.version}`];
  const matches = references.map((reference) => typeof reference === "string" &&
    locators.some((locator) => reference === locator || reference.startsWith(`${locator}(`)));
  const semver = createRequire(require.resolve("node-abi"))("semver");
  const satisfiesDeclared = semver.validRange(range) && semver.satisfies(installed.version, range);
  // A hoisted package may have several valid peer contexts. A lock-approved
  // version within the declared range needs no override exception. An out-of-
  // range replacement still requires unambiguous agreement across contexts.
  if (!matches.some(Boolean) || (!satisfiesDeclared && !matches.every(Boolean))) {
    throw new Error(`Locked runtime dependency ${parentKey} > ${name} expects ${references.join(", ")}, found ${installed.name}@${installed.version}`);
  }
  return satisfiesDeclared ? range : installed.version;
}

function writeEffectiveDependencyRanges(destination, edges) {
  const manifest = readManifest(destination);
  let changed = false;
  for (const { name, range } of edges) {
    for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
      if (Object.hasOwn(manifest[field] ?? {}, name) && manifest[field][name] !== range) {
        manifest[field][name] = range;
        changed = true;
      }
    }
  }
  if (changed) fs.writeFileSync(path.join(destination, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function selectedPluginDirs(vendorDir, ids = DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS) {
  return ids.flatMap((id) => ["dist", "dist-runtime"].map((base) => path.join(vendorDir, base, "extensions", id)))
    .filter((dir) => fs.existsSync(path.join(dir, "package.json")));
}

function isSelectedPluginNodeModules(vendorDir, dir, ids = DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS) {
  const match = /^(?:dist|dist-runtime)\/extensions\/([^/]+)\/node_modules$/.exec(path.relative(vendorDir, dir).replace(/\\/g, "/"));
  return !!match && ids.includes(match[1]);
}

function materializeSelectedPluginDependencies(vendorDir, ids = DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS) {
  const lock = readDependencyLock(vendorDir);
  for (const pluginDir of selectedPluginDirs(vendorDir, ids)) {
    const sourceDir = path.join(vendorDir, "extensions", path.basename(pluginDir));
    materializePluginDependencies(vendorDir, pluginDir, fs.existsSync(sourceDir) ? sourceDir : pluginDir, { lock });
  }
}

function materializePluginDependencies(vendorDir, pluginDir, sourceDir, { lock = null, rootSources = {}, target } = {}) {
    const id = path.basename(pluginDir);
    const rootModules = path.join(pluginDir, "node_modules");
    // Resolve the entire graph before replacing upstream's source-checkout
    // links. Physical private trees also work on Windows without symlink rights.
    const graph = new Map();
    function collect(manifest, fromDir) {
      return runtimeDependencies(manifest).flatMap(({ name, range, optional }) => {
        const source = (fromDir === sourceDir && rootSources[name]) || resolvePackage(name, fromDir);
        if (!source) {
          if (optional) return [];
          throw new Error(`Missing runtime dependency ${id}: ${name} from ${fromDir}`);
        }
        assertWithin(vendorDir, source);
        if (optional && target) {
          const pkg = readManifest(source);
          const matches = (values, value) => !values || (!values.includes(`!${value}`) &&
            (!values.some((item) => !item.startsWith("!")) || values.includes(value)));
          if (!matches(pkg.os, target.platform) || !matches(pkg.cpu, target.arch)) return [];
        }
        const effectiveRange = lockedDependencyRange(lock, vendorDir, manifest, fromDir, name, range, source);
        assertVersion(name, effectiveRange, source);
        if (!graph.has(source)) {
          graph.set(source, []);
          graph.set(source, collect(readManifest(source), source));
        }
        return [{ name, source, range: effectiveRange }];
      });
    }
    const roots = collect(readManifest(pluginDir), sourceDir);
    fs.rmSync(rootModules, { recursive: true, force: true });
    const placed = new Map();
    function place(edges, fromDir) {
      const pending = [];
      for (const { name, source } of edges) {
        const existing = resolvePackage(name, fromDir);
        if (existing && placed.get(existing) === source) continue;
        const hoisted = path.join(rootModules, name);
        const dest = fs.existsSync(hoisted) ? path.join(fromDir, "node_modules", name) : hoisted;
        if (placed.get(dest) === source) continue;
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.cpSync(source, dest, {
          recursive: true, dereference: true,
          filter: (file) => {
            if (["node_modules", ".git"].includes(path.basename(file))) return false;
            assertWithin(vendorDir, file);
            return true;
          },
        });
        writeEffectiveDependencyRanges(dest, graph.get(source));
        placed.set(fs.realpathSync(dest), source);
        pending.push([graph.get(source), dest]);
      }
      // Reserve siblings before hoisting their children, so a direct dependency
      // cannot overwrite a different transitive version placed at the same path.
      for (const [children, dest] of pending) place(children, dest);
    }
    place(roots, pluginDir);
    writeEffectiveDependencyRanges(pluginDir, roots);
    console.log(`[vendor-plugin-dependencies] ${path.relative(vendorDir, pluginDir)}: ${placed.size} packages`);
}

function assertSelectedPluginDependencies(vendorDir, ids = DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS) {
  assertPluginDependencies(vendorDir, selectedPluginDirs(vendorDir, ids));
}

function assertPluginDependencies(vendorDir, pluginDirs) {
  const visited = new Set();
  function visit(dir) {
    for (const { name, range, optional } of runtimeDependencies(readManifest(dir))) {
      const resolved = resolvePackage(name, dir);
      if (!resolved) {
        if (optional) continue;
        throw new Error(`Missing packaged runtime dependency ${name} from ${dir}`);
      }
      assertWithin(vendorDir, resolved);
      assertVersion(name, range, resolved);
      if (!visited.has(resolved)) {
        visited.add(resolved);
        visit(resolved);
      }
    }
  }
  for (const dir of pluginDirs) visit(dir);
}

function materializeSelectedPluginAssets(vendorDir, ids = DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS) {
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const source = assertWithin(vendorDir, file);
        if (!fs.statSync(source).isFile()) throw new Error(`Unexpected plugin directory symlink: ${file}`);
        const bytes = fs.readFileSync(source);
        fs.unlinkSync(file);
        fs.writeFileSync(file, bytes);
      } else if (entry.isDirectory()) visit(file);
    }
  }
  for (const dir of selectedPluginDirs(vendorDir, ids)) visit(dir);
}

function materializeRuntimeModuleLinks(vendorDir) {
  const overlays = path.join(vendorDir, "dist-runtime", "extensions");
  if (!fs.existsSync(overlays)) return;
  function visit(sourceDir, destinationDir) {
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const source = path.join(sourceDir, entry.name);
      const destination = path.join(destinationDir, entry.name);
      if (entry.isDirectory()) visit(source, destination);
      else if (/\.(?:cjs|mjs)$/.test(entry.name)) {
        assertWithin(vendorDir, source);
        let existing;
        try { existing = fs.lstatSync(destination); } catch (error) { if (error.code !== "ENOENT") throw error; }
        if (existing && !existing.isSymbolicLink()) continue;
        if (existing) {
          if (assertWithin(vendorDir, destination) !== fs.realpathSync(source)) {
            throw new Error(`Unexpected runtime module link: ${destination}`);
          }
          fs.unlinkSync(destination);
        }
        fs.mkdirSync(destinationDir, { recursive: true });
        fs.copyFileSync(source, destination);
      }
    }
  }
  // Upstream wraps .js files but symlinks .cjs/.mjs. Materialize their entire
  // local chunk set before generic link cleanup, including unselected plugins.
  for (const entry of fs.readdirSync(overlays, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    const source = path.join(vendorDir, "dist", "extensions", entry.name);
    if (fs.existsSync(source)) visit(source, path.join(overlays, entry.name));
  }
}

function assertBundledPluginEntries(vendorDir) {
  for (const base of ["dist", "dist-runtime"]) {
    const root = path.join(vendorDir, base, "extensions");
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const dir = path.join(root, entry.name);
      if (!entry.isDirectory() || !fs.existsSync(path.join(dir, "package.json"))) continue;
      const metadata = readManifest(dir).openclaw;
      for (const specifier of [...(metadata?.extensions ?? []), metadata?.setupEntry, metadata?.channel?.configuredState?.specifier].filter(Boolean)) {
        const file = path.resolve(dir, specifier);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
          throw new Error(`Missing retained plugin entry: ${base}/${entry.name}/${specifier}`);
        }
        assertWithin(dir, file);
      }
    }
  }
}

module.exports = {
  resolvePackage, runtimeDependencies, selectedPluginDirs, isSelectedPluginNodeModules,
  materializeSelectedPluginDependencies, assertSelectedPluginDependencies, materializeSelectedPluginAssets,
  materializePluginDependencies, assertPluginDependencies,
  materializeRuntimeModuleLinks, assertBundledPluginEntries,
};

if (require.main === module) {
  const vendorDir = path.resolve(process.argv[2] || path.join(__dirname, "../../../vendor/openclaw"));
  materializeRuntimeModuleLinks(vendorDir);
  assertBundledPluginEntries(vendorDir);
  console.log("[vendor-runtime] Built plugin entries verified within their package directories");
}
