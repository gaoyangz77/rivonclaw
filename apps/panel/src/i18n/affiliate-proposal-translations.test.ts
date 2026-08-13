import { describe, expect, it } from "vitest";
import { LANGUAGE_RESOURCES } from "./languages.js";

describe("Affiliate proposal translations", () => {
  it("provides the multi-Sample decision bundle copy in every supported language", () => {
    for (const language of [
      "en",
      "zh",
      "de",
      "es",
      "fr",
      "id",
      "it",
      "th",
    ] as const) {
      const bundle = (
        LANGUAGE_RESOURCES[language].translation as {
          ecommerce: {
            affiliateWorkspace: {
              sampleDecisionBundle: Record<string, string>;
            };
          };
        }
      ).ecommerce.affiliateWorkspace.sampleDecisionBundle;

      for (const key of [
        "recommendationTitle",
        "title",
        "summary",
        "approvalScope",
        "confirmSend",
        "confirmDoNotSend",
        "approveBundle",
        "overrideSend",
        "overrideDoNotSend",
        "overrideNote",
        "overrideSuccess",
        "localApplication",
        "providerApplication",
        "shop",
        "unknownProduct",
        "unavailable",
        "agentDecision",
        "approve",
        "reject",
        "historicalStaff",
        "displayOnly",
      ]) {
        expect(bundle[key], `${language}.${key}`).toBeTruthy();
      }
    }
  });
});
