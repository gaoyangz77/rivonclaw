import { describe, expect, it, vi } from "vitest";
import type {
  StructuredOneShotAgentOptions,
  StructuredOneShotAgentResult,
} from "../gateway/structured-one-shot-agent.js";
import {
  generateCampaignMessageTemplate,
  generateCampaignSearchPhraseSuggestions,
  type StructuredRunner,
} from "./affiliate-campaign-ai-service.js";

const context = {
  productSnapshotHash: "product-hash",
  shopName: "Shop Five",
  explanationLocale: "zh",
  excludePhrases: [],
  product: {
    productId: "product-1",
    title: "Very Long Marketplace Product Title",
    description: "A gold-tone faith-inspired pendant for everyday outfits.",
    status: "ACTIVE",
    originalCurrency: "USD",
    minimumPriceUsdAmount: 19.99,
    maximumPriceUsdAmount: 24.99,
    categoryLeafId: "leaf-1",
    categoryLeafName: "Pendant necklaces",
    categoryPathIds: ["jewelry", "necklaces", "leaf-1"],
    categoryPathNames: ["Jewelry", "Necklaces", "Pendant necklaces"],
    brandId: null,
    brandName: null,
    observedAt: "2026-07-26T00:00:00.000Z",
    snapshotHash: "product-hash",
  },
  marketplaceCapabilities: {
    shopId: "shop-5",
    market: "US",
    apiVersion: "2026-06",
    ageRanges: ["AGE_25_34"],
    genders: ["FEMALE"],
    gmvRanges: ["GMV_1K_10K"],
    unitsSoldRanges: ["UNITS_10_100"],
    languages: ["en"],
    creatorLevels: ["LEVEL_2"],
    categoryPros: ["FASHION"],
    capabilityHash: "capability-hash",
  },
};

function structuredRunnerFor(raw: unknown): {
  runner: StructuredRunner;
  calls: ReturnType<typeof vi.fn>;
} {
  const calls = vi.fn();
  const runner: StructuredRunner = async <T>(
    options: StructuredOneShotAgentOptions<T>,
  ): Promise<StructuredOneShotAgentResult<T>> => {
    calls(options);
    return {
      value: options.validate(raw),
      provider: "user-provider",
      model: "user-model",
      runIds: ["run-1"],
      repaired: false,
      durationMs: 10,
    };
  };
  return { runner, calls };
}

