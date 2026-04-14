import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Sentinel test for vendor patch 0008: Pi SDK validateConfig compatibility shim.
 *
 * Verifies that OpenClaw's pi-model-discovery.ts monkey-patches
 * PiModelRegistryClass.prototype.validateConfig to temporarily inject
 * synthetic apiKey for auth-mode providers (token/oauth/aws-sdk),
 * preventing the all-or-nothing validation failure.
 *
 * When this test fails after a vendor update, re-apply patch 0008 or
 * verify that upstream Pi SDK accepts auth modes as alternatives to
 * apiKey in validateConfig.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VENDOR_FILE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/agents/pi-model-discovery.ts",
);

/** Check if the vendor source has the patch applied. */
function isVendorPatched(): boolean {
  try {
    const src = readFileSync(VENDOR_FILE, "utf-8");
    return (
      src.includes("OC_COMPAT_AUTH_MODES") &&
      src.includes("_origValidateConfig")
    );
  } catch {
    return false;
  }
}

const runOrSkip = isVendorPatched() ? describe : describe.skip;

runOrSkip(
  "vendor patch 0008: Pi SDK validateConfig compatibility shim for auth-mode providers",
  () => {
    const source = readFileSync(VENDOR_FILE, "utf-8");

    it("OC_COMPAT_AUTH_MODES set exists with all three auth modes", () => {
      expect(source).toContain("OC_COMPAT_AUTH_MODES");
      expect(source).toContain('"token"');
      expect(source).toContain('"oauth"');
      expect(source).toContain('"aws-sdk"');
    });

    it("patches validateConfig on PiModelRegistryClass.prototype", () => {
      // Must access validateConfig via prototype (cast through unknown for TS private)
      expect(source).toContain("PiModelRegistryClass.prototype");
      expect(source).toContain(".validateConfig");
      // Must save the original first
      expect(source).toContain("_origValidateConfig");
      // Must guard with typeof check
      expect(source).toContain('typeof _origValidateConfig === "function"');
    });

    it("finally block restores (deletes) synthetic apiKey", () => {
      // The finally block must exist to ensure cleanup
      expect(source).toContain("finally");
      // Must delete apiKey from shimmed providers
      expect(source).toContain("delete cfg.apiKey");
    });

    it("synthetic apiKey uses __oc_compat_ prefix", () => {
      expect(source).toContain("__oc_compat_");
      // Verify the pattern interpolates the auth mode
      expect(source).toContain("`__oc_compat_${providerCfg.auth}`");
    });

    it("calls original validateConfig via .call(this, config)", () => {
      expect(source).toContain("_origValidateConfig.call(this, config)");
    });
  },
);
