export interface CursorPage<Item> {
  items: readonly Item[];
  nextCursor?: string | null;
}

export interface CursorPageBuffer<Item> {
  queryKey: string;
  items: Item[];
  nextCursor: string | null;
  loadedMore: boolean;
}

export function emptyCursorPageBuffer<Item>(queryKey: string): CursorPageBuffer<Item> {
  return { queryKey, items: [], nextCursor: null, loadedMore: false };
}

/**
 * Reconcile a freshly queried first page with an optional loaded tail.
 *
 * Polls and refetches always request page 1. Before any load-more request that
 * page is authoritative. Once later pages have been loaded, a page-1 refresh
 * updates and prepends its rows while retaining the loaded tail and its cursor.
 */
export function replaceCursorPageBufferFirstPage<Item>(
  current: CursorPageBuffer<Item>,
  queryKey: string,
  page: CursorPage<Item>,
  itemKey: (item: Item) => string,
): CursorPageBuffer<Item> {
  const firstPageItems = uniqueByKey(page.items, itemKey);
  if (current.queryKey !== queryKey || !current.loadedMore) {
    return {
      queryKey,
      items: firstPageItems,
      nextCursor: page.nextCursor ?? null,
      loadedMore: false,
    };
  }

  const refreshedKeys = new Set(firstPageItems.map(itemKey));
  return {
    ...current,
    items: [
      ...firstPageItems,
      ...current.items.filter((item) => !refreshedKeys.has(itemKey(item))),
    ],
  };
}

export function appendCursorPageBuffer<Item>(
  current: CursorPageBuffer<Item>,
  queryKey: string,
  page: CursorPage<Item>,
  itemKey: (item: Item) => string,
): CursorPageBuffer<Item> {
  if (current.queryKey !== queryKey) return current;
  const existingKeys = new Set(current.items.map(itemKey));
  return {
    queryKey,
    items: [
      ...current.items,
      ...page.items.filter((item) => {
        const key = itemKey(item);
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      }),
    ],
    nextCursor: page.nextCursor ?? null,
    loadedMore: true,
  };
}

function uniqueByKey<Item>(items: readonly Item[], itemKey: (item: Item) => string): Item[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = itemKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
