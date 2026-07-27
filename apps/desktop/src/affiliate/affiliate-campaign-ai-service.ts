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

interface SearchRulesDraft {
  minimumFollowers?: number | null;
  maximumFollowers?: number | null;
  ageRanges?: string[] | null;
  genderDistribution?: {
    gender: string;
    minimumPercentage: number;
  } | null;
  gmvRanges?: string[] | null;
  unitsSoldRanges?: string[] | null;
  languages?: string[] | null;
  creatorLevels?: string[] | null;
  categoryPros?: string[] | null;
}

interface SearchSuggestionCandidate {
  keyword: string;
  explanation: string;
  rules?: SearchRulesCandidate | null;
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
  shopId: string;
  productId: string;
  uiLocale: string;
  excludePhrases?: string[];
  guidance?: string;
  runStructured?: StructuredRunner;
}): Promise<CampaignSearchPhraseSuggestions> {
  const context = await readCampaignAiContext({
    authSession: input.authSession,
    shopId: input.shopId,
    productId: input.productId,
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
      "Every group must include at least one useful filter in rules; the phrase alone is not a complete search group.",
      "Use at least three distinct rule configurations across the five groups so they explore different creator segments.",
      "Use only capability values supplied in the user request. Omit filters that are not useful instead of emitting null or empty arrays.",
      "Do not over-constrain a group: select the smallest set of filters that materially expresses its audience or commercial intent.",
      "The property that contains advanced conditions is named rules, never filters.",
      "If gender is useful, express it only as the complete nested genderDistribution object with both gender and minimumPercentage.",
      `Write every explanation in ${localeInstruction(context.explanationLocale)}.`,
      'Return one JSON array shaped as [{"keyword":"...","explanation":"...","rules":{...}}].',
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
        rules:
          "At least one group-specific filter, with at least three distinct rule configurations across the complete set.",
      },
      outputContractExample: [
        {
          keyword: "three word English phrase",
          explanation: "localized explanation",
          rules: {
            minimumFollowers: 1000,
          },
        },
      ],
    }),
    jsonSchema: searchSuggestionJsonSchema(context.marketplaceCapabilities),
    validate: (value) => ({
      suggestions: validateSearchSuggestionDraft(value, context.marketplaceCapabilities),
    }),
  });

  const validated = await input.authSession.graphqlFetch<{
    validateAffiliateCampaignSearchPhraseSuggestions: CampaignSearchPhraseSuggestions;
  }>(VALIDATE_CAMPAIGN_SEARCH_SUGGESTIONS_MUTATION, {
    input: {
      shopId: input.shopId,
      productSnapshotHash: context.productSnapshotHash,
      uiLocale: context.explanationLocale,
      excludePhrases: context.excludePhrases,
      suggestions: generated.value.suggestions,
    },
  });
  return validated.validateAffiliateCampaignSearchPhraseSuggestions;
}

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
  const context = await readCampaignAiContext({
    authSession: input.authSession,
    shopId: input.shopId,
    productId: input.productId,
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
      shopId: input.shopId,
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
  shopId: string;
  productId: string;
  uiLocale: string;
  excludePhrases?: string[];
}): Promise<CampaignAiContext> {
  const result = await input.authSession.graphqlFetch<{
    affiliateCampaignAiGenerationContext: CampaignAiContext;
  }>(CAMPAIGN_AI_CONTEXT_QUERY, {
    input: {
      shopId: input.shopId,
      productId: input.productId,
      uiLocale: input.uiLocale,
      excludePhrases: input.excludePhrases ?? [],
    },
  });
  return result.affiliateCampaignAiGenerationContext;
}

