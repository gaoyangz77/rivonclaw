const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");

const desktopDir = path.resolve(__dirname, "../apps/desktop");

function electronPackageDir(fromDir = desktopDir) {
  return path.dirname(createRequire(path.join(fromDir, "package.json")).resolve("electron/package.json"));
}

// Electron 42's main export can download a binary. Read path.txt instead so
// verification and build-cache warmup never acquire software implicitly.
function resolveElectronPath(packageDir = electronPackageDir()) {
  const marker = path.join(packageDir, "path.txt");
  if (!fs.existsSync(marker)) {
    throw new Error("Electron is not provisioned; run node scripts/provision-electron.cjs first");
  }
  const relative = fs.readFileSync(marker, "utf8").trim();
  const dist = path.join(packageDir, "dist");
  const binary = path.resolve(dist, relative);
  if (!relative || path.isAbsolute(relative) || !binary.startsWith(`${dist}${path.sep}`) || !fs.existsSync(binary)) {
    throw new Error(`Invalid or missing Electron binary: ${binary}`);
  }
  return binary;
}

function readElectronVersions(binary) {
  return JSON.parse(execFileSync(binary, ["-p", "JSON.stringify(process.versions)"], {
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_OPTIONS: "", NODE_PATH: "" },
  }).trim());
}

module.exports = { desktopDir, electronPackageDir, resolveElectronPath, readElectronVersions };
