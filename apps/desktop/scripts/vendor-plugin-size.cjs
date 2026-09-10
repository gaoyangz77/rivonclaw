const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { selectedPluginDirs } = require("./vendor-plugin-dependencies.cjs");

const VENDOR_ARCHIVE_ENV = Object.freeze({ COPYFILE_DISABLE: "1" });

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

module.exports = { stripPrivateSourceMaps, stripSelectedPluginSourceMaps, deduplicateMirroredPluginDependencies, VENDOR_ARCHIVE_ENV };
