import { GQL } from "@rivonclaw/core";
import type { StateCreator } from "zustand";
import { SUBSCRIPTION_STATUS_QUERY, LLM_QUOTA_STATUS_QUERY } from "../../api/auth-queries.js";
import { getClient } from "../../api/apollo-client.js";
import type { PanelStore } from "../panel-store.js";

export interface SubscriptionSlice {
  subscriptionStatus: GQL.UserSubscription | null;
  llmQuota: GQL.LlmQuotaStatus | null;

  fetchSubscription: () => Promise<void>;
  fetchLlmQuota: () => Promise<void>;
  resetSubscription: () => void;
}

export const createSubscriptionSlice: StateCreator<PanelStore, [], [], SubscriptionSlice> = (set) => ({
  subscriptionStatus: null,
  llmQuota: null,

  fetchSubscription: async () => {
    try {
      const { data } = await getClient().query<{
        subscriptionStatus: GQL.UserSubscription | null;
      }>({
        query: SUBSCRIPTION_STATUS_QUERY,
        fetchPolicy: "network-only",
      });
      set({ subscriptionStatus: data?.subscriptionStatus ?? null });
    } catch {
      // Silently fail — subscription data is non-critical
    }
  },

  fetchLlmQuota: async () => {
    try {
      const { data } = await getClient().query<{
        llmQuotaStatus: GQL.LlmQuotaStatus;
      }>({
        query: LLM_QUOTA_STATUS_QUERY,
        fetchPolicy: "network-only",
      });
      set({ llmQuota: data?.llmQuotaStatus ?? null });
    } catch {
      // Silently fail — quota data is non-critical
    }
  },

  resetSubscription: () => {
    set({ subscriptionStatus: null, llmQuota: null });
  },
});
