import { flow, getEnv } from "mobx-state-tree";
import { UserModel as UserModelBase } from "@rivonclaw/core/models";
import {
  ENROLL_MODULE_MUTATION,
  UNENROLL_MODULE_MUTATION,
} from "../../api/auth-queries.js";
import {
  SHOPS_QUERY,
  PLATFORM_APPS_QUERY,
  MY_CREDITS_QUERY,
} from "../../api/shops-queries.js";
import type { PanelStoreEnv } from "../types.js";

export const UserModel = UserModelBase.actions((self) => {
  const client = () => getEnv<PanelStoreEnv>(self).apolloClient;

  return {
    enrollModule: flow(function* (moduleId: string) {
      yield client().mutate({
        mutation: ENROLL_MODULE_MUTATION,
        variables: { moduleId },
      });
      // Result ingested by Desktop via proxy -> MST -> SSE -> Panel auto-updates
      // Trigger shops sync if ecommerce module
      if (moduleId === "GLOBAL_ECOMMERCE_SELLER") {
        yield Promise.all([
          client().query({ query: SHOPS_QUERY, fetchPolicy: "network-only" }),
          client().query({ query: PLATFORM_APPS_QUERY, fetchPolicy: "network-only" }),
          client().query({ query: MY_CREDITS_QUERY, fetchPolicy: "network-only" }),
        ]).catch(() => {});
      }
    }),

    unenrollModule: flow(function* (moduleId: string) {
      yield client().mutate({
        mutation: UNENROLL_MODULE_MUTATION,
        variables: { moduleId },
      });
      // Result ingested by Desktop via proxy -> MST -> SSE -> Panel auto-updates
    }),
  };
});
