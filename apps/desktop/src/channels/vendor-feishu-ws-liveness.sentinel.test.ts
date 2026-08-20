import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0034-vendor-openclaw-widen-Feishu-websocket-liveness-time.patch",
);

const VENDOR_CLIENT = resolve(
  __dirname,
  "../../../../vendor/openclaw/extensions/feishu/src/client.ts",
);

function readPingTimeout(source: string): number | null {
  const match = /const FEISHU_WS_CONFIG = \{\s*pingTimeout: (\d+),/.exec(source);
  return match ? Number(match[1]) : null;
}

describe("vendor patch 0034: Feishu websocket liveness timeout", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("keeps the patched vendor source aligned with the patch target", () => {
    const patched = /^\+  pingTimeout: (\d+),$/m.exec(patch);
    expect(patched).not.toBeNull();

    expect(readPingTimeout(readFileSync(VENDOR_CLIENT, "utf-8"))).toBe(Number(patched?.[1]));
    // Patch replay remains the fail-fast guard for an upstream baseline change.
    expect(patch).toContain("-  pingTimeout: 3,");
  });

  it("widens the watchdog past a measured event-loop stall without disabling it", () => {
    const patched = /^\+  pingTimeout: (\d+),$/m.exec(patch);
    expect(patched).not.toBeNull();

    const pingTimeoutSeconds = Number(patched?.[1]);
    // The deadline is measured inside the gateway's event loop, so it must
    // outlast a stall there rather than a network round trip. A desktop host
    // running concurrent CS agents was measured at a 22.9s peak event-loop
    // delay, so anything at or below that reproduces the failure. It must also
    // stay inside one ping cycle (~120s) so a genuinely half-open socket is
    // still detected.
    expect(pingTimeoutSeconds).toBeGreaterThan(23);
    expect(pingTimeoutSeconds).toBeLessThan(120);
  });

  it("keeps the vendor wsConfig assertions aligned with the widened value", () => {
    expect(patch).toContain("extensions/feishu/src/client.test.ts");
    expect(patch).not.toMatch(/^\+\s*pingTimeout: 3,$/m);
  });
});
