import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const RUNNER = fileURLToPath(
  new URL("../scripts/run-vendor-production-install.cjs", import.meta.url),
);
const DONE = "Done in 0.1s using pnpm v12.3.4";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A throwaway install: a node script in its own directory. */
function fakeInstall(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "rivonclaw-vendor-install-"));
  tempDirs.push(dir);
  const script = join(dir, "fake-pnpm.cjs");
  writeFileSync(script, source);
  return { dir, script, workerPidFile: join(dir, "worker.pid") };
}

function runInstall(script: string, dir: string, options: { deadlineMs: number; graceMs: number }) {
  return spawnSync(
    process.execPath,
    [
      RUNNER,
      "--cwd",
      dir,
      "--deadline-ms",
      String(options.deadlineMs),
      "--grace-ms",
      String(options.graceMs),
      "--",
      process.execPath,
      script,
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// The runner starts the install with the install directory as its cwd, so the
// fake scripts below use relative paths for their marker files.

/** Source for a background worker that outlives the install's main process. */
const SPAWN_LINGERING_WORKER = `
  const { spawn } = require("node:child_process");
  const worker = spawn(process.execPath, ["-e", "setInterval(() => {}, 1e6)"], { stdio: "ignore" });
  require("node:fs").writeFileSync("worker.pid", String(worker.pid));
`;

// These spawn real processes and wait on deliberate delays, so allow more than
// vitest's 5s default on a loaded CI runner.
describe("run-vendor-production-install", { timeout: 30_000 }, () => {
  it("waits for an install that outlasts the old 120s-style timeout instead of continuing early", () => {
    // The 1.9.17 failure: the caller moved on while pnpm was still linking.
    // Here the install finishes its last write only after a delay; the runner
    // must not return before that write lands.
    const install = fakeInstall(`
      const fs = require("node:fs");
      console.log("Progress: resolved 1439, reused 0, downloaded 1432, added 774");
      setTimeout(() => {
        fs.writeFileSync("marker", "linked");
        console.log(${JSON.stringify(DONE)});
      }, 1500);
    `);

    const result = runInstall(install.script, install.dir, { deadlineMs: 20_000, graceMs: 5_000 });

    expect(result.status).toBe(0);
    expect(readFileSync(join(install.dir, "marker"), "utf8")).toBe("linked");
  });

  it("fails, rather than continues, when the install has not finished by the deadline", () => {
    const install = fakeInstall(`
      console.log("Progress: resolved 1439, reused 0, downloaded 1432, added 774");
      setInterval(() => {}, 1e6);
    `);

    const result = runInstall(install.script, install.dir, { deadlineMs: 1_000, graceMs: 5_000 });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/did not finish within 1000ms/);
  });

  it("fails when pnpm exits with an error", () => {
    const install = fakeInstall(`console.error("ERR_PNPM_FROZEN_LOCKFILE"); process.exit(2);`);

    const result = runInstall(install.script, install.dir, { deadlineMs: 20_000, graceMs: 5_000 });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/pnpm exited with code 2/);
  });

  it("treats a pnpm that reports completion but never exits as finished", () => {
    const install = fakeInstall(`
      console.log(${JSON.stringify(DONE)});
      setInterval(() => {}, 1e6);
    `);

    const result = runInstall(install.script, install.dir, { deadlineMs: 20_000, graceMs: 500 });

    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/reported completion but did not exit within 500ms/);
  });

  it("recognizes the completion line when it arrives split across output chunks", () => {
    const install = fakeInstall(`
      process.stdout.write("Done in 0.1s us");
      setTimeout(() => { process.stdout.write("ing pnpm v12.3.4\\n"); }, 200);
      setInterval(() => {}, 1e6);
    `);

    const result = runInstall(install.script, install.dir, { deadlineMs: 5_000, graceMs: 500 });

    expect(result.status).toBe(0);
  });

  it.skipIf(process.platform === "win32")(
    "leaves no install worker running once it returns",
    () => {
      // pnpm installs through workers. Stopping only the direct child is what let
      // the 1.9.17 install keep writing to node_modules.
      const install = fakeInstall(`
        ${SPAWN_LINGERING_WORKER}
        console.log(${JSON.stringify(DONE)});
        setInterval(() => {}, 1e6);
      `);

      const result = runInstall(install.script, install.dir, { deadlineMs: 20_000, graceMs: 500 });

      expect(result.status).toBe(0);
      expect(existsSync(install.workerPidFile)).toBe(true);
      const workerPid = Number(readFileSync(install.workerPidFile, "utf8"));
      expect(isAlive(workerPid)).toBe(false);
    },
  );

  it.skipIf(process.platform === "win32")(
    "removes stragglers left behind by an install that exits cleanly",
    () => {
      const install = fakeInstall(`
        ${SPAWN_LINGERING_WORKER}
        console.log(${JSON.stringify(DONE)});
        process.exit(0);
      `);

      const result = runInstall(install.script, install.dir, {
        deadlineMs: 20_000,
        graceMs: 5_000,
      });

      expect(result.status).toBe(0);
      const workerPid = Number(readFileSync(install.workerPidFile, "utf8"));
      expect(isAlive(workerPid)).toBe(false);
    },
  );

  it.each([
    [[] as string[], /usage:/],
    [["--cwd", "/tmp", "--"], /usage:/],
    [
      ["--deadline-ms", "0", "--cwd", "/tmp", "--", "node"],
      /--deadline-ms must be a positive integer/,
    ],
    [["--nope", "1", "--cwd", "/tmp", "--", "node"], /unknown option --nope/],
    [["--", "node"], /--cwd is required/],
  ])("rejects invalid arguments %j", (args, message) => {
    const result = spawnSync(process.execPath, [RUNNER, ...args], {
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
  });
});
