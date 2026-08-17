import { createLogger } from "@rivonclaw/logger";
import type { AuthSessionManager } from "../auth/session.js";
import type { AffiliateCampaignSearchPlanRequestPayload } from "../cloud/backend-subscription-client.js";
import { runStructuredOneShotAgent } from "../gateway/structured-one-shot-agent.js";

const log = createLogger("affiliate-campaign-search-plan");
export const DEFAULT_SEARCH_PLAN_GENERATION_CONCURRENCY = 3;
export const SEARCH_PLAN_AGENT_TIMEOUT_MS = 3 * 60 * 1000;

const CLAIM = `mutation ClaimAffiliateCampaignSearchPlanGeneration($input: ClaimAffiliateCampaignSearchPlanGenerationInput!) {
  claimAffiliateCampaignSearchPlanGeneration(input: $input) {
    leaseToken searchPlanId campaign shop productSnapshot capability uiLocale recentPlans
  }
}`;
const SUBMIT = `mutation SubmitAffiliateCampaignSearchPlan($input: SubmitAffiliateCampaignSearchPlanInput!) {
  submitAffiliateCampaignSearchPlan(input: $input) { id status generation pageSequence }
}`;
const REPORT = `mutation ReportAffiliateCampaignSearchPlanGenerationFailure($input: ReportAffiliateCampaignSearchPlanGenerationFailureInput!) {
  reportAffiliateCampaignSearchPlanGenerationFailure(input: $input) { id status errorCode }
}`;

type BackendClient = Pick<AuthSessionManager, "graphqlFetch">;
type SearchRules = {
  minimumFollowers?: number;
  maximumFollowers?: number;
  ageRanges?: string[];
  gender?: string;
  genderMinimumPercentage?: number;
  gmvRanges?: string[];
  unitsSoldRanges?: string[];
  languages?: string[];
  creatorLevels?: string[];
  categoryPros?: string[];
};
type SearchPlanGuidanceInterpretation = {
  softDirections: string[];
  hardConstraints: SearchRules;
  unsupportedHardConstraints: string[];
};
type GeneratedPlan = {
  keyword: string;
  explanation: string;
  rules: SearchRules;
  guidanceInterpretation: SearchPlanGuidanceInterpretation;
};
type GenerationContext = {
  leaseToken: string;
  searchPlanId: string;
  campaign: Record<string, unknown>;
  shop: Record<string, unknown>;
  productSnapshot: Record<string, unknown> & { snapshotHash: string };
  capability: Record<string, unknown>;
  uiLocale: string;
  recentPlans: Array<Record<string, unknown>>;
};

export class AffiliateCampaignSearchPlanActuator {
  private readonly pendingByShop = new Map<string, AffiliateCampaignSearchPlanRequestPayload[]>();
  private readonly shopOrder: string[] = [];
  private readonly enqueued = new Set<string>();
  private readonly idleWaiters = new Set<() => void>();
  private activeCount = 0;
  private pendingCount = 0;
  private lastStartedShopId: string | undefined;
  private readonly maxConcurrency: number;

  constructor(
    private readonly authSession: BackendClient,
    private readonly deviceId: string,
    private readonly getUiLocale: () => string,
    private readonly generate: typeof generatePlan = generatePlan,
    maxConcurrency = DEFAULT_SEARCH_PLAN_GENERATION_CONCURRENCY,
  ) {
    this.maxConcurrency = Number.isFinite(maxConcurrency)
      ? Math.max(1, Math.floor(maxConcurrency))
      : DEFAULT_SEARCH_PLAN_GENERATION_CONCURRENCY;
  }

  enqueue(request: AffiliateCampaignSearchPlanRequestPayload): void {
    const key = `${request.searchPlanId}:${request.generation}:${request.attempt}`;
    if (this.enqueued.has(key)) return;
    this.enqueued.add(key);
    const shopQueue = this.pendingByShop.get(request.shopId);
    if (shopQueue) {
      shopQueue.push(request);
    } else {
      this.pendingByShop.set(request.shopId, [request]);
      this.shopOrder.push(request.shopId);
    }
    this.pendingCount += 1;
    this.drain();
  }

