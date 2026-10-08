import type { GQL } from "@rivonclaw/core";
import type { Workbook } from "exceljs";

/** Collect every page before offering a file, so a failed request never produces a partial export. */
export async function collectAffiliateCreatorExportRows(
  readPage: (offset: number) => Promise<GQL.AffiliateCreatorUpdateExportPage>,
  onProgress: (count: number) => void = () => {},
): Promise<GQL.AffiliateCreatorUpdateExportRow[]> {
  const rows: GQL.AffiliateCreatorUpdateExportRow[] = [];
  const seen = new Set<string>();
  while (true) {
    const page = await readPage(rows.length);
    if (page.offset !== rows.length || (page.hasMore && !page.items.length)) {
      throw new Error("Creator export pagination did not advance; refresh and try again");
    }
    for (const row of page.items) {
      if (seen.has(row.creatorRelationshipId)) {
        throw new Error("Creator export changed during download; refresh and try again");
      }
      seen.add(row.creatorRelationshipId);
      rows.push(row);
    }
    onProgress(rows.length);
    if (!page.hasMore) return rows;
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
