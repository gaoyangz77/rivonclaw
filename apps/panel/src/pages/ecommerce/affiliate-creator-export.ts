import type { GQL } from "@rivonclaw/core";
import type { Workbook } from "exceljs";

/**
 * Collect every page before offering a file, so a failed request never produces a partial export.
 * Pages advance by the server's relationship cursor: Creators skipped for lacking a TikTok username
 * still consume relationship offsets, so the row count is not the next offset.
 */
export async function collectAffiliateCreatorExportRows(
  readPage: (offset: number) => Promise<GQL.AffiliateCreatorUpdateExportPage>,
  onProgress: (count: number) => void = () => {},
): Promise<{ rows: GQL.AffiliateCreatorUpdateExportRow[]; skippedWithoutUsernameCount: number }> {
  const rows: GQL.AffiliateCreatorUpdateExportRow[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let skippedWithoutUsernameCount = 0;
  while (true) {
    const page = await readPage(offset);
    if (page.offset !== offset || (page.hasMore && page.nextOffset <= offset)) {
      throw new Error("Creator export pagination did not advance; refresh and try again");
    }
    for (const row of page.items) {
      if (seen.has(row.creatorRelationshipId)) {
        throw new Error("Creator export changed during download; refresh and try again");
      }
      seen.add(row.creatorRelationshipId);
      rows.push(row);
    }
    skippedWithoutUsernameCount += page.skippedWithoutUsernameCount;
    offset = page.nextOffset;
    onProgress(rows.length);
    if (!page.hasMore) return { rows, skippedWithoutUsernameCount };
  }
}

export async function downloadAffiliateCreatorWorkbook(workbook: Workbook, filename: string) {
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