  async waitForIdle(): Promise<void> {
    if (this.activeCount === 0 && this.pendingCount === 0) return;
    await new Promise<void>((resolve) => this.idleWaiters.add(resolve));
  }

  private drain(): void {
    while (this.activeCount < this.maxConcurrency && this.pendingCount > 0) {
      const request = this.takeNext();
      if (!request) break;
      this.activeCount += 1;
      const key = `${request.searchPlanId}:${request.generation}:${request.attempt}`;
      void this.process(request)
        .catch((error) => {
          log.error("SearchPlan actuator queue failed", {
            searchPlanId: request.searchPlanId,
            generation: request.generation,
            error: errorMessage(error),
          });
        })
        .finally(() => {
          this.enqueued.delete(key);
          this.activeCount -= 1;
          this.drain();
          this.resolveIdleIfNeeded();
        });
    }
  }

  private takeNext(): AffiliateCampaignSearchPlanRequestPayload | undefined {
    if (!this.shopOrder.length) return undefined;
    let index = this.shopOrder.findIndex((shopId) => shopId !== this.lastStartedShopId);
    if (index < 0) index = 0;
    const [shopId] = this.shopOrder.splice(index, 1);
    if (!shopId) return undefined;
    const shopQueue = this.pendingByShop.get(shopId);
    if (!shopQueue) {
      return this.takeNext();
    }
    const request = shopQueue.shift();
    if (!request) {
      this.pendingByShop.delete(shopId);
      return this.takeNext();
    }
    this.pendingCount -= 1;
    this.lastStartedShopId = shopId;
    if (shopQueue.length) {
      this.shopOrder.push(shopId);
    } else {
      this.pendingByShop.delete(shopId);
    }
    return request;
  }

  private resolveIdleIfNeeded(): void {
    if (this.activeCount !== 0 || this.pendingCount !== 0) return;
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }

  private async process(request: AffiliateCampaignSearchPlanRequestPayload): Promise<void> {
    let context: GenerationContext;
    try {
      const claimed = await this.authSession.graphqlFetch<{
        claimAffiliateCampaignSearchPlanGeneration: GenerationContext;
      }>(CLAIM, {
        input: {
          searchPlanId: request.searchPlanId,
          generation: request.generation,
          deviceId: this.deviceId,
          uiLocale: this.getUiLocale(),
        },
      });
      context = claimed.claimAffiliateCampaignSearchPlanGeneration;
    } catch (error) {
      log.info("SearchPlan request was not claimable", {
        searchPlanId: request.searchPlanId,
        generation: request.generation,
        error: errorMessage(error),
      });
      return;
    }

    try {
      for (let semanticAttempt = 1; semanticAttempt <= 2; semanticAttempt += 1) {
        const generated = await this.generate(context, semanticAttempt);
        try {
          await this.authSession.graphqlFetch(SUBMIT, {
            input: {
              searchPlanId: request.searchPlanId,
              generation: request.generation,
              configRevision: request.configRevision,
              leaseToken: context.leaseToken,
              productSnapshotHash: context.productSnapshot.snapshotHash,
              uiLocale: context.uiLocale,
              phrase: {
                text: generated.value.keyword,
                explanation: generated.value.explanation,
                discoveryRules: providerRules(generated.value.rules),
              },
              guidanceInterpretation: {
                sourceGuidanceHash: String(context.campaign.searchPlanGuidanceHash ?? ""),
                softDirections: generated.value.guidanceInterpretation.softDirections,
                hardConstraints: providerRules(
                  generated.value.guidanceInterpretation.hardConstraints,
                ),
                unsupportedHardConstraints:
                  generated.value.guidanceInterpretation.unsupportedHardConstraints,
              },
            },
          });
          log.info("Dynamic Affiliate Campaign SearchPlan generated", {
            searchPlanId: request.searchPlanId,
            generation: request.generation,
            model: `${generated.provider}/${generated.model}`,
            durationMs: generated.durationMs,
            repaired: generated.repaired,
            runIds: generated.runIds,
            semanticAttempt,
          });
          return;
        } catch (error) {
          const message = errorMessage(error);
          const retryable =
            message.includes("SEARCH_PLAN_DUPLICATE_WITHIN_30_DAYS") ||
            message.includes("CAPABILITY") ||
            message.includes("ENGLISH_PHRASE") ||
            message.includes("SEARCH_PLAN_GUIDANCE");
          if (!retryable || semanticAttempt === 2) throw error;
        }
      }
    } catch (error) {
      log.warn("Dynamic Affiliate Campaign SearchPlan generation failed", {
        searchPlanId: request.searchPlanId,
        generation: request.generation,
        error: errorMessage(error),
      });
      await this.authSession
        .graphqlFetch(REPORT, {
          input: {
            searchPlanId: request.searchPlanId,
            generation: request.generation,
            leaseToken: context.leaseToken,
            errorCode: classifyError(error),
          },
        })
        .catch((reportError) =>
          log.warn("Failed to report SearchPlan generation failure", {
            searchPlanId: request.searchPlanId,
            error: errorMessage(reportError),
          }),
        );
    }
  }
}

