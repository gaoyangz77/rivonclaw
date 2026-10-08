import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_CREATOR_UPDATE_EXPORT_PAGE_QUERY,
  CREATOR_MANUAL_TAGS_QUERY,
} from "../../../api/shops-queries.js";
import { TkButton } from "../../../components/design-system/index.js";
import { DownloadIcon } from "../../../components/icons.js";
import { useToast } from "../../../components/Toast.js";
import {
  collectAffiliateCreatorExportRows,
  downloadAffiliateCreatorWorkbook,
} from "../affiliate-creator-export.js";
import { buildAffiliateCreatorUpdateTemplateWorkbook } from "../affiliate-creator-update-template.js";

export function AffiliateCreatorExportButton({ input }: { input: GQL.ReadAffiliateCreatorsInput }) {
  const client = useApolloClient();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [count, setCount] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function download() {
    const scope = structuredClone(input);
    const controller = new AbortController();
    abortRef.current = controller;
    setCount(0);
    try {
      const rows = await collectAffiliateCreatorExportRows(async (offset) => {
        const result = await client.query<{
          affiliateCreatorUpdateExportPage: GQL.AffiliateCreatorUpdateExportPage;
        }>({
          query: AFFILIATE_CREATOR_UPDATE_EXPORT_PAGE_QUERY,
          variables: { input: { ...scope, offset, limit: 100 } },
          fetchPolicy: "no-cache",
          context: { fetchOptions: { signal: controller.signal } },
        });
        if (!result.data) throw new Error(t("ecommerce.updateFailed"));
        return result.data.affiliateCreatorUpdateExportPage;
      }, setCount);
      if (!rows.length) {
        showToast(t("ecommerce.affiliateTeam.creatorExportEmpty"), "warning");
        return;
      }
      const [catalog, { default: ExcelJS }] = await Promise.all([
        client.query<{ creatorManualTags: GQL.CreatorManualTag[] }>({
          query: CREATOR_MANUAL_TAGS_QUERY,
          fetchPolicy: "no-cache",
          context: { fetchOptions: { signal: controller.signal } },
        }),
        import("exceljs"),
      ]);
      if (!catalog.data) throw new Error(t("ecommerce.updateFailed"));
      if (controller.signal.aborted) return;
      const workbook = buildAffiliateCreatorUpdateTemplateWorkbook(
        ExcelJS,
        t,
        catalog.data.creatorManualTags.map((tag) => tag.name),
        rows,
      );
      await downloadAffiliateCreatorWorkbook(workbook, "affiliate-creator-bulk-update.xlsx");
    } catch (error) {
      if (!controller.signal.aborted) {
        showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
      }
    } finally {
      if (!controller.signal.aborted) setCount(null);
      abortRef.current = null;
    }
  }

  return (
    <TkButton variant="secondary" onClick={() => void download()} disabled={count !== null}>
      <DownloadIcon />
      {count === null
        ? t("ecommerce.affiliateTeam.creatorExport")
        : t("ecommerce.affiliateTeam.creatorExportProgress", { count })}
    </TkButton>
  );
}
