import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "./index.js";
import { LANGUAGE_OPTIONS, LANGUAGE_RESOURCES } from "./languages.js";

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
    ...Object.entries(value).map(([key, child]) =>
      flattenValues(child, prefix ? `${prefix}.${key}` : key),
    ),
  );
}

function missingLabelKeys(
  values: Record<string, string>,
  labelGroups: Record<string, readonly string[]>,
): string[] {
  return Object.entries(labelGroups).flatMap(([prefix, groupValues]) =>
    groupValues.map((value) => `${prefix}.${value}`).filter((key) => !values[key]?.trim()),
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

  it("pluralizes the English sample-review bundle summary", () => {
    // A one-application bundle used to read "1 applications" in the decision package.
    const t = i18n.getFixedT("en");
    const key = "ecommerce.affiliateWorkspace.sampleReviewActions.summary";
    expect(t(key, { count: 1, approveCount: 1, rejectCount: 0, ignoreCount: 0 })).toBe(
      "1 application · 1 approve · 0 reject · 0 ignore",
    );
    expect(t(key, { count: 2, approveCount: 1, rejectCount: 1, ignoreCount: 0 })).toBe(
      "2 applications · 1 approve · 1 reject · 0 ignore",
    );
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

  it("localizes every sidebar action tooltip", () => {
    const tooltipKeys = [
      "common.themeControl",
      "common.languageControl",
      "common.openWebsite",
      "common.openInBrowser",
    ];

    for (const language of LANGUAGE_OPTIONS) {
      const values = flattenValues(language.resource);
      for (const key of tooltipKeys) {
        expect(values[key]?.trim(), `${language.code} ${key}`).toBeTruthy();
      }
    }
  });

  it("uses only the customer-facing TK brand", () => {
    for (const language of LANGUAGE_OPTIONS) {
      const values = flattenValues(language.resource);
      expect(values["common.brandName"]).toBe(language.code === "zh" ? "TK匠" : "TK Copilot");
      expect(values["providers.label_rivonclaw-pro"]).toBe(
        language.code === "zh" ? "TK匠 AI" : "TK Copilot AI",
      );
      for (const [key, value] of Object.entries(values)) {
        expect(value, `${language.code} ${key}`).not.toMatch(/RivonClaw|EasyClaw|爪爪|TKå|�/);
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

  it("labels every Affiliate work value the backend emits in every locale", () => {
    // The Affiliate workspace resolves these through t(..., { defaultValue }), so a
    // missing key silently renders a title-cased English enum in every locale.
    // triggerKind is a plain String in the schema: the backend work boundary sets it
    // to a Sample content follow-up stage, a Sample performance follow-up stage, or
    // SAMPLE_APPLICATION; the remaining kinds were labelled before those stages.
    const triggerKinds = [
      "CREATOR_MESSAGE",
      "SAMPLE_APPLICATION",
      "TARGET_COLLABORATION",
      "ORDER_ATTRIBUTION",
      "SAMPLE_CONTENT_FOLLOW_UP_DAY_3",
      "SAMPLE_CONTENT_FOLLOW_UP_DAY_7",
      "SAMPLE_CONTENT_FOLLOW_UP_DAY_12",
      "SAMPLE_PERFORMANCE_FOLLOW_UP_STAGE_1",
      "SAMPLE_PERFORMANCE_FOLLOW_UP_STAGE_2",
      "SAMPLE_PERFORMANCE_FOLLOW_UP_STAGE_3",
    ];
    const labelGroups: Record<string, readonly string[]> = {
      "ecommerce.affiliateWorkspace.agendaOwners": Object.values(
        GQL.AffiliateRelationshipAgendaOwner,
      ),
      "ecommerce.affiliateWorkspace.agendaSourceTypes": Object.values(
        GQL.AffiliateRelationshipAgendaSourceType,
      ),
      "ecommerce.affiliateWorkspace.processReasons": Object.values(GQL.AffiliateWorkProcessReason),
      "ecommerce.affiliateWorkspace.requiredActions": Object.values(
        GQL.AffiliateRelationshipRequiredAction,
      ),
      "ecommerce.affiliateWorkspace.workKinds": Object.values(GQL.AffiliateWorkKind),
      "ecommerce.affiliateWorkspace.triggerKinds": triggerKinds,
    };

    for (const language of LANGUAGE_OPTIONS) {
      const values = flattenValues(LANGUAGE_RESOURCES[language.code].translation);
      expect(
        missingLabelKeys(values, labelGroups),
        `${language.code} missing Affiliate work labels`,
      ).toEqual([]);
    }
  });

  it("labels every Affiliate creator card and profile value the backend emits in every locale", () => {
    // AffiliateCreatorPerformanceCurrent.sourceType is a plain String in the schema.
    // These values mirror the backend enum AffiliateCreatorPerformanceSourceType in
    // server/backend/src/ecommerce/affiliate/models/AffiliateCreatorPerformanceCurrent.ts.
    const performanceSourceTypes = [
      "MARKETPLACE_SEARCH",
      "PERFORMANCE_DETAIL",
      "SAMPLE_APPLICATION",
    ];
    const labelGroups: Record<string, readonly string[]> = {
      "ecommerce.affiliateWorkspace.collaborationTypes": Object.values(
        GQL.AffiliateCollaborationType,
      ),
      "ecommerce.platform": Object.values(GQL.ShopPlatform),
      "ecommerce.affiliateWorkspace.creatorDetail.sourceTypes": performanceSourceTypes,
    };

    for (const language of LANGUAGE_OPTIONS) {
      const values = flattenValues(LANGUAGE_RESOURCES[language.code].translation);
      expect(
        missingLabelKeys(values, labelGroups),
        `${language.code} missing Affiliate creator labels`,
      ).toEqual([]);
    }
  });

  it("describes Campaign saves without promising that queued work was recalculated", () => {
    const expected = {
      en: "Campaign configuration updated.",
      zh: "推广计划配置已更新。",
      de: "Kampagnenkonfiguration aktualisiert.",
      es: "Configuración de la campaña actualizada.",
      fr: "Configuration de la campagne mise à jour.",
      id: "Konfigurasi kampanye diperbarui.",
      it: "Configurazione della campagna aggiornata.",
      th: "อัปเดตการตั้งค่าแคมเปญแล้ว",
    } as const;
    for (const language of LANGUAGE_OPTIONS) {
      const values = flattenValues(LANGUAGE_RESOURCES[language.code].translation);
      expect(values["ecommerce.affiliateCampaign.updated"]).toBe(expected[language.code]);
      expect(values["ecommerce.affiliateCampaign.authorizationBody"]).not.toMatch(
        /all unsubmitted work|所有未提交任务/u,
      );
    }
  });
});
