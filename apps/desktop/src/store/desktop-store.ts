import { onPatch, applySnapshot, getSnapshot, types, type IJsonPatch } from "mobx-state-tree";
import { createLogger } from "@rivonclaw/logger";
import { RootStoreModel } from "@rivonclaw/core/models";
import { SYSTEM_TOOL_CATALOG } from "../generated/system-tool-catalog.js";
import { LLMProviderManagerModel, type LLMProviderManagerEnv } from "./llm-provider-manager.js";

const log = createLogger("desktop-store");

// ---------------------------------------------------------------------------
// Strip __typename from Apollo GraphQL responses before MST ingestion.
// MST strict-checks model schemas and rejects unknown properties.
// ---------------------------------------------------------------------------

function sanitizeForMst<T>(obj: T): T {
  // MST types.optional accepts undefined (uses default) but rejects null.
  // MST types.maybeNull treats undefined as null. So null→undefined is safe for all MST types.
  if (obj === null) return undefined as T;
  if (Array.isArray(obj)) return obj.map(sanitizeForMst) as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === "__typename") continue;
      result[key] = sanitizeForMst(val);
    }
    return result as T;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Desktop store environment — late-initialized infrastructure dependencies.
// The LLMProviderManager uses its own setEnv(), so the top-level env is now
// only needed if other desktop-store actions require infrastructure deps.
// ---------------------------------------------------------------------------

/** Initialize the LLM Provider Manager environment. Called once during startup in main.ts. */
export function initLLMProviderManagerEnv(env: LLMProviderManagerEnv): void {
  rootStore.llmManager.setEnv(env);
  rootStore.llmManager.initFromStorage();
}

// Re-export the env type for main.ts convenience
export type { LLMProviderManagerEnv };

// ---------------------------------------------------------------------------
// Desktop-specific RootStore: extends shared model with ingestion actions
// ---------------------------------------------------------------------------

