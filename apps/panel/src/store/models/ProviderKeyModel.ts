import { flow } from "mobx-state-tree";
import { ProviderKeyModel as ProviderKeyModelBase } from "@rivonclaw/core/models";
import { fetchJson, invalidateCache } from "../../api/client.js";
import type { ProviderKeyEntry } from "@rivonclaw/core";
import { API, clientPath } from "@rivonclaw/core/api-contract";

export const ProviderKeyModel = ProviderKeyModelBase.actions((self) => ({
  update: flow(function* (
    fields: { label?: string; model?: string; proxyUrl?: string; baseUrl?: string; inputModalities?: string[]; customModelsJson?: string; apiKey?: string },
  ): Generator<Promise<ProviderKeyEntry>, ProviderKeyEntry, ProviderKeyEntry> {
    const result: ProviderKeyEntry = yield fetchJson<ProviderKeyEntry>(clientPath(API["providerKeys.update"], { id: self.id }), {
      method: "PUT",
      body: JSON.stringify(fields),
    });
    invalidateCache("models");
    return result;
  }),

  activate: flow(function* () {
    yield fetchJson(clientPath(API["providerKeys.activate"], { id: self.id }), { method: "POST" });
    invalidateCache("models");
  }),

  delete: flow(function* () {
    yield fetchJson(clientPath(API["providerKeys.delete"], { id: self.id }), { method: "DELETE" });
    invalidateCache("models");
    // Desktop REST handler removes entity from Desktop MST → SSE patch → Panel auto-updates
  }),

  refreshModels: flow(function* (): Generator<Promise<ProviderKeyEntry>, ProviderKeyEntry, ProviderKeyEntry> {
    const result: ProviderKeyEntry = yield fetchJson<ProviderKeyEntry>(clientPath(API["providerKeys.refreshModels"], { id: self.id }), {
      method: "POST",
    });
    invalidateCache("models");
    return result;
  }),

  /**
   * Trigger a subscription-quota fetch for this key on Desktop. The result is
   * written into MST by `LLMProviderManager.fetchKeyUsage` and arrives in Panel
   * via SSE patch — no need to read the response body here beyond error checking.
   *
   * Callers just fire and forget; components read `self.usage` reactively.
   */
  fetchUsage: flow(function* () {
    yield fetchJson(clientPath(API["providerKeys.fetchUsage"], { id: self.id }), { method: "POST" });
  }),

  /**
   * Re-authenticate an OAuth key: the caller must first drive the OAuth flow
   * (startOAuthFlow → auto callback or completeManualOAuth). This action then
   * tells Desktop to consume the completed flow and rotate the stored credential
   * on THIS key in place — no new row, no change to label/model/isDefault/proxy.
   *
   * The updated row (with refreshed `oauthExpiresAt` / `updatedAt`) flows back
   * via SSE patch; observers re-render automatically.
   *
   * Returns `idTokenCaptureFailed`: when true, the Desktop attempted but
   * couldn't capture the id_token (network / HTTP error). OAuth state may be
   * server-side-rotated past our last read — callers should show a warning
   * so the user knows to retry Re-auth if their next LLM call 401s.
   */
  reauth: flow(function* (): Generator<
    Promise<{ ok: true; idTokenCaptureFailed: boolean }>,
    { ok: true; idTokenCaptureFailed: boolean },
    { ok: true; idTokenCaptureFailed: boolean }
  > {
    const result: { ok: true; idTokenCaptureFailed: boolean } = yield fetchJson<{
      ok: true;
      idTokenCaptureFailed: boolean;
    }>(clientPath(API["providerKeys.reauth"], { id: self.id }), { method: "POST" });
    return result;
  }),
}));
