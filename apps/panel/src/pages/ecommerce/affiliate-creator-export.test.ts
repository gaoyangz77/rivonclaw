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
      nextOffset: offset + 100,
      skippedWithoutUsernameCount: 0,
      hasMore: offset + 100 < 500,
      items: Array.from({ length: 100 }, (_, i) => row(offset + i)),
    }));
    const progress = vi.fn();
    const { rows, skippedWithoutUsernameCount } = await collectAffiliateCreatorExportRows(
      read,
      progress,
    );
    expect(skippedWithoutUsernameCount).toBe(0);
    expect(rows).toHaveLength(500);
    expect(read.mock.calls.map(([offset]) => offset)).toEqual([0, 100, 200, 300, 400]);
    expect(progress).toHaveBeenLastCalledWith(500);
    expect(rows[499].username).toBe("creator-499");
  });
  it("propagates a later page failure instead of downloading a partial workbook", async () => {
    await expect(
      collectAffiliateCreatorExportRows(async (offset) => {
        if (offset) throw new Error("Export failed");
        return {
          offset,
          nextOffset: 1,
          skippedWithoutUsernameCount: 0,
          hasMore: true,
          items: [row(0)],
        };
      }),
    ).rejects.toThrow("Export failed");
  });
  it("rejects duplicate rows and stalled pagination", async () => {
    await expect(
      collectAffiliateCreatorExportRows(async (offset) => ({
        offset,
        nextOffset: offset + 1,
        skippedWithoutUsernameCount: 0,
        hasMore: true,
        items: [row(0)],
      })),
    ).rejects.toThrow("changed during download");
    await expect(
      collectAffiliateCreatorExportRows(async (offset) => ({
        offset,
        nextOffset: offset,
        skippedWithoutUsernameCount: 0,
        hasMore: true,
        items: [],
      })),
    ).rejects.toThrow("did not advance");
  });
  it("advances past Creators skipped for lacking a TikTok username, including all-skipped pages", async () => {
    const pages = new Map([
      [0, { nextOffset: 100, skippedWithoutUsernameCount: 40, hasMore: true, items: [row(0)] }],
      [100, { nextOffset: 200, skippedWithoutUsernameCount: 100, hasMore: true, items: [] }],
      [200, { nextOffset: 230, skippedWithoutUsernameCount: 0, hasMore: false, items: [row(200)] }],
    ]);
    const read = vi.fn(async (offset: number) => ({ offset, ...pages.get(offset)! }));
    const { rows, skippedWithoutUsernameCount } = await collectAffiliateCreatorExportRows(read);
    expect(read.mock.calls.map(([offset]) => offset)).toEqual([0, 100, 200]);
    expect(rows.map((item) => item.username)).toEqual(["creator-0", "creator-200"]);
    expect(skippedWithoutUsernameCount).toBe(140);
  });
});