const DesktopRootStoreModel = RootStoreModel.actions((self) => ({
  /**
   * Update systemTools from gateway catalog IDs.
   * Preserves metadata from pre-seeded SYSTEM_TOOL_CATALOG entries.
   */
  updateSystemToolsFromCatalog(catalogCoreIds: string[]) {
    if (catalogCoreIds.length === 0) return;
    const existingMeta = new Map(
      self.systemTools.map((t) => [t.id, { displayName: t.displayName, description: t.description, category: t.category }]),
    );
    applySnapshot(
      self.systemTools,
      catalogCoreIds.map((id) => {
        const meta = existingMeta.get(id);
        return {
          id,
          name: id,
          displayName: meta?.displayName ?? id,
          description: meta?.description ?? "",
          category: meta?.category ?? "system",
          source: "system",
          operationType: "system",
        };
      }),
    );
  },

  /**
   * Ingest a GraphQL response into the MST store.
   *
   * Uses __typename to automatically route data to the correct MST collection.
   * Handles reads (query arrays) and creates/updates (mutation objects).
   * Deletes are handled by Panel MST actions directly (optimistic removal after mutation succeeds).
   */
  ingestGraphQLResponse(rawData: Record<string, unknown>) {
    // --- Entity collections: __typename → MST array ---
    const COLLECTIONS: Record<string, any> = {
      Shop: self.shops,
      Surface: self.surfaces,
      RunProfile: self.runProfiles,
      ToolSpec: self.entitledTools,
      PlatformApp: self.platformApps,
      ServiceCredit: self.credits,
    };

    // --- Nullable singletons: __typename → getter/setter ---
    const SINGLETONS: Record<string, { get: () => any; set: (v: any) => void }> = {
      UserSubscription: {
        get: () => self.subscriptionStatus,
        set: (v) => { self.subscriptionStatus = v; },
      },
      LlmQuotaStatus: {
        get: () => self.llmQuotaStatus,
        set: (v) => { self.llmQuotaStatus = v; },
      },
      CSSessionStats: {
        get: () => self.sessionStats,
        set: (v) => { self.sessionStats = v; },
      },
      MeResponse: {
        get: () => self.currentUser,
        set: (v) => { self.currentUser = v; },
      },
    };

    // --- Key-based fallback for arrays without __typename ---
    const KEY_FALLBACK: Record<string, any> = {
      shops: self.shops,
      surfaces: self.surfaces,
      runProfiles: self.runProfiles,
      toolSpecs: self.entitledTools,
      platformApps: self.platformApps,
      myCredits: self.credits,
    };

    for (const [key, raw] of Object.entries(rawData)) {
      if (raw === undefined || raw === null) continue;

      // 1. Array → full replace (query result)
      if (Array.isArray(raw)) {
        const typeName = (raw[0] as any)?.__typename;
        const target = (typeName && COLLECTIONS[typeName]) || KEY_FALLBACK[key];
        if (target) applySnapshot(target, sanitizeForMst(raw));
        continue;
      }

      // 2. Skip booleans (delete responses — handled by Panel actions)
      if (typeof raw !== "object") continue;

      const obj = raw as Record<string, unknown>;
      const typeName = obj.__typename as string | undefined;
      const sanitized = sanitizeForMst(obj);

      // 3. Collection entity → upsert by identifier
      if (typeName && COLLECTIONS[typeName]) {
        const target = COLLECTIONS[typeName];
        const id = (sanitized as any).id;
        if (id) {
          const idx = target.findIndex((item: any) => item.id === id);
          if (idx >= 0) {
            applySnapshot(target[idx], sanitized);
          } else {
            target.push(sanitized as any);
          }
        }
        continue;
      }

      // 4. Singleton entity → set or update
      if (typeName && SINGLETONS[typeName]) {
        const s = SINGLETONS[typeName];
        if (s.get()) {
          applySnapshot(s.get(), sanitized);
        } else {
          s.set(sanitized);
        }
        continue;
      }

      // 5. AuthPayload wrapper (login/register → nested user)
      if (typeName === "AuthPayload") {
        const user = (obj as any).user;
        if (user && typeof user === "object" && user.__typename === "MeResponse") {
          const sanitizedUser = sanitizeForMst(user);
          if (self.currentUser) {
            applySnapshot(self.currentUser, sanitizedUser);
          } else {
            self.currentUser = sanitizedUser as any;
          }
        }
        continue;
      }

      // 6. Module enroll/unenroll → partial user update
      if (key === "enrollModule" || key === "unenrollModule") {
        const result = sanitized as { enrolledModules?: string[]; entitlementKeys?: string[] };
        if (self.currentUser && result.enrolledModules) {
          applySnapshot(self.currentUser.enrolledModules, result.enrolledModules);
        }
        if (self.currentUser && result.entitlementKeys) {
          applySnapshot(self.currentUser.entitlementKeys, result.entitlementKeys);
        }
        continue;
      }
    }
  },

  /**
   * Remove an entity from a collection by __typename and ID.
   * Called by the GraphQL proxy after a successful delete mutation.
   * This triggers SSE patches to Panel automatically.
   */
  removeEntity(typeName: string, id: string) {
    const COLLECTIONS: Record<string, any> = {
      Shop: self.shops,
      Surface: self.surfaces,
      RunProfile: self.runProfiles,
    };
    const target = COLLECTIONS[typeName];
    if (target) {
      const idx = target.findIndex((item: any) => item.id === id);
      if (idx >= 0) target.splice(idx, 1);
    }
  },

  /** Set the current user from auth REST routes (login/register/session). */
  setCurrentUser(userData: any) {
    if (self.currentUser) {
      applySnapshot(self.currentUser, userData);
    } else {
      self.currentUser = userData;
    }
  },

  /** Clear user on logout. */
  clearUser() {
    self.currentUser = null;
  },

  /** Replace all client tool specs in the MST store (from gateway RPC). */
  loadClientToolSpecs(specs: any[]) {
    applySnapshot(self.clientTools, specs);
  },

  /** Replace all provider keys in the MST store (bulk load from storage). */
  loadProviderKeys(keys: any[]) {
    applySnapshot(self.providerKeys, keys);
  },

  /** Upsert a single provider key (after create/update). */
  upsertProviderKey(key: any) {
    const idx = self.providerKeys.findIndex((k) => k.id === key.id);
    if (idx >= 0) {
      applySnapshot(self.providerKeys[idx], key);
    } else {
      self.providerKeys.push(key);
    }
  },

  /** Remove a provider key by ID. */
  removeProviderKey(id: string) {
    const idx = self.providerKeys.findIndex((k) => k.id === id);
    if (idx >= 0) self.providerKeys.splice(idx, 1);
  },
}))
.props({
  /** LLM Provider Manager — encapsulates provider key transaction actions. */
  llmManager: types.optional(LLMProviderManagerModel, {}),
});

/** Singleton MST store instance for the Desktop process. */
export const rootStore = DesktopRootStoreModel.create({
  systemTools: SYSTEM_TOOL_CATALOG.map((t) => ({
    id: t.id,
    name: t.id,
    displayName: t.label ?? t.id,
    description: t.description ?? "",
    category: t.section ?? "system",
    source: "system",
    operationType: "system",
  })),
});

// ---------------------------------------------------------------------------
// Patch listener registry (used by SSE broadcasting in Phase 2)
// ---------------------------------------------------------------------------

type PatchListener = (patches: IJsonPatch[]) => void;
const patchListeners = new Set<PatchListener>();

export function subscribeToPatch(listener: PatchListener): () => void {
  patchListeners.add(listener);
  return () => patchListeners.delete(listener);
}

// Batch patches within the same microtask to avoid SSE message storms.
// A single applySnapshot of 50 entitledTools fires 50+ onPatch calls synchronously;
// buffering them into one flush prevents Panel render thrashing.
let patchBuffer: IJsonPatch[] = [];
let flushScheduled = false;

function flushPatches() {
  flushScheduled = false;
  if (patchBuffer.length === 0) return;
  const batch = patchBuffer;
  patchBuffer = [];
  for (const listener of patchListeners) {
    listener(batch);
  }
}

onPatch(rootStore, (patch) => {
  patchBuffer.push(patch);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushPatches);
  }
});

export { getSnapshot };
