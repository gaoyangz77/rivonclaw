import { types, flow, getRoot } from "mobx-state-tree";
import { fetchJson } from "../../api/client.js";
import { fetchModelCatalog } from "../../api/providers.js";

export interface SwitchModelResult {
  contextWarning?: { currentTokens: number; newContextWindow: number };
}

export interface SessionModelInfo {
  provider: string;
  model: string;
  modelName: string;
  isOverridden: boolean;
  contextWindow: number | null;
}

/** Fired after any global model or provider change. */
const CONFIG_CHANGED_EVENT = "config-changed";

/**
 * LLM provider/model operations as MST actions on the Panel entity store.
 *
 * Holds no observable state — session overrides live on the Desktop side.
 * This is an action container mounted as `entityStore.llmManager`.
 *
 * `switchModel` and `activateProvider` delegate to ProviderKeyModel actions
 * (accessed via `getRoot`), which issue REST calls to Desktop.
 */
export const LLMProviderModel = types
  .model("LLMProvider", {})
  .actions((self) => {
    /** Broadcast config change to all listeners. */
    function broadcast(): void {
      window.dispatchEvent(new CustomEvent(CONFIG_CHANGED_EVENT));
    }

    return {
      /** Switch the global default model on a provider key (affects new sessions only). */
      switchModel: flow(function* (
        keyId: string,
        model: string,
      ): Generator<Promise<unknown>, SwitchModelResult, any> {
        const root = getRoot(self) as any;
        const key = root.providerKeys.find((k: any) => k.id === keyId);
        if (!key) throw new Error(`Provider key ${keyId} not found`);
        const result = yield key.update({ model });
        broadcast();
        const response = result as Record<string, unknown>;
        const warning = response.contextWarning as SwitchModelResult["contextWarning"];
        return { contextWarning: warning };
      }),

      /** Activate a provider key as the global default. */
      activateProvider: flow(function* (keyId: string) {
        const root = getRoot(self) as any;
        const key = root.providerKeys.find((k: any) => k.id === keyId);
        if (!key) throw new Error(`Provider key ${keyId} not found`);
        yield key.activate();
        broadcast();
      }),

      /** Switch model for a specific session (does not affect global default). */
      switchSessionModel: flow(function* (sessionKey: string, provider: string, model: string) {
        yield fetchJson("/session-model", {
          method: "PUT",
          body: JSON.stringify({ sessionKey, provider, model }),
        });
      }),

      /** Reset a session to follow the global default model. */
      resetSessionModel: flow(function* (sessionKey: string) {
        yield fetchJson("/session-model", {
          method: "PUT",
          body: JSON.stringify({ sessionKey, provider: "", model: "" }),
        });
      }),

      /** Get the effective model info for a session.
       *  Resolved by LLMProviderManager on Desktop: session override -> global default.
       *  Returns null if no provider key is configured. */
      getSessionModelInfo: flow(function* (
        sessionKey: string,
      ): Generator<Promise<unknown>, SessionModelInfo | null, any> {
        const info: { provider: string; model: string; isOverridden: boolean } | null =
          yield fetchJson(`/session-model?sessionKey=${encodeURIComponent(sessionKey)}`);
        if (!info?.provider) return null;

        // Catalog lookup stays client-side (display name + contextWindow)
        const catalog: Record<string, Array<{ id: string; name: string; contextWindow?: number }>> =
          yield fetchModelCatalog();
        const models = catalog[info.provider] ?? [];
        const match = models.find((m) => m.id === info.model);

        return {
          provider: info.provider,
          model: info.model,
          modelName: match?.name ?? info.model,
          isOverridden: info.isOverridden,
          contextWindow: match?.contextWindow ?? null,
        };
      }),

      /** Broadcast config change to all listeners (for cross-page coordination). */
      broadcast,

      /** Subscribe to config changes. Returns cleanup function. */
      onChange(callback: () => void): () => void {
        window.addEventListener(CONFIG_CHANGED_EVENT, callback);
        return () => window.removeEventListener(CONFIG_CHANGED_EVENT, callback);
      },
    };
  });
