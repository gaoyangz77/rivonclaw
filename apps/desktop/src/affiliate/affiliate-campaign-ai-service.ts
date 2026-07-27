import type { AuthSessionManager } from "../auth/session.js";
import {
  runStructuredOneShotAgent,
  type StructuredOneShotAgentOptions,
  type StructuredOneShotAgentResult,
} from "../gateway/structured-one-shot-agent.js";

const CAMPAIGN_AI_CONTEXT_QUERY = `
  query AffiliateCampaignAiGenerationContext(
    $input: AffiliateCampaignAiGenerationContextInput!
  ) {
    affiliateCampaignAiGenerationContext(input: $input) {
      snapshotRef
      productSnapshotHash
      shopName
      explanationLocale
      excludePhrases
      product {
        productId
        title
        description
        status
        originalCurrency
        minimumPriceUsdAmount
        maximumPriceUsdAmount
        categoryLeafId
        categoryLeafName
        categoryPathIds
        categoryPathNames
        brandId
        brandName
        observedAt
        snapshotHash
      }
      marketplaceCapabilities {
        shopId
        market
        apiVersion
        ageRanges
        genders
        gmvRanges
        unitsSoldRanges
        languages
        creatorLevels
        categoryPros
        capabilityHash
      }
    }
  }
`;

