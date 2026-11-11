/** Most order numbers one list search takes; the backend refuses more. */
export const MAX_ORDER_SEARCH_IDS = 50;

/**
 * Order numbers typed or pasted into a list search box: split on commas, semicolons and white
 * space (a pasted spreadsheet column), de-duplicated, in the order given.
 */
export function parseOrderSearch(text: string): string[] {
  return [...new Set(text.split(/[\s,;，；、]+/u).filter(Boolean))];
}

/** A paste into a single-line box loses its line breaks; keep them as separators instead. */
export function pastedOrderSearch(pasted: string): string {
  return pasted.replace(/\r\n?|\n/g, ",");
}
