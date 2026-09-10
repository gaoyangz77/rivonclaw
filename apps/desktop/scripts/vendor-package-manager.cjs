// @ts-check
//
// Desktop packaging entry point for the vendor's pinned pnpm. The shell vendor
// bootstrap (`scripts/setup-vendor.sh`, `scripts/provision-vendor-patched.sh`)
// and the electron-builder hooks must agree on the exact release and on where
// it is installed, so both go through one implementation.
//
// See `scripts/vendor-pnpm.cjs` for why the pinned pnpm is installed outside
// the vendor tree.

const { readVendorPnpmVersion, resolveVendorPnpmEntry } = require(
  "../../../scripts/vendor-pnpm.cjs",
);

// pnpm 12 does not honor the legacy npm_config_node_linker environment override.
// This is an install option, so it must follow the subcommand, not precede it.
const VENDOR_PRODUCTION_INSTALL_ARGS = Object.freeze([
  "--config.manage-package-manager-versions=false",
  "--config.auto-install-peers=false",
  "install",
  "--prod",
  "--node-linker=hoisted",
  "--optional",
  "--frozen-lockfile",
  "--ignore-scripts",
]);

/** @param {{ nodeLinker?: string, included?: { dependencies?: boolean, devDependencies?: boolean, optionalDependencies?: boolean } } | null | undefined} state */
function isCompletedVendorProductionInstall(state) {
  return (
    state?.nodeLinker === "hoisted" &&
    state?.included?.dependencies === true &&
    state?.included?.devDependencies === false &&
    state?.included?.optionalDependencies === true
  );
}

module.exports = {
  readVendorPnpmVersion,
  resolveVendorPnpmEntry,
  VENDOR_PRODUCTION_INSTALL_ARGS,
  isCompletedVendorProductionInstall,
};
