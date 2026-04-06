// @ts-check
// Restore vendor/openclaw after dist:* build.
// prune + bundle modifies the original vendor (node_modules pruned,
// dist/ rewritten). This script restores it for dev mode.

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const vendorDir = path.resolve(__dirname, "..", "..", "..", "vendor", "openclaw");

if (!fs.existsSync(vendorDir)) {
  console.log("[restore-vendor] vendor/openclaw not found, skipping.");
  process.exit(0);
}

// CI builds don't need restore (fresh clone every time)
if (process.env.CI) {
  console.log("[restore-vendor] CI detected, skipping restore.");
  process.exit(0);
}

console.log("[restore-vendor] Restoring vendor/openclaw after build...");
const t0 = Date.now();

const env = { ...process.env, npm_config_node_linker: "hoisted" };
const run = (cmd) => execSync(cmd, { cwd: vendorDir, stdio: "inherit", env });

try {
  // 1. Restore git-tracked files (.gitignore, etc.)
  run("git checkout -- .");

  // 2. Restore full node_modules (dev + prod)
  // Must delete node_modules first — pnpm install on a pruned hoisted layout
  // doesn't correctly re-add dev deps. Clean install takes ~40s.
  fs.rmSync(path.join(vendorDir, "node_modules"), { recursive: true, force: true });
  run("pnpm install --frozen-lockfile");

  // 3. Rebuild dist/
  run("pnpm run build");

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[restore-vendor] Vendor restored in ${elapsed}s`);
} catch (err) {
  console.warn(`[restore-vendor] Restore failed: ${err.message}`);
  console.warn("[restore-vendor] Run ./scripts/setup-vendor.sh to fix manually.");
  // Don't fail the build — the installer was already produced successfully
}