const VALIDATE_CAMPAIGN_SEARCH_SUGGESTIONS_MUTATION = `
  mutation ValidateAffiliateCampaignSearchPhraseSuggestions(
    $input: ValidateAffiliateCampaignSearchPhraseSuggestionsInput!
  ) {
    validateAffiliateCampaignSearchPhraseSuggestions(input: $input) {
      suggestionVersion
      productSnapshotHash
      suggestions {
        text
        explanation
        explanationLocale
        rationale
        discoveryRules {
          keyword
          followerCount {
            minimum
            maximum
          }
          audience {
            ageRanges
            genderDistribution {
              gender
              minimumPercentage
            }
          }
          salesPerformance30d {
            gmvRanges
            unitsSoldRanges
          }
          marketSpecific {
            languages
            creatorLevels
            categoryPros
          }
        }
      }
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
  categoryLeafId: string;
  categoryLeafName: string;
  categoryPathIds: string[];
  categoryPathNames: string[];
  brandId?: string | null;
  brandName?: string | null;
  observedAt: string;
  snapshotHash: string;
}

interface CampaignMarketplaceCapabilities {
  shopId: string;
  market: string;
  apiVersion: string;
  ageRanges: string[];
  genders: string[];
  gmvRanges: string[];
  unitsSoldRanges: string[];
  languages: string[];
  creatorLevels: string[];
  categoryPros: string[];
  capabilityHash: string;
}

interface CampaignAiContext {
  snapshotRef: string;
  productSnapshotHash: string;
  shopName: string;
  explanationLocale: string;
  excludePhrases: string[];
  product: CampaignProductContext;
  marketplaceCapabilities: CampaignMarketplaceCapabilities;
}

interface SearchRulesCandidate {
  minimumFollowers?: number | null;
  maximumFollowers?: number | null;
  ageRanges?: string[] | null;
  gender?: string | null;
  genderMinimumPercentage?: number | null;
  gmvRanges?: string[] | null;
  unitsSoldRanges?: string[] | null;
  languages?: string[] | null;
  creatorLevels?: string[] | null;
  categoryPros?: string[] | null;
}

interface SearchSuggestionCandidate {
  keyword: string;
  explanation: string;
  rules: SearchRulesCandidate;
}

interface SearchSuggestionDraft {
  suggestions: SearchSuggestionCandidate[];
}

export interface CampaignSearchPhraseSuggestions {
  suggestionVersion: number;
  productSnapshotHash: string;
  suggestions: Array<{
    text: string;
    explanation: string;
    explanationLocale: string;
    rationale: string;
    discoveryRules: {
      keyword?: string | null;
      followerCount?: {
        minimum?: number | null;
        maximum?: number | null;
      } | null;
      audience?: {
        ageRanges: string[];
        genderDistribution?: {
          gender: string;
          minimumPercentage: number;
        } | null;
      } | null;
      salesPerformance30d?: {
        gmvRanges: string[];
        unitsSoldRanges: string[];
      } | null;
      marketSpecific?: {
        languages: string[];
        creatorLevels: string[];
        categoryPros: string[];
      } | null;
    };
  }>;
}

export interface CampaignMessageTemplateSuggestion {
  text: string;
  source: "AI_GENERATED";
  productShortName: string;
}

export type StructuredRunner = <T>(
  options: StructuredOneShotAgentOptions<T>,
) => Promise<StructuredOneShotAgentResult<T>>;

export async function generateCampaignSearchPhraseSuggestions(input: {
  authSession: CampaignAiBackendClient;
  snapshotRef: string;
  uiLocale: string;
  excludePhrases?: string[];
  guidance?: string;
  runStructured?: StructuredRunner;
}): Promise<CampaignSearchPhraseSuggestions> {
  const context = await readCampaignAiContext({
    authSession: input.authSession,
    snapshotRef: input.snapshotRef,
    uiLocale: input.uiLocale,
    excludePhrases: input.excludePhrases,
  });
  const runStructured = input.runStructured ?? runStructuredOneShotAgent;
  const generated = await runStructured({
    namespace: "affiliate-campaign-search-groups",
    systemPrompt: [
      "Design five distinct TikTok Shop Creator Marketplace search groups for one product.",
      "Each group combines one English marketplace search phrase with Provider-supported filters.",
      "The five groups should cover meaningfully different creator audiences, content angles, or buyer intents.",
      "Use only capability values supplied in the user request. Use null or [] when a filter is not useful.",
      `Write every explanation in ${localeInstruction(context.explanationLocale)}.`,
      "Never invent unsupported enums, IDs, performance claims, or product facts.",
    ].join(" "),
    userPrompt: JSON.stringify({
      task: "Generate exactly five campaign search groups.",
      product: context.product,
      shopName: context.shopName,
      market: context.marketplaceCapabilities.market,
      providerCapabilities: context.marketplaceCapabilities,
      excludedEnglishPhrases: context.excludePhrases,
      optionalUserGuidance: cleanOptionalText(input.guidance),
      requirements: {
        keyword: "An English phrase containing 2–8 words.",
        explanation: `A concise reason written in ${context.explanationLocale}.`,
        rules: "A conservative subset of the supplied Provider capabilities.",
      },
    }),
    jsonSchema: searchSuggestionJsonSchema(context.marketplaceCapabilities),
    validate: validateSearchSuggestionDraft,
  });

  const validated = await input.authSession.graphqlFetch<{
    validateAffiliateCampaignSearchPhraseSuggestions: CampaignSearchPhraseSuggestions;
  }>(VALIDATE_CAMPAIGN_SEARCH_SUGGESTIONS_MUTATION, {
    input: {
      snapshotRef: context.snapshotRef,
      uiLocale: context.explanationLocale,
      excludePhrases: context.excludePhrases,
      suggestions: generated.value.suggestions,
    },
  });
  return validated.validateAffiliateCampaignSearchPhraseSuggestions;
}

export async function generateCampaignMessageTemplate(input: {
  authSession: CampaignAiBackendClient;
  snapshotRef: string;
  uiLocale: string;
  guidance?: string;
  mode: "INITIAL" | "ALTERNATIVE";
  previousDraft?: string;
  runStructured?: StructuredRunner;
}): Promise<CampaignMessageTemplateSuggestion> {
  const context = await readCampaignAiContext({
    authSession: input.authSession,
    snapshotRef: input.snapshotRef,
    uiLocale: input.uiLocale,
  });
  const runStructured = input.runStructured ?? runStructuredOneShotAgent;
  const generated = await runStructured({
    namespace: "affiliate-campaign-first-touch-template",
    systemPrompt: [
      "Write one concise, friendly TikTok Shop first-touch message from a merchant to a creator.",
      "Use the product description, category, brand, and price context—not only the raw title.",
      "Create a short conversational product name instead of copying a long marketplace title.",
      "The message may use only {{creator_name}}, {{product_name}}, and {{shop_name}} placeholders.",
      "Do not include URLs, HTML, unsupported claims, private identifiers, or an invented discount.",
      input.mode === "ALTERNATIVE"
        ? "Make this materially different in wording and angle from the previous draft."
        : "Prefer a natural collaboration invitation with a clear reason the creator may care.",
    ].join(" "),
    userPrompt: JSON.stringify({
      task: "Generate one campaign first-touch message template and one conversational product name.",
      product: context.product,
      shopName: context.shopName,
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
      snapshotRef: context.snapshotRef,
      text: generated.value.text,
      productShortName: generated.value.productShortName,
      mode: input.mode,
      previousDraft: cleanOptionalText(input.previousDraft),
    },
  });
  return validated.validateAffiliateCampaignMessageTemplateSuggestion;
}

async function readCampaignAiContext(input: {
  authSession: CampaignAiBackendClient;
  snapshotRef: string;
  uiLocale: string;
  excludePhrases?: string[];
}): Promise<CampaignAiContext> {
  const result = await input.authSession.graphqlFetch<{
    affiliateCampaignAiGenerationContext: CampaignAiContext;
  }>(CAMPAIGN_AI_CONTEXT_QUERY, {
    input: {
      snapshotRef: input.snapshotRef,
      uiLocale: input.uiLocale,
      excludePhrases: input.excludePhrases ?? [],
    },
  });
  return result.affiliateCampaignAiGenerationContext;
}

function searchSuggestionJsonSchema(
  capabilities: CampaignMarketplaceCapabilities,
): Record<string, unknown> {
  const nullableInteger = { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] };
  const nullableStringEnum = (values: string[]) => ({
    anyOf: [{ type: "string", enum: values }, { type: "null" }],
  });
  const nullableStringArray = (values: string[]) => ({
    anyOf: [
      { type: "array", uniqueItems: true, items: { type: "string", enum: values } },
      { type: "null" },
    ],
  });
  return {
    type: "object",
    additionalProperties: false,
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["keyword", "explanation", "rules"],
          properties: {
            keyword: { type: "string", minLength: 2, maxLength: 80 },
            explanation: { type: "string", minLength: 1, maxLength: 300 },
            rules: {
              type: "object",
              additionalProperties: false,
              required: [
                "minimumFollowers",
                "maximumFollowers",
                "ageRanges",
                "gender",
                "genderMinimumPercentage",
                "gmvRanges",
                "unitsSoldRanges",
                "languages",
                "creatorLevels",
                "categoryPros",
              ],
              properties: {
                minimumFollowers: nullableInteger,
                maximumFollowers: nullableInteger,
                ageRanges: nullableStringArray(capabilities.ageRanges),
                gender: nullableStringEnum(capabilities.genders),
                genderMinimumPercentage: {
                  anyOf: [
                    { type: "number", minimum: 0, maximum: 100 },
                    { type: "null" },
                  ],
                },
                gmvRanges: nullableStringArray(capabilities.gmvRanges),
                unitsSoldRanges: nullableStringArray(capabilities.unitsSoldRanges),
                languages: nullableStringArray(capabilities.languages),
                creatorLevels: nullableStringArray(capabilities.creatorLevels),
                categoryPros: nullableStringArray(capabilities.categoryPros),
              },
            },
          },
        },
      },
    },
  };
}

function validateSearchSuggestionDraft(value: unknown): SearchSuggestionDraft {
  const record = strictRecord(value, ["suggestions"], "search suggestion result");
  if (!Array.isArray(record.suggestions) || record.suggestions.length !== 5) {
    throw new Error("suggestions must contain exactly five items");
  }
  return {
    suggestions: record.suggestions.map((item, index) => {
      const suggestion = strictRecord(
        item,
        ["keyword", "explanation", "rules"],
        `suggestions[${index}]`,
      );
      const rules = strictRecord(
        suggestion.rules,
        [
          "minimumFollowers",
          "maximumFollowers",
          "ageRanges",
          "gender",
          "genderMinimumPercentage",
          "gmvRanges",
          "unitsSoldRanges",
          "languages",
          "creatorLevels",
          "categoryPros",
        ],
        `suggestions[${index}].rules`,
      );
      return {
        keyword: requiredString(suggestion.keyword, `suggestions[${index}].keyword`, 80),
        explanation: requiredString(
          suggestion.explanation,
          `suggestions[${index}].explanation`,
          300,
        ),
        rules: {
          minimumFollowers: optionalNonNegativeInteger(rules.minimumFollowers),
          maximumFollowers: optionalNonNegativeInteger(rules.maximumFollowers),
          ageRanges: optionalStringArray(rules.ageRanges),
          gender: optionalString(rules.gender),
          genderMinimumPercentage: optionalPercentage(rules.genderMinimumPercentage),
          gmvRanges: optionalStringArray(rules.gmvRanges),
          unitsSoldRanges: optionalStringArray(rules.unitsSoldRanges),
          languages: optionalStringArray(rules.languages),
          creatorLevels: optionalStringArray(rules.creatorLevels),
          categoryPros: optionalStringArray(rules.categoryPros),
        },
      };
    }),
  };
}

function validateTemplateDraft(value: unknown): {
  text: string;
  productShortName: string;
} {
  const record = strictRecord(value, ["text", "productShortName"], "message template result");
  return {
    text: requiredString(record.text, "text", 2_000),
    productShortName: requiredString(record.productShortName, "productShortName", 80),
  };
}

function strictRecord(
  value: unknown,
  keys: string[],
  field: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const expected = new Set(keys);
  const actual = Object.keys(record);
  if (actual.some((key) => !expected.has(key)) || keys.some((key) => !(key in record))) {
    throw new Error(`${field} has an invalid key set`);
  }
  return record;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} must contain 1–${maxLength} characters`);
  }
  return normalized;
}

function optionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Optional string value is invalid");
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized || null;
}

function optionalStringArray(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("Optional string array is invalid");
  }
  return [...new Set(value.map((item) => item.normalize("NFKC").trim()).filter(Boolean))];
}

function optionalNonNegativeInteger(value: unknown): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error("Follower boundary must be a non-negative integer or null");
  }
  return Number(value);
}

function optionalPercentage(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Percentage must be between 0 and 100 or null");
  }
  return value;
}

function cleanOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized || null;
}

function localeInstruction(locale: string): string {
  const names: Record<string, string> = {
    en: "English",
    zh: "Chinese",
    de: "German",
    es: "Spanish",
    fr: "French",
    id: "Indonesian",
    it: "Italian",
    th: "Thai",
  };
  return names[locale] ?? locale;
}
