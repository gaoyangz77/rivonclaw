import { createLogger } from "@rivonclaw/logger";
import type { AuthSessionManager } from "../auth/session.js";
import type { AffiliateCampaignSearchPlanRequestPayload } from "../cloud/backend-subscription-client.js";
import { runStructuredOneShotAgent } from "../gateway/structured-one-shot-agent.js";

const log = createLogger("affiliate-campaign-search-plan");

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
type GeneratedPlan = { keyword: string; explanation: string; rules: SearchRules };
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
  private tail: Promise<void> = Promise.resolve();
  private readonly enqueued = new Set<string>();

  constructor(
    private readonly authSession: BackendClient,
    private readonly deviceId: string,
    private readonly uiLocale: string,
    private readonly generate: typeof generatePlan = generatePlan,
  ) {}

  enqueue(request: AffiliateCampaignSearchPlanRequestPayload): void {
    const key = `${request.searchPlanId}:${request.generation}:${request.attempt}`;
    if (this.enqueued.has(key)) return;
    this.enqueued.add(key);
    this.tail = this.tail
      .then(() => this.process(request))
      .catch((error) => {
        log.error("SearchPlan actuator queue failed", {
          searchPlanId: request.searchPlanId,
          generation: request.generation,
          error: errorMessage(error),
        });
      })
      .finally(() => {
        this.enqueued.delete(key);
      });
  }

  async waitForIdle(): Promise<void> {
    await this.tail;
  }

  private async process(request: AffiliateCampaignSearchPlanRequestPayload): Promise<void> {
    let context: GenerationContext;
    try {
      const claimed = await this.authSession.graphqlFetch<{
        claimAffiliateCampaignSearchPlanGeneration: GenerationContext;
      }>(CLAIM, { input: {
        searchPlanId: request.searchPlanId,
        generation: request.generation,
        deviceId: this.deviceId,
        uiLocale: this.uiLocale,
      } });
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
          await this.authSession.graphqlFetch(SUBMIT, { input: {
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
          } });
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
          const retryable = message.includes("SEARCH_PLAN_DUPLICATE_WITHIN_30_DAYS") ||
            message.includes("CAPABILITY") || message.includes("ENGLISH_PHRASE");
          if (!retryable || semanticAttempt === 2) throw error;
        }
      }
    } catch (error) {
      await this.authSession.graphqlFetch(REPORT, { input: {
        searchPlanId: request.searchPlanId,
        generation: request.generation,
        leaseToken: context.leaseToken,
        errorCode: classifyError(error),
      } }).catch((reportError) => log.warn("Failed to report SearchPlan generation failure", {
        searchPlanId: request.searchPlanId,
        error: errorMessage(reportError),
      }));
    }
  }
}

async function generatePlan(context: GenerationContext, semanticAttempt: number) {
  const capability = context.capability;
  const enumArray = (key: string) => Array.isArray(capability[key]) ? capability[key] : [];
  const ruleProperties: Record<string, unknown> = {
    minimumFollowers: { type: "integer", minimum: 0 },
    maximumFollowers: { type: "integer", minimum: 0 },
  };
  for (const [key, capabilityKey] of [
    ["ageRanges", "ageRanges"], ["gmvRanges", "gmvRanges"],
    ["unitsSoldRanges", "unitsSoldRanges"], ["languages", "languages"],
    ["creatorLevels", "creatorLevels"], ["categoryPros", "categoryPros"],
  ]) {
    const values = enumArray(capabilityKey);
    if (values.length) ruleProperties[key] = { type: "array", uniqueItems: true, items: { type: "string", enum: values } };
  }
  const genders = enumArray("genders");
  if (genders.length) {
    ruleProperties.gender = { type: "string", enum: genders };
    ruleProperties.genderMinimumPercentage = { type: "number", minimum: 1, maximum: 100 };
  }
  return runStructuredOneShotAgent<GeneratedPlan>({
    namespace: "affiliate-campaign-search-plan",
    systemPrompt: [
      "Generate exactly one next TikTok Creator Marketplace search plan.",
      "keyword must be a useful English phrase containing 2-8 words.",
      `explanation must use UI locale ${context.uiLocale}.`,
      "rules may be empty. Add filters only when historical plan volume shows the search should be narrowed.",
      "Do not repeat or trivially paraphrase a recent plan. Never invent unsupported rule enum values.",
      semanticAttempt === 2 ? "The prior proposal was rejected semantically; choose a materially different phrase or supported rules." : "",
    ].filter(Boolean).join("\n"),
    userPrompt: JSON.stringify({
      campaign: context.campaign,
      shop: context.shop,
      product: context.productSnapshot,
      supportedMarketplaceConditions: capability,
      recentSearchPlans: context.recentPlans,
    }),
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["keyword", "explanation", "rules"],
      properties: {
        keyword: { type: "string", minLength: 2, maxLength: 80 },
        explanation: { type: "string", minLength: 2, maxLength: 300 },
        rules: { type: "object", additionalProperties: false, properties: ruleProperties },
      },
    },
    validate: validateGeneratedPlan,
  });
}

function validateGeneratedPlan(value: unknown): GeneratedPlan {
  if (!value || typeof value !== "object") throw new Error("SEARCH_PLAN_JSON_INVALID");
  const item = value as Record<string, unknown>;
  const keyword = String(item.keyword ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
  const explanation = String(item.explanation ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
  const words = keyword.match(/\p{Script=Latin}[\p{Script=Latin}\p{Mark}'’-]*/gu) ?? [];
  if (words.length < 2 || words.length > 8 || /[^\p{Script=Latin}\p{Mark}\p{Number}\s&'+,./()\-–—]/u.test(keyword)) {
    throw new Error("SEARCH_PLAN_ENGLISH_PHRASE_REQUIRED");
  }
  if (!explanation || explanation.length > 300) throw new Error("SEARCH_PLAN_EXPLANATION_INVALID");
  const rules = item.rules && typeof item.rules === "object" && !Array.isArray(item.rules)
    ? item.rules as SearchRules : {};
  return { keyword, explanation, rules };
}

function providerRules(rules: SearchRules): Record<string, unknown> {
  return {
    ...(rules.minimumFollowers != null || rules.maximumFollowers != null ? {
      followerCount: { minimum: rules.minimumFollowers, maximum: rules.maximumFollowers },
    } : {}),
    ...(rules.ageRanges?.length || rules.gender ? {
      audience: {
        ageRanges: rules.ageRanges ?? [],
        ...(rules.gender && rules.genderMinimumPercentage != null ? {
          genderDistribution: { gender: rules.gender, minimumPercentage: rules.genderMinimumPercentage },
        } : {}),
      },
    } : {}),
    ...(rules.gmvRanges?.length || rules.unitsSoldRanges?.length ? {
      salesPerformance30d: { gmvRanges: rules.gmvRanges ?? [], unitsSoldRanges: rules.unitsSoldRanges ?? [] },
    } : {}),
    categories: [],
    ...(rules.languages?.length || rules.creatorLevels?.length || rules.categoryPros?.length ? {
      marketSpecific: {
        languages: rules.languages ?? [], creatorLevels: rules.creatorLevels ?? [], categoryPros: rules.categoryPros ?? [],
      },
    } : {}),
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
