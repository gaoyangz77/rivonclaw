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

module.exports = { readVendorPnpmVersion, resolveVendorPnpmEntry };
