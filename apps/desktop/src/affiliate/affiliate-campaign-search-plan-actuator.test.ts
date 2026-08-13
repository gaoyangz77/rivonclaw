import { describe, expect, it, vi } from "vitest";
import type { AffiliateCampaignSearchPlanRequestPayload } from "../cloud/backend-subscription-client.js";
import { AffiliateCampaignSearchPlanActuator } from "./affiliate-campaign-search-plan-actuator.js";

function request(
  id: string,
  generation: number,
  shopId = "shop-1",
): AffiliateCampaignSearchPlanRequestPayload {
  return {
    searchPlanId: id,
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
        const id = variables?.input.searchPlanId as string;
        operations.push(`claim:${id}`);
        return {
          claimAffiliateCampaignSearchPlanGeneration: {
            leaseToken: `lease-${id}`,
            searchPlanId: id,
            campaign: { searchPlanGuidance: "automotive creators" },
            shop: { market: "US" },
            productSnapshot: { snapshotHash: `snapshot-${id}`, title: "Car organizer" },
            capability: { languages: ["en"] },
            uiLocale: "zh-CN",
            recentPlans: [],
          },
        };
      }
      if (query.includes("SubmitAffiliateCampaignSearchPlan")) {
        const id = variables?.input.searchPlanId as string;
        operations.push(`submit:${id}`);
        return { submitAffiliateCampaignSearchPlan: { id, status: "ACTIVE" } };
      }
      throw new Error("unexpected GraphQL operation");
    });
    const generate = vi.fn(async (context: { searchPlanId: string }) => {
      operations.push(`generate:${context.searchPlanId}`);
      return {
        value: {
          keyword: "car organization creators",
          explanation: "寻找关注车内收纳内容的达人。",
          rules: {},
        },
        provider: "user-provider",
        model: "user-default-model",
        runIds: [`run-${context.searchPlanId}`],
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
  });

  it("runs three generations concurrently by default", async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    let active = 0;
    let peakActive = 0;
    const graphqlFetch = graphqlClient();
    const generate = vi.fn(async (context: { searchPlanId: string }) => {
      started.push(context.searchPlanId);
      active += 1;
      peakActive = Math.max(peakActive, active);
      await new Promise<void>((resolve) => releases.set(context.searchPlanId, resolve));
      active -= 1;
      return generated(context.searchPlanId);
    });
    const actuator = new AffiliateCampaignSearchPlanActuator(
      { graphqlFetch } as never,
      "device-1",
      () => "zh-CN",
      generate as never,
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
    const generate = vi.fn(async (context: { searchPlanId: string }) => {
      started.push(context.searchPlanId);
      await new Promise<void>((resolve) => releases.set(context.searchPlanId, resolve));
      return generated(context.searchPlanId);
    });
    const actuator = new AffiliateCampaignSearchPlanActuator(
      { graphqlFetch } as never,
      "device-1",
      () => "zh-CN",
      generate as never,
      1,
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
});

function graphqlClient() {
  return vi.fn(async (query: string, variables?: Record<string, any>) => {
    const id = variables?.input.searchPlanId as string;
    if (query.includes("ClaimAffiliateCampaignSearchPlanGeneration")) {
      return {
        claimAffiliateCampaignSearchPlanGeneration: {
          leaseToken: `lease-${id}`,
          searchPlanId: id,
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
    },
    provider: "user-provider",
    model: "user-default-model",
    runIds: [`run-${id}`],
    repaired: false,
    durationMs: 12,
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for SearchPlan actuator state");
}
