import { describe, expect, it, vi } from "vitest";
import type {
  StructuredOneShotAgentOptions,
  StructuredOneShotAgentResult,
} from "../gateway/structured-one-shot-agent.js";
import {
  generateCampaignMessageTemplate,
  type StructuredRunner,
} from "./affiliate-campaign-ai-service.js";

const NOTE = "Brightloom sells everyday jewelry.\n\nThis pendant is a gold-tone faith piece.";

describe("affiliate Campaign Desktop AI service", () => {
  it("uses one local structured run and validates only the resulting first-touch draft", async () => {
    const backendResult = {
      text: "Hi {{creator_name}}, we'd love to share our faith-inspired pendant with you.",
      productShortName: "faith-inspired pendant",
      collaborationInvitationText: NOTE,
      source: "AI_GENERATED" as const,
    };
    const graphqlFetch = vi.fn(async (query: string, _variables?: Record<string, unknown>) => {
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
          collaborationInvitationText: NOTE,
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
      resolveShopName: () => "Brightloom",
    });

    expect(result).toEqual(backendResult);
    expect(calls).toHaveBeenCalledTimes(1);
    const systemPrompt = calls.mock.calls[0]?.[0].systemPrompt ?? "";
    expect(systemPrompt).toContain("immutable protocol syntax");
    expect(systemPrompt).toContain("MUST remain in English ASCII");
    expect(systemPrompt).toContain("double curly braces exactly as written");
    expect(systemPrompt).toContain("exact token {{creator_name}}");
    expect(systemPrompt).toContain("collaborationInvitationText");
    expect(systemPrompt).toContain("no placeholders or curly braces at all");
    expect(JSON.parse(calls.mock.calls[0]?.[0].userPrompt).shop).toEqual({ name: "Brightloom" });
    const schema = calls.mock.calls[0]?.[0].jsonSchema;
    expect(schema.required).toContain("collaborationInvitationText");
    expect(schema.properties.collaborationInvitationText.maxLength).toBe(500);
    expect(graphqlFetch).toHaveBeenCalledTimes(2);
    expect(graphqlFetch.mock.calls[1]?.[1]).toEqual({
      input: {
        shopId: "shop-5",
        text: backendResult.text,
        productShortName: backendResult.productShortName,
        collaborationInvitationText: NOTE,
        mode: "INITIAL",
        previousDraft: null,
      },
    });
  });

  it("rejects a localized creator placeholder and accepts the repaired output", async () => {
    const valid = {
      text: "¡Hola, {{creator_name}}! Nos encantaría colaborar contigo.",
      productShortName: "producto de bienestar",
      collaborationInvitationText: NOTE,
      source: "AI_GENERATED" as const,
    };
    const graphqlFetch = vi.fn(async (query: string) => {
      if (query.includes("AffiliateCampaignMessageProductPreview")) {
        return {
          affiliateCampaignProductPreview: {
            productId: "product-1",
            title: "Producto",
            description: "Descripción",
            status: "ACTIVE",
            originalCurrency: "MXN",
            minimumPriceUsdAmount: 10,
            maximumPriceUsdAmount: 10,
            categoryPathIds: ["wellness"],
            categoryPathNames: ["Wellness"],
            brandId: null,
            brandName: "Brand",
            observedAt: "2026-09-24T00:00:00.000Z",
            snapshotHash: "product-hash",
          },
        };
      }
      if (query.includes("ValidateAffiliateCampaignMessageTemplateSuggestion")) {
        return { validateAffiliateCampaignMessageTemplateSuggestion: valid };
      }
      throw new Error("Unexpected GraphQL operation");
    });
    const runner: StructuredRunner = async <T>(options: StructuredOneShotAgentOptions<T>) => {
      expect(() =>
        options.validate({
          text: "¡Hola, [Nombre]! Nos encantaría colaborar contigo.",
          productShortName: "producto de bienestar",
          collaborationInvitationText: NOTE,
        }),
      ).toThrow("exact {{creator_name}}");
      return {
        value: options.validate({
          text: valid.text,
          productShortName: valid.productShortName,
          collaborationInvitationText: NOTE,
        }),
        provider: "user-provider",
        model: "user-model",
        runIds: ["run-1", "run-2"],
        repaired: true,
        durationMs: 20,
      };
    };

    await expect(
      generateCampaignMessageTemplate({
        authSession: { graphqlFetch } as never,
        shopId: "shop-5",
        productId: "product-1",
        uiLocale: "es-MX",
        mode: "INITIAL",
        runStructured: runner,
      }),
    ).resolves.toEqual(valid);
  });

  it("returns the last structured draft for human correction when repair is still invalid", async () => {
    const invalidDraft = {
      text: "¡Hola, [Nombre]! Nos encantaría colaborar contigo.",
      productShortName: "producto de bienestar",
      collaborationInvitationText: NOTE,
    };
    const graphqlFetch = vi.fn(async (query: string) => {
      if (query.includes("AffiliateCampaignMessageProductPreview")) {
        return {
          affiliateCampaignProductPreview: {
            productId: "product-1",
            title: "Producto",
            description: "Descripción",
            status: "ACTIVE",
            originalCurrency: "MXN",
            minimumPriceUsdAmount: 10,
            maximumPriceUsdAmount: 10,
            categoryPathIds: ["wellness"],
            categoryPathNames: ["Wellness"],
            brandId: null,
            brandName: "Brand",
            observedAt: "2026-09-24T00:00:00.000Z",
            snapshotHash: "product-hash",
          },
        };
      }
      throw new Error("Invalid drafts must not reach Backend validation");
    });
    const runner: StructuredRunner = async <T>(options: StructuredOneShotAgentOptions<T>) => ({
      value: options.validate(invalidDraft),
      provider: "user-provider",
      model: "user-model",
      runIds: ["run-1", "run-2"],
      repaired: true,
      durationMs: 20,
    });

    await expect(
      generateCampaignMessageTemplate({
        authSession: { graphqlFetch } as never,
        shopId: "shop-5",
        productId: "product-1",
        uiLocale: "es-MX",
        mode: "INITIAL",
        runStructured: runner,
      }),
    ).resolves.toEqual({ ...invalidDraft, source: "AI_GENERATED" });
    expect(graphqlFetch).toHaveBeenCalledTimes(1);
  });

  describe("collaboration invitation text", () => {
    const preview = {
      productId: "product-1",
      title: "Producto",
      description: "Descripción",
      status: "ACTIVE",
      originalCurrency: "USD",
      minimumPriceUsdAmount: 10,
      maximumPriceUsdAmount: 10,
      categoryPathIds: ["wellness"],
      categoryPathNames: ["Wellness"],
      brandId: null,
      brandName: "Brand",
      observedAt: "2026-09-24T00:00:00.000Z",
      snapshotHash: "product-hash",
    };
    const template = { text: "Hi {{creator_name}}, join us.", productShortName: "tonic" };

    function harness(backendNote = "") {
      const graphqlFetch = vi.fn(async (query: string, _variables?: Record<string, unknown>) => {
        if (query.includes("AffiliateCampaignMessageProductPreview")) {
          return { affiliateCampaignProductPreview: preview };
        }
        return {
          validateAffiliateCampaignMessageTemplateSuggestion: {
            ...template,
            source: "AI_GENERATED",
            collaborationInvitationText: backendNote,
          },
        };
      });
      return graphqlFetch;
    }

    function run(
      draft: Record<string, unknown>,
      overrides: Record<string, unknown> = {},
      graphqlFetch = harness(),
    ) {
      const prompts: string[] = [];
      const runner: StructuredRunner = async <T>(options: StructuredOneShotAgentOptions<T>) => {
        prompts.push(options.userPrompt);
        return {
          value: options.validate(draft),
          provider: "p",
          model: "m",
          runIds: ["r"],
          repaired: false,
          durationMs: 1,
        };
      };
      return {
        prompts,
        graphqlFetch,
        result: generateCampaignMessageTemplate({
          authSession: { graphqlFetch } as never,
          shopId: "shop-5",
          productId: "product-1",
          uiLocale: "en",
          mode: "INITIAL",
          runStructured: runner,
          resolveShopName: () => null,
          ...overrides,
        }),
      };
    }

    it("keeps line breaks, trims trailing spaces and collapses blank-line runs", async () => {
      const h = run({
        ...template,
        collaborationInvitationText: "  Line one  \r\nLine two\r\n\r\n\r\n\r\nLine three \n",
      });
      await h.result;
      expect(h.graphqlFetch.mock.calls[1]?.[1]).toMatchObject({
        input: { collaborationInvitationText: "Line one\nLine two\n\nLine three" },
      });
    });

    it.each([
      ["a placeholder", "Hi {{creator_name}}"],
      ["a single brace", "Hello }} there"],
      ["an empty note", "   "],
      ["more than 500 code points", "😀".repeat(501)],
      ["a URL", "See https://example.com"],
      ["HTML", "<b>Hello</b>"],
    ])("rejects a note with %s", async (_label, note) => {
      const h = run({ ...template, collaborationInvitationText: note });
      await expect(h.result).rejects.toThrow("collaborationInvitationText");
    });

    it("accepts exactly 500 code points", async () => {
      const h = run({ ...template, collaborationInvitationText: "😀".repeat(500) });
      await expect(h.result).resolves.toBeDefined();
    });

    it("passes a null shop when the shop is unknown and the name when known", async () => {
      const unknown = run({ ...template, collaborationInvitationText: NOTE });
      await unknown.result;
      expect(JSON.parse(unknown.prompts[0] ?? "{}").shop).toBeNull();
      const known = run({ ...template, collaborationInvitationText: NOTE }, {
        resolveShopName: () => "Brightloom",
      });
      await known.result;
      expect(JSON.parse(known.prompts[0] ?? "{}").shop).toEqual({ name: "Brightloom" });
    });

    it("forwards the previous note only in ALTERNATIVE mode and returns the backend note", async () => {
      const h = run(
        { ...template, collaborationInvitationText: NOTE },
        { mode: "ALTERNATIVE", previousInvitationText: "Old note\nsecond" },
        harness("Backend note"),
      );
      await expect(h.result).resolves.toMatchObject({ collaborationInvitationText: "Backend note" });
      expect(JSON.parse(h.prompts[0] ?? "{}").previousInvitationText).toBe("Old note second");
      const initial = run(
        { ...template, collaborationInvitationText: NOTE },
        { previousInvitationText: "Old note" },
      );
      await initial.result;
      expect(JSON.parse(initial.prompts[0] ?? "{}").previousInvitationText).toBeNull();
    });

    it("carries a valid note on the missing-creator-placeholder fallback and an empty one when the note is invalid", async () => {
      const bad = { text: "Hi [Name], join us.", productShortName: "tonic" };
      const withNote = run({ ...bad, collaborationInvitationText: "Valid\nnote" });
      await expect(withNote.result).resolves.toEqual({
        ...bad,
        collaborationInvitationText: "Valid\nnote",
        source: "AI_GENERATED",
      });
      const withBadNote = run({ ...bad, collaborationInvitationText: "{{shop_name}} note" });
      await expect(withBadNote.result).resolves.toEqual({
        ...bad,
        collaborationInvitationText: "",
        source: "AI_GENERATED",
      });
    });
  });
});
