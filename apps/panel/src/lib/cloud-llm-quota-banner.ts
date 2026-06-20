const CLOUD_LLM_PROVIDER_ID = "rivonclaw-pro";
const WARNING_REMAINING_PERCENT = 5;
const RELEVANT_WINDOWS = new Set(["FIVE_HOURS", "WEEK"]);

export type CloudLlmQuotaBannerSeverity = "warning" | "error";

export interface CloudLlmQuotaBannerState {
  severity: CloudLlmQuotaBannerSeverity;
  exhaustedWindows: string[];
  lowWindows: string[];
}

interface ProviderKeyLike {
  provider: string;
  isDefault: boolean;
}

interface BillingUsageLike {
  window: string;
  remainingPercent: number;
}

interface AccountLlmBillingLike {
  entitlement?: {
    code?: string | null;
    usage?: readonly BillingUsageLike[];
  } | null;
}

interface BillingOverviewLike {
  accountLlm?: AccountLlmBillingLike | null;
}

function isRelevantQuotaWindow(window: string): boolean {
  return RELEVANT_WINDOWS.has(window);
}

function isFinitePercent(value: number): boolean {
  return Number.isFinite(value);
}

export function resolveCloudLlmQuotaBannerState(
  providerKeys: readonly ProviderKeyLike[],
  billingOverview: BillingOverviewLike | null | undefined,
): CloudLlmQuotaBannerState | null {
  const activeCloudKey = providerKeys.find((key) => key.isDefault && key.provider === CLOUD_LLM_PROVIDER_ID);
  if (!activeCloudKey) return null;

  const entitlement = billingOverview?.accountLlm?.entitlement;
  if (!entitlement) return null;

  const exhaustedWindows: string[] = [];
  const lowWindows: string[] = [];

  for (const usage of entitlement.usage ?? []) {
    if (!isRelevantQuotaWindow(usage.window) || !isFinitePercent(usage.remainingPercent)) continue;
    if (usage.remainingPercent <= 0) {
      exhaustedWindows.push(usage.window);
    } else if (usage.remainingPercent <= WARNING_REMAINING_PERCENT) {
      lowWindows.push(usage.window);
    }
  }

  if (entitlement.code === "QUOTA_EXCEEDED" || exhaustedWindows.length > 0) {
    return {
      severity: "error",
      exhaustedWindows,
      lowWindows,
    };
  }

  if (lowWindows.length > 0) {
    return {
      severity: "warning",
      exhaustedWindows,
      lowWindows,
    };
  }

  return null;
}
