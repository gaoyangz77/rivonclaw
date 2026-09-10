const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { spawnSync } = require("node:child_process");
const { desktopDir, resolveElectronPath, readElectronVersions } = require("./electron-runtime.cjs");

function resolveSqliteDir(repoRoot) {
  const resolve = (dir) => fs.realpathSync(path.dirname(createRequire(path.join(repoRoot, dir, "package.json")).resolve("better-sqlite3/package.json")));
  const desktop = resolve("apps/desktop");
  const storage = resolve("packages/storage");
  if (desktop !== storage) throw new Error("Desktop and storage resolve different better-sqlite3 installations");
  const modules = fs.realpathSync(path.join(repoRoot, "node_modules"));
  if (!modules.startsWith(`${fs.realpathSync(repoRoot)}${path.sep}`)) throw new Error("Refusing shared node_modules outside this worktree");
  if (!desktop.startsWith(`${modules}${path.sep}`)) throw new Error(`Refusing to rebuild outside this worktree: ${desktop}`);
  return desktop;
}

function run(command, args, cwd) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit", timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Native build failed (exit ${result.status}): ${command} ${args.join(" ")}`);
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const sqliteDir = resolveSqliteDir(repoRoot);
  const desktopRequire = createRequire(path.join(desktopDir, "package.json"));
  const { getAbi } = await import(desktopRequire.resolve("node-abi"));
  const electronVersion = desktopRequire("electron/package.json").version;
  const electronAbi = getAbi(electronVersion, "electron");
  const runtime = readElectronVersions(resolveElectronPath());
  if (runtime.electron !== electronVersion || runtime.modules !== electronAbi) {
    throw new Error(`Electron package/binary/ABI mismatch: ${JSON.stringify(runtime)}`);
  }
  const sqliteVersion = JSON.parse(fs.readFileSync(path.join(sqliteDir, "package.json"), "utf8")).version;
  if (Number(sqliteVersion.split(".")[0]) >= 13) {
    // v13 includes N-API prebuilds in the npm tarball. Do not overwrite those
    // portable binaries with ABI-specific V8 builds or download extra artifacts.
    const smoke = path.join(__dirname, "verify-sqlite-native.cjs");
    run(process.execPath, ["--expose-gc", smoke, sqliteDir], repoRoot);
    const result = spawnSync(resolveElectronPath(), ["--expose-gc", smoke, sqliteDir], {
      cwd: repoRoot, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_OPTIONS: "", NODE_PATH: "" },
      stdio: "inherit", timeout: 120_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Electron N-API SQLite verification failed (exit ${result.status})`);
    return;
  }
  const platform = `${process.platform}-${process.arch}`;
  const binding = (abi) => path.join(sqliteDir, "lib/binding", `node-v${abi}-${platform}`, "better_sqlite3.node");
  const nodeBinding = binding(process.versions.modules);
  const electronBinding = binding(electronAbi);
  const buildDir = path.join(sqliteDir, "build");
  if (!process.argv.includes("--force") && fs.existsSync(nodeBinding) && fs.existsSync(electronBinding) && !fs.existsSync(buildDir)) {
    console.log(`[rebuild-native] Both exact ABI prebuilds exist: ${process.versions.modules}, ${electronAbi}`);
    return;
  }
  const rebuildEntry = desktopRequire.resolve("@electron/rebuild");
  const rebuildRequire = createRequire(rebuildEntry);
  const nodeGyp = rebuildRequire.resolve("node-gyp/bin/node-gyp.js");
  const copyBinding = (dest) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(buildDir, "Release/better_sqlite3.node"), dest);
  };
  fs.rmSync(buildDir, { recursive: true, force: true });
  run(process.execPath, [nodeGyp, "rebuild", "--release"], sqliteDir);
  copyBinding(nodeBinding);
  run(process.execPath, [path.join(path.dirname(rebuildEntry), "cli.js"), "-f", "-o", "better-sqlite3"], desktopDir);
  copyBinding(electronBinding);
  // bindings must choose lib/binding/node-v<ABI>, not the last build/Release.
  fs.rmSync(buildDir, { recursive: true, force: true });
  console.log(`[rebuild-native] Ready: Node ABI ${process.versions.modules}, Electron ABI ${electronAbi} (${platform})`);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { resolveSqliteDir, run };
