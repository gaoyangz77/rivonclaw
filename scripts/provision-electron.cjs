const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { electronPackageDir, resolveElectronPath, readElectronVersions } = require("./electron-runtime.cjs");

function provisionElectron() {
  const packageDir = electronPackageDir();
  const version = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8")).version;
  let binary;
  try { binary = resolveElectronPath(packageDir); } catch {
    console.log(`[provision-electron] Installing Electron ${version} explicitly`);
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(process.execPath, [path.join(packageDir, "install.js")], { env, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Electron installation failed (${result.status})`);
    binary = resolveElectronPath(packageDir);
  }
  const versions = readElectronVersions(binary);
  if (versions.electron !== version) throw new Error(`Electron binary ${versions.electron} != package ${version}`);
  console.log(`[provision-electron] Electron ${versions.electron}, Node ${versions.node}, ABI ${versions.modules}: ${binary}`);
}

if (require.main === module) {
  try { provisionElectron(); } catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = { provisionElectron };
