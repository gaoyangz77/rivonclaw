import { describe, expect, it, vi } from "vitest";
import type { AffiliateCampaignSearchPlanRequestPayload } from "../cloud/backend-subscription-client.js";
import {
  AffiliateCampaignSearchPlanActuator,
  guidanceAppearsToContainHardConstraint,
  validateGeneratedPlan,
} from "./affiliate-campaign-search-plan-actuator.js";

function request(
  id: string,
  generation: number,
  shopId = "shop-1",
): AffiliateCampaignSearchPlanRequestPayload {
  return {
    generationRequestId: id,
    campaignId: `campaign-${id}`,
    shopId,
    platformShopId: `platform-${shopId}`,
    generation,
    configRevision: 3,
    requestedAt: "2026-08-10T00:00:00.000Z",
    attempt: 1,
  };
}

describe("AffiliateCampaignSearchPlanActuator", () => {
  it("deduplicates requests and preserves FIFO order when configured for one worker", async () => {
    const operations: string[] = [];
    const graphqlFetch = vi.fn(async (query: string, variables?: Record<string, any>) => {
      if (query.includes("ClaimAffiliateCampaignSearchPlanGeneration")) {
        const id = variables?.input.generationRequestId as string;
        operations.push(`claim:${id}`);
        return {
          claimAffiliateCampaignSearchPlanGeneration: {
            leaseToken: `lease-${id}`,
            generationRequestId: id,
            campaign: {
              searchPlanGuidance: "automotive creators",
              searchPlanGuidanceHash: "guidance-hash",
            },
            shop: { market: "US" },
            productSnapshot: { snapshotHash: `snapshot-${id}`, title: "Car organizer" },
            capability: { languages: ["en"] },
            uiLocale: "zh-CN",
            recentPlans: [],
          },
        };
      }
      if (query.includes("SubmitAffiliateCampaignSearchPlan")) {
        const id = variables?.input.generationRequestId as string;
        operations.push(`submit:${id}`);
        return { submitAffiliateCampaignSearchPlan: { id, status: "ACTIVE" } };
      }
      throw new Error("unexpected GraphQL operation");
    });
    const generate = vi.fn(async (context: { generationRequestId: string }) => {
      operations.push(`generate:${context.generationRequestId}`);
      return {
        value: {
          keyword: "car organization creators",
          explanation: "寻找关注车内收纳内容的达人。",
          rules: {},
          guidanceInterpretation: {
            softDirections: ["汽车内容达人"],
            hardConstraints: {},
            unsupportedHardConstraints: [],
          },
        },
        provider: "user-provider",
        model: "user-default-model",
        runIds: [`run-${context.generationRequestId}`],
        repaired: false,
        durationMs: 12,
      };
    });
    const actuator = new AffiliateCampaignSearchPlanActuator(
      { graphqlFetch } as never,
      "device-1",
      () => "zh-CN",
      generate as never,
      1,
      () => true,
    );

    actuator.enqueue(request("plan-1", 1));
    actuator.enqueue(request("plan-2", 1));
    actuator.enqueue(request("plan-1", 1));
    await actuator.waitForIdle();

    expect(operations).toEqual([
      "claim:plan-1",
      "generate:plan-1",
      "submit:plan-1",
      "claim:plan-2",
      "generate:plan-2",
      "submit:plan-2",
    ]);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("ClaimAffiliateCampaignSearchPlanGeneration"),
      {
        input: expect.objectContaining({ uiLocale: "zh-CN" }),
      },
    );
    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("SubmitAffiliateCampaignSearchPlan"),
      {
        input: expect.objectContaining({
          guidanceInterpretation: {
            sourceGuidanceHash: "guidance-hash",
            softDirections: ["汽车内容达人"],
            hardConstraints: { categories: [] },
            unsupportedHardConstraints: [],
          },
        }),
      },
    );
  });

  it("runs three generations concurrently by default", async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    let active = 0;
    let peakActive = 0;
    const graphqlFetch = graphqlClient();
    const generate = vi.fn(async (context: { generationRequestId: string }) => {
      started.push(context.generationRequestId);
      active += 1;
      peakActive = Math.max(peakActive, active);
      await new Promise<void>((resolve) => releases.set(context.generationRequestId, resolve));
      active -= 1;
      return generated(context.generationRequestId);
    });
    const actuator = new AffiliateCampaignSearchPlanActuator(
      { graphqlFetch } as never,
      "device-1",
      () => "zh-CN",
      generate as never,
      undefined,
      () => true,
    );

    for (let index = 1; index <= 4; index += 1) {
      actuator.enqueue(request(`plan-${index}`, 1, `shop-${index}`));
    }
    await waitFor(() => started.length === 3);
    expect(started).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(peakActive).toBe(3);

    releases.get("plan-1")?.();
    await waitFor(() => started.length === 4);
    expect(started[3]).toBe("plan-4");
    for (const release of releases.values()) release();
    await actuator.waitForIdle();
    expect(generate).toHaveBeenCalledTimes(4);
  });

  it("round-robins pending work across shops", async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const graphqlFetch = graphqlClient();
    const generate = vi.fn(async (context: { generationRequestId: string }) => {
      started.push(context.generationRequestId);
      await new Promise<void>((resolve) => releases.set(context.generationRequestId, resolve));
      return generated(context.generationRequestId);
    });
    const actuator = new AffiliateCampaignSearchPlanActuator(
      { graphqlFetch } as never,
      "device-1",
      () => "zh-CN",
      generate as never,
      1,
      () => true,
    );

    actuator.enqueue(request("shop-a-1", 1, "shop-a"));
    actuator.enqueue(request("shop-a-2", 1, "shop-a"));
    actuator.enqueue(request("shop-b-1", 1, "shop-b"));
    actuator.enqueue(request("shop-b-2", 1, "shop-b"));
    await waitFor(() => started.length === 1);
    releases.get("shop-a-1")?.();
    await waitFor(() => started.length === 2);
    expect(started[1]).toBe("shop-b-1");
    releases.get("shop-b-1")?.();
    await waitFor(() => started.length === 3);
    expect(started[2]).toBe("shop-a-2");
    releases.get("shop-a-2")?.();
    await waitFor(() => started.length === 4);
    expect(started[3]).toBe("shop-b-2");
    releases.get("shop-b-2")?.();
    await actuator.waitForIdle();
  });

  it("does not claim a generation attempt before the Desktop gateway is ready", async () => {
    const graphqlFetch = graphqlClient();
    const generate = vi.fn(async () => generated("plan-not-ready"));
    const actuator = new AffiliateCampaignSearchPlanActuator(
      { graphqlFetch } as never,
      "device-1",
      () => "zh-CN",
      generate as never,
      1,
      () => false,
    );

    actuator.enqueue(request("plan-not-ready", 1));
    await actuator.waitForIdle();

    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("accepts an omitted guidance interpretation when Campaign guidance is empty", () => {
    const result = validateGeneratedPlan({
      keyword: "automotive accessory creators",
      explanation: "寻找适合汽车配件推广的达人。",
      rules: {},
    }, generationContext("") as never);

    expect(result.guidanceInterpretation).toEqual({
      softDirections: [],
      hardConstraints: {},
      unsupportedHardConstraints: [],
    });
  });

  it("ignores model-invented guidance interpretation when Campaign guidance is empty", () => {
    const result = validateGeneratedPlan({
      keyword: "automotive accessory creators",
      explanation: "寻找适合汽车配件推广的达人。",
      rules: {},
      guidanceInterpretation: {
        softDirections: ["优先寻找汽车用品达人"],
        hardConstraints: { minimumFollowers: 10_000 },
        unsupportedHardConstraints: ["Creator must own a sports car"],
      },
    }, generationContext("") as never);

    expect(result.guidanceInterpretation).toEqual({
      softDirections: [],
      hardConstraints: {},
      unsupportedHardConstraints: [],
    });
  });

  it("requires explicit hard guidance to be applied to provider rules", () => {
    const context = generationContext("Creators must have at least 10,000 followers");
    expect(() => validateGeneratedPlan({
      keyword: "automotive accessory creators",
      explanation: "寻找适合汽车配件推广的达人。",
      rules: { minimumFollowers: 1_000 },
      guidanceInterpretation: {
        softDirections: [],
        hardConstraints: { minimumFollowers: 10_000 },
        unsupportedHardConstraints: [],
      },
    }, context as never)).toThrow("SEARCH_PLAN_GUIDANCE_HARD_CONSTRAINT_NOT_APPLIED");

    expect(validateGeneratedPlan({
      keyword: "automotive accessory creators",
      explanation: "寻找适合汽车配件推广的达人。",
      rules: { minimumFollowers: 10_000 },
      guidanceInterpretation: {
        softDirections: [],
        hardConstraints: { minimumFollowers: 10_000 },
        unsupportedHardConstraints: [],
      },
    }, context as never).rules.minimumFollowers).toBe(10_000);
  });

  it("fails closed instead of silently weakening unsupported hard guidance", () => {
    const context = generationContext("Only creators who own a red convertible");
    expect(() => validateGeneratedPlan({
      keyword: "convertible lifestyle creators",
      explanation: "寻找跑车生活方式达人。",
      rules: {},
      guidanceInterpretation: {
        softDirections: [],
        hardConstraints: {},
        unsupportedHardConstraints: ["Creator must own a red convertible"],
      },
    }, context as never)).toThrow("SEARCH_PLAN_GUIDANCE_HARD_CONSTRAINT_UNSUPPORTED");
  });

  it("treats descriptive preferences as soft guidance", () => {
    expect(guidanceAppearsToContainHardConstraint("Prefer practical automotive content")).toBe(false);
    const result = validateGeneratedPlan({
      keyword: "practical car accessory creators",
      explanation: "寻找擅长讲解实用汽车用品的达人。",
      rules: {},
      guidanceInterpretation: {
        softDirections: ["实用汽车内容"],
        hardConstraints: {},
        unsupportedHardConstraints: [],
      },
    }, generationContext("Prefer practical automotive content") as never);
    expect(result.guidanceInterpretation.softDirections).toEqual(["实用汽车内容"]);
  });

  it("normalizes a localized singleton soft direction from model output", () => {
    const result = validateGeneratedPlan({
      keyword: "practical car accessory creators",
      explanation: "寻找擅长讲解实用汽车用品的达人。",
      rules: {},
      guidanceInterpretation: {
        softDirections: "实用汽车内容",
        hardConstraints: {},
        unsupportedHardConstraints: [],
      },
    }, generationContext("Prefer practical automotive content") as never);

    expect(result.guidanceInterpretation.softDirections).toEqual(["实用汽车内容"]);
  });

  it("uses the localized explanation when soft-guidance audit output has the wrong locale", () => {
    const result = validateGeneratedPlan({
      keyword: "practical car accessory creators",
      explanation: "寻找擅长讲解实用汽车用品的达人。",
      rules: {},
      guidanceInterpretation: {
        softDirections: ["practical automotive creators"],
        hardConstraints: {},
        unsupportedHardConstraints: [],
      },
    }, generationContext("Prefer practical automotive content") as never);

    expect(result.guidanceInterpretation.softDirections).toEqual([
      "寻找擅长讲解实用汽车用品的达人。",
    ]);
  });

  it("uses the localized explanation when a pure-soft interpretation is omitted", () => {
    const result = validateGeneratedPlan({
      keyword: "practical car accessory creators",
      explanation: "寻找擅长讲解实用汽车用品的达人。",
      rules: {},
    }, generationContext("Prefer practical automotive content") as never);

    expect(result.guidanceInterpretation.softDirections).toEqual([
      "寻找擅长讲解实用汽车用品的达人。",
    ]);
    expect(result.guidanceInterpretation.unsupportedHardConstraints).toEqual([]);
  });

  it("does not use the localized soft-guidance fallback for hard guidance", () => {
    expect(() => validateGeneratedPlan({
      keyword: "automotive accessory creators",
      explanation: "寻找适合汽车配件推广的达人。",
      rules: {},
      guidanceInterpretation: {
        softDirections: { locale: "zh-CN", values: ["汽车配件达人"] },
        hardConstraints: {},
        unsupportedHardConstraints: [],
      },
    }, generationContext("Creators must have at least 10,000 followers") as never)).toThrow(
      "SEARCH_PLAN_GUIDANCE_SOFT_DIRECTION_INVALID",
    );
  });
});

