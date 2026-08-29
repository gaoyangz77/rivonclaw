import { GQL } from "@rivonclaw/core";
import { describe, expect, it } from "vitest";
import {
  AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS,
  AFFILIATE_CREATOR_UPDATE_IMPORT_MAX_ENTRIES,
  AFFILIATE_CREATOR_UPDATE_IMPORT_MAX_VARIABLE_BYTES,
  affiliateCreatorUpdateImportVariablesByteLength,
  buildAffiliateDeveloperProvisionBatches,
  buildAffiliateProtectionDeveloperResolutionSeeds,
  buildAffiliateCreatorUpdateImportBatches,
  classifyAffiliateProtectionPreviewRow,
  normalizeAffiliateBusinessDeveloperName,
  parseAffiliateCreatorUpdateRow,
  summarizeAffiliateProtectionAssignments,
  validateAffiliateCreatorUpdateTemplate,
  type AffiliateCreatorUpdateImportEntry,
} from "./affiliate-protection-import.js";

function entry(index: number, note: string | null = null): AffiliateCreatorUpdateImportEntry {
  return {
    platform: GQL.ShopPlatform.TiktokShop,
    creatorOpenId: null,
    username: `creator-${index}`,
    businessDeveloperId: "507f1f77bcf86cd799439011",
    protect: Boolean(note),
    protectionNote: note,
    manualTagNames: [],
  };
}

