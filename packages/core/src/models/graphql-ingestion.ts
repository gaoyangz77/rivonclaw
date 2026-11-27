import { applySnapshot, getSnapshot } from "mobx-state-tree";

/**
 * GraphQL ingestion shared by every host that owns an entity store: Desktop
 * (its proxy ingests every Panel and extension response) and the web host
 * (Panel ingests the responses itself). One implementation, so both hosts
 * route a response into the store the same way.
 *
 * Moved verbatim from the Desktop store (ADR-123 step 2b); the store model
 * attaches it with `.actions(graphQLIngestionActions)`.
 */

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Strip __typename from Apollo GraphQL responses before MST ingestion.
// MST strict-checks model schemas and rejects unknown properties.
// ---------------------------------------------------------------------------

export function sanitizeForMst<T>(obj: T): T {
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

function hasOwnObjectKey(value: unknown, key: string): boolean {
  return !!value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
}

function preserveMissingShopServiceFields(
  rawShop: unknown,
  sanitizedShop: Record<string, any>,
  existingSnapshot: Record<string, any> | null | undefined,
): Record<string, any> {
  const existingServices = existingSnapshot?.services;
  if (!existingServices || !hasOwnObjectKey(rawShop, "services")) return sanitizedShop;

  const rawServices = (rawShop as Record<string, unknown>).services;
  if (!rawServices || typeof rawServices !== "object") return sanitizedShop;

  const nextServices =
    sanitizedShop.services && typeof sanitizedShop.services === "object"
      ? { ...sanitizedShop.services }
      : {};

  for (const serviceKey of ["customerService", "wms", "affiliateService"]) {
    const existingService = existingServices[serviceKey];
    if (!existingService) continue;

    if (!hasOwnObjectKey(rawServices, serviceKey)) {
      nextServices[serviceKey] = existingService;
      continue;
    }

    const rawService = (rawServices as Record<string, unknown>)[serviceKey];
    if (!rawService || typeof rawService !== "object") continue;

    const nextService =
      nextServices[serviceKey] && typeof nextServices[serviceKey] === "object"
        ? { ...nextServices[serviceKey] }
        : {};
    for (const fieldKey of Object.keys(existingService)) {
      if (!hasOwnObjectKey(rawService, fieldKey)) {
        nextService[fieldKey] = existingService[fieldKey];
      }
    }
    nextServices[serviceKey] = nextService;
  }

  sanitizedShop.services = nextServices;
  return sanitizedShop;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function graphQLIngestionActions(self: any) {
  return {
    beginShopRefresh(reason: string) {
      self.shopLifecycle.status = "loading";
      self.shopLifecycle.lastRefreshReason = reason;
      self.shopLifecycle.error = null;
    },

    replaceShopsFromGraphQL(rawShops: unknown[], reason: string) {
      applySnapshot(self.shops, sanitizeForMst(rawShops) as any);
      self.shopLifecycle.status = "ready";
      self.shopLifecycle.generation += 1;
      self.shopLifecycle.lastRefreshReason = reason;
      self.shopLifecycle.lastRefreshAt = nowIso();
      self.shopLifecycle.error = null;
    },

    upsertShopFromGraphQL(rawShop: unknown, reason: string) {
      const sanitized = sanitizeForMst(rawShop) as any;
      const id = sanitized?.id;
      if (!id) return;
      const idx = self.shops.findIndex((item: any) => item.id === id);
      if (idx >= 0) {
        applySnapshot(
          self.shops[idx],
          preserveMissingShopServiceFields(
            rawShop,
            sanitized,
            getSnapshot(self.shops[idx]) as Record<string, any>,
          ),
        );
      } else {
        self.shops.push(sanitized);
      }
      self.shopLifecycle.status = "ready";
      self.shopLifecycle.generation += 1;
      self.shopLifecycle.lastRefreshReason = reason;
      self.shopLifecycle.lastRefreshAt = nowIso();
      self.shopLifecycle.error = null;
    },

    upsertShopsFromGraphQL(rawShops: unknown[], reason: string) {
      let changed = false;
      for (const rawShop of rawShops) {
        const sanitized = sanitizeForMst(rawShop) as any;
        const id = sanitized?.id;
        if (!id) continue;
        const idx = self.shops.findIndex((item: any) => item.id === id);
        if (idx >= 0) {
          applySnapshot(
            self.shops[idx],
            preserveMissingShopServiceFields(
              rawShop,
              sanitized,
              getSnapshot(self.shops[idx]) as Record<string, any>,
            ),
          );
        } else {
          self.shops.push(sanitized);
        }
        changed = true;
      }
      if (!changed) return;
      self.shopLifecycle.status = "ready";
      self.shopLifecycle.generation += 1;
      self.shopLifecycle.lastRefreshReason = reason;
      self.shopLifecycle.lastRefreshAt = nowIso();
      self.shopLifecycle.error = null;
    },

    markShopRefreshFailed(reason: string, error: string) {
      self.shopLifecycle.status = "error";
      self.shopLifecycle.lastRefreshReason = reason;
      self.shopLifecycle.error = error;
    },

    clearShopCache(reason: string) {
      applySnapshot(self.shops, []);
      self.shopLifecycle.status = "empty";
      self.shopLifecycle.generation += 1;
      self.shopLifecycle.lastRefreshReason = reason;
      self.shopLifecycle.lastRefreshAt = nowIso();
      self.shopLifecycle.error = null;
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
        AdsAdvertiser: self.adsAdvertisers,
        AdsStoreBinding: self.adsStoreBindings,
        AdsStoreAccess: self.adsStoreBindings,
        Surface: self.surfaces,
        RunProfile: self.runProfiles,
        ToolSpec: self.entitledTools,
        PlatformApp: self.platformApps,
        WmsAccount: self.wmsAccounts,
        Warehouse: self.warehouses,
        ShopWarehouse: self.shopWarehouses,
        InventoryGood: self.inventoryGoods,
        BillingPlanDefinition: self.billingPlanDefinitions,
        Payment: self.payments,
        ActionProposal: self.affiliateWorkspace.actionProposals,
        AffiliateCollaboration: self.affiliateWorkspace.affiliateCollaborations,
        AffiliateCreatorRelationship: self.affiliateWorkspace.creatorRelationships,
        AffiliateCreatorIdentity: self.affiliateWorkspace.creatorProfiles,
        SampleApplicationRecord: self.affiliateWorkspace.sampleApplicationRecords,
        LifecycleEvent: self.affiliateWorkspace.lifecycleEvents,
        EcomProductSummary: self.affiliateWorkspace.productSummaries,
      };

      // --- Nullable singletons: __typename → getter/setter ---
      // `mergeSelectedFields`: a response carries only the fields its query
      // selected, so absent top-level fields keep their current value. The
      // 60-second LLM quota refresh selects only `accountLlm` and must not
      // erase the shop billing rows the full overview query loaded.
      const SINGLETONS: Record<
        string,
        { get: () => any; set: (v: any) => void; mergeSelectedFields?: boolean }
      > = {
        BillingOverview: {
          get: () => self.billingOverview,
          set: (v) => {
            self.billingOverview = v;
          },
          mergeSelectedFields: true,
        },
        MeResponse: {
          get: () => self.currentUser,
          set: (v) => {
            self.currentUser = v;
          },
        },
      };

      const KEY_SINGLETONS: Record<
        string,
        { get: () => any; set: (v: any) => void; mergeSelectedFields?: boolean }
      > = {
        me: SINGLETONS.MeResponse,
        billingOverview: SINGLETONS.BillingOverview,
      };

      // --- Key-based fallback for arrays without __typename ---
      const KEY_FALLBACK: Record<string, any> = {
        shops: self.shops,
        adsAdvertisers: self.adsAdvertisers,
        adsStoreAccesses: self.adsStoreBindings,
        adsStoreBindings: self.adsStoreBindings,
        surfaces: self.surfaces,
        runProfiles: self.runProfiles,
        toolSpecs: self.entitledTools,
        platformApps: self.platformApps,
        readWmsAccounts: self.wmsAccounts,
        readWarehouses: self.warehouses,
        readShopWarehouses: self.shopWarehouses,
        readInventoryGoods: self.inventoryGoods,
        writeInventoryGoods: self.inventoryGoods,
        writeShopWarehouseMappings: self.shopWarehouses,
        billingPlanDefinitions: self.billingPlanDefinitions,
        readPayments: self.payments,
      };

      for (const [key, raw] of Object.entries(rawData)) {
        if (raw === undefined || raw === null) continue;

        // 1. Array → collection hydration (query result)
        if (Array.isArray(raw)) {
          if (key === "actionProposals") {
            self.affiliateWorkspace.ingestAffiliateActionProposals(sanitizeForMst(raw) as any);
            continue;
          }
          if (key === "creatorRelations") {
            self.affiliateWorkspace.replaceAffiliateCreatorRelationships(
              sanitizeForMst(raw) as any,
            );
            continue;
          }
          if (key === "affiliateCollaborations") {
            self.affiliateWorkspace.replaceAffiliateCollaborations(sanitizeForMst(raw) as any);
            continue;
          }
          if (key === "creatorProfiles") {
            self.affiliateWorkspace.replaceAffiliateCreatorProfiles(sanitizeForMst(raw) as any);
            continue;
          }
          const typeName = (raw[0] as any)?.__typename;
          const target = (typeName && COLLECTIONS[typeName]) || KEY_FALLBACK[key];
          if (target) {
            if (target === self.shops) {
              (self as any).replaceShopsFromGraphQL(raw, `graphql:${key}`);
            } else {
              applySnapshot(target, sanitizeForMst(raw));
            }
          }
          continue;
        }

        // 2. Skip booleans (delete responses — handled by Panel actions)
        if (typeof raw !== "object") continue;

        const obj = raw as Record<string, unknown>;
        const typeName = obj.__typename as string | undefined;
        const sanitized = sanitizeForMst(obj);

        if (key === "decideActionProposal" || key === "affiliateResolveWorkItem") {
          self.affiliateWorkspace.upsertAffiliateActionProposal(sanitized as any);
        }

        if (key === "affiliateWorkspace") {
          self.affiliateWorkspace.ingestAffiliateWorkspace(sanitized as any);
          continue;
        }

        // 3. Collection entity → upsert by identifier
        if (typeName && COLLECTIONS[typeName]) {
          const target = COLLECTIONS[typeName];
          const id = (sanitized as any).id;
          if (id) {
            if (typeName === "ActionProposal") {
              self.affiliateWorkspace.upsertAffiliateActionProposal(sanitized as any);
            } else if (typeName === "AffiliateCollaboration") {
              self.affiliateWorkspace.upsertAffiliateCollaboration(sanitized as any);
            } else if (typeName === "AffiliateCreatorRelationship") {
              self.affiliateWorkspace.upsertAffiliateCreatorRelationship(sanitized as any);
            } else if (typeName === "AffiliateCreatorIdentity") {
              self.affiliateWorkspace.upsertAffiliateCreatorProfile(sanitized as any);
            } else if (typeName === "SampleApplicationRecord") {
              self.affiliateWorkspace.upsertAffiliateSampleApplicationRecord(sanitized as any);
            } else if (typeName === "LifecycleEvent") {
              self.affiliateWorkspace.upsertAffiliateLifecycleEvent(sanitized as any);
            } else if (typeName === "EcomProductSummary") {
              self.affiliateWorkspace.upsertAffiliateProductSummary(sanitized as any);
            }
            if (target === self.shops) {
              (self as any).upsertShopFromGraphQL(obj, `graphql:${key || typeName}`);
            } else {
              const idx = target.findIndex((item: any) => item.id === id);
              if (idx >= 0) {
                applySnapshot(target[idx], sanitized);
              } else {
                target.push(sanitized as any);
              }
            }
          }
          continue;
        }

        // 4. Singleton entity → set or update
        const singleton = (typeName && SINGLETONS[typeName]) || (!typeName && KEY_SINGLETONS[key]);
        if (singleton) {
          const s = singleton;
          if (s.get()) {
            applySnapshot(
              s.get(),
              s.mergeSelectedFields
                ? { ...(getSnapshot(s.get()) as object), ...(sanitized as object) }
                : sanitized,
            );
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

        // enrollModule / unenrollModule / setDefaultRunProfile now return full MeResponse
        // with __typename, so they are handled by the MeResponse singleton branch above (step 4).
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
        AdsAdvertiser: self.adsAdvertisers,
        AdsStoreBinding: self.adsStoreBindings,
        AdsStoreAccess: self.adsStoreBindings,
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
      if (self.currentUser?.userId !== userData.userId) {
        self.categories.clear();
        self.categorySession++;
      }
      if (self.currentUser) {
        applySnapshot(self.currentUser, userData);
      } else {
        self.currentUser = userData;
      }
    },

    setAuthBootstrap(
      status: "signed_out" | "loading" | "ready" | "error",
      error: string | null = null,
    ) {
      (self as any).authBootstrap.status = status;
      (self as any).authBootstrap.error = error;
    },

    beginAuthLifecycle(action: string): number {
      self.categories.clear();
      self.categorySession++;
      const auth = (self as any).authBootstrap;
      auth.transitionId += 1;
      auth.phase = "transitioning";
      auth.action = action;
      auth.error = null;
      return auth.transitionId;
    },

    finishAuthLifecycle(transitionId: number): void {
      const auth = (self as any).authBootstrap;
      if (auth.transitionId !== transitionId) return;
      auth.phase = "settled";
      auth.action = null;
      auth.settledUserId = self.currentUser?.userId ?? null;
    },

    clearCloudEntities() {
      self.categories.clear();
      self.categorySession++;
      self.currentUser = null;
      applySnapshot(self.entitledTools, []);
      applySnapshot(self.surfaces, []);
      applySnapshot(self.runProfiles, []);
      (self as any).clearShopCache("clear_cloud_entities");
      applySnapshot(self.adsAdvertisers, []);
      applySnapshot(self.adsStoreBindings, []);
      applySnapshot(self.platformApps, []);
      applySnapshot(self.wmsAccounts, []);
      applySnapshot(self.warehouses, []);
      applySnapshot(self.shopWarehouses, []);
      applySnapshot(self.inventoryGoods, []);
      (self as any).affiliateWorkspace.clearAffiliateWorkspace();
      applySnapshot(self.billingPlanDefinitions, []);
      applySnapshot(self.payments, []);
      self.billingOverview = null;
    },

    clearCloudDataExceptUser(options?: { preserveShops?: boolean }) {
      self.categories.clear();
      self.categorySession++;
      applySnapshot(self.entitledTools, []);
      applySnapshot(self.surfaces, []);
      applySnapshot(self.runProfiles, []);
      if (!options?.preserveShops) {
        (self as any).clearShopCache("clear_cloud_data_except_user");
      }
      applySnapshot(self.adsAdvertisers, []);
      applySnapshot(self.adsStoreBindings, []);
      applySnapshot(self.platformApps, []);
      applySnapshot(self.wmsAccounts, []);
      applySnapshot(self.warehouses, []);
      applySnapshot(self.shopWarehouses, []);
      applySnapshot(self.inventoryGoods, []);
      (self as any).affiliateWorkspace.clearAffiliateWorkspace();
      applySnapshot(self.billingPlanDefinitions, []);
      applySnapshot(self.payments, []);
      self.billingOverview = null;
    },

  };
}
