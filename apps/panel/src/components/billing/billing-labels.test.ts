import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import { BillingPlanDefinitionModel, BillingOverviewModel } from "@rivonclaw/core/models";
import {
  accountPlanRank,
  isHighestAccountPlan,
  upgradeableAccountPlans,
  checkoutProviderOptions,
  preferredCheckoutProvider,
} from "./billing-labels.js";

describe("Max usage plan choices", () => {
  const planIds = [
    GQL.BillingPlanId.RivonclawAiPlus,
    GQL.BillingPlanId.RivonclawAiPro,
    GQL.BillingPlanId.RivonclawAiMax,
    GQL.BillingPlanId.RivonclawAiMax_2X,
    GQL.BillingPlanId.RivonclawAiMax_3X,
  ];
  const plans = planIds.map((planId) =>
    BillingPlanDefinitionModel.create({
      planId,
      name: planId,
      product: GQL.BillableProduct.LlmUsage,
      priceCurrency: "USD",
      priceMonthly: "79",
      metered: true,
    }),
  );

  it("orders all five plans and only marks Max 3x as highest", () => {
    expect(planIds.map(accountPlanRank)).toEqual([1, 2, 3, 4, 5]);
    expect(planIds.map(isHighestAccountPlan)).toEqual([false, false, false, false, true]);
    expect(
      upgradeableAccountPlans(plans, GQL.BillingPlanId.RivonclawAiMax).map((p) => p.planId),
    ).toEqual(planIds.slice(3));
    expect(
      upgradeableAccountPlans(plans, GQL.BillingPlanId.RivonclawAiMax_2X).map((p) => p.planId),
    ).toEqual(planIds.slice(4));
    expect(upgradeableAccountPlans(plans, GQL.BillingPlanId.RivonclawAiMax_3X)).toEqual([]);
  });

  it.each(planIds)("loads old-shaped MST snapshots with plan %s", (planId) => {
    const overview = BillingOverviewModel.create({
      accountLlm: {
        planId,
        entitlement: {
          scopeType: "ACCOUNT",
          scopeId: "owner",
          product: "LLM_USAGE",
          allowed: true,
          code: "ALLOWED",
        },
      },
    });
    expect(overview.accountLlm.planId).toBe(planId);
    expect(overview.accountServices).toHaveLength(0);
    expect(overview.accountLlm.entitlement.coverageScopeType).toBeNull();
  });
});

describe("billing checkout provider labels", () => {
  it("keeps payment method order stable across languages", () => {
    expect(checkoutProviderOptions("en-US")).toEqual(["STRIPE", "LAKALA"]);
    expect(checkoutProviderOptions("zh-CN")).toEqual(["STRIPE", "LAKALA"]);
  });

  it("chooses the language-preferred default without reordering elements", () => {
    const providers = checkoutProviderOptions("zh-CN");

    expect(preferredCheckoutProvider("zh-CN", providers)).toBe("LAKALA");
    expect(preferredCheckoutProvider("en-US", providers)).toBe("STRIPE");
  });

  it("falls back to the first available provider when the preferred provider is unavailable", () => {
    expect(preferredCheckoutProvider("zh-CN", ["STRIPE"])).toBe("STRIPE");
    expect(preferredCheckoutProvider("en-US", ["LAKALA"])).toBe("LAKALA");
  });
});
