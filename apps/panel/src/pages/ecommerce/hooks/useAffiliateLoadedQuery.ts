import { useLayoutEffect, useMemo, useRef } from "react";
import { useQuery } from "@apollo/client/react";
import type { DocumentNode } from "graphql";
import { useWorkbenchPagination } from "../useWorkbenchPagination.js";

interface PageInfo {
  hasMore: boolean;
  nextCursor: string | null;
}
interface Options<Row, Page extends { items: Row[] }, Input extends object, Field extends string> {
  field: Field;
  input: Input;
  queryKey: string;
  enabled: boolean;
  rowKey: (row: Row) => string;
  pageInfo?: (page: Page) => PageInfo;
  withCursor?: (input: Input, cursor: string | null) => Input;
  mergePages?: (previous: Page, next: Page) => Page;
  onError?: (error: unknown) => void;
  throwOnError?: boolean;
}

/** One loaded range for cursor, offset and timeline APIs, using backend-owned payload types. */
export function useAffiliateLoadedQuery<
  Row,
  Page extends { items: Row[] },
  Input extends object,
  Field extends string,
>(document: DocumentNode, options: Options<Row, Page, Input, Field>) {
  const { field, input, enabled, queryKey, rowKey, pageInfo, withCursor, mergePages } = options;
  const query = useQuery<Record<Field, Page>, { input: Input }>(document, {
    variables: { input },
    skip: !enabled,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const rawPage = query.data?.[field];
  const firstPage = useMemo(() => {
    if (!rawPage) return undefined;
    const info = pageInfo
      ? pageInfo(rawPage)
      : {
          hasMore: Boolean((rawPage as Page & { hasMore: boolean }).hasMore),
          nextCursor: (rawPage as Page & { nextCursor?: string | null }).nextCursor ?? null,
        };
    return { ...info, items: rawPage.items, payload: rawPage };
  }, [rawPage, pageInfo]);
  const loadedPageCount = useRef(0);
  const pagination = useWorkbenchPagination<Row, NonNullable<typeof firstPage>>({
    filterKey: queryKey,
    enabled,
    firstPage,
    rowKey,
    throwOnError: options.throwOnError,
    fetchPage: async (cursor) => {
      const pageInput = withCursor
        ? withCursor(input, cursor)
        : cursor === null
          ? input
          : { ...input, cursor };
      // A single page can use Apollo's ordinary refetch/retry semantics. Once
      // more pages are loaded, read without overwriting the observed page 1.
      const result =
        cursor === null && loadedPageCount.current <= 1
          ? await query.refetch({ input: pageInput })
          : await query.fetchMore({
              variables: { input: pageInput },
              updateQuery: (current) => current,
            });
      const page = result?.data?.[field];
      if (!page) return undefined;
      const info = pageInfo
        ? pageInfo(page)
        : {
            hasMore: Boolean((page as Page & { hasMore: boolean }).hasMore),
            nextCursor: (page as Page & { nextCursor?: string | null }).nextCursor ?? null,
          };
      return { ...info, items: page.items, payload: page };
    },
    mergePages: (previous, next) => {
      const payload = mergePages?.(previous.payload, next.payload);
      const items = [
        ...new Map(
          (payload?.items ?? [...previous.items, ...next.items]).map((row) => [rowKey(row), row]),
        ).values(),
      ];
      return {
        ...next,
        items,
        payload: {
          ...(payload ?? { ...previous.payload, ...next.payload }),
          items,
        },
      };
    },
    onError: (error) => {
      options.onError?.(error);
    },
  });
  useLayoutEffect(() => {
    loadedPageCount.current = pagination.pageCount;
  }, [pagination.pageCount]);
  return {
    paginationLoading: pagination.loading,
    data: pagination.page
      ? ({ [field]: pagination.page.payload } as Record<Field, Page>)
      : undefined,
    loading: query.loading || pagination.loading,
    error: pagination.error ?? query.error,
    refetch: pagination.refresh,
    loadMore: pagination.loadMore,
    fetchMore: query.fetchMore,
    pageCount: pagination.pageCount,
  };
}
