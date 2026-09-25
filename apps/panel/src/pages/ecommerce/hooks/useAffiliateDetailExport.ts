import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import type { GQL } from "@rivonclaw/core";
import { AFFILIATE_BI_DATA_QUERY } from "../../../api/affiliate-analytics-queries.js";
import {
  buildAffiliateDetailWorkbook,
  fetchAllAffiliateDetailRows,
} from "../affiliate-detail-export.js";

type DataResult = { getEcommerceBiData: GQL.EcomBiQueryResult };
type DataVariables = { input: GQL.EcomBiQueryInput };

export interface AffiliateDetailExportRequest {
  input: GQL.EcomBiQueryInput;
  columns: readonly string[];
  sheetName: string;
  filename: string;
  label: (key: string) => string;
  displayText: (key: string, value: unknown) => string;
}

/**
 * Downloads every row of one frozen sample-detail query as .xlsx. Pages are
 * fetched sequentially with `no-cache` so tens of thousands of rows never
 * enter the Apollo cache. `cancel()` (also called on unmount) aborts the
 * in-flight request and guarantees no partial file is written.
 */
export function useAffiliateDetailExport() {
  const client = useApolloClient();
  const controllerRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number | null } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const cancel = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setProgress(null);
  };

  const start = async (request: AffiliateDetailExportRequest) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    const { signal } = controller;
    controllerRef.current = controller;
    setError(null);
    setProgress({ done: 0, total: null });
    try {
      const rows = await fetchAllAffiliateDetailRows({
        input: request.input,
        signal,
        onProgress: (done, total) => {
          if (controllerRef.current === controller) setProgress({ done, total });
        },
        fetchPage: async (input, pageSignal) => {
          const response = await client.query<DataResult, DataVariables>({
            query: AFFILIATE_BI_DATA_QUERY,
            variables: { input },
            fetchPolicy: "no-cache",
            context: { fetchOptions: { signal: pageSignal } },
          });
          const result = response.data?.getEcommerceBiData;
          if (!result) throw response.error ?? new Error("Affiliate detail query returned no data");
          return { rows: result.rows, pageInfo: result.pageInfo };
        },
      });
      const { default: ExcelJS } = await import("exceljs");
      signal.throwIfAborted();
      const workbook = buildAffiliateDetailWorkbook(ExcelJS, {
        sheetName: request.sheetName,
        columns: request.columns,
        rows,
        label: request.label,
        displayText: request.displayText,
      });
      const bytes = await workbook.xlsx.writeBuffer();
      signal.throwIfAborted();
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = request.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (caught) {
      // Cancellation is the requested outcome, not a failure: nothing to report.
      if (signal.aborted) return;
      setError(caught);
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setProgress(null);
      }
    }
  };

  return {
    exporting: progress !== null,
    progress,
    error,
    start,
    cancel,
    clearError: () => setError(null),
  };
}
