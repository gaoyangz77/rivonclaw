/** Locale-aware brand name for the Electron main process. */
const BRAND: Record<string, string> = {
  zh: "TK匠",
  en: "TK Copilot",
  de: "TK Copilot",
  es: "TK Copilot",
  fr: "TK Copilot",
  id: "TK Copilot",
  it: "TK Copilot",
  th: "TK Copilot",
};

/** Get the brand name for the given locale. */
export function brandName(locale: string): string {
  return BRAND[locale] ?? BRAND.en;
}
