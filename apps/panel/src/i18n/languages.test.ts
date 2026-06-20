import { describe, expect, it } from "vitest";
import i18n from "./index.js";
import { LANGUAGE_OPTIONS } from "./languages.js";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value)
    .flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

describe("panel i18n resources", () => {
  it("disables English fallback for supported locales", () => {
    expect(i18n.options.fallbackLng).toBe(false);
  });

  it("does not introduce translation-key gaps beyond the tracked legacy baseline", () => {
    const [baseLanguage, ...otherLanguages] = LANGUAGE_OPTIONS;
    expect(baseLanguage, "base language").toBeDefined();

    const baseKeys = flattenKeys(baseLanguage.resource);
    const legacyMissingBaseline: Record<string, number> = {
      zh: 0,
      de: 216,
      es: 216,
      fr: 216,
      id: 216,
      it: 216,
      th: 216,
    };

    for (const language of otherLanguages) {
      const languageKeys = flattenKeys(language.resource);
      const missing = baseKeys.filter((key) => !languageKeys.includes(key));
      const extra = languageKeys.filter((key) => !baseKeys.includes(key));

      expect(
        missing,
        `${language.code} missing keys must not grow; backfill legacy keys to reduce this baseline`,
      ).toHaveLength(legacyMissingBaseline[language.code] ?? 0);
      expect(extra, `${language.code} extra keys`).toEqual([]);
    }
  });
});
