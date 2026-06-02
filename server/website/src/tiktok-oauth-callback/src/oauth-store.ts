import { flow, types } from "mobx-state-tree";
import type { Instance } from "mobx-state-tree";
import { completeTikTokOAuth, resolveOAuthEndpoints } from "./oauth-api";
import { OAuthAttemptStatus, OAuthBackend, OAuthPageState } from "./oauth-types";

const OAuthBackendModel = types.enumeration<OAuthBackend>("OAuthBackend", [
  OAuthBackend.PRODUCTION,
  OAuthBackend.STAGING,
]);

const OAuthAttemptStatusModel = types.enumeration<OAuthAttemptStatus>("OAuthAttemptStatus", [
  OAuthAttemptStatus.PENDING,
  OAuthAttemptStatus.RUNNING,
  OAuthAttemptStatus.SUCCEEDED,
  OAuthAttemptStatus.FAILED,
]);

const OAuthPageStateModel = types.enumeration<OAuthPageState>("OAuthPageState", [
  OAuthPageState.IDLE,
  OAuthPageState.LOADING,
  OAuthPageState.READY,
  OAuthPageState.ERROR,
]);

const OAuthAttemptModel = types.model("OAuthAttempt", {
  backend: OAuthBackendModel,
  endpoint: types.string,
  status: OAuthAttemptStatusModel,
  errorMessage: types.maybeNull(types.string),
});

const OAuthResultModel = types.model("OAuthResult", {
  shopId: types.string,
  shopName: types.string,
  platform: types.string,
  backend: OAuthBackendModel,
});

export const OAuthCallbackStore = types
  .model("OAuthCallbackStore", {
    pageState: OAuthPageStateModel,
    attempts: types.array(OAuthAttemptModel),
    result: types.maybeNull(OAuthResultModel),
    errorMessage: types.maybeNull(types.string),
  })
  .views((self) => ({
    get runningAttempt(): Instance<typeof OAuthAttemptModel> | undefined {
      return self.attempts.find((attempt) => attempt.status === OAuthAttemptStatus.RUNNING);
    },
  }))
  .actions((self) => ({
    complete: flow(function* complete(code: string | null, state: string | null, missingMessage: string) {
      self.result = null;
      self.errorMessage = null;
      self.attempts.clear();

      if (!code || !state) {
        self.pageState = OAuthPageState.ERROR;
        self.errorMessage = missingMessage;
        return;
      }

      self.pageState = OAuthPageState.LOADING;
      const endpoints = resolveOAuthEndpoints();
      endpoints.forEach((endpoint) => {
        self.attempts.push({
          backend: endpoint.backend,
          endpoint: endpoint.endpoint,
          status: OAuthAttemptStatus.PENDING,
          errorMessage: null,
        });
      });

      for (const attempt of self.attempts) {
        attempt.status = OAuthAttemptStatus.RUNNING;
        try {
          const data: Awaited<ReturnType<typeof completeTikTokOAuth>> = yield completeTikTokOAuth(
            attempt.endpoint,
            code,
            state,
          );
          attempt.status = OAuthAttemptStatus.SUCCEEDED;
          self.result = {
            ...data.completeTikTokOAuth,
            backend: attempt.backend,
          };
          self.pageState = OAuthPageState.READY;
          return;
        } catch (error) {
          attempt.status = OAuthAttemptStatus.FAILED;
          attempt.errorMessage = error instanceof Error ? error.message : "OAuth attempt failed.";
        }
      }

      self.pageState = OAuthPageState.ERROR;
      self.errorMessage = null;
    }),
  }));

export type OAuthCallbackStoreInstance = Instance<typeof OAuthCallbackStore>;
