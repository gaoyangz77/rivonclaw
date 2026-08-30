import { describe, expect, it } from "vitest";
import { AFFILIATE_ESCALATION_TRANSLATIONS } from "./affiliate-escalation-translations.js";

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      Object.entries(flatten(child, prefix ? `${prefix}.${key}` : key)),
    ),
  );
}

describe("Affiliate escalation i18n parity", () => {
  it("ships the same non-empty keys in all eight locales without fallback", () => {
    const locales = ["en", "zh", "de", "es", "fr", "id", "it", "th"] as const;
    const expectedKeys = Object.keys(flatten(AFFILIATE_ESCALATION_TRANSLATIONS.en)).sort();
    for (const locale of locales) {
      const values = flatten(AFFILIATE_ESCALATION_TRANSLATIONS[locale]);
      expect(Object.keys(values).sort(), locale).toEqual(expectedKeys);
      expect(
        Object.values(values).every((value) => value.trim().length > 0),
        locale,
      ).toBe(true);
    }
  });
});
