import { useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import type { GQL } from "@rivonclaw/core";
import { AFFILIATE_BI_DATA_QUERY } from "../../../api/affiliate-analytics-queries.js";
import { requireAffiliateDetailTotalRows } from "../affiliate-detail-export.js";

export const AFFILIATE_DETAIL_PAGE_SIZE = 50;

type Row = Record<string, unknown>;
type DataResult = { getEcommerceBiData: GQL.EcomBiQueryResult };
type DataVariables = { input: GQL.EcomBiQueryInput };

interface AffiliateDetailPagesState {
  /** The input frozen by the last search; every page and the export use it. */
  input: GQL.EcomBiQueryInput | null;
  /** Zero-based index of the page whose rows are displayed. */
  pageIndex: number;
  rows: Row[];
  totalRows: number | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: AffiliateDetailPagesState = {
  input: null,
  pageIndex: 0,
  rows: [],
  totalRows: null,
  loading: false,
  error: null,
};

/**
 * Offset pager over one frozen sample-detail query. A search freezes its input;
 * page navigation re-reads that frozen input so filter edits made after the
 * search never leak into later pages. The current rows stay visible while the
 * next page loads, and a superseded response never overwrites a newer one.
 */
export function useAffiliateDetailPages() {
  const client = useApolloClient();
  const sequence = useRef(0);
  const [state, setState] = useState<AffiliateDetailPagesState>(EMPTY);

  const load = async (input: GQL.EcomBiQueryInput, pageIndex: number): Promise<boolean> => {
    const request = ++sequence.current;
    try {
      const response = await client.query<DataResult, DataVariables>({
        query: AFFILIATE_BI_DATA_QUERY,
        variables: {
          input: {
            ...input,
            limit: AFFILIATE_DETAIL_PAGE_SIZE,
            offset: pageIndex * AFFILIATE_DETAIL_PAGE_SIZE,
          },
        },
        // Rows live in this hook's state; nothing reads them back from the cache.
        fetchPolicy: "no-cache",
      });
      if (request !== sequence.current) return false;
      const result = response.data?.getEcommerceBiData;
      if (!result) throw response.error ?? new Error("Affiliate detail query returned no data");
      const totalRows = requireAffiliateDetailTotalRows(result.pageInfo);
      setState({ input, pageIndex, rows: result.rows as Row[], totalRows, loading: false, error: null });
      return true;
    } catch (error) {
      // A superseded request no longer owns the visible state.
      if (request !== sequence.current) return false;
      const message = error instanceof Error ? error.message : String(error);
      setState((current) => ({ ...current, loading: false, error: message }));
      return false;
    }
  };

  /** Freeze `input` and show its first page; clears the previous result. */
  const search = (input: GQL.EcomBiQueryInput): Promise<boolean> => {
    setState({ ...EMPTY, input, loading: true });
    return load(input, 0);
  };

  /** Show another page of the frozen search, keeping current rows until it arrives. */
  const goTo = (pageIndex: number): Promise<boolean> => {
    const input = state.input;
    if (!input) throw new Error("Affiliate detail page requested before any search");
    setState((current) => ({ ...current, loading: true, error: null }));
    return load(input, pageIndex);
  };

  /** Drop the result and ignore any in-flight response. */
  const reset = () => {
    sequence.current += 1;
    setState(EMPTY);
  };

  return { ...state, search, goTo, reset };
}
