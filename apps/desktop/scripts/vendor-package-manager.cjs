// @ts-check
//
// Desktop packaging entry point for the vendor's pinned pnpm. The shell vendor
// bootstrap (`scripts/setup-vendor.sh`, `scripts/provision-vendor-patched.sh`)
// and the electron-builder hooks must agree on the exact release and on where
// it is installed, so both go through one implementation.
//
// See `scripts/vendor-pnpm.cjs` for why the pinned pnpm is installed outside
// the vendor tree.

const {
  readVendorPnpmVersion,
  resolveVendorPnpmEntry,
} = require("../../../scripts/vendor-pnpm.cjs");

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

// pnpm's own completion line. `.modules.yaml` is written before linking ends, so
// it cannot tell a finished install from one still running.
const PNPM_INSTALL_DONE_LINE = /\bDone in [^\n]* using pnpm v/u;

/**
 * Decides what to do with a running vendor install. An install is finished only
 * when pnpm exits, or when it has printed its completion line and then failed to
 * exit for `graceMs` (the hang this runner exists for). An install that has not
 * printed its completion line by `deadlineMs` is killed and fails.
 *
 * @param {{
 *   exited: boolean,
 *   exitCode: number | null,
 *   startedAtMs: number,
 *   doneAtMs: number | null,
 *   nowMs: number,
 *   graceMs: number,
 *   deadlineMs: number,
 * }} state
 * @returns {{ action: "wait" } | { action: "exit" | "kill", code: number, reason: string }}
 */
function decideVendorInstallWait(state) {
  if (state.exited) {
    return state.exitCode === 0
      ? { action: "exit", code: 0, reason: "pnpm exited successfully" }
      : { action: "exit", code: 1, reason: `pnpm exited with code ${state.exitCode}` };
  }
  if (state.doneAtMs !== null) {
    return state.nowMs - state.doneAtMs >= state.graceMs
      ? {
          action: "kill",
          code: 0,
          reason: `pnpm reported completion but did not exit within ${state.graceMs}ms`,
        }
      : { action: "wait" };
  }
  return state.nowMs - state.startedAtMs >= state.deadlineMs
    ? { action: "kill", code: 1, reason: `pnpm did not finish within ${state.deadlineMs}ms` }
    : { action: "wait" };
}

module.exports = {
  readVendorPnpmVersion,
  resolveVendorPnpmEntry,
  VENDOR_PRODUCTION_INSTALL_ARGS,
  isCompletedVendorProductionInstall,
  PNPM_INSTALL_DONE_LINE,
  decideVendorInstallWait,
};
