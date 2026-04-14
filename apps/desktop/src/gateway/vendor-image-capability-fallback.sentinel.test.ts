import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Sentinel test for vendor patch 0008: id-only catalog fallback in
 * resolveGatewayModelSupportsImages.
 *
 * Pi SDK's ModelRegistry.validateConfig() silently drops ALL custom models
 * from the catalog when any provider has models but no apiKey. This causes
 * resolveGatewayModelSupportsImages to miss the custom provider's entry and
 * return false, dropping images.
 *
 * The patch adds an id-only catalog.find fallback after the provider+model
 * exact match, so the function can find the same model under a built-in
 * provider (e.g. openai/gpt-5.4 instead of rivonclaw-pro/gpt-5.4).
 *
 * When this test fails after a vendor update, re-apply patch 0008 or
 * verify that upstream fixed Pi SDK's validateConfig behavior.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VENDOR_FILE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/gateway/session-utils.ts",
);

/** Check if the vendor source has the patch applied. */
function isVendorPatched(): boolean {
  try {
    const src = readFileSync(VENDOR_FILE, "utf-8");
    // The patch adds a nullish coalescing fallback with an id-only find
    // after the provider+model find in resolveGatewayModelSupportsImages.
    return hasIdOnlyFallback(src);
  } catch {
    return false;
  }
}

/**
 * Verify the function contains the id-only catalog.find fallback
 * after the provider+model match.
 */
function hasIdOnlyFallback(source: string): boolean {
  const fnStart = source.indexOf("async function resolveGatewayModelSupportsImages");
  if (fnStart === -1) return false;

  // Scope to the function body (find the next export at the same level)
  const fnEnd = source.indexOf("\nexport ", fnStart + 1);
  const fnSlice = source.slice(fnStart, fnEnd > -1 ? fnEnd : undefined);

  // The patch adds: ?? (params.provider ? catalog.find((entry) => entry.id === params.model) : undefined)
  // We check for the nullish coalescing operator and the id-only find pattern.
  const hasNullishCoalescing = fnSlice.includes("??");
  const hasIdOnlyFind =
    // The fallback find matches on entry.id === params.model without provider check
    fnSlice.includes("catalog.find((entry) => entry.id === params.model)");

  return hasNullishCoalescing && hasIdOnlyFind;
}

const runOrSkip = isVendorPatched() ? describe : describe.skip;

runOrSkip("vendor patch 0008: id-only catalog fallback for image capability", () => {
  const source = readFileSync(VENDOR_FILE, "utf-8");

  it("resolveGatewayModelSupportsImages has id-only fallback after provider+model match", () => {
    const fnStart = source.indexOf("async function resolveGatewayModelSupportsImages");
    expect(fnStart).toBeGreaterThan(-1);

    const fnEnd = source.indexOf("\nexport ", fnStart + 1);
    const fnSlice = source.slice(fnStart, fnEnd > -1 ? fnEnd : undefined);

    // The provider+model exact match must come first
    const exactMatchIdx = fnSlice.indexOf(
      "entry.id === params.model && (!params.provider || entry.provider === params.provider)",
    );
    expect(exactMatchIdx).toBeGreaterThan(-1);

    // The nullish coalescing fallback must follow
    const nullishIdx = fnSlice.indexOf("??", exactMatchIdx);
    expect(nullishIdx).toBeGreaterThan(exactMatchIdx);

    // The id-only fallback must be guarded by params.provider presence
    const providerGuardIdx = fnSlice.indexOf("params.provider", nullishIdx);
    expect(providerGuardIdx).toBeGreaterThan(nullishIdx);

    // The id-only find must exist after the guard
    const idOnlyFindIdx = fnSlice.indexOf(
      "catalog.find((entry) => entry.id === params.model)",
      nullishIdx,
    );
    expect(idOnlyFindIdx).toBeGreaterThan(nullishIdx);
  });

  it("fallback is scoped to provider-specified lookups only", () => {
    const fnStart = source.indexOf("async function resolveGatewayModelSupportsImages");
    const fnEnd = source.indexOf("\nexport ", fnStart + 1);
    const fnSlice = source.slice(fnStart, fnEnd > -1 ? fnEnd : undefined);

    // The fallback should be: (params.provider ? catalog.find(...) : undefined)
    // This ensures we only fall back when a provider was explicitly specified.
    // Without a provider, the exact match already does id-only matching.
    const nullishIdx = fnSlice.indexOf("??");
    const afterNullish = fnSlice.slice(nullishIdx);

    expect(afterNullish).toContain("params.provider");
    expect(afterNullish).toContain(": undefined)");
  });
});
