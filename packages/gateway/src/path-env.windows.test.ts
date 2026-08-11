import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizePathEnvironment } from "./path-env.js";

const fixtureDirs: string[] = [];

afterEach(() => {
  for (const dir of fixtureDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe.skipIf(process.platform !== "win32")("Windows npm command resolution", () => {
  it("runs npm.cmd from a valid Path when PATH is empty", () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), "RivonClaw npm fixture "));
    fixtureDirs.push(fixtureDir);
    copyFileSync(process.execPath, join(fixtureDir, "node.exe"));
    writeFileSync(join(fixtureDir, "npm.cmd"), "@echo off\r\necho 99.1.2\r\n");

    const env = normalizePathEnvironment(
      { ...process.env, Path: fixtureDir, PATH: "" },
      { platform: "win32", extraPaths: [] },
    );
    const nodeVersion = execFileSync("node.exe", ["--version"], {
      env,
      encoding: "utf8",
      windowsHide: true,
    });
    const cmd = win32.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe");
    const output = execFileSync(cmd, ["/d", "/s", "/c", "npm.cmd --version"], {
      env,
      encoding: "utf8",
      windowsHide: true,
    });

    expect(nodeVersion.trim()).toMatch(/^v\d+/u);
    expect(output.trim()).toBe("99.1.2");
    expect(Object.keys(env).filter((key) => key.toLowerCase() === "path")).toEqual(["Path"]);
  });
});
