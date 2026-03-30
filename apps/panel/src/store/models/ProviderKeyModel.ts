import { flow } from "mobx-state-tree";
import { ProviderKeyModel as ProviderKeyModelBase } from "@rivonclaw/core/models";
import { fetchJson, invalidateCache } from "../../api/client.js";
import type { ProviderKeyEntry } from "@rivonclaw/core";

export const ProviderKeyModel = ProviderKeyModelBase.actions((self) => ({
  update: flow(function* (
    fields: { label?: string; model?: string; proxyUrl?: string; baseUrl?: string; inputModalities?: string[]; customModelsJson?: string; apiKey?: string },
  ): Generator<Promise<ProviderKeyEntry>, ProviderKeyEntry, ProviderKeyEntry> {
    const result: ProviderKeyEntry = yield fetchJson<ProviderKeyEntry>("/provider-keys/" + self.id, {
      method: "PUT",
      body: JSON.stringify(fields),
    });
    invalidateCache("models");
    return result;
  }),

  activate: flow(function* () {
    yield fetchJson("/provider-keys/" + self.id + "/activate", { method: "POST" });
    invalidateCache("models");
  }),

  delete: flow(function* () {
    yield fetchJson("/provider-keys/" + self.id, { method: "DELETE" });
    invalidateCache("models");
    // Desktop REST handler removes entity from Desktop MST → SSE patch → Panel auto-updates
  }),

  refreshModels: flow(function* (): Generator<Promise<ProviderKeyEntry>, ProviderKeyEntry, ProviderKeyEntry> {
    const result: ProviderKeyEntry = yield fetchJson<ProviderKeyEntry>("/provider-keys/" + self.id + "/refresh-models", {
      method: "POST",
    });
    invalidateCache("models");
    return result;
  }),
}));
