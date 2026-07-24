import { GQL } from "@rivonclaw/core";
import { describe, expect, it } from "vitest";
import {
  AFFILIATE_PROTECTION_IMPORT_MAX_ENTRIES,
  AFFILIATE_PROTECTION_IMPORT_MAX_VARIABLE_BYTES,
  affiliateProtectionImportVariablesByteLength,
  buildAffiliateProtectionImportBatches,
  type AffiliateProtectionImportEntry,
} from "./affiliate-protection-import.js";

function entry(index: number, note: string | null = null): AffiliateProtectionImportEntry {
  return {
    platform: GQL.ShopPlatform.TiktokShop,
    creatorOpenId: null,
    username: `creator-${index}`,
    businessDeveloperId: "507f1f77bcf86cd799439011",
    note,
  };
}

describe("Affiliate protected creator import batching", () => {
  it("splits a customer-scale workbook into ordered requests below the GraphQL proxy limit", () => {
    const entries = Array.from({ length: 3_061 }, (_, index) => entry(index));
    const importBatchId = "customer-scale-batch";
    const batches = buildAffiliateProtectionImportBatches(entries, importBatchId);

    expect(batches).toHaveLength(16);
    expect(batches.every((batch) => batch.entries.length <= AFFILIATE_PROTECTION_IMPORT_MAX_ENTRIES)).toBe(true);
    expect(batches.every((batch) => (
      affiliateProtectionImportVariablesByteLength(batch.entries, importBatchId)
        <= AFFILIATE_PROTECTION_IMPORT_MAX_VARIABLE_BYTES
    ))).toBe(true);
    expect(batches.flatMap((batch) => batch.entries)).toEqual(entries);
    expect(batches.map((batch) => batch.startIndex)).toEqual([
      0, 200, 400, 600, 800, 1_000, 1_200, 1_400,
      1_600, 1_800, 2_000, 2_200, 2_400, 2_600, 2_800, 3_000,
    ]);
  });

  it("also splits by encoded variable size when rows contain long notes", () => {
    const entries = [
      entry(0, "a".repeat(600)),
      entry(1, "b".repeat(600)),
      entry(2, "c".repeat(600)),
    ];
    const batches = buildAffiliateProtectionImportBatches(entries, "byte-limited", {
      maxEntries: 100,
      maxVariableBytes: 1_000,
    });

    expect(batches).toHaveLength(3);
    expect(batches.flatMap((batch) => batch.entries)).toEqual(entries);
  });

  it("rejects a single row that cannot fit inside the safe request budget", () => {
    expect(() => buildAffiliateProtectionImportBatches(
      [entry(0, "x".repeat(2_000))],
      "oversized-row",
      { maxVariableBytes: 1_000 },
    )).toThrow("row 1 exceeds the safe request size");
  });
});