function searchSuggestionJsonSchema(
  capabilities: CampaignMarketplaceCapabilities,
): Record<string, unknown> {
  const ruleProperties: Record<string, unknown> = {
    minimumFollowers: { type: "integer", minimum: 0 },
    maximumFollowers: { type: "integer", minimum: 0 },
  };
  const addEnumArray = (key: string, values: string[]) => {
    if (values.length > 0) {
      ruleProperties[key] = {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: { type: "string", enum: values },
      };
    }
  };
  addEnumArray("ageRanges", capabilities.ageRanges);
  if (capabilities.genders.length > 0) {
    ruleProperties.genderDistribution = {
      type: "object",
      additionalProperties: false,
      required: ["gender", "minimumPercentage"],
      properties: {
        gender: { type: "string", enum: capabilities.genders },
        minimumPercentage: { type: "number", minimum: 1, maximum: 100 },
      },
    };
  }
  addEnumArray("gmvRanges", capabilities.gmvRanges);
  addEnumArray("unitsSoldRanges", capabilities.unitsSoldRanges);
  addEnumArray("languages", capabilities.languages);
  addEnumArray("creatorLevels", capabilities.creatorLevels);
  addEnumArray("categoryPros", capabilities.categoryPros);
  return {
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
          minProperties: 1,
          additionalProperties: false,
          properties: ruleProperties,
        },
      },
    },
  };
}

function validateSearchSuggestionDraft(
  value: unknown,
  capabilities: CampaignMarketplaceCapabilities,
): SearchSuggestionCandidate[] {
  if (!Array.isArray(value) || value.length !== 5) {
    throw new Error("suggestions must contain exactly five items");
  }
  const suggestions = value.map((item, index) => {
    const itemRecord = recordWithAllowedKeys(
      item,
      ["keyword", "explanation", "rules"],
      ["keyword", "explanation", "rules"],
      `suggestions[${index}]`,
    );
    const suggestion = strictRecord(
      {
        keyword: itemRecord.keyword,
        explanation: itemRecord.explanation,
        rules: itemRecord.rules,
      },
      ["keyword", "explanation", "rules"],
      `suggestions[${index}]`,
    );
    const rules = recordWithAllowedKeys(
      suggestion.rules,
      [
        "minimumFollowers",
        "maximumFollowers",
        "ageRanges",
        "genderDistribution",
        "gmvRanges",
        "unitsSoldRanges",
        "languages",
        "creatorLevels",
        "categoryPros",
      ],
      [],
      `suggestions[${index}].rules`,
    );
    const draftRules: SearchRulesDraft = {
      minimumFollowers: optionalNonNegativeInteger(rules.minimumFollowers),
      maximumFollowers: optionalNonNegativeInteger(rules.maximumFollowers),
      ageRanges: optionalStringArray(rules.ageRanges),
      genderDistribution: optionalGenderDistribution(
        rules.genderDistribution,
        `suggestions[${index}].rules.genderDistribution`,
      ),
      gmvRanges: optionalStringArray(rules.gmvRanges),
      unitsSoldRanges: optionalStringArray(rules.unitsSoldRanges),
      languages: optionalStringArray(rules.languages),
      creatorLevels: optionalStringArray(rules.creatorLevels),
      categoryPros: optionalStringArray(rules.categoryPros),
    };
    const candidate = {
      keyword: requiredString(suggestion.keyword, `suggestions[${index}].keyword`, 80),
      explanation: requiredString(suggestion.explanation, `suggestions[${index}].explanation`, 300),
      rules: {
        minimumFollowers: draftRules.minimumFollowers,
        maximumFollowers: draftRules.maximumFollowers,
        ageRanges: draftRules.ageRanges,
        gender: draftRules.genderDistribution?.gender ?? null,
        genderMinimumPercentage: draftRules.genderDistribution?.minimumPercentage ?? null,
        gmvRanges: draftRules.gmvRanges,
        unitsSoldRanges: draftRules.unitsSoldRanges,
        languages: draftRules.languages,
        creatorLevels: draftRules.creatorLevels,
        categoryPros: draftRules.categoryPros,
      },
    };
    validateCandidateRules(candidate.rules, capabilities, index);
    return candidate;
  });
  const signatures = new Set(
    suggestions.map((suggestion) => meaningfulRuleSignature(suggestion.rules ?? {})),
  );
  if (signatures.size < 3) {
    throw new Error("suggestions must contain at least three distinct rule configurations");
  }
  return suggestions;
}

