import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
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

function flattenValues(value: unknown, prefix = ""): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? { [prefix]: String(value) } : {};
  }

  return Object.assign(
    {},
    ...Object.entries(value).map(([key, child]) => flattenValues(child, prefix ? `${prefix}.${key}` : key)),
  );
}

function interpolationVariables(value: string): string[] {
  return [...value.matchAll(/{{\s*[\w.]+\s*}}/g)]
    .map((match) => match[0].replace(/\s+/g, ""))
    .sort();
}

describe("panel i18n resources", () => {
  it("disables English fallback for supported locales", () => {
    expect(i18n.options.fallbackLng).toBe(false);
  });

  it("keeps every supported locale at complete key parity", () => {
    const [baseLanguage, ...otherLanguages] = LANGUAGE_OPTIONS;
    expect(baseLanguage, "base language").toBeDefined();

    const baseKeys = flattenKeys(baseLanguage.resource);

    for (const language of otherLanguages) {
      const languageKeys = flattenKeys(language.resource);
      const missing = baseKeys.filter((key) => !languageKeys.includes(key));
      const extra = languageKeys.filter((key) => !baseKeys.includes(key));

      expect(missing, `${language.code} missing keys`).toEqual([]);
      expect(extra, `${language.code} extra keys`).toEqual([]);
    }
  });

  it("keeps interpolation variables aligned across all supported locales", () => {
    const [baseLanguage, ...otherLanguages] = LANGUAGE_OPTIONS;
    expect(baseLanguage, "base language").toBeDefined();

    const baseValues = flattenValues(baseLanguage.resource);
    for (const language of otherLanguages) {
      const languageValues = flattenValues(language.resource);
      for (const [key, baseValue] of Object.entries(baseValues)) {
        expect(
          interpolationVariables(languageValues[key] ?? ""),
          `${language.code} ${key} interpolation variables`,
        ).toEqual(interpolationVariables(baseValue));
      }
    }
  });

  it("localizes every concrete TikTok Shop onboarding market", () => {
    const markets = new Set([
      ...Object.values(GQL.ShopRegion),
      ...Object.values(GQL.PlatformMarket).filter((market) => market !== GQL.PlatformMarket.Row),
    ]);

    for (const language of LANGUAGE_OPTIONS) {
      const keys = new Set(flattenKeys(language.resource));
      for (const market of markets) {
        expect(keys.has(`ecommerce.market.${market}`), `${language.code} ${market}`).toBe(true);
      }
    }
  });
});
