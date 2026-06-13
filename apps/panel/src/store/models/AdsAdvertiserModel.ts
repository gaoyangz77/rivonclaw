import { flow, getEnv } from "mobx-state-tree";
import { AdsAdvertiserModel as AdsAdvertiserModelBase } from "@rivonclaw/core/models";
import { DISCONNECT_ADS_ADVERTISER_MUTATION } from "../../api/ads-queries.js";
import type { PanelStoreEnv } from "../types.js";

export const AdsAdvertiserModel = AdsAdvertiserModelBase.actions((self) => {
  const client = () => getEnv<PanelStoreEnv>(self).apolloClient;

  return {
    disconnect: flow(function* () {
      yield client().mutate({
        mutation: DISCONNECT_ADS_ADVERTISER_MUTATION,
        variables: { id: self.id },
      });
    }),
  };
});