async function generatePlan(context: GenerationContext, semanticAttempt: number) {
  const capability = context.capability;
  const enumArray = (key: string) => (Array.isArray(capability[key]) ? capability[key] : []);
  const ruleProperties: Record<string, unknown> = {
    minimumFollowers: { type: "integer", minimum: 0 },
    maximumFollowers: { type: "integer", minimum: 0 },
  };
  for (const [key, capabilityKey] of [
    ["ageRanges", "ageRanges"],
    ["gmvRanges", "gmvRanges"],
    ["unitsSoldRanges", "unitsSoldRanges"],
    ["languages", "languages"],
    ["creatorLevels", "creatorLevels"],
    ["categoryPros", "categoryPros"],
  ]) {
    const values = enumArray(capabilityKey);
    if (values.length)
      ruleProperties[key] = {
        type: "array",
        uniqueItems: true,
        items: { type: "string", enum: values },
      };
  }
  const genders = enumArray("genders");
  if (genders.length) {
    ruleProperties.gender = { type: "string", enum: genders };
    ruleProperties.genderMinimumPercentage = { type: "number", minimum: 1, maximum: 100 };
  }
  return runStructuredOneShotAgent<GeneratedPlan>({
    namespace: "affiliate-campaign-search-plan",
    timeoutMs: SEARCH_PLAN_AGENT_TIMEOUT_MS,
    systemPrompt: [
      "Generate exactly one next TikTok Creator Marketplace search plan.",
      "keyword MUST be a useful, product-relevant English phrase containing 2-8 words, never a generic one-word placeholder such as creator or influencer.",
      `explanation MUST explain why this exact search direction fits the product, using UI locale ${context.uiLocale}.`,
      "rules may be empty. Add filters only when historical plan volume shows the search should be narrowed.",
      "Campaign searchPlanGuidance has two semantics. Descriptive preferences, audiences, styles, and directions are SOFT: use them to choose the keyword and optional filters, but do not claim they are guaranteed.",
      "Obligation language such as must, required, only, at least, at most, no more than, exclude, do not include, and equivalents in the user's language is HARD.",
      "Every supported HARD clause MUST appear exactly in guidanceInterpretation.hardConstraints and also be applied to rules. Historical search volume never removes a hard constraint.",
      "Every HARD clause that cannot be represented by supportedMarketplaceConditions MUST be copied into unsupportedHardConstraints. Never silently ignore, weaken, or reinterpret it as soft guidance.",
      `Put concise summaries of all remaining soft guidance in softDirections, written in UI locale ${context.uiLocale}. softDirections MUST be a JSON array of plain strings, never a single string or object. If Campaign guidance is empty, all three interpretation fields must be empty.`,
      localeSpecificGuidanceInstruction(context.uiLocale),
      "Do not repeat or trivially paraphrase a recent plan. Never invent unsupported rule enum values.",
      semanticAttempt === 2
        ? "The prior proposal was rejected semantically; choose a materially different phrase or supported rules."
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    userPrompt: [
      "Generate the SearchPlan for this exact Campaign and product context. Return no placeholder content.",
      `Mandatory constraints: keyword is a product-relevant 2-8 word English phrase; explanation is written in ${context.uiLocale}; rules contain only supported values and may be empty unless Campaign hard guidance requires a filter.`,
      JSON.stringify({
        campaign: context.campaign,
        shop: context.shop,
        product: context.productSnapshot,
        supportedMarketplaceConditions: capability,
        recentSearchPlans: context.recentPlans,
      }),
    ].join("\n"),
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["keyword", "explanation", "rules", "guidanceInterpretation"],
      properties: {
        keyword: {
          type: "string",
          minLength: 3,
          maxLength: 80,
          pattern: "^[A-Za-z0-9&'+,./()\\-–—]+(?:\\s+[A-Za-z0-9&'+,./()\\-–—]+){1,7}$",
          description:
            "A product-relevant English search phrase containing 2-8 space-separated words.",
        },
        explanation: {
          type: "string",
          minLength: 2,
          maxLength: 300,
          description: `Why this search direction fits the product, written in UI locale ${context.uiLocale}.`,
        },
        rules: { type: "object", additionalProperties: false, properties: ruleProperties },
        guidanceInterpretation: {
          type: "object",
          additionalProperties: false,
          required: ["softDirections", "hardConstraints", "unsupportedHardConstraints"],
          properties: {
            softDirections: {
              type: "array",
              maxItems: 10,
              uniqueItems: true,
              items: { type: "string", minLength: 1, maxLength: 200 },
            },
            hardConstraints: {
              type: "object",
              additionalProperties: false,
              properties: ruleProperties,
            },
            unsupportedHardConstraints: {
              type: "array",
              maxItems: 10,
              uniqueItems: true,
              items: { type: "string", minLength: 1, maxLength: 200 },
            },
          },
        },
      },
    },
    validate: (value) => validateGeneratedPlan(value, context),
  });
}

