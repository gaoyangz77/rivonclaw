import { flow, getEnv } from "mobx-state-tree";
import { ShopModel as ShopModelBase } from "@rivonclaw/core/models";
import {
  UPDATE_SHOP_MUTATION,
  DELETE_SHOP_MUTATION,
  ECOMMERCE_UPDATE_SHOP_MUTATION,
} from "../../api/shops-queries.js";
import type { PanelStoreEnv } from "../types.js";

export interface ChannelAccountForRouting {
  channelId: string;
  accountId: string;
  config: Record<string, unknown>;
  status?: {
    hasContextToken?: boolean | null;
  };
}

export type CustomerServiceRoutingIssue = "invalid_channel" | "missing_context_token";

interface ShopUpdateInput {
  shopName?: string;
  alias?: string;
  authStatus?: string;
  region?: string;
  services?: {
    customerService?: {
      enabled?: boolean;
      unpaidOrderReachoutEnabled?: boolean;
      unpaidOrderReachoutStages?: Array<{
        id?: string | null;
        enabled: boolean;
        delayMinutes: number;
        messageTemplate?: string | null;
      }>;
      unpaidOrderReachoutExperiment?: {
        enabled?: boolean;
        holdoutPercent?: number;
      };
      businessPrompt?: string | null;
      runProfileId?: string;
      csDeviceId?: string | null;
      csProviderOverride?: string | null;
      csModelOverride?: string | null;
      escalationChannelId?: string | null;
      escalationRecipientId?: string | null;
      reviewOptimization?: {
        enabled?: boolean;
        badReviewReachout?: {
          enabled?: boolean;
          stars?: number;
          recentDays?: number;
        };
      } | null;
    };
    wms?: {
      enabled?: boolean | null;
    };
    affiliateService?: {
      enabled?: boolean;
      runProfileId?: string | null;
      deviceId?: string | null;
      businessPrompt?: string | null;
      campaignDailyCreatorOutreachLimit?: number;
      decisionThresholds?: {
        minExpectedSalesUnits?: number | null;
      } | null;
    };
  };
}

/**
 * Seeded onto a shop the first time Affiliate service is switched on, so the
 * Affiliate Agent always has a shop reference to compare expected sales
 * against. Shops that already carry a threshold keep the operator's value.
 */
const DEFAULT_MIN_EXPECTED_SALES_UNITS = 1;

function requiredDeviceId(deviceId: string | null | undefined): string {
  const normalized = deviceId?.trim();
  if (!normalized) {
    throw new Error("Current device ID is unavailable. Please try again after the app is ready.");
  }
  return normalized;
}

export const ShopModel = ShopModelBase.views((self) => ({
  getCustomerServiceRoutingIssue(params: {
    currentDeviceId: string | null;
    channelAccounts: readonly ChannelAccountForRouting[];
  }): CustomerServiceRoutingIssue | null {
    const cs = self.services?.customerService;
    if (!cs?.enabled || !self.handlesCustomerServiceOnDevice(params.currentDeviceId)) return null;

    const escalationChannelId = cs.escalationChannelId?.trim();
    if (!escalationChannelId) return null;

    const colonIdx = escalationChannelId.indexOf(":");
    if (colonIdx <= 0 || colonIdx === escalationChannelId.length - 1) return "invalid_channel";

    const channelId = escalationChannelId.slice(0, colonIdx);
    const accountId = escalationChannelId.slice(colonIdx + 1);
    const account = params.channelAccounts.find((candidate) => (
      candidate.channelId === channelId && candidate.accountId === accountId
    ));
    if (!account) return "invalid_channel";

    return null;
  },
})).actions((self) => {
  const client = () => getEnv<PanelStoreEnv>(self).apolloClient;
  const updateShop = async (input: ShopUpdateInput) => {
    const result = await client().mutate<{ updateShop: unknown }>({
      mutation: UPDATE_SHOP_MUTATION,
      variables: { id: self.id, input },
    });
    return result.data!.updateShop;
  };

  return {
    update: flow(function* (input: ShopUpdateInput) {
      return yield updateShop(input);
    }),

    setCustomerServiceEnabled: flow(function* (
      enabled: boolean,
      currentDeviceId?: string | null,
    ) {
      const existingDeviceId = self.services?.customerService?.csDeviceId?.trim();
      return yield updateShop({
        services: {
          customerService: {
            enabled,
            ...(enabled && !existingDeviceId
              ? { csDeviceId: requiredDeviceId(currentDeviceId) }
              : {}),
          },
        },
      });
    }),

    bindCustomerServiceToDevice: flow(function* (deviceId: string) {
      return yield updateShop({
        services: { customerService: { csDeviceId: requiredDeviceId(deviceId) } },
      });
    }),

    unbindCustomerServiceFromDevice: flow(function* () {
      return yield updateShop({
        services: { customerService: { csDeviceId: "" } },
      });
    }),

    setAffiliateServiceEnabled: flow(function* (
      enabled: boolean,
      currentDeviceId?: string | null,
    ) {
      const affiliateService = self.services?.affiliateService;
      const existingDeviceId = affiliateService?.deviceId?.trim();
      const existingMinExpectedSalesUnits =
        affiliateService?.decisionThresholds?.minExpectedSalesUnits;
      return yield updateShop({
        services: {
          affiliateService: {
            enabled,
            ...(enabled && !affiliateService?.runProfileId
              ? { runProfileId: "AFFILIATE_OPERATOR" }
              : {}),
            ...(enabled && !existingDeviceId
              ? { deviceId: requiredDeviceId(currentDeviceId) }
              : {}),
            ...(enabled && typeof existingMinExpectedSalesUnits !== "number"
              ? {
                  decisionThresholds: {
                    minExpectedSalesUnits: DEFAULT_MIN_EXPECTED_SALES_UNITS,
                  },
                }
              : {}),
          },
        },
      });
    }),

    bindAffiliateServiceToDevice: flow(function* (deviceId: string) {
      return yield updateShop({
        services: { affiliateService: { deviceId: requiredDeviceId(deviceId) } },
      });
    }),

    unbindAffiliateServiceFromDevice: flow(function* () {
      return yield updateShop({
        services: { affiliateService: { deviceId: "" } },
      });
    }),

    updateAlias: flow(function* (alias: string) {
      const result = yield client().mutate({
        mutation: ECOMMERCE_UPDATE_SHOP_MUTATION,
        variables: { shopId: self.id, alias },
      });
      return result.data!.ecommerceUpdateShop;
    }),

    delete: flow(function* () {
      const result = yield client().mutate({
        mutation: DELETE_SHOP_MUTATION,
        variables: { id: self.id },
      });
      if (result.data?.deleteShop !== true) {
        throw new Error("Shop disconnect was not accepted by the server.");
      }
      // Desktop proxy removes the entity; callers refresh the authoritative shop list.
    }),
  };
});
