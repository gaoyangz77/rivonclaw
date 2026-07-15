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
import { AFFILIATE_TEAM_TRANSLATIONS } from "./affiliate-team-translations.js";
import { AFFILIATE_CHANNEL_TRANSLATIONS } from "./affiliate-channel-translations.js";

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

function mergeTranslationResources<T extends TranslationResourceRecord>(
  resource: T,
  ...backfills: TranslationResourceRecord[]
): T {
  return backfills.reduce<TranslationResourceRecord>(
    (merged, backfill) => mergeTranslationResource(merged, backfill),
    resource,
  ) as T;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "en", label: "English", resource: mergeTranslationResources(en, AFFILIATE_TEAM_TRANSLATIONS.en, AFFILIATE_CHANNEL_TRANSLATIONS.en) },
  { code: "zh", label: "中文", resource: mergeTranslationResources(zh, AFFILIATE_TEAM_TRANSLATIONS.zh, AFFILIATE_CHANNEL_TRANSLATIONS.zh) },
  { code: "de", label: "Deutsch", resource: mergeTranslationResources(de, LEGACY_I18N_BACKFILL.de, RECENT_TRANSLATIONS.de, AFFILIATE_TEAM_TRANSLATIONS.de, AFFILIATE_CHANNEL_TRANSLATIONS.de) },
  { code: "es", label: "Español", resource: mergeTranslationResources(es, LEGACY_I18N_BACKFILL.es, RECENT_TRANSLATIONS.es, AFFILIATE_TEAM_TRANSLATIONS.es, AFFILIATE_CHANNEL_TRANSLATIONS.es) },
  { code: "fr", label: "Français", resource: mergeTranslationResources(fr, LEGACY_I18N_BACKFILL.fr, RECENT_TRANSLATIONS.fr, AFFILIATE_TEAM_TRANSLATIONS.fr, AFFILIATE_CHANNEL_TRANSLATIONS.fr) },
  { code: "id", label: "Bahasa Indonesia", resource: mergeTranslationResources(id, LEGACY_I18N_BACKFILL.id, RECENT_TRANSLATIONS.id, AFFILIATE_TEAM_TRANSLATIONS.id, AFFILIATE_CHANNEL_TRANSLATIONS.id) },
  { code: "it", label: "Italiano", resource: mergeTranslationResources(it, LEGACY_I18N_BACKFILL.it, RECENT_TRANSLATIONS.it, AFFILIATE_TEAM_TRANSLATIONS.it, AFFILIATE_CHANNEL_TRANSLATIONS.it) },
  { code: "th", label: "ไทย", resource: mergeTranslationResources(th, LEGACY_I18N_BACKFILL.th, RECENT_TRANSLATIONS.th, AFFILIATE_TEAM_TRANSLATIONS.th, AFFILIATE_CHANNEL_TRANSLATIONS.th) },
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
