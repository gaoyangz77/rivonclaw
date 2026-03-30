import { flow, getEnv } from "mobx-state-tree";
import { RunProfileModel as RunProfileModelBase } from "@rivonclaw/core/models";
import {
  UPDATE_RUN_PROFILE_MUTATION,
  DELETE_RUN_PROFILE_MUTATION,
} from "../../api/run-profiles-queries.js";
import type { PanelStoreEnv } from "../types.js";

export const RunProfileModel = RunProfileModelBase.actions((self) => {
  const client = () => getEnv<PanelStoreEnv>(self).apolloClient;

  return {
    update: flow(function* (input: {
      name?: string;
      selectedToolIds?: string[];
      surfaceId?: string;
    }) {
      const result = yield client().mutate({
        mutation: UPDATE_RUN_PROFILE_MUTATION,
        variables: { id: self.id, input },
      });
      return result.data!.updateRunProfile;
    }),

    delete: flow(function* () {
      yield client().mutate({
        mutation: DELETE_RUN_PROFILE_MUTATION,
        variables: { id: self.id },
      });
      // Desktop proxy removes entity from Desktop MST → SSE patch → Panel auto-updates
    }),
  };
});
