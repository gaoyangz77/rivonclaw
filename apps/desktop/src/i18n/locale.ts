export const SUPPORTED_LOCALES = ["en", "zh", "de", "es", "fr", "id", "it", "th"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export type StaffLanguage =
  | "English"
  | "Chinese"
  | "German"
  | "Spanish"
  | "French"
  | "Indonesian"
  | "Italian"
  | "Thai";

const STAFF_LANGUAGE_BY_LOCALE: Record<AppLocale, StaffLanguage> = {
  en: "English",
  zh: "Chinese",
  de: "German",
  es: "Spanish",
  fr: "French",
  id: "Indonesian",
  it: "Italian",
  th: "Thai",
};

export function normalizeAppLocale(locale: string | undefined | null): AppLocale {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.includes(language as AppLocale) ? language as AppLocale : "en";
}

export function getSystemLocale(): AppLocale {
  try {
    return normalizeAppLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return "en";
  }
}

export function localeToStaffLanguage(locale: string | undefined | null): StaffLanguage {
  return STAFF_LANGUAGE_BY_LOCALE[normalizeAppLocale(locale)];
}

export function localeToHtmlLang(locale: string): string {
  const normalized = normalizeAppLocale(locale);
  return normalized === "zh" ? "zh-CN" : normalized;
}
