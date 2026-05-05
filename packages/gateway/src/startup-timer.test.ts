import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

function findFeishuMonitorChunk(): { distDir: string; chunkPath: string } {
  const distDir = resolve(repoRoot, "vendor/openclaw/dist");
  expect(existsSync(distDir), "vendor/openclaw/dist must exist").toBe(true);

  const chunk = readdirSync(distDir)
    .filter((name) => name.startsWith("monitor-") && name.endsWith(".js"))
    .find((name) =>
      readFileSync(resolve(distDir, name), "utf8").includes(
        "monitorFeishuProvider",
      ),
    );

  expect(chunk, "OpenClaw Feishu monitor chunk must exist").toBeTruthy();
  return { distDir, chunkPath: resolve(distDir, chunk!) };
}

describe("startup-timer preload", () => {
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
