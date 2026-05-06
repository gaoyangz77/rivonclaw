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

export const ShopModel = ShopModelBase.views((self) => ({
  getCustomerServiceRoutingIssue(params: {
    currentDeviceId: string | null;
    channelAccounts: readonly ChannelAccountForRouting[];
  }): CustomerServiceRoutingIssue | null {
    const cs = self.services?.customerService;
    if (!cs?.enabled || !params.currentDeviceId || cs.csDeviceId !== params.currentDeviceId) return null;

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

  return {
    update: flow(function* (input: {
      shopName?: string;
      alias?: string;
      authStatus?: string;
      region?: string;
      services?: {
        customerService?: {
          enabled?: boolean;
          businessPrompt?: string;
          runProfileId?: string;
          csDeviceId?: string | null;
          csProviderOverride?: string | null;
          csModelOverride?: string | null;
          escalationChannelId?: string | null;
          escalationRecipientId?: string | null;
        };
        wms?: {
          enabled?: boolean | null;
        };
      };
    }) {
      const result = yield client().mutate({
        mutation: UPDATE_SHOP_MUTATION,
        variables: { id: self.id, input },
      });
      return result.data!.updateShop;
    }),

    updateAlias: flow(function* (alias: string) {
      const result = yield client().mutate({
        mutation: ECOMMERCE_UPDATE_SHOP_MUTATION,
        variables: { shopId: self.id, alias },
      });
      return result.data!.ecommerceUpdateShop;
    }),

    delete: flow(function* () {
      yield client().mutate({
        mutation: DELETE_SHOP_MUTATION,
        variables: { id: self.id },
      });
      // Desktop proxy removes entity from Desktop MST → SSE patch → Panel auto-updates
    }),
  };
});
