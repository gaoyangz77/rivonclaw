const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { selectedPluginDirs } = require("./vendor-plugin-dependencies.cjs");

const VENDOR_ARCHIVE_ENV = Object.freeze({ COPYFILE_DISABLE: "1" });
const BUILD_CACHE_DIRS = new Set([".experimental-vitest-cache", ".vitest", ".vite", ".turbo"]);

function privateFiles(root) {
  const files = [];
  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    if (fs.lstatSync(dir).isSymbolicLink()) throw new Error(`Private runtime directory is a symlink: ${dir}`);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  visit(root);
  return files;
}

function stripPrivateSourceMaps(root) {
  let files = 0;
  let bytes = 0;
  for (const file of privateFiles(root)) {
    if (!/\.(?:[cm]?js|[cm]?tsx?)\.map$/.test(file)) continue;
    let map;
    try { map = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    if (map?.version !== 3 || !(Array.isArray(map.sections) ||
        (Array.isArray(map.sources) && typeof map.mappings === "string"))) continue;
    bytes += fs.statSync(file).size;
    fs.unlinkSync(file);
    files++;
  }
  return { files, bytes };
}

function stripSelectedPluginSourceMaps(vendorDir) {
  const total = { files: 0, bytes: 0 };
  for (const pluginDir of selectedPluginDirs(vendorDir)) {
    const removed = stripPrivateSourceMaps(path.join(pluginDir, "node_modules"));
    total.files += removed.files;
    total.bytes += removed.bytes;
  }
  return total;
}

function stripRuntimeDevelopmentFiles(root) {
  let files = 0;
  let bytes = 0;
  for (const file of privateFiles(root)) {
    // Keep executable TS, assets and licenses. Declarations and explicit test
    // modules are not runtime entries, including inside private dependency trees.
    const cached = path.relative(root, file).split(path.sep).some((part) => BUILD_CACHE_DIRS.has(part));
    if (!cached && !/(?:\.d\.[cm]?ts|\.(?:test|spec)\.[cm]?[jt]sx?)$/.test(file)) continue;
    bytes += fs.statSync(file).size;
    fs.unlinkSync(file);
    files++;
  }
  return { files, bytes };
}

function deduplicateRuntimeDependencies(vendorDir) {
  const roots = [path.join(vendorDir, "node_modules"),
    ...selectedPluginDirs(vendorDir).map((dir) => path.join(dir, "node_modules"))];
  const files = roots.flatMap(privateFiles);
  const inodes = new Map();
  const records = files.map((file) => {
    const stat = fs.statSync(file);
    const inode = `${stat.dev}:${stat.ino}`;
    inodes.set(inode, (inodes.get(inode) ?? 0) + 1);
    return { file, stat, inode };
  });
  const manifests = new Map();
  const remaining = new Map(inodes);
  const candidates = new Map();
  const result = { linkedFiles: 0, savedBytes: 0, skippedExternalLinks: 0 };
  for (const { file, stat, inode } of records) {
    if (!stat.size) continue;
    // Do not share native binaries that platform signing may modify later.
    if (/\.(?:node|dylib|dll|exe|so|bare|bundle)$/.test(file)) continue;
    if (stat.nlink !== inodes.get(inode)) { result.skippedExternalLinks++; continue; }
    const parts = file.split(path.sep);
    const start = parts.lastIndexOf("node_modules") + 1;
    const end = start + (parts[start]?.startsWith("@") ? 2 : 1);
    const packageDir = parts.slice(0, end).join(path.sep);
    if (!manifests.has(packageDir)) {
      const manifest = path.join(packageDir, "package.json");
      manifests.set(packageDir, fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, "utf8")) : null);
    }
    const manifest = manifests.get(packageDir);
    if (!manifest?.name || !manifest.version) continue;
    const key = JSON.stringify([manifest.name, manifest.version, parts.slice(end), stat.size,
      stat.mode, stat.uid, stat.gid]);
    const peers = candidates.get(key) ?? [];
    const source = peers.find((peer) => fs.readFileSync(peer).equals(fs.readFileSync(file)));
    if (!source) { peers.push(file); candidates.set(key, peers); continue; }
    const current = fs.statSync(source);
    if (current.dev === stat.dev && current.ino === stat.ino) continue;
    const temporary = `${file}.rivonclaw-hardlink-${randomUUID()}`;
    try {
      fs.linkSync(source, temporary);
      fs.renameSync(temporary, file);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
    result.linkedFiles++;
    // An existing mirrored inode only frees storage after its final path moves.
    remaining.set(inode, remaining.get(inode) - 1);
    if (remaining.get(inode) === 0) result.savedBytes += stat.size;
  }
  console.log(`[vendor-dependency-dedup] ${JSON.stringify(result)}`);
  return result;
}

function deduplicateMirroredPluginDependencies(vendorDir) {
  const result = { linkedFiles: 0, savedBytes: 0, savedAllocatedBytes: 0, alreadyLinked: 0, skippedMetadata: 0 };
  const canonicalRoot = path.join(vendorDir, "dist", "extensions");
  for (const pluginDir of selectedPluginDirs(vendorDir)) {
    if (path.dirname(pluginDir) !== canonicalRoot) continue;
    const sourceRoot = path.join(pluginDir, "node_modules");
    const destinationRoot = path.join(vendorDir, "dist-runtime", "extensions", path.basename(pluginDir), "node_modules");
    if (!fs.existsSync(destinationRoot)) continue;
    // Collect through directory entries, never through symlinks. Sharing is
    // limited to the same plugin and relative path; module resolution is unchanged.
    const destinations = new Set(privateFiles(destinationRoot));
    for (const source of privateFiles(sourceRoot)) {
      const destination = path.join(destinationRoot, path.relative(sourceRoot, source));
      if (!destinations.has(destination)) continue;
      const a = fs.statSync(source);
      const b = fs.statSync(destination);
      if (a.dev === b.dev && a.ino === b.ino) { result.alreadyLinked++; continue; }
      if (!a.size || a.size !== b.size) continue;
      // Do not change ownership, executable bits, or a pre-existing sharing
      // arrangement outside this pair of immutable packaged dependency trees.
      if (a.mode !== b.mode || a.uid !== b.uid || a.gid !== b.gid || a.nlink !== 1 || b.nlink !== 1) {
        result.skippedMetadata++;
        continue;
      }
      if (!fs.readFileSync(source).equals(fs.readFileSync(destination))) continue;
      const temporary = `${destination}.rivonclaw-hardlink-${randomUUID()}`;
      try {
        fs.linkSync(source, temporary);
        fs.renameSync(temporary, destination);
      } catch (error) {
        throw new Error(`Cannot hardlink mirrored runtime file ${destination}: ${error.message}`, { cause: error });
      } finally {
        fs.rmSync(temporary, { force: true });
      }
      result.linkedFiles++;
      result.savedBytes += b.size;
      result.savedAllocatedBytes += b.blocks * 512;
    }
  }
  console.log(`[vendor-plugin-size] ${JSON.stringify(result)}`);
  return result;
}

module.exports = { stripPrivateSourceMaps, stripSelectedPluginSourceMaps, stripRuntimeDevelopmentFiles,
  deduplicateMirroredPluginDependencies, deduplicateRuntimeDependencies, VENDOR_ARCHIVE_ENV };