export function validateGeneratedPlan(value: unknown, context: GenerationContext): GeneratedPlan {
  if (!value || typeof value !== "object") throw new Error("SEARCH_PLAN_JSON_INVALID");
  const item = value as Record<string, unknown>;
  const keyword = String(item.keyword ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ");
  const explanation = String(item.explanation ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ");
  const words = keyword.match(/\p{Script=Latin}[\p{Script=Latin}\p{Mark}'’-]*/gu) ?? [];
  if (
    words.length < 2 ||
    words.length > 8 ||
    /[^\p{Script=Latin}\p{Mark}\p{Number}\s&'+,./()\-–—]/u.test(keyword)
  ) {
    throw new Error("SEARCH_PLAN_ENGLISH_PHRASE_REQUIRED");
  }
  if (!explanation || explanation.length > 300) throw new Error("SEARCH_PLAN_EXPLANATION_INVALID");
  if (!explanationMatchesLocale(explanation, context.uiLocale)) {
    throw new Error("SEARCH_PLAN_EXPLANATION_LOCALE_REQUIRED");
  }
  const rawRules =
    item.rules && typeof item.rules === "object" && !Array.isArray(item.rules)
      ? (item.rules as SearchRules)
      : {};
  const rawInterpretation =
    item.guidanceInterpretation &&
    typeof item.guidanceInterpretation === "object" &&
    !Array.isArray(item.guidanceInterpretation)
      ? (item.guidanceInterpretation as Record<string, unknown>)
      : {};
  const hardConstraints =
    rawInterpretation.hardConstraints &&
    typeof rawInterpretation.hardConstraints === "object" &&
    !Array.isArray(rawInterpretation.hardConstraints)
      ? (rawInterpretation.hardConstraints as SearchRules)
      : {};
  const rules = removeNonNarrowingEnumFilters(rawRules, context.capability, hardConstraints);
  const guidance = String(context.campaign.searchPlanGuidance ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ");
  const hasHardGuidance = guidanceAppearsToContainHardConstraint(guidance);
  const softDirections = normalizeSoftDirections({
    value: rawInterpretation.softDirections,
    explanation,
    uiLocale: context.uiLocale,
    allowLocalizedFallback: Boolean(guidance) && !hasHardGuidance,
  });
  const unsupportedHardConstraints = rawInterpretation.unsupportedHardConstraints === undefined
    ? []
    : normalizeInterpretationStatements(
      rawInterpretation.unsupportedHardConstraints,
      "SEARCH_PLAN_GUIDANCE_HARD_CONSTRAINT_INVALID",
    );
  const hasHardConstraints = hasMeaningfulRule(hardConstraints);
  if (unsupportedHardConstraints.length) {
    throw new Error("SEARCH_PLAN_GUIDANCE_HARD_CONSTRAINT_UNSUPPORTED");
  }
  if (!guidance && (softDirections.length || hasHardConstraints)) {
    throw new Error("SEARCH_PLAN_GUIDANCE_INTERPRETATION_INVALID");
  }
  if (guidance && !softDirections.length && !hasHardConstraints) {
    throw new Error(
      hasHardGuidance
        ? "SEARCH_PLAN_GUIDANCE_HARD_CONSTRAINT_REQUIRED"
        : "SEARCH_PLAN_GUIDANCE_INTERPRETATION_REQUIRED",
    );
  }
  if (hasHardGuidance && !hasHardConstraints) {
    throw new Error("SEARCH_PLAN_GUIDANCE_HARD_CONSTRAINT_REQUIRED");
  }
  if (hasHardConstraints && !containsRequiredValue(rules, hardConstraints)) {
    throw new Error("SEARCH_PLAN_GUIDANCE_HARD_CONSTRAINT_NOT_APPLIED");
  }
  return {
    keyword,
    explanation,
    rules,
    guidanceInterpretation: {
      softDirections,
      hardConstraints,
      unsupportedHardConstraints,
    },
  };
}

function explanationMatchesLocale(explanation: string, uiLocale: string): boolean {
  const language = uiLocale.trim().toLowerCase().split(/[-_]/u)[0];
  if (language === "zh") return /\p{Script=Han}/u.test(explanation);
  if (language === "th") return /\p{Script=Thai}/u.test(explanation);
  return true;
}

function removeNonNarrowingEnumFilters(
  rules: SearchRules,
  capability: Record<string, unknown>,
  hardConstraints: SearchRules = {},
): SearchRules {
  const next = { ...rules };
  for (const key of [
    "ageRanges",
    "gmvRanges",
    "unitsSoldRanges",
    "languages",
    "creatorLevels",
    "categoryPros",
  ] as const) {
    const selected = next[key];
    const supported = capability[key];
    if (
      !hasMeaningfulRule(hardConstraints[key]) &&
      Array.isArray(selected) &&
      Array.isArray(supported) &&
      supported.length > 0 &&
      new Set(selected).size === new Set(supported).size &&
      supported.every((value) => selected.includes(String(value)))
    ) {
      delete next[key];
    }
  }
  return next;
}

export function guidanceAppearsToContainHardConstraint(value: string): boolean {
  const guidance = value.normalize("NFKC").trim().toLocaleLowerCase();
  return /(?:\b(?:must|required|only|at least|at most|no more than|over|under|exclude|do not include)\b|\b\d[\d,.]*\s*(?:k|m)?\s*\+|必须|务必|至少|不低于|不小于|不得少于|不超过|至多|最多|以上|以下|仅限|排除|不要包含|\b(?:muss|mindestens|höchstens|nur|ausschließen|debe|solo|al menos|como máximo|excluir|doit|uniquement|au moins|au plus|exclure|harus|hanya|minimal|maksimal|kecualikan|deve|almeno|al massimo|escludere)\b|ต้อง|เท่านั้น|อย่างน้อย|ไม่เกิน|ยกเว้น)/iu.test(
    guidance,
  );
}

function normalizeInterpretationStatements(
  value: unknown,
  errorCode: string,
  options: { allowSingleton?: boolean } = {},
): string[] {
  const values = options.allowSingleton && typeof value === "string" ? [value] : value;
  if (!Array.isArray(values) || values.length > 10) throw new Error(errorCode);
  const statements = values.map((item) => String(item).normalize("NFKC").trim().replace(/\s+/gu, " "));
  if (statements.some((item) => !item || item.length > 200)) throw new Error(errorCode);
  return [...new Set(statements)];
}

function normalizeSoftDirections(input: {
  value: unknown;
  explanation: string;
  uiLocale: string;
  allowLocalizedFallback: boolean;
}): string[] {
  let statements: string[];
  try {
    statements = normalizeInterpretationStatements(
      input.value,
      "SEARCH_PLAN_GUIDANCE_SOFT_DIRECTION_INVALID",
      { allowSingleton: true },
    );
  } catch (error) {
    if (!input.allowLocalizedFallback) throw error;
    return [input.explanation];
  }
  if (statements.some((direction) => !explanationMatchesLocale(direction, input.uiLocale))) {
    if (input.allowLocalizedFallback) return [input.explanation];
    throw new Error(
      `SEARCH_PLAN_GUIDANCE_SOFT_DIRECTION_LOCALE_REQUIRED: every softDirections item must be written in ${input.uiLocale}${localeScriptRequirement(input.uiLocale)}`,
    );
  }
  return statements;
}

function localeSpecificGuidanceInstruction(uiLocale: string): string {
  const language = uiLocale.trim().toLowerCase().split(/[-_]/u)[0];
  if (language === "zh") {
    return 'For this Chinese UI locale, every softDirections item MUST contain Chinese Han characters; example shape: "softDirections": ["实用汽车内容达人"].';
  }
  if (language === "th") {
    return 'For this Thai UI locale, every softDirections item MUST contain Thai script; example shape: "softDirections": ["ครีเอเตอร์สายรถยนต์"].';
  }
  return `Every softDirections item MUST be written in the language of UI locale ${uiLocale}.`;
}

function localeScriptRequirement(uiLocale: string): string {
  const language = uiLocale.trim().toLowerCase().split(/[-_]/u)[0];
  if (language === "zh") return " and contain Chinese Han characters";
  if (language === "th") return " and contain Thai script";
  return "";
}

function hasMeaningfulRule(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== "object") return value !== undefined && value !== null;
  return Object.values(value as Record<string, unknown>).some(hasMeaningfulRule);
}

function containsRequiredValue(actual: unknown, required: unknown): boolean {
  if (Array.isArray(required)) {
    if (!required.length) return true;
    if (!Array.isArray(actual)) return false;
    return canonicalValue(actual) === canonicalValue(required);
  }
  if (!required || typeof required !== "object") return Object.is(actual, required);
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  return Object.entries(required as Record<string, unknown>).every(
    ([key, child]) => !hasMeaningfulRule(child) || containsRequiredValue(
      (actual as Record<string, unknown>)[key],
      child,
    ),
  );
}

function canonicalValue(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify([...value].map(String).sort());
  }
  return JSON.stringify(value);
}

function providerRules(rules: SearchRules): Record<string, unknown> {
  return {
    ...(rules.minimumFollowers != null || rules.maximumFollowers != null
      ? {
          followerCount: { minimum: rules.minimumFollowers, maximum: rules.maximumFollowers },
        }
      : {}),
    ...(rules.ageRanges?.length || rules.gender
      ? {
          audience: {
            ageRanges: rules.ageRanges ?? [],
            ...(rules.gender && rules.genderMinimumPercentage != null
              ? {
                  genderDistribution: {
                    gender: rules.gender,
                    minimumPercentage: rules.genderMinimumPercentage,
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(rules.gmvRanges?.length || rules.unitsSoldRanges?.length
      ? {
          salesPerformance30d: {
            gmvRanges: rules.gmvRanges ?? [],
            unitsSoldRanges: rules.unitsSoldRanges ?? [],
          },
        }
      : {}),
    categories: [],
    ...(rules.languages?.length || rules.creatorLevels?.length || rules.categoryPros?.length
      ? {
          marketSpecific: {
            languages: rules.languages ?? [],
            creatorLevels: rules.creatorLevels ?? [],
            categoryPros: rules.categoryPros ?? [],
          },
        }
      : {}),
  };
}

function classifyError(error: unknown): string {
  const message = errorMessage(error).toUpperCase();
  const match = message.match(/SEARCH_PLAN_[A-Z0-9_]+/u);
  return match?.[0] ?? "SEARCH_PLAN_AGENT_GENERATION_FAILED";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
