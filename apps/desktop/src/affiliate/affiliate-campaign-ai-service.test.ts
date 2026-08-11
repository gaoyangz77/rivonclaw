import { describe, expect, it, vi } from "vitest";
import type {
  StructuredOneShotAgentOptions,
  StructuredOneShotAgentResult,
} from "../gateway/structured-one-shot-agent.js";
import {
  generateCampaignMessageTemplate,
  type StructuredRunner,
} from "./affiliate-campaign-ai-service.js";

describe("affiliate Campaign Desktop AI service", () => {
  it("uses one local structured run and validates only the resulting first-touch draft", async () => {
    const backendResult = {
      text: "Hi {{creator_name}}, we'd love to share our faith-inspired pendant with you.",
      productShortName: "faith-inspired pendant",
      source: "AI_GENERATED" as const,
    };
    const graphqlFetch = vi.fn(async (
      query: string,
      _variables?: Record<string, unknown>,
    ) => {
      if (query.includes("AffiliateCampaignMessageProductPreview")) {
        return {
          affiliateCampaignProductPreview: {
            productId: "product-1",
            title: "Very Long Marketplace Product Title",
            description: "A gold-tone faith-inspired pendant for everyday outfits.",
            status: "ACTIVE",
            originalCurrency: "USD",
            minimumPriceUsdAmount: 19.99,
            maximumPriceUsdAmount: 24.99,
            categoryPathIds: ["jewelry", "necklaces"],
            categoryPathNames: ["Jewelry", "Necklaces"],
            brandId: null,
            brandName: null,
            observedAt: "2026-07-26T00:00:00.000Z",
            snapshotHash: "product-hash",
          },
        };
      }
      if (query.includes("ValidateAffiliateCampaignMessageTemplateSuggestion")) {
        return { validateAffiliateCampaignMessageTemplateSuggestion: backendResult };
      }
      throw new Error("Unexpected GraphQL operation");
    });
    const calls = vi.fn();
    const runner: StructuredRunner = async <T>(
      options: StructuredOneShotAgentOptions<T>,
    ): Promise<StructuredOneShotAgentResult<T>> => {
      calls(options);
      return {
        value: options.validate({
          text: backendResult.text,
          productShortName: backendResult.productShortName,
        }),
        provider: "user-provider",
        model: "user-model",
        runIds: ["run-1"],
        repaired: false,
        durationMs: 10,
      };
    };

    const result = await generateCampaignMessageTemplate({
      authSession: { graphqlFetch } as never,
      shopId: "shop-5",
      productId: "product-1",
      uiLocale: "zh-CN",
      mode: "INITIAL",
      runStructured: runner,
    });

    expect(result).toEqual(backendResult);
    expect(calls).toHaveBeenCalledTimes(1);
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
