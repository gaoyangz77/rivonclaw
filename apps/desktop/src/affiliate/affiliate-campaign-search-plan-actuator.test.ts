import { describe, expect, it, vi } from "vitest";
import type { AffiliateCampaignSearchPlanRequestPayload } from "../cloud/backend-subscription-client.js";
import { AffiliateCampaignSearchPlanActuator } from "./affiliate-campaign-search-plan-actuator.js";

function request(id: string, generation: number): AffiliateCampaignSearchPlanRequestPayload {
  return {
    searchPlanId: id,
    campaignId: `campaign-${id}`,
    shopId: "shop-1",
    platformShopId: "platform-shop-1",
    generation,
    configRevision: 3,
    requestedAt: "2026-08-10T00:00:00.000Z",
    attempt: 1,
  };
}

describe("AffiliateCampaignSearchPlanActuator", () => {
  it("claims and generates plans in a single-concurrency FIFO queue", async () => {
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
    expect(graphqlFetch).toHaveBeenCalledWith(expect.stringContaining("ClaimAffiliateCampaignSearchPlanGeneration"), {
      input: expect.objectContaining({ uiLocale: "zh-CN" }),
    });
  });
});
