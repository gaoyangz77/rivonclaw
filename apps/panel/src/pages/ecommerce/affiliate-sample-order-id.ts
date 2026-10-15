/** Display only a real Provider order ID; legacy projections can contain "0". */
export function sampleOrderIdForCard(nested?: string | null, legacy?: string | null): string | null {
  for (const value of [nested, legacy]) {
    const id = value?.trim();
    if (id && !/^0+$/.test(id)) return id;
  }
  return null;
}
