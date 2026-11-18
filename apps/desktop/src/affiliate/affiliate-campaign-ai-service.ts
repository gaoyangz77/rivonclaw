import { rootStore } from "../app/store/desktop-store.js";
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
      collaborationInvitationText
    }
  }
`;

const COLLABORATION_INVITATION_TEXT_MAX_CODE_POINTS = 500;

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
  collaborationInvitationText: string;
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
  previousInvitationText?: string;
  runStructured?: StructuredRunner;
  resolveShopName?: (shopId: string) => string | null;
}): Promise<CampaignMessageTemplateSuggestion> {
  const preview = await input.authSession.graphqlFetch<{
    affiliateCampaignProductPreview: CampaignProductContext;
  }>(CAMPAIGN_PRODUCT_PREVIEW_QUERY, {
    input: { shopId: input.shopId, productId: input.productId },
  });
  const product = preview.affiliateCampaignProductPreview;
  const shopName = (input.resolveShopName ?? defaultResolveShopName)(input.shopId);
  let latestDraft: TemplateDraft | undefined;
  let generated: StructuredOneShotAgentResult<TemplateDraft>;
  try {
    generated = await (input.runStructured ?? runStructuredOneShotAgent)({
      namespace: "affiliate-campaign-first-touch-template",
      systemPrompt: [
        "Write one concise, friendly TikTok Shop first-touch message from a merchant to a creator.",
        "Use the product description, category, brand, and price context—not only the raw title.",
        "Create a short conversational product name instead of copying a long marketplace title.",
        "Placeholder tokens are immutable protocol syntax, not natural-language text.",
        "They MUST remain in English ASCII with the original variable names and double curly braces exactly as written: {{creator_name}}, {{product_name}}, and {{shop_name}}.",
        "The text must contain the exact token {{creator_name}}. Never translate, localize, rename, or reformat any placeholder.",
        "Do not include URLs, HTML, unsupported claims, private identifiers, or an invented discount.",
        `The user's interface locale is ${input.uiLocale}; the actual outreach message should remain natural for the product's target market.`,
        input.mode === "ALTERNATIVE"
          ? "Make this materially different in wording and angle from the previous draft and, in the same way, from previousInvitationText."
          : "Prefer a natural collaboration invitation with a clear reason the creator may care.",
        "Also write a separate collaborationInvitationText: the note shown on the TikTok target-collaboration invitation that many creators receive at once.",
        "It introduces the seller: who the shop or brand is and what it sells, then the promoted product's concrete selling points drawn from the description, category, brand, and price.",
        "Keep creator-directed content minimal: at most one short closing line inviting collaboration. Do not address or praise a specific creator.",
        "collaborationInvitationText must contain no placeholders or curly braces at all: it is not a template.",
        "Write it in the same target-market language as the message, 200-450 characters; short paragraphs separated by line breaks are fine.",
        "Apply the same bans to it as to the message: no URLs, HTML, unsupported claims, or invented discounts.",
      ].join(" "),
      userPrompt: JSON.stringify({
        task: "Generate one campaign first-touch message template, one conversational product name, and one collaboration invitation note.",
        shop: shopName ? { name: shopName } : null,
        product,
        optionalUserGuidance: cleanOptionalText(input.guidance),
        mode: input.mode,
        previousDraft: input.mode === "ALTERNATIVE" ? cleanOptionalText(input.previousDraft) : null,
        previousInvitationText:
          input.mode === "ALTERNATIVE" ? cleanOptionalText(input.previousInvitationText) : null,
      }),
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["text", "productShortName", "collaborationInvitationText"],
        properties: {
          text: { type: "string", minLength: 1, maxLength: 2_000 },
          productShortName: { type: "string", minLength: 1, maxLength: 80 },
          collaborationInvitationText: {
            type: "string",
            minLength: 1,
            maxLength: COLLABORATION_INVITATION_TEXT_MAX_CODE_POINTS,
          },
        },
      },
      validate(value) {
        const parsed = parseTemplateDraft(value);
        // Remember the template part before the note is judged, so a bad note
        // never discards a draft the human can still correct.
        latestDraft = { ...parsed.template, collaborationInvitationText: "" };
        const collaborationInvitationText = parseInvitationText(parsed.invitationText);
        latestDraft = { ...parsed.template, collaborationInvitationText };
        validateAiTemplatePlaceholders(parsed.template.text);
        return latestDraft;
      },
    });
  } catch (error) {
    // The structured runner has already used its one repair turn. Preserve a
    // structurally valid draft for human correction instead of discarding it.
    // Its note is carried only when it passed its own validation (otherwise "").
    if (latestDraft && aiTemplateMissingCreatorPlaceholder(latestDraft.text)) {
      return { ...latestDraft, source: "AI_GENERATED" };
    }
    throw error;
  }

  const validated = await input.authSession.graphqlFetch<{
    validateAffiliateCampaignMessageTemplateSuggestion: CampaignMessageTemplateSuggestion;
  }>(VALIDATE_CAMPAIGN_TEMPLATE_MUTATION, {
    input: {
      shopId: input.shopId,
      text: generated.value.text,
      productShortName: generated.value.productShortName,
      collaborationInvitationText: generated.value.collaborationInvitationText,
      mode: input.mode,
      previousDraft: cleanOptionalText(input.previousDraft),
    },
  });
  return validated.validateAffiliateCampaignMessageTemplateSuggestion;
}

interface TemplateDraft {
  text: string;
  productShortName: string;
  collaborationInvitationText: string;
}

function defaultResolveShopName(shopId: string): string | null {
  return rootStore.shops.find((shop) => shop.id === shopId)?.shopName ?? null;
}

function parseTemplateDraft(value: unknown): {
  template: { text: string; productShortName: string };
  invitationText: unknown;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("template result must be an object");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.some(
      (key) => key !== "text" && key !== "productShortName" && key !== "collaborationInvitationText",
    )
  ) {
    throw new Error("template result contains unsupported fields");
  }
  return {
    template: {
      text: requiredString(record.text, "text", 2_000),
      productShortName: requiredString(record.productShortName, "productShortName", 80),
    },
    invitationText: record.collaborationInvitationText,
  };
}

/**
 * The invitation note is a multi-line, placeholder-free block shared by every
 * Creator on a collaboration, so unlike the template it must keep its line
 * breaks. Mirrors the Backend rules (ADR-108).
 */
function parseInvitationText(value: unknown): string {
  const field = "collaborationInvitationText";
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const normalized = value
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  if (!normalized) throw new Error(`${field} must not be empty`);
  if ([...normalized].length > COLLABORATION_INVITATION_TEXT_MAX_CODE_POINTS) {
    throw new Error(`${field} must be at most ${COLLABORATION_INVITATION_TEXT_MAX_CODE_POINTS} characters`);
  }
  if (normalized.includes("{{") || normalized.includes("}}")) {
    throw new Error(`${field} must not contain {{...}} placeholders or curly braces`);
  }
  if (/<[^>]*>/u.test(normalized)) throw new Error(`${field} must not contain HTML`);
  if (/https?:\/\/|www\./iu.test(normalized)) throw new Error(`${field} must not contain URLs`);
  return normalized;
}

function aiTemplateMissingCreatorPlaceholder(text: string): boolean {
  return !text.includes("{{creator_name}}");
}

function validateAiTemplatePlaceholders(text: string): void {
  if (aiTemplateMissingCreatorPlaceholder(text)) {
    throw new Error(
      "AI template must contain the exact {{creator_name}} placeholder copied byte-for-byte",
    );
  }
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
