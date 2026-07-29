import { describe, expect, it } from "vitest";
import { LANGUAGE_RESOURCES } from "./languages.js";

describe("Affiliate Expected Sales translation backfill", () => {
  it("does not overwrite the existing Chinese Expected Sales label", () => {
    const translation = LANGUAGE_RESOURCES.zh.translation as {
      ecommerce: {
        affiliateWorkspace: {
          predictionComparison: {
            expectedSales: string;
            bootstrapEstimate: string;
            humanDecision: string;
          };
        };
      };
    };

    expect(
      translation.ecommerce.affiliateWorkspace.predictionComparison.expectedSales,
    ).toBe("校准后预测销量");
    expect(
      translation.ecommerce.affiliateWorkspace.predictionComparison.bootstrapEstimate,
    ).toBe("冷启动估算");
    expect(
      translation.ecommerce.affiliateWorkspace.predictionComparison.humanDecision,
    ).toBe("人工决策");
  });

  it("provides every stage/status key in all eight supported languages", () => {
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
      const predictionComparison = (
        LANGUAGE_RESOURCES[language].translation as {
          ecommerce: {
            affiliateWorkspace: {
              predictionComparison: Record<string, string>;
            };
          };
        }
      ).ecommerce.affiliateWorkspace.predictionComparison;
      for (const key of [
        "bootstrapEstimate",
        "bootstrapBadge",
        "bootstrapExplanation",
        "humanDecision",
        "humanBootstrapEstimate",
        "humanBootstrapExplanation",
        "effectiveScope",
        "modelUnavailable",
      ]) {
        expect(predictionComparison[key], `${language}.${key}`).toBeTruthy();
      }
    }
  });
});
