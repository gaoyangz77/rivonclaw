import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

function findFeishuMonitorChunk(): { distDir: string; chunkPath: string } {
  const distDir = resolve(repoRoot, "vendor/openclaw/dist");
  expect(existsSync(distDir), "vendor/openclaw/dist must exist").toBe(true);

  const chunks = [distDir];
  let chunk: string | undefined;
  for (const dir of chunks) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        chunks.push(path);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      if (readFileSync(path, "utf8").includes("monitorFeishuProvider")) {
        chunk = path;
        break;
      }
    }
    if (chunk) break;
  }

  expect(chunk, "OpenClaw Feishu monitor chunk must exist").toBeTruthy();
  return { distDir, chunkPath: chunk! };
}

describe("startup-timer preload", () => {
  it("emits compact performance samples for the desktop collector", () => {
    const preloadPath = resolve(here, "startup-timer.cjs");
    const result = spawnSync(
      process.execPath,
      ["--require", preloadPath, "-e", "setTimeout(() => {}, 130)"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          RIVONCLAW_PERF_SAMPLE_INTERVAL_MS: "50",
        },
        encoding: "utf8",
        timeout: 5_000,
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const line = result.stderr
      .split("\n")
      .find((entry) => entry.startsWith("[desktop-perf-sample] "));
    expect(line).toBeTruthy();
    expect(JSON.parse(line!.slice("[desktop-perf-sample] ".length))).toEqual(
      expect.objectContaining({
        ts: expect.any(Number),
        intervalMs: expect.any(Number),
        cpu: expect.objectContaining({ coreRatio: expect.any(Number) }),
        eventLoop: expect.objectContaining({ p99Ms: expect.any(Number) }),
        memory: expect.objectContaining({ heapUsedBytes: expect.any(Number) }),
        gc: expect.objectContaining({ count: expect.any(Number) }),
      }),
    );
  });

  it("does not sample gateway descendant processes", () => {
    const preloadPath = resolve(here, "startup-timer.cjs");
    const result = spawnSync(
      process.execPath,
      ["--require", preloadPath, "-e", "setTimeout(() => {}, 130)"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          RIVONCLAW_PERF_SAMPLE_INTERVAL_MS: "50",
          RIVONCLAW_PERF_SAMPLER_OWNER_PID: "1",
        },
        encoding: "utf8",
        timeout: 5_000,
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stderr).not.toContain("[desktop-perf-sample] ");
  });

  it("provides a vendor-dist __dirname fallback for bundled OpenClaw ESM chunks", () => {
    const { distDir, chunkPath } = findFeishuMonitorChunk();
    const preloadPath = resolve(here, "startup-timer.cjs");
    const chunkUrl = pathToFileURL(chunkPath).href;

    const result = spawnSync(
      process.execPath,
      [
        "--require",
        preloadPath,
        "--input-type=module",
        "-e",
        `import(${JSON.stringify(chunkUrl)}).then(()=>console.log("ok")).catch((error)=>{console.error(error.stack||error.message);process.exit(1)})`,
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          RIVONCLAW_OPENCLAW_DIST_DIR: distDir,
        },
        encoding: "utf8",
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("ok");
  });
});
