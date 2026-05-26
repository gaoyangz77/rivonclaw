import type { TFunction } from "i18next";
import { GQL } from "@rivonclaw/core";
import type { BillingEntitlementStatus, BillingPlanDefinition, BillingUsageStatus } from "@rivonclaw/core/models";

export type CheckoutProvider = "STRIPE" | "LAKALA";

type BillingEnumGroup =
  | "product"
  | "entitlementCode"
  | "entitlementSource"
  | "subscriptionStatus"
  | "provider"
  | "renewalMode"
  | "paymentMethod"
  | "paymentStatus"
  | "usageMetric"
  | "usageWindow";

function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function billingEnumLabel(t: TFunction, group: BillingEnumGroup, value?: string | null): string {
  if (!value) return "-";
  return t(`billing.enums.${group}.${value}`, { defaultValue: humanizeEnum(value) });
}

export function entitlementStatusLabel(t: TFunction, entitlement: BillingEntitlementStatus | null): string {
  if (entitlement?.allowed) return t("billing.allowed");
  if (entitlement?.code === GQL.EntitlementDecisionCode.PaymentRequired) return t("billing.needsActivation");
  return billingEnumLabel(t, "entitlementCode", entitlement?.code);
}

export function billingPlanDisplayName(t: TFunction, plan: BillingPlanDefinition): string {
  return t(`billing.planNames.${plan.planId}`, { defaultValue: plan.name });
}

export function usagePercentLabel(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Math.max(0, Math.min(100, value)).toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

const USAGE_WINDOW_ORDER: Record<string, number> = {
  FIVE_HOURS: 0,
  WEEK: 1,
};

export function sortUsageWindows(usages: readonly BillingUsageStatus[]): BillingUsageStatus[] {
  return [...usages].sort((left, right) => {
    const leftOrder = USAGE_WINDOW_ORDER[left.window] ?? 10;
    const rightOrder = USAGE_WINDOW_ORDER[right.window] ?? 10;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.window.localeCompare(right.window);
  });
}

export function findPlanDefinition(
  plans: readonly BillingPlanDefinition[],
  planId?: string | null,
  product?: string | null,
): BillingPlanDefinition | null {
  if (planId) return plans.find((plan) => plan.planId === planId) ?? null;
  if (!product) return null;
  const productPlans = plans.filter((plan) => plan.product === product);
  return productPlans.length === 1 ? productPlans[0] : null;
}

export function customerServicePlan(plans: readonly BillingPlanDefinition[]): BillingPlanDefinition | null {
  return plans.find((plan) => plan.planId === GQL.BillingPlanId.EcomCustomerServiceUnlimitedMonthly)
    ?? plans.find((plan) => plan.product === GQL.BillableProduct.EcomCustomerService)
    ?? null;
}

export function checkoutProviderOptions(language: string): CheckoutProvider[] {
  return language.startsWith("zh") ? ["LAKALA", "STRIPE"] : ["STRIPE", "LAKALA"];
}

export function checkoutProviderLabelKey(provider: CheckoutProvider): string {
  return provider === "STRIPE" ? "billing.payByCard" : "billing.payByWechatAlipay";
}

export function checkoutProviderFromBillingProvider(provider?: string | null): CheckoutProvider | undefined {
  return provider === "STRIPE" || provider === "LAKALA" ? provider : undefined;
}

export function shouldShowRenewalReminder(
  entitlement: BillingEntitlementStatus | null,
  thresholdDays = 5,
): boolean {
  if (!entitlement?.allowed) return false;
  const subscription = entitlement.subscription;
  if (!subscription) return false;
  if (subscription.renewalMode === GQL.BillingRenewalMode.AutoRenews && !subscription.cancelAtPeriodEnd) return false;
  if (
    subscription.renewalMode !== GQL.BillingRenewalMode.Prepaid
    && subscription.renewalMode !== GQL.BillingRenewalMode.NonRenewing
    && !subscription.cancelAtPeriodEnd
  ) return false;
  const expiresAt = new Date(subscription.currentPeriodEnd).getTime();
  if (!Number.isFinite(expiresAt)) return false;
  const remainingMs = expiresAt - Date.now();
  return remainingMs >= 0 && remainingMs <= thresholdDays * 24 * 60 * 60 * 1000;
}

const ACCOUNT_PLAN_RANK: Record<string, number> = {
  [GQL.BillingPlanId.RivonclawAiPlus]: 1,
  [GQL.BillingPlanId.RivonclawAiPro]: 2,
  [GQL.BillingPlanId.RivonclawAiMax]: 3,
};

export function accountPlanRank(planId?: string | null): number {
  return planId ? (ACCOUNT_PLAN_RANK[planId] ?? 0) : 0;
}

export function isHighestAccountPlan(planId?: string | null): boolean {
  return accountPlanRank(planId) >= accountPlanRank(GQL.BillingPlanId.RivonclawAiMax);
}

export function upgradeableAccountPlans(
  plans: readonly BillingPlanDefinition[],
  currentPlanId?: string | null,
): BillingPlanDefinition[] {
  const currentRank = accountPlanRank(currentPlanId);
  return plans
    .filter((plan) => plan.product === GQL.BillableProduct.LlmUsage)
    .filter((plan) => accountPlanRank(plan.planId) > currentRank)
    .sort((left, right) => accountPlanRank(left.planId) - accountPlanRank(right.planId));
}
