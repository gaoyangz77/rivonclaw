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
              sampleDecisionBundle: Record<string, unknown>;
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
        "shop",
        "unknownShop",
        "sellerSku",
        "unknownProduct",
        "unavailable",
        "agentDecision",
        "approve",
        "reject",
        "rejectWithReason",
        "historicalStaff",
      ]) {
        expect(bundle[key], `${language}.${key}`).toBeTruthy();
      }
      expect(bundle.rejectReasons, `${language}.rejectReasons`).toEqual(expect.objectContaining({
        NOT_MATCH: expect.any(String),
        OFFLINE: expect.any(String),
        OUT_OF_STOCK: expect.any(String),
        OTHER: expect.any(String),
      }));
    }
  });
});
