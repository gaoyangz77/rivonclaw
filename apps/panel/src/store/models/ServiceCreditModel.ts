import { flow, getEnv } from "mobx-state-tree";
import { ServiceCreditModel as ServiceCreditModelBase } from "@rivonclaw/core/models";
import { REDEEM_CREDIT_MUTATION, MY_CREDITS_QUERY } from "../../api/shops-queries.js";
import type { PanelStoreEnv } from "../types.js";

export const ServiceCreditModel = ServiceCreditModelBase.actions((self) => {
  const client = () => getEnv<PanelStoreEnv>(self).apolloClient;

  return {
    redeem: flow(function* (shopId: string) {
      yield client().mutate({
        mutation: REDEEM_CREDIT_MUTATION,
        variables: { creditId: self.id, shopId },
      });
      // Mutation returns full Shop → Desktop proxy ingests via ingestGraphQLResponse → SSE patch.
      // Refresh credits list since the redeemed credit changes status to REDEEMED.
      yield client().query({ query: MY_CREDITS_QUERY, fetchPolicy: "network-only" }).catch(() => {});
    }),
  };
});
