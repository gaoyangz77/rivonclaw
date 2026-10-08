import { describe, expect, it, vi } from "vitest";
import type { GQL } from "@rivonclaw/core";
import { collectAffiliateCreatorExportRows } from "./affiliate-creator-export.js";

function row(i: number): GQL.AffiliateCreatorUpdateExportRow {
  return {
    creatorRelationshipId: `relationship-${i}`,
    username: `creator-${i}`,
    businessDeveloperName: "Old BD",
    protect: false,
    manualTagNames: [],
  };
}

describe("Creator workbook export pagination", () => {
  it("collects all 500 matching Creators, not only the first visible page", async () => {
    const read = vi.fn(async (offset: number) => ({
      offset,
      hasMore: offset + 100 < 500,
      items: Array.from({ length: 100 }, (_, i) => row(offset + i)),
    }));
    const progress = vi.fn();
    const rows = await collectAffiliateCreatorExportRows(read, progress);
    expect(rows).toHaveLength(500);
    expect(read.mock.calls.map(([offset]) => offset)).toEqual([0, 100, 200, 300, 400]);
    expect(progress).toHaveBeenLastCalledWith(500);
    expect(rows[499].username).toBe("creator-499");
  });
  it("propagates a later page failure instead of downloading a partial workbook", async () => {
    await expect(
      collectAffiliateCreatorExportRows(async (offset) => {
        if (offset) throw new Error("Export failed");
        return { offset, hasMore: true, items: [row(0)] };
      }),
    ).rejects.toThrow("Export failed");
  });
  it("rejects duplicate rows and stalled pagination", async () => {
    await expect(
      collectAffiliateCreatorExportRows(async (offset) => ({
        offset,
        hasMore: true,
        items: [row(0)],
      })),
    ).rejects.toThrow("changed during download");
    await expect(
      collectAffiliateCreatorExportRows(async (offset) => ({ offset, hasMore: true, items: [] })),
    ).rejects.toThrow("did not advance");
  });
});
