import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { runGatewayStartupSmoke, isolatedEnvironment } = require("../scripts/verify-vendor-runtime-contract.cjs");

describe("isolated empty-PATH Gateway startup contract", () => {
  let root: string;
  let env: Record<string, string>;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "gateway-startup-contract-"));
    fs.mkdirSync(path.join(root, "empty-bin"));
    env = { ...isolatedEnvironment(), PATH: path.join(root, "empty-bin"), HOME: root, OPENCLAW_STATE_DIR: root };
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });
  function fixture(body: string) {
    fs.writeFileSync(path.join(root, "openclaw.mjs"), `
      import fs from "node:fs";
      import http from "node:http";
      fs.writeFileSync(process.env.OPENCLAW_STATE_DIR + "/pid", String(process.pid));
      const keys = Object.keys(process.env).filter(k => k.toUpperCase() === "PATH");
      if (keys.length !== 1 || fs.readdirSync(process.env.PATH).length !== 0) throw Error("PATH leak");
      const port = Number(process.argv[process.argv.indexOf("--port") + 1]);
      ${body}
    `);
  }
  function expectStopped() {
    const pid = Number(fs.readFileSync(path.join(root, "pid"), "utf8"));
    expect(() => process.kill(pid, 0)).toThrow();
  }

  it("waits for HTTP ready=true and stops its own Gateway child", async () => {
    fixture(`
      const server = http.createServer((req, res) => res.end(JSON.stringify({ready: req.url === "/readyz"})));
      server.listen(port, "127.0.0.1");
    `);
    await runGatewayStartupSmoke(root, root, env, 3000);
    expectStopped();
  });

  it("rejects a live but not-ready server and cleans up after the bounded timeout", async () => {
    fixture(`http.createServer((req, res) => res.end(JSON.stringify({ready: false}))).listen(port, "127.0.0.1");`);
    await expect(runGatewayStartupSmoke(root, root, env, 500)).rejects.toThrow("readiness timed out");
    expectStopped();
  });

  it("fails when Gateway exits before readiness", async () => {
    fixture("process.exit(42);");
    await expect(runGatewayStartupSmoke(root, root, env, 3000)).rejects.toThrow("exited before readiness (42)");
    expectStopped();
  });

  it("fails a package-manager repair attempt even when the server becomes ready", async () => {
    fixture(`console.error("spawn npm ENOENT"); http.createServer((req, res) => res.end('{"ready":true}')).listen(port, "127.0.0.1");`);
    await expect(runGatewayStartupSmoke(root, root, env, 3000)).rejects.toThrow("package manager");
    expectStopped();
  });
});
