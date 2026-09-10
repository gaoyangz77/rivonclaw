const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const VENDOR_PRUNE_INPUTS = Object.freeze([
  "prune-vendor-deps.cjs",
  "stage-official-vendor-plugins.cjs",
  "vendor-runtime-plugin-inventory.cjs",
  "vendor-plugin-dependencies.cjs",
  "vendor-plugin-size.cjs",
  "vendor-package-manager.cjs",
  "pnpm-target-architecture.cjs",
  "vendor-runtime-cache.cjs",
]);

function readVendorPruneProfile(scriptsDir = __dirname) {
  const hash = crypto.createHash("sha256");
  for (const name of VENDOR_PRUNE_INPUTS) {
    hash.update(name);
    hash.update(fs.readFileSync(path.join(scriptsDir, name)));
  }
  return `selected-plugin-runtime-${hash.digest("hex").slice(0, 16)}`;
}

module.exports = { VENDOR_PRUNE_INPUTS, readVendorPruneProfile };
