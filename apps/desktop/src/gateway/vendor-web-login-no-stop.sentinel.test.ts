import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Sentinel test for vendor patch 0004: skip stopChannel for new-account QR logins.
 *
 * Verifies that OpenClaw's web.login.start handler does NOT call
 * context.stopChannel when accountId is undefined (new-account login).
 * Without this patch, starting a QR login kills all existing running
 * accounts for the channel.
 *
 * When this test fails after a vendor update, re-apply patch 0004 or
 * verify that upstream added equivalent functionality.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PATCHED_VENDOR_ROOT = resolve(__dirname, "../../../../tmp/vendor-patched/openclaw");
const VENDOR_ROOT = existsSync(PATCHED_VENDOR_ROOT)
  ? PATCHED_VENDOR_ROOT
  : resolve(__dirname, "../../../../vendor/openclaw");

const VENDOR_FILE = resolve(
  VENDOR_ROOT,
  "src/gateway/server-methods/web.ts",
);

describe("vendor patch 0004: skip stopChannel for new-account QR login", () => {
  const source = readFileSync(VENDOR_FILE, "utf-8");

  it("stopChannel is guarded by accountId presence", () => {
    // Find the web.login.start handler (skip the WEB_LOGIN_METHODS Set definition)
    const handlerStart = source.indexOf('"web.login.start": async');
    expect(handlerStart).toBeGreaterThan(-1);

    // Find the next handler boundary to scope the search
    const nextHandler = source.indexOf('"web.login.wait": async', handlerStart);
    const handlerSlice = source.slice(handlerStart, nextHandler > -1 ? nextHandler : undefined);

    // The patch requires a concrete account before the pre-login stop path.
    const ifIndex = handlerSlice.indexOf("const stoppedBeforeLogin = Boolean(accountId)");
    const stopIndex = handlerSlice.indexOf("stopChannel");
    expect(ifIndex).toBeGreaterThan(-1);
    expect(stopIndex).toBeGreaterThan(ifIndex);
  });
});