function validateCandidateRules(
  rules: SearchRulesCandidate,
  capabilities: CampaignMarketplaceCapabilities,
  index: number,
): void {
  if (
    rules.minimumFollowers != null &&
    rules.maximumFollowers != null &&
    rules.minimumFollowers > rules.maximumFollowers
  ) {
    throw new Error(`suggestions[${index}].rules has an invalid follower range`);
  }
  if ((rules.gender == null) !== (rules.genderMinimumPercentage == null)) {
    throw new Error(
      `suggestions[${index}].rules must provide gender and genderMinimumPercentage together`,
    );
  }
  assertAllowedValues(rules.ageRanges, capabilities.ageRanges, index, "ageRanges");
  assertAllowedValues(rules.gender ? [rules.gender] : null, capabilities.genders, index, "gender");
  assertAllowedValues(rules.gmvRanges, capabilities.gmvRanges, index, "gmvRanges");
  assertAllowedValues(
    rules.unitsSoldRanges,
    capabilities.unitsSoldRanges,
    index,
    "unitsSoldRanges",
  );
  assertAllowedValues(rules.languages, capabilities.languages, index, "languages");
  assertAllowedValues(rules.creatorLevels, capabilities.creatorLevels, index, "creatorLevels");
  assertAllowedValues(rules.categoryPros, capabilities.categoryPros, index, "categoryPros");
  if (meaningfulRuleSignature(rules) === "{}") {
    throw new Error(`suggestions[${index}].rules must include at least one useful filter`);
  }
}

function assertAllowedValues(
  values: string[] | null | undefined,
  allowed: string[],
  index: number,
  field: string,
): void {
  if (values?.some((value) => !allowed.includes(value))) {
    throw new Error(`suggestions[${index}].rules.${field} contains an unsupported value`);
  }
}

function meaningfulRuleSignature(rules: SearchRulesCandidate): string {
  const meaningful = {
    ...(rules.minimumFollowers != null ? { minimumFollowers: rules.minimumFollowers } : {}),
    ...(rules.maximumFollowers != null ? { maximumFollowers: rules.maximumFollowers } : {}),
    ...(rules.ageRanges?.length ? { ageRanges: [...rules.ageRanges].sort() } : {}),
    ...(rules.gender != null && rules.genderMinimumPercentage != null
      ? {
          gender: rules.gender,
          genderMinimumPercentage: rules.genderMinimumPercentage,
        }
      : {}),
    ...(rules.gmvRanges?.length ? { gmvRanges: [...rules.gmvRanges].sort() } : {}),
    ...(rules.unitsSoldRanges?.length
      ? { unitsSoldRanges: [...rules.unitsSoldRanges].sort() }
      : {}),
    ...(rules.languages?.length ? { languages: [...rules.languages].sort() } : {}),
    ...(rules.creatorLevels?.length ? { creatorLevels: [...rules.creatorLevels].sort() } : {}),
    ...(rules.categoryPros?.length ? { categoryPros: [...rules.categoryPros].sort() } : {}),
  };
  return JSON.stringify(meaningful);
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

function strictRecord(value: unknown, keys: string[], field: string): Record<string, unknown> {
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

function recordWithAllowedKeys(
  value: unknown,
  allowedKeys: string[],
  requiredKeys: string[],
  field: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedKeys);
  const actual = Object.keys(record);
  if (actual.some((key) => !allowed.has(key)) || requiredKeys.some((key) => !(key in record))) {
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

function optionalGenderDistribution(
  value: unknown,
  field: string,
): SearchRulesDraft["genderDistribution"] {
  if (value == null) return null;
  const record = strictRecord(value, ["gender", "minimumPercentage"], field);
  if (typeof record.gender !== "string") {
    throw new Error(`${field}.gender must be a string`);
  }
  const gender = record.gender.normalize("NFKC").trim();
  if (!gender) throw new Error(`${field}.gender must not be empty`);
  const minimumPercentage = optionalPercentage(record.minimumPercentage);
  if (minimumPercentage == null || minimumPercentage < 1) {
    throw new Error(`${field}.minimumPercentage must be between 1 and 100`);
  }
  return { gender, minimumPercentage };
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
