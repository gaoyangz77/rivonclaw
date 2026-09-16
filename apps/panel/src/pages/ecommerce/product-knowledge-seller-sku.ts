/**
 * Seller SKU discovery input parsing.
 *
 * The same product usually carries a different Seller SKU in each shop, so the
 * merchant pastes several at once. Chinese merchants type the full-width comma
 * as readily as the ASCII one, so both separate entries.
 */

const SELLER_SKU_SEPARATORS = /[,，]/;

/**
 * Splits a pasted Seller SKU field into the list sent to the backend: trimmed,
 * empties dropped, duplicates removed, input order kept. Case is preserved —
 * platform Seller SKUs are case-sensitive.
 */
export function splitSellerSkuInput(value: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(SELLER_SKU_SEPARATORS)) {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
