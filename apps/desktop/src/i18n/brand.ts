/** Locale-aware brand name for the Electron main process. */
const BRAND: Record<string, string> = {
  zh: "DlxAI",
  en: "DlxAI",
};

/** Get the brand name for the given locale. */
export function brandName(locale: string): string {
  return BRAND[locale] ?? BRAND.en;
}
