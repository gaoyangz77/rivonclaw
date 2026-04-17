import { types, type Instance } from "mobx-state-tree";

/**
 * Single quota window returned by a subscription provider (e.g. 5h, Week, Premium, Chat).
 * `resetAt` is a Unix ms timestamp.
 *
 * Shape mirrors `UsageWindow` from `openclaw/plugin-sdk/provider-usage` — kept in sync
 * intentionally so Desktop can map snapshots directly into MST.
 */
export const ProviderKeyUsageWindowModel = types.model("ProviderKeyUsageWindow", {
  label: types.string,
  usedPercent: types.number,
  resetAt: types.maybe(types.number),
});

/**
 * Per-key subscription quota usage snapshot. Populated by Desktop when the user
 * opens the Usage modal for a subscription-type key. Not persisted — cleared on
 * any provider key upsert (stale quota is better cleared than shown).
 */
export const ProviderKeyUsageModel = types.model("ProviderKeyUsage", {
  /** Unix ms when this snapshot was fetched. 0 while fetching for the first time. */
  updatedAt: types.number,
  /** Fetch in progress (keeps modal showing a spinner). */
  fetching: types.boolean,
  /** Parsed quota windows (may be empty if provider returned none). */
  windows: types.array(ProviderKeyUsageWindowModel),
  /** Optional plan label returned by the provider (e.g. "ChatGPT Plus"). */
  plan: types.maybe(types.string),
  /** User-visible fetch error (HTTP status / timeout / unsupported). Null on success. */
  error: types.maybe(types.string),
});

export const ProviderKeyModel = types.model("ProviderKey", {
  id: types.identifier,
  provider: types.string,
  label: types.string,
  model: types.string,
  isDefault: types.boolean,
  proxyUrl: types.maybeNull(types.string),
  authType: types.optional(types.string, "api_key"),
  baseUrl: types.maybeNull(types.string),
  customProtocol: types.maybeNull(types.string),
  customModelsJson: types.maybeNull(types.string),
  inputModalities: types.maybeNull(types.array(types.string)),
  source: types.optional(types.string, "local"),
  createdAt: types.string,
  updatedAt: types.string,
  /**
   * Subscription quota usage. Null until the user explicitly requests it via the
   * "Usage" button. Using `types.optional(..., null)` so snapshots that omit it
   * (e.g. from Desktop's `toMstSnapshot`) reset to null rather than erroring.
   */
  usage: types.optional(types.maybeNull(ProviderKeyUsageModel), null),
})
  .actions((self) => ({
    /**
     * Begin a usage fetch — clears any prior error and marks fetching.
     * Called by Desktop (LLMProviderManager) before hitting the provider API.
     */
    beginUsageFetch() {
      self.usage = ProviderKeyUsageModel.create({
        updatedAt: 0,
        fetching: true,
        windows: [],
      });
    },

    /**
     * Store a completed usage snapshot (success or failure). Always clears `fetching`.
     * `error` distinguishes a provider/HTTP failure from an empty-window response.
     */
    setUsage(snapshot: {
      updatedAt: number;
      windows: Array<{ label: string; usedPercent: number; resetAt?: number }>;
      plan?: string;
      error?: string;
    }) {
      self.usage = ProviderKeyUsageModel.create({
        updatedAt: snapshot.updatedAt,
        fetching: false,
        windows: snapshot.windows,
        plan: snapshot.plan,
        error: snapshot.error,
      });
    },
  }));

export interface ProviderKey extends Instance<typeof ProviderKeyModel> {}
export interface ProviderKeyUsage extends Instance<typeof ProviderKeyUsageModel> {}
export interface ProviderKeyUsageWindow extends Instance<typeof ProviderKeyUsageWindowModel> {}