describe("Affiliate Creator bulk update import", () => {
  it("requires the new general template while accepting extra numbered tag columns", () => {
    expect(validateAffiliateCreatorUpdateTemplate([...AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS])).toEqual({
      valid: true,
      missingHeaders: [],
      unsupportedHeaders: [],
    });
    expect(validateAffiliateCreatorUpdateTemplate([
      ...AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS,
      "add_manual_tag_12",
    ]).valid).toBe(true);
    expect(validateAffiliateCreatorUpdateTemplate(["creator_username", "bd_name"])).toEqual({
      valid: false,
      missingHeaders: ["protection_action", "protection_note", "add_manual_tag_1"],
      unsupportedHeaders: [],
    });
    expect(validateAffiliateCreatorUpdateTemplate([
      ...AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS,
      "manual_tags",
    ]).unsupportedHeaders).toEqual(["manual_tags"]);
  });

  it("parses additive actions, arbitrary tag columns, and case-insensitive tag duplicates", () => {
    expect(parseAffiliateCreatorUpdateRow({
      "Creator Username": " @Alice ",
      bd_name: " Regional BD ",
      protection_action: " protect ",
      protection_note: "VIP relationship",
      add_manual_tag_1: " Long-term ",
      add_manual_tag_2: "long-term",
      add_manual_tag_7: "Fashion",
    })).toEqual({
      username: "Alice",
      businessDeveloperName: "Regional BD",
      protect: true,
      protectionNote: "VIP relationship",
      manualTagNames: ["Long-term", "Fashion"],
      issue: null,
    });
  });

  it("rejects invalid protection actions, orphaned notes, and rows with no updates", () => {
    expect(parseAffiliateCreatorUpdateRow({
      creator_username: "alice",
      protection_action: "REMOVE",
    }).issue).toBe("INVALID_PROTECTION_ACTION");
    expect(parseAffiliateCreatorUpdateRow({
      creator_username: "alice",
      protection_note: "note",
    }).issue).toBe("NOTE_WITHOUT_PROTECTION");
    expect(parseAffiliateCreatorUpdateRow({ creator_username: "alice" }).issue).toBe("NO_UPDATES");
  });

  it("describes the actual import outcome instead of marking every valid row ready", () => {
    expect(classifyAffiliateProtectionPreviewRow({
      error: "Missing creator",
      businessDeveloperId: null,
      businessDeveloperName: null,
    })).toBe("ERROR");
    expect(classifyAffiliateProtectionPreviewRow({
      error: null,
      excluded: true,
      businessDeveloperId: null,
      businessDeveloperName: "Skipped BD",
    })).toBe("EXCLUDED");
    expect(classifyAffiliateProtectionPreviewRow({
      error: null,
      businessDeveloperId: null,
      businessDeveloperName: "Unknown BD",
    })).toBe("NEEDS_DEVELOPER_DECISION");
    expect(classifyAffiliateProtectionPreviewRow({
      error: null,
      businessDeveloperId: "bd-1",
      businessDeveloperName: "Alice",
    })).toBe("ASSIGNED");
    expect(classifyAffiliateProtectionPreviewRow({
      error: null,
      businessDeveloperId: null,
      businessDeveloperName: null,
    })).toBe("PROTECTION_ONLY");
  });

  it("summarizes matched BD assignments before the user confirms them", () => {
    expect(summarizeAffiliateProtectionAssignments([
      {
        error: null,
        businessDeveloperId: "bd-lin",
        businessDeveloperName: "林",
      },
      {
        error: null,
        businessDeveloperId: "bd-lin",
        businessDeveloperName: "林",
      },
      {
        error: null,
        businessDeveloperId: "bd-chen",
        businessDeveloperName: "陈",
      },
      {
        error: null,
        businessDeveloperId: null,
        businessDeveloperName: null,
      },
      {
        error: "Missing creator",
        businessDeveloperId: null,
        businessDeveloperName: null,
      },
    ])).toEqual({
      assigned: [
        {
          businessDeveloperId: "bd-lin",
          businessDeveloperName: "林",
          rowCount: 2,
        },
        {
          businessDeveloperId: "bd-chen",
          businessDeveloperName: "陈",
          rowCount: 1,
        },
      ],
      assignedRowCount: 3,
      protectionOnlyRowCount: 1,
      attentionRowCount: 1,
    });
  });

  it("keeps BD provisioning requests within the backend 100-name limit", () => {
    const batches = buildAffiliateDeveloperProvisionBatches(
      Array.from({ length: 205 }, (_, index) => `bd-${index}`),
    );
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5]);
    expect(batches.flat()).toHaveLength(205);
  });

  it("normalizes and groups unresolved BD names while keeping blank names protection-only", () => {
    expect(normalizeAffiliateBusinessDeveloperName("  Ａｌｉｃｅ   Smith ")).toBe("alice smith");
    const groups = buildAffiliateProtectionDeveloperResolutionSeeds([
      {
        rowNumber: 2,
        businessDeveloperName: "Alice",
        businessDeveloperId: null,
        error: null,
      },
      {
        rowNumber: 3,
        businessDeveloperName: "  Ａｌｉｃｅ ",
        businessDeveloperId: null,
        error: null,
      },
      {
        rowNumber: 4,
        businessDeveloperName: "Archived BD",
        businessDeveloperId: null,
        error: null,
      },
      {
        rowNumber: 5,
        businessDeveloperName: null,
        businessDeveloperId: null,
        error: null,
      },
      {
        rowNumber: 6,
        businessDeveloperName: "Invalid row BD",
        businessDeveloperId: null,
        error: "Missing creator",
      },
    ], [{
      id: "archived-id",
      normalizedDisplayName: "archived bd",
      archivedAt: "2026-07-24",
    }]);

    expect(groups).toEqual([
      expect.objectContaining({
        sourceName: "Alice",
        normalizedSourceName: "alice",
        rowNumbers: [2, 3],
        archivedDeveloperId: null,
        defaultResolution: "CREATE",
      }),
      expect.objectContaining({
        sourceName: "Archived BD",
        rowNumbers: [4],
        archivedDeveloperId: "archived-id",
        defaultResolution: "",
      }),
    ]);
  });

  it("splits a customer-scale workbook into ordered requests below the GraphQL proxy limit", () => {
    const entries = Array.from({ length: 3_062 }, (_, index) => entry(index));
    const importBatchId = "customer-scale-batch";
    const batches = buildAffiliateCreatorUpdateImportBatches(entries, importBatchId);

    expect(batches).toHaveLength(16);
    expect(batches.every((batch) => batch.entries.length <= AFFILIATE_CREATOR_UPDATE_IMPORT_MAX_ENTRIES)).toBe(true);
    expect(batches.every((batch) => (
      affiliateCreatorUpdateImportVariablesByteLength(batch.entries, importBatchId)
        <= AFFILIATE_CREATOR_UPDATE_IMPORT_MAX_VARIABLE_BYTES
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
    const batches = buildAffiliateCreatorUpdateImportBatches(entries, "byte-limited", {
      maxEntries: 100,
      maxVariableBytes: 1_000,
    });

    expect(batches).toHaveLength(3);
    expect(batches.flatMap((batch) => batch.entries)).toEqual(entries);
  });

  it("rejects a single row that cannot fit inside the safe request budget", () => {
    expect(() => buildAffiliateCreatorUpdateImportBatches(
      [entry(0, "x".repeat(2_000))],
      "oversized-row",
      { maxVariableBytes: 1_000 },
    )).toThrow("row 1 exceeds the safe request size");
  });
});