describe("affiliate Campaign Desktop AI service", () => {
  it("uses one structured Agent run for all five search groups and then backend-validates them", async () => {
    const ruleSets = [
      { minimumFollowers: 1_000, ageRanges: ["AGE_25_34"] },
      { minimumFollowers: 5_000, gmvRanges: ["GMV_1K_10K"] },
      { maximumFollowers: 50_000, languages: ["en"] },
      {
        genderDistribution: { gender: "FEMALE", minimumPercentage: 60 },
        categoryPros: ["FASHION"],
      },
      { creatorLevels: ["LEVEL_2"], unitsSoldRanges: ["UNITS_10_100"] },
    ];
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      keyword: `faith fashion creator ${index + 1}`,
      explanation: `这是第 ${index + 1} 个达人方向，用于覆盖不同内容受众。`,
      rules: ruleSets[index],
    }));
    const backendResult = {
      suggestionVersion: 3,
      productSnapshotHash: "product-hash",
      suggestions: candidates.map((candidate) => ({
        text: candidate.keyword,
        explanation: candidate.explanation,
        explanationLocale: "zh",
        rationale: candidate.explanation,
        discoveryRules: {},
      })),
    };
    const graphqlFetch = vi.fn(async (query: string, _variables?: Record<string, unknown>) => {
      if (query.includes("AffiliateCampaignAiGenerationContext")) {
        return { affiliateCampaignAiGenerationContext: context };
      }
      if (query.includes("ValidateAffiliateCampaignSearchPhraseSuggestions")) {
        return { validateAffiliateCampaignSearchPhraseSuggestions: backendResult };
      }
      throw new Error("Unexpected GraphQL operation");
    });
    const structured = structuredRunnerFor(candidates);

    const result = await generateCampaignSearchPhraseSuggestions({
      authSession: { graphqlFetch } as never,
      shopId: "shop-5",
      productId: "product-1",
      uiLocale: "zh-CN",
      runStructured: structured.runner,
    });

    expect(result).toEqual(backendResult);
    expect(structured.calls).toHaveBeenCalledTimes(1);
    expect(graphqlFetch).toHaveBeenCalledTimes(2);
    expect(graphqlFetch.mock.calls[1]?.[0]).toContain(
      "ValidateAffiliateCampaignSearchPhraseSuggestions",
    );
    const validationVariables = graphqlFetch.mock.calls[1]?.[1] as {
      input: { shopId: string; productSnapshotHash: string; suggestions: SearchSuggestionLike[] };
    };
    expect(validationVariables.input.shopId).toBe("shop-5");
    expect(validationVariables.input.productSnapshotHash).toBe("product-hash");
    expect(validationVariables.input.suggestions).toHaveLength(5);
    expect(validationVariables.input.suggestions[0]?.keyword).toBe("faith fashion creator 1");
    expect(validationVariables.input.suggestions[3]?.rules).toMatchObject({
      gender: "FEMALE",
      genderMinimumPercentage: 60,
    });
    const structuredOptions = structured.calls.mock.calls[0]?.[0] as StructuredOneShotAgentOptions<{
      suggestions: SearchSuggestionLike[];
    }>;
    expect(structuredOptions.systemPrompt).toContain(
      "Every group must include at least one useful filter",
    );
    expect(structuredOptions.userPrompt).toContain("outputContractExample");
    expect(structuredOptions.jsonSchema).toMatchObject({
      items: {
        required: ["keyword", "explanation", "rules"],
        properties: {
          rules: {
            minProperties: 1,
            properties: {
              genderDistribution: {
                required: ["gender", "minimumPercentage"],
              },
            },
          },
        },
      },
    });
  });

  it("rejects five keyword-only groups so the structured utility can repair them", async () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      keyword: `faith fashion creator ${index + 1}`,
      explanation: `这是第 ${index + 1} 个达人方向。`,
      rules: {},
    }));
    const graphqlFetch = vi.fn(async (query: string) => {
      if (query.includes("AffiliateCampaignAiGenerationContext")) {
        return { affiliateCampaignAiGenerationContext: context };
      }
      throw new Error("Backend validation should not be reached");
    });
    const structured = structuredRunnerFor(candidates);

    await expect(
      generateCampaignSearchPhraseSuggestions({
        authSession: { graphqlFetch } as never,
        shopId: "shop-5",
        productId: "product-1",
        uiLocale: "zh-CN",
        runStructured: structured.runner,
      }),
    ).rejects.toThrow("must include at least one useful filter");
    expect(graphqlFetch).toHaveBeenCalledTimes(1);
  });

  it("generates the first-touch template locally and sends only the draft to backend validation", async () => {
    const backendResult = {
      text: "Hi {{creator_name}}, we'd love to share our faith-inspired pendant with you.",
      productShortName: "faith-inspired pendant",
      source: "AI_GENERATED" as const,
    };
    const graphqlFetch = vi.fn(async (query: string, _variables?: Record<string, unknown>) => {
      if (query.includes("AffiliateCampaignAiGenerationContext")) {
        return { affiliateCampaignAiGenerationContext: context };
      }
      if (query.includes("ValidateAffiliateCampaignMessageTemplateSuggestion")) {
        return { validateAffiliateCampaignMessageTemplateSuggestion: backendResult };
      }
      throw new Error("Unexpected GraphQL operation");
    });
    const structured = structuredRunnerFor({
      text: backendResult.text,
      productShortName: backendResult.productShortName,
    });

    const result = await generateCampaignMessageTemplate({
      authSession: { graphqlFetch } as never,
      shopId: "shop-5",
      productId: "product-1",
      uiLocale: "zh-CN",
      mode: "INITIAL",
      runStructured: structured.runner,
    });

    expect(result).toEqual(backendResult);
    expect(structured.calls).toHaveBeenCalledTimes(1);
    expect(graphqlFetch).toHaveBeenCalledTimes(2);
    expect(graphqlFetch.mock.calls[1]?.[1]).toEqual({
      input: {
        shopId: "shop-5",
        text: backendResult.text,
        productShortName: backendResult.productShortName,
        mode: "INITIAL",
        previousDraft: null,
      },
    });
  });
});

type SearchSuggestionLike = {
  keyword: string;
  rules?: {
    gender?: string | null;
    genderMinimumPercentage?: number | null;
  };
};
