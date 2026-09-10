import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { GatewayLauncher } from "../packages/gateway/dist/index.mjs";

const require = createRequire(import.meta.url);
const { resolveElectronPath } = require("./electron-runtime.cjs");
const repo = path.resolve(import.meta.dirname, "..");
const { values } = parseArgs({
  options: { vendor: { type: "string" }, archive: { type: "string" } },
});
assert(!(values.vendor && values.archive), "Choose a vendor directory or packaged archive");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gateway-lifecycle-"));
const stateDir = path.join(root, "state");
const pluginDir = path.join(root, "shutdown-probe");
let vendor = path.resolve(values.vendor || path.join(repo, "vendor/openclaw"));
if (values.archive) {
  vendor = path.join(root, "runtime");
  fs.mkdirSync(vendor);
  execFileSync("tar", ["-xf", path.resolve(values.archive), "-C", vendor]);
}
fs.mkdirSync(stateDir);
fs.mkdirSync(pluginDir);
const marker = path.join(root, "probe-ready");
const stopped = path.join(root, "probe-stopped");
const delayPath = path.join(root, "stop-delay");
fs.writeFileSync(
  path.join(pluginDir, "package.json"),
  JSON.stringify({
    name: "shutdown-probe",
    version: "1.0.0",
    type: "module",
    openclaw: { extensions: ["./index.js"] },
  }),
);
fs.writeFileSync(
  path.join(pluginDir, "openclaw.plugin.json"),
  JSON.stringify({
    id: "shutdown-probe",
    activation: { onCapabilities: ["hook"] },
    configSchema: { type: "object", properties: {}, additionalProperties: false },
  }),
);
fs.writeFileSync(
  path.join(pluginDir, "index.js"),
  `import fs from "node:fs";
export default { id: "shutdown-probe", register(api) {
  api.registerService({ id: "shutdown-probe", start() {
    fs.writeFileSync(${JSON.stringify(marker)}, String(process.pid));
  }, async stop() {
    await new Promise(resolve => setTimeout(resolve, Number(fs.readFileSync(${JSON.stringify(delayPath)}, "utf8"))));
    fs.writeFileSync(${JSON.stringify(stopped)}, String(process.pid));
  } });
} };`,
);
const configPath = path.join(root, "config.json");
fs.writeFileSync(
  configPath,
  JSON.stringify({
    gateway: {
      mode: "local",
      auth: { mode: "token", token: "isolated-lifecycle-test" },
      controlUi: { enabled: false },
    },
    agents: { defaults: { workspace: path.join(root, "workspace"), heartbeat: { every: "0m" } } },
    memory: { search: { enabled: false } },
    plugins: {
      allow: ["shutdown-probe"],
      load: { paths: [pluginDir] },
      entries: {
        "shutdown-probe": { enabled: true },
        "memory-core": { config: { dreaming: { enabled: false } } },
      },
    },
  }),
);
const listener = net.createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const launcher = new GatewayLauncher({
  entryPath: path.join(vendor, "openclaw.mjs"),
  nodeBin: resolveElectronPath(),
  configPath,
  stateDir,
  gatewayPort: port,
  maxRestarts: 1,
  env: {
    ELECTRON_RUN_AS_NODE: "1",
    HOME: root,
    USERPROFILE: root,
    APPDATA: root,
    LOCALAPPDATA: root,
    XDG_CONFIG_HOME: root,
    RIVONCLAW_HOME: root,
    TMPDIR: root,
    TMP: root,
    TEMP: root,
    NODE_OPTIONS: "",
    NODE_PATH: "",
    CI: "1",
    OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: "1",
  },
});
const results = [];
let lastExit;
launcher.on("stopped", (code, signal) => {
  lastExit = { code, signal };
});
launcher.on("error", (error) => console.error("Gateway lifecycle probe:", error.message));
try {
  // Three planned stops inside the breaker window must not create three
  // unclean boots. Six seconds also crosses the old Desktop's 5s kill budget.
  for (const delayMs of [3000, 6000, 3000]) {
    fs.rmSync(marker, { force: true });
    fs.rmSync(stopped, { force: true });
    fs.writeFileSync(delayPath, String(delayMs));
    await launcher.start();
    const pid = launcher.getStatus().pid;
    let ready = false;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/readyz`, {
          signal: AbortSignal.timeout(1000),
        });
        ready = response.ok && (await response.json()).ready === true && fs.existsSync(marker);
      } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(ready, "Gateway and test service must become ready");
    assert.equal(
      Number(fs.readFileSync(marker, "utf8")),
      pid,
      "No extra compile-cache supervisor may own Gateway",
    );
    const started = Date.now();
    await Promise.all([launcher.stop(), launcher.stop()]);
    assert.equal(lastExit.code, 0, "Planned shutdown must not be force-killed");
    assert.equal(Number(fs.readFileSync(stopped, "utf8")), pid, "Service cleanup must finish");
    assert.throws(() => process.kill(pid, 0), "The owned Gateway process must exit");
    const db = new DatabaseSync(path.join(stateDir, "state/openclaw.sqlite"), { readOnly: true });
    const boots = db
      .prepare(
        "SELECT pid, completed_at_ms, outcome FROM gateway_boot_lifecycle ORDER BY started_at_ms",
      )
      .all();
    db.close();
    assert.equal(boots.length, results.length + 1);
    assert(
      boots.every((boot) => boot.outcome === "clean_stop" && boot.completed_at_ms !== null),
      "All planned boots must complete, without tripping crash-loop suppression",
    );
    results.push({ delayMs, elapsedStopMs: Date.now() - started, outcome: lastExit.code });
  }
  console.log(
    "Gateway lifecycle contract passed:",
    JSON.stringify({ packaged: Boolean(values.archive), results }),
  );
} finally {
  if (launcher.getStatus().state !== "stopped") await launcher.stop();
  fs.rmSync(root, { recursive: true, force: true });
}
