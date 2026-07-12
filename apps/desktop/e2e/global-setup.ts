import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

type VendorRuntimeManifest = {
  version: string;
  archiveFile: string;
};

function preparePackagedVendorRuntimeCache(): string | undefined {
  const executablePath = process.env.E2E_EXECUTABLE_PATH;
  if (process.platform !== "darwin" || !executablePath) return undefined;

  const archiveDir = resolve(dirname(executablePath), "../Resources/vendor/openclaw");
  const manifest = JSON.parse(
    readFileSync(join(archiveDir, "vendor-runtime-manifest.json"), "utf8"),
  ) as VendorRuntimeManifest;
  const archivePath = join(archiveDir, manifest.archiveFile);
  const cacheRoot = mkdtempSync(join(tmpdir(), "rivonclaw-e2e-vendor-runtime-"));
  const runtimeDir = join(cacheRoot, manifest.version, "openclaw");
  mkdirSync(runtimeDir, { recursive: true });

  execFileSync(
    "tar",
    [manifest.archiveFile.endsWith(".gz") ? "-xzf" : "-xf", archivePath, "-C", runtimeDir],
    {
      stdio: "inherit",
      timeout: 300_000,
    },
  );
  if (!existsSync(join(runtimeDir, "openclaw.mjs"))) {
    rmSync(cacheRoot, { recursive: true, force: true });
    throw new Error(`Packaged vendor runtime cache is incomplete: ${runtimeDir}`);
  }

  process.env.RIVONCLAW_E2E_VENDOR_RUNTIME_CACHE = cacheRoot;
  return cacheRoot;
}

export default function globalSetup() {
  // Kill any leftover RivonClaw instances from previous test runs.
  // .env loading is handled by dotenv in playwright.config.ts.
  if (process.platform === "darwin") {
    // Use killall (~10ms) instead of pkill which can take 20-50s on macOS
    // due to slow proc_info kernel calls when many processes are running.
    try {
      execSync("killall -9 RivonClaw 2>/dev/null || true", { stdio: "ignore" });
    } catch {}
  }
  if (process.platform === "win32") {
    try {
      execSync("taskkill /F /IM RivonClaw.exe 2>nul || exit 0", { stdio: "ignore" });
    } catch {}
  }

  const runtimeCache = preparePackagedVendorRuntimeCache();
  return () => {
    if (runtimeCache) {
      rmSync(runtimeCache, { recursive: true, force: true });
    }
  };
}
