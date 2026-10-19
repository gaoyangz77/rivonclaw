import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface WorkbenchPage<Row> {
  items: Row[];
  nextCursor?: string | null;
  hasMore: boolean;
}

interface PageBuffer<Row, Page extends WorkbenchPage<Row>> {
  filterKey: string;
  firstPage: Page | undefined;
  page: Page | undefined;
  items: Row[];
  pageCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

interface Options<Row, Page extends WorkbenchPage<Row>> {
  filterKey: string;
  firstPage: Page | undefined;
  refreshRevision?: number;
  enabled?: boolean;
  rowKey?: (row: Row) => string;
  mergePages?: (previous: Page, next: Page) => Page;
  throwOnError?: boolean;
  /** Read a page without replacing the observed first-page query in Apollo. */
  fetchPage: (cursor: string | null) => Promise<Page | undefined>;
  /** A changed product binding can invalidate a cursor; retry once from page 1. */
  onError: (error: unknown) => "refresh" | void;
}

function emptyBuffer<Row, Page extends WorkbenchPage<Row>>(
  filterKey: string,
): PageBuffer<Row, Page> {
  return {
    filterKey,
    firstPage: undefined,
    page: undefined,
    items: [],
    pageCount: 0,
    nextCursor: null,
    hasMore: false,
  };
}

function uniqueRows<Row>(rows: Row[], rowKey: (row: Row) => string): Row[] {
  return [...new Map(rows.map((row) => [rowKey(row), row])).values()];
}

/**
 * Workbench facts change while a seller reviews later pages. Revalidate the
 * whole loaded range with fresh, chained cursors and publish it atomically.
 * Merely merging page 1 into an old tail would retain handled/deleted rows;
 * replacing it would collapse the list after every SSE/focus refresh.
 */
export function useWorkbenchPagination<Row, Page extends WorkbenchPage<Row>>(
  options: Options<Row, Page>,
) {
  const { filterKey, firstPage, refreshRevision = 0, enabled = true } = options;
  const [buffer, setBuffer] = useState<PageBuffer<Row, Page>>(() => emptyBuffer(filterKey));
  const [failure, setFailure] = useState<{ filterKey: string; error: Error } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // These are plain Apollo result snapshots and request state, never MST nodes.
  const bufferRef = useRef(buffer);
  const optionsRef = useRef(options);
  const scopeRef = useRef({
    filterKey,
    enabled,
    running: false,
    refreshing: false,
    refreshQueued: false,
  });
  useLayoutEffect(() => {
    optionsRef.current = options;
    if (scopeRef.current.filterKey !== filterKey || scopeRef.current.enabled !== enabled) {
      // Object identity invalidates requests even after A -> B -> A filters.
      scopeRef.current = {
        filterKey,
        enabled,
        running: false,
        refreshing: false,
        refreshQueued: false,
      };
      setBusyKey(null);
    }
  });

  const commit = useCallback((next: PageBuffer<Row, Page>) => {
    bufferRef.current = next;
    setFailure(null);
    setBuffer(next);
  }, []);

  const run = useCallback(
    async (mode: "more" | "refresh", seed?: Page) => {
      const scope = scopeRef.current;
      if (!scope.enabled) return;
      if (scope.running) {
        if (mode === "refresh") scope.refreshQueued = true;
        return;
      }
      const request = optionsRef.current;
      const rowKey = request.rowKey ?? ((row: Row) => (row as { id: string }).id);
      const combine = (previous: Page, next: Page): Page => {
        const merged = request.mergePages?.(previous, next) ?? {
          ...previous,
          ...next,
          items: [...previous.items, ...next.items],
        };
        return { ...merged, items: uniqueRows(merged.items, rowKey) };
      };
      const currentBuffer =
        bufferRef.current.filterKey === scope.filterKey
          ? bufferRef.current
          : emptyBuffer<Row, Page>(scope.filterKey);
      if (mode === "more" && (!currentBuffer.hasMore || !currentBuffer.nextCursor)) return;
      scope.running = true;
      setFailure(null);
      setBusyKey(scope.filterKey);
      const active = () => scopeRef.current === scope;
      let cursorRecovered = false;
      try {
        do {
          scope.refreshQueued = false;
          scope.refreshing = mode === "refresh";
          const current =
            bufferRef.current.filterKey === scope.filterKey
              ? bufferRef.current
              : emptyBuffer<Row, Page>(scope.filterKey);
          try {
            if (mode === "more") {
              const next = await request.fetchPage(current.nextCursor);
              if (!active() || !next) return;
              setFailure(null);
              const page = current.page ? combine(current.page, next) : next;
              commit({
                ...current,
                page,
                items: page.items,
                pageCount: current.pageCount + 1,
                nextCursor: next.nextCursor ?? null,
                hasMore: next.hasMore,
              });
            } else {
              let page = seed ?? (await request.fetchPage(null));
              if (!active() || !page) return;
              setFailure(null);
              const refreshedFirstPage = page;
              let combined = { ...page, items: uniqueRows(page.items, rowKey) };
              let pageCount = 1;
              while (pageCount < current.pageCount && page.hasMore && page.nextCursor) {
                page = await request.fetchPage(page.nextCursor);
                if (!active() || !page) return;
                combined = combine(combined, page);
                pageCount += 1;
              }
              commit({
                filterKey: scope.filterKey,
                firstPage: refreshedFirstPage,
                page: combined,
                items: combined.items,
                pageCount,
                nextCursor: page.nextCursor ?? null,
                hasMore: page.hasMore,
              });
            }
          } catch (error) {
            if (!active()) return;
            setFailure({
              filterKey: scope.filterKey,
              error: error instanceof Error ? error : new Error(String(error)),
            });
            const recovery = request.onError(error);
            if (recovery === "refresh" && !cursorRecovered) {
              cursorRecovered = true;
              scope.refreshQueued = true;
            } else if (request.throwOnError) {
              throw error;
            }
          }
          mode = "refresh";
          seed = undefined;
        } while (active() && scope.refreshQueued);
      } finally {
        if (active()) {
          scope.running = false;
          scope.refreshing = false;
          setBusyKey(null);
        }
      }
    },
    [commit],
  );

  useEffect(() => {
    if (!enabled || !firstPage) return;
    const scope = scopeRef.current;
    if (scope.running) {
      // A cache update during pagination must be checked after the append.
      if (!scope.refreshing) scope.refreshQueued = true;
      return;
    }
    const current = bufferRef.current;
    if (current.filterKey === filterKey && current.pageCount > 1) {
      void run("refresh", firstPage);
    } else {
      commit({
        filterKey,
        firstPage,
        page: firstPage,
        items: uniqueRows(
          firstPage.items,
          optionsRef.current.rowKey ?? ((row: Row) => (row as { id: string }).id),
        ),
        pageCount: 1,
        nextCursor: firstPage.nextCursor ?? null,
        hasMore: firstPage.hasMore,
      });
    }
  }, [commit, enabled, filterKey, firstPage, run]);

  const lastRevision = useRef(refreshRevision);
  useEffect(() => {
    if (lastRevision.current === refreshRevision) return;
    lastRevision.current = refreshRevision;
    void run("refresh");
  }, [refreshRevision, run]);
  useEffect(
    () => () => {
      // Unmounted tabs cannot commit responses or display their errors.
      scopeRef.current = {
        filterKey: "",
        enabled: false,
        running: false,
        refreshing: false,
        refreshQueued: false,
      };
    },
    [],
  );

  const active = buffer.filterKey === filterKey ? buffer : emptyBuffer<Row, Page>(filterKey);
  return {
    ...active,
    loaded: active.pageCount > 0,
    error: failure?.filterKey === filterKey ? failure.error : null,
    loading: busyKey === filterKey,
    loadMore: useCallback(() => run("more"), [run]),
    refresh: useCallback(() => run("refresh"), [run]),
  };
}
