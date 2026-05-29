import en from "./en.js";
import zh from "./zh.js";
import de from "./de.js";
import es from "./es.js";
import fr from "./fr.js";
import id from "./id.js";
import it from "./it.js";
import th from "./th.js";

type TranslationResource = object;
export type SupportedLanguageCode = "en" | "zh" | "de" | "es" | "fr" | "id" | "it" | "th";

interface LanguageOption {
  code: SupportedLanguageCode;
  label: string;
  resource: TranslationResource;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "en", label: "English", resource: en },
  { code: "zh", label: "中文", resource: zh },
  { code: "de", label: "Deutsch", resource: de },
  { code: "es", label: "Español", resource: es },
  { code: "fr", label: "Français", resource: fr },
  { code: "id", label: "Bahasa Indonesia", resource: id },
  { code: "it", label: "Italiano", resource: it },
  { code: "th", label: "ไทย", resource: th },
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