function graphqlClient() {
  return vi.fn(async (query: string, variables?: Record<string, any>) => {
    const id = variables?.input.generationRequestId as string;
    if (query.includes("ClaimAffiliateCampaignSearchPlanGeneration")) {
      return {
        claimAffiliateCampaignSearchPlanGeneration: {
          leaseToken: `lease-${id}`,
          generationRequestId: id,
          campaign: {},
          shop: {},
          productSnapshot: { snapshotHash: `snapshot-${id}` },
          capability: {},
          uiLocale: "zh-CN",
          recentPlans: [],
        },
      };
    }
    if (query.includes("SubmitAffiliateCampaignSearchPlan")) {
      return { submitAffiliateCampaignSearchPlan: { id, status: "ACTIVE" } };
    }
    throw new Error("unexpected GraphQL operation");
  });
}

function generated(id: string) {
  return {
    value: {
      keyword: "car organization creators",
      explanation: "寻找关注车内收纳内容的达人。",
      rules: {},
      guidanceInterpretation: {
        softDirections: [],
        hardConstraints: {},
        unsupportedHardConstraints: [],
      },
    },
    provider: "user-provider",
    model: "user-default-model",
    runIds: [`run-${id}`],
    repaired: false,
    durationMs: 12,
  };
}

function generationContext(guidance: string) {
  return {
    leaseToken: "lease",
    generationRequestId: "plan",
    campaign: {
      searchPlanGuidance: guidance,
      searchPlanGuidanceHash: "guidance-hash",
    },
    shop: {},
    productSnapshot: { snapshotHash: "snapshot", title: "Car accessory" },
    capability: {},
    uiLocale: "zh-CN",
    recentPlans: [],
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for SearchPlan actuator state");
}
