import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0037-vendor-openclaw-keep-Playwright-out-of-Windows-CLI.patch",
);
const PATCHED_VENDOR_ROOT = resolve(__dirname, "../../../../tmp/vendor-patched/openclaw");
const VENDOR_ROOT = existsSync(PATCHED_VENDOR_ROOT)
  ? PATCHED_VENDOR_ROOT
  : resolve(__dirname, "../../../../vendor/openclaw");

describe("vendor patch 0037: lazy Windows browser CLI registration", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");
  const schemaSource = readFileSync(
    resolve(VENDOR_ROOT, "extensions/browser/src/browser-tool.schema.ts"),
    "utf8",
  );
  const configSource = readFileSync(
    resolve(VENDOR_ROOT, "extensions/browser/src/browser/config.ts"),
    "utf8",
  );

  it("keeps browser schemas independent from Playwright-backed action policy", () => {
    expect(schemaSource).toContain(
      'import { ACT_MAX_VIEWPORT_DIMENSION } from "./browser/constants.js";',
    );
    expect(schemaSource).not.toContain(
      'import { ACT_MAX_VIEWPORT_DIMENSION } from "./browser/act-policy.js";',
    );
  });

  it("keeps browser config on registration-safe SDK helpers", () => {
    expect(configSource).toContain(
      'import { parseBrowserHttpUrl, redactCdpUrl } from "openclaw/plugin-sdk/browser-config";',
    );
    expect(configSource).toContain('import { isLoopbackHost } from "../gateway/net.js";');
    expect(configSource).not.toContain(
      'import { parseBrowserHttpUrl, redactCdpUrl, isLoopbackHost } from "./cdp.helpers.js";',
    );
  });

  it("records the upstream fix and removal condition", () => {
    expect(patch).toContain("b1b2608f8ca9a56d573487c7eae8ecbdfa3aa8cc");
    expect(patch).toContain("PR #127035");
    expect(patch).toContain("Removal:");
    expect(patch).toContain(
      "apps/desktop/src/gateway/vendor-browser-windows-cli-laziness.sentinel.test.ts",
    );
  });
});
