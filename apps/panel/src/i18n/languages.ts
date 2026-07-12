import en from "./en.js";
import zh from "./zh.js";
import de from "./de.js";
import es from "./es.js";
import fr from "./fr.js";
import id from "./id.js";
import it from "./it.js";
import th from "./th.js";
import { LEGACY_I18N_BACKFILL } from "./legacy-backfill.js";
import { RECENT_TRANSLATIONS } from "./recent-translations.js";

type TranslationResource = object;
export type SupportedLanguageCode = "en" | "zh" | "de" | "es" | "fr" | "id" | "it" | "th";

type TranslationResourceRecord = Record<string, unknown>;

interface LanguageOption {
  code: SupportedLanguageCode;
  label: string;
  resource: TranslationResource;
}

function isRecord(value: unknown): value is TranslationResourceRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeTranslationResource<T extends TranslationResourceRecord>(
  resource: T,
  backfill: TranslationResourceRecord = {},
): T {
  const merged: TranslationResourceRecord = { ...resource };
  for (const [key, value] of Object.entries(backfill)) {
    const existing = merged[key];
    merged[key] = isRecord(existing) && isRecord(value)
      ? mergeTranslationResource(existing, value)
      : value;
  }
  return merged as T;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "en", label: "English", resource: en },
  { code: "zh", label: "中文", resource: zh },
  { code: "de", label: "Deutsch", resource: mergeTranslationResource(mergeTranslationResource(de, LEGACY_I18N_BACKFILL.de), RECENT_TRANSLATIONS.de) },
  { code: "es", label: "Español", resource: mergeTranslationResource(mergeTranslationResource(es, LEGACY_I18N_BACKFILL.es), RECENT_TRANSLATIONS.es) },
  { code: "fr", label: "Français", resource: mergeTranslationResource(mergeTranslationResource(fr, LEGACY_I18N_BACKFILL.fr), RECENT_TRANSLATIONS.fr) },
  { code: "id", label: "Bahasa Indonesia", resource: mergeTranslationResource(mergeTranslationResource(id, LEGACY_I18N_BACKFILL.id), RECENT_TRANSLATIONS.id) },
  { code: "it", label: "Italiano", resource: mergeTranslationResource(mergeTranslationResource(it, LEGACY_I18N_BACKFILL.it), RECENT_TRANSLATIONS.it) },
  { code: "th", label: "ไทย", resource: mergeTranslationResource(mergeTranslationResource(th, LEGACY_I18N_BACKFILL.th), RECENT_TRANSLATIONS.th) },
] as const;

export const SUPPORTED_LANGUAGE_CODES: readonly SupportedLanguageCode[] = LANGUAGE_OPTIONS.map((language) => language.code);

export function normalizeLanguageCode(locale: string | undefined | null): SupportedLanguageCode {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGE_CODES.includes(language as SupportedLanguageCode)
    ? language as SupportedLanguageCode
    : "en";
}

export const LANGUAGE_RESOURCES = Object.fromEntries(
  LANGUAGE_OPTIONS.map((language) => [language.code, { translation: language.resource }]),
) as Record<SupportedLanguageCode, { translation: TranslationResource }>;
