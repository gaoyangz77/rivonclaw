import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { PRODUCT_KNOWLEDGES_QUERY } from "../../../api/product-knowledge-queries.js";
import { TkButton } from "../../../components/design-system/index.js";
import { DownloadIcon } from "../../../components/icons.js";
import { useToast } from "../../../components/Toast.js";
import { downloadAfterSaleWorkbook } from "../after-sale-export.js";
import {
  buildProductKnowledgeWorkbook,
  collectProductKnowledgeExportRows,
  type ProductKnowledgeExportText,
} from "../product-knowledge-export.js";

const PREFIX = "ecommerce.productKnowledge.export";

/**
 * Downloads every Product Knowledge entry the list shows as .xlsx, not only the loaded page
 * (ADR-103 §6). The status and search are frozen when the download starts; the rows never enter
 * the Apollo cache.
 */
export function ProductKnowledgeExportButton({
  status,
  search,
  disabled,
}: {
  status: GQL.ProductKnowledgeStatus;
  search: string;
  disabled: boolean;
}) {
  const client = useApolloClient();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function download() {
    const filter = { status, search: search || null };
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: 0 });
    try {
      const rows = await collectProductKnowledgeExportRows({
        readPage: async (offset, limit) => {
          const result = await client.query<{ productKnowledges: GQL.ProductKnowledgePage }>({
            query: PRODUCT_KNOWLEDGES_QUERY,
            variables: { input: { ...filter, offset, limit } },
            fetchPolicy: "no-cache",
            context: { fetchOptions: { signal: controller.signal } },
          });
          if (!result.data) throw new Error(t(`${PREFIX}.failed`));
          return result.data.productKnowledges;
        },
        onProgress: (done, total) => {
          if (!controller.signal.aborted) setProgress({ done, total });
        },
      });
      if (rows.length === 0) {
        showToast(t(`${PREFIX}.empty`), "warning");
        return;
      }
      const { default: ExcelJS } = await import("exceljs");
      if (controller.signal.aborted) return;
      const text: ProductKnowledgeExportText = {
        header: (column) => t(`${PREFIX}.columns.${column}`),
        status: (value) =>
          value === GQL.ProductKnowledgeStatus.Archived
            ? t("ecommerce.productKnowledge.archivedStatus")
            : t("ecommerce.productKnowledge.active"),
      };
      const workbook = buildProductKnowledgeWorkbook(ExcelJS, {
        sheetName: t(`${PREFIX}.sheetName`),
        rows,
        text,
      });
      const day = new Date().toISOString().slice(0, 10);
      const scope = filter.status === GQL.ProductKnowledgeStatus.Archived ? "archived" : "active";
      await downloadAfterSaleWorkbook(workbook, `product-knowledge-${scope}-${day}.xlsx`);
    } catch (error) {
      if (!controller.signal.aborted) {
        showToast(
          `${t(`${PREFIX}.failed`)} ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setProgress(null);
      }
    }
  }

  return (
    <TkButton
      variant="secondary"
      leadingIcon={<DownloadIcon />}
      disabled={disabled || progress !== null}
      aria-busy={progress !== null || undefined}
      onClick={() => void download()}
    >
      {progress === null
        ? t(`${PREFIX}.download`)
        : t(`${PREFIX}.progress`, { done: progress.done, total: progress.total })}
    </TkButton>
  );
}
