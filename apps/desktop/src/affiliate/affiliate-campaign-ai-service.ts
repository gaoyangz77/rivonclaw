import type { AuthSessionManager } from "../auth/session.js";
import {
  runStructuredOneShotAgent,
  type StructuredOneShotAgentOptions,
  type StructuredOneShotAgentResult,
} from "../gateway/structured-one-shot-agent.js";

const CAMPAIGN_PRODUCT_PREVIEW_QUERY = `
  query AffiliateCampaignMessageProductPreview(
    $input: ResolveAffiliateCampaignProductInput!
  ) {
    affiliateCampaignProductPreview(input: $input) {
      productId
      title
      description
      status
      originalCurrency
      minimumPriceUsdAmount
      maximumPriceUsdAmount
      categoryPathIds
      categoryPathNames
      brandId
      brandName
      observedAt
      snapshotHash
    }
  }
`;

const VALIDATE_CAMPAIGN_TEMPLATE_MUTATION = `
  mutation ValidateAffiliateCampaignMessageTemplateSuggestion(
    $input: ValidateAffiliateCampaignMessageTemplateSuggestionInput!
  ) {
    validateAffiliateCampaignMessageTemplateSuggestion(input: $input) {
      text
      source
      productShortName
    }
  }
`;

type CampaignAiBackendClient = Pick<AuthSessionManager, "graphqlFetch">;

interface CampaignProductContext {
  productId: string;
  title: string;
  description?: string | null;
  status?: string | null;
  originalCurrency: string;
  minimumPriceUsdAmount: number;
  maximumPriceUsdAmount: number;
  categoryPathIds: string[];
  categoryPathNames: string[];
  brandId?: string | null;
  brandName?: string | null;
  observedAt: string;
  snapshotHash: string;
}

export interface CampaignMessageTemplateSuggestion {
  text: string;
  source: "AI_GENERATED";
  productShortName: string;
}

export type StructuredRunner = <T>(
  options: StructuredOneShotAgentOptions<T>,
) => Promise<StructuredOneShotAgentResult<T>>;

export async function generateCampaignMessageTemplate(input: {
  authSession: CampaignAiBackendClient;
  shopId: string;
  productId: string;
  uiLocale: string;
  guidance?: string;
  mode: "INITIAL" | "ALTERNATIVE";
  previousDraft?: string;
  runStructured?: StructuredRunner;
}): Promise<CampaignMessageTemplateSuggestion> {
  const preview = await input.authSession.graphqlFetch<{
    affiliateCampaignProductPreview: CampaignProductContext;
  }>(CAMPAIGN_PRODUCT_PREVIEW_QUERY, {
    input: { shopId: input.shopId, productId: input.productId },
  });
  const product = preview.affiliateCampaignProductPreview;
  const generated = await (input.runStructured ?? runStructuredOneShotAgent)({
    namespace: "affiliate-campaign-first-touch-template",
    systemPrompt: [
      "Write one concise, friendly TikTok Shop first-touch message from a merchant to a creator.",
      "Use the product description, category, brand, and price context—not only the raw title.",
      "Create a short conversational product name instead of copying a long marketplace title.",
      "The message may use only {{creator_name}}, {{product_name}}, and {{shop_name}} placeholders.",
      "Do not include URLs, HTML, unsupported claims, private identifiers, or an invented discount.",
      `The user's interface locale is ${input.uiLocale}; the actual outreach message should remain natural for the product's target market.`,
      input.mode === "ALTERNATIVE"
        ? "Make this materially different in wording and angle from the previous draft."
        : "Prefer a natural collaboration invitation with a clear reason the creator may care.",
    ].join(" "),
    userPrompt: JSON.stringify({
      task: "Generate one campaign first-touch message template and one conversational product name.",
      product,
      optionalUserGuidance: cleanOptionalText(input.guidance),
      mode: input.mode,
      previousDraft: input.mode === "ALTERNATIVE" ? cleanOptionalText(input.previousDraft) : null,
    }),
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["text", "productShortName"],
      properties: {
        text: { type: "string", minLength: 1, maxLength: 2_000 },
        productShortName: { type: "string", minLength: 1, maxLength: 80 },
      },
    },
    validate: validateTemplateDraft,
  });

  const validated = await input.authSession.graphqlFetch<{
    validateAffiliateCampaignMessageTemplateSuggestion: CampaignMessageTemplateSuggestion;
  }>(VALIDATE_CAMPAIGN_TEMPLATE_MUTATION, {
    input: {
      shopId: input.shopId,
      text: generated.value.text,
      productShortName: generated.value.productShortName,
      mode: input.mode,
      previousDraft: cleanOptionalText(input.previousDraft),
    },
  });
  return validated.validateAffiliateCampaignMessageTemplateSuggestion;
}

function validateTemplateDraft(value: unknown): {
  text: string;
  productShortName: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("template result must be an object");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => key !== "text" && key !== "productShortName")) {
    throw new Error("template result contains unsupported fields");
  }
  return {
    text: requiredString(record.text, "text", 2_000),
    productShortName: requiredString(record.productShortName, "productShortName", 80),
  };
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} must contain 1-${maxLength} characters`);
  }
  return normalized;
}

function cleanOptionalText(value: string | undefined): string | null {
  const normalized = value?.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized || null;
}
