import { types, getRoot, applySnapshot, cast, type Instance } from "mobx-state-tree";
import { ScopeType, TRUSTED_SCOPE_TYPES } from "../types/index.js";
import type { CatalogTool, SurfaceAvailabilityResult, ToolCapabilityResult } from "../types/index.js";

// ── Nested models ──────────────────────────────────────────────────────────

const SessionProfileModel = types.model("SessionProfile", {
  selectedToolIds: types.array(types.string),
  surfaceId: types.optional(types.string, ""),
  runProfileId: types.maybeNull(types.string),
  setAt: types.number,
});

// ── Constants ──────────────────────────────────────────────────────────────

const SESSION_PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_PROFILE_CLEANUP_THRESHOLD = 100;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Case-insensitive tool ID matching. */
export function toolIdMatch(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

/** Check if a tool ID is in a set (case-insensitive). */
function toolIdInSet(toolId: string, idSet: Set<string>): boolean {
  return idSet.has(toolId) || idSet.has(toolId.toUpperCase());
}

// ── Available tool shape for Panel UI ──────────────────────────────────────

export interface AvailableTool {
  id: string;
  displayName: string;
  description: string;
  category: string;
  source: "system" | "extension" | "entitled" | "client";
}

/** Surface metadata for Panel display. */
export interface SurfaceInfo {
  id: string;
  name: string;
  userId: string;
  /** Resolved tool IDs available in this surface. */
  resolvedToolIds: string[];
}

/** RunProfile metadata for Panel display. */
export interface RunProfileInfo {
  id: string;
  name: string;
  userId: string;
  surfaceId: string;
  selectedToolIds: string[];
}

// ── Main model ─────────────────────────────────────────────────────────────

export const ToolCapabilityModel = types
  .model("ToolCapability", {
    extensionToolIds: types.optional(types.array(types.string), []),
    initialized: types.optional(types.boolean, false),
    sessionProfiles: types.optional(types.map(SessionProfileModel), {}),
    defaultProfileToolIds: types.maybeNull(types.array(types.string)),
    defaultProfileSurfaceId: types.optional(types.string, ""),
  })
  .views((self) => {
    // Helper to access parent RootStore — typed loosely to avoid circular refs
    const root = () => getRoot(self) as any;

    return {
      /** System tool IDs from the parent RootStore's systemTools array. */
      get systemToolIds(): string[] {
        return root().systemTools.map((t: any) => t.id);
      },

      /** Entitled + client tool IDs from the parent RootStore. */
      get entitledToolIds(): string[] {
        return [...root().entitledTools, ...root().clientTools].map((s: any) => s.id);
      },

      /** All available tool IDs = system + extension + entitled + client */
      get allAvailableToolIds(): string[] {
        return [
          ...root().allTools.map((t: any) => t.id),
          ...self.extensionToolIds,
        ];
      },

      /**
       * Tool list for Panel UI (Surface/RunProfile selectors).
       * Excludes extension tools (e.g. feishu channel plugins) — these are
       * internal to OpenClaw channel plugins and not user-manageable.
       * Extension tools remain in allAvailableToolIds for runtime permission
       * checks, so the agent can still use them.
       */
      get toolList(): AvailableTool[] {
        return root().allTools.map((t: any) => ({
          id: t.id,
          displayName: t.displayName,
          description: t.description || "",
          category: t.category,
          source: (t.source || "entitled") as AvailableTool["source"],
        }));
      },

      /** Alias used by Panel components. */
      get availableTools(): AvailableTool[] {
        return this.toolList;
      },
    };
  })
  .views((self) => {
    const root = () => getRoot(self) as any;

    return {
      /** Derived surfaces from entitled/client tools (system surfaces). */
      getDerivedSurfaces(): Array<{ id: string; name: string; allowedToolIds: string[]; userId: string }> {
        return root().getDerivedSurfaces();
      },

      /** Derived run profiles from entitled/client tools (system profiles). */
      getDerivedRunProfiles(): Array<{ id: string; name: string; selectedToolIds: string[]; surfaceId: string; userId: string }> {
        return root().getDerivedRunProfiles();
      },

      /** All surfaces: Default + derived from tools + user-created from MST store. */
      get allSurfaces(): SurfaceInfo[] {
        const allToolIds = self.allAvailableToolIds;
        const systemToolIds = self.systemToolIds;

        // Default surface: all tools
        const defaultSurface: SurfaceInfo = {
          id: "Default",
          name: "Default",
          userId: "",
          resolvedToolIds: allToolIds,
        };

        // Derived from entitled/client tools
        const derivedSurfaces = root().getDerivedSurfaces() as Array<{
          id: string; name: string; allowedToolIds: string[]; userId: string;
        }>;
        const systemSurfaces: SurfaceInfo[] = derivedSurfaces.map(
          (s: { id: string; name: string; allowedToolIds: string[]; userId: string }) => ({
            id: s.id,
            name: s.name,
            userId: s.userId ?? "",
            // System surfaces: entitled tools from allowedToolIds + system tools always included
            resolvedToolIds: [...systemToolIds, ...s.allowedToolIds],
          }),
        );

        // User-created from MST store
        const userSurfaces: SurfaceInfo[] = root().surfaces.map(
          (s: any) => ({
            id: s.id,
            name: s.name,
            userId: s.userId ?? "",
            // User surfaces: strict — only what they selected
            resolvedToolIds: [...s.allowedToolIds],
          }),
        );

        return [defaultSurface, ...systemSurfaces, ...userSurfaces];
      },

      /** All run profiles: derived from tools + user-created from MST store. */
      get allRunProfiles(): RunProfileInfo[] {
        const derivedProfiles = root().getDerivedRunProfiles() as Array<{
          id: string; name: string; selectedToolIds: string[]; surfaceId: string; userId: string;
        }>;
        const systemProfiles: RunProfileInfo[] = derivedProfiles.map(
          (p: { id: string; name: string; selectedToolIds: string[]; surfaceId: string; userId: string }) => ({
            id: p.id,
            name: p.name,
            userId: p.userId ?? "",
            surfaceId: p.surfaceId ?? "Default",
            selectedToolIds: p.selectedToolIds,
          }),
        );

        const userProfiles: RunProfileInfo[] = root().runProfiles.map(
          (p: any) => ({
            id: p.id,
            name: p.name,
            userId: p.userId ?? "",
            surfaceId: p.surfaceId ?? "Default",
            selectedToolIds: [...p.selectedToolIds],
          }),
        );

        return [...systemProfiles, ...userProfiles];
      },
    };
  })
  .views((self) => ({
    /** Compute surface availability — Layer 1 + Layer 2 filtering. */
    computeSurfaceAvailability(surface: { id: string; allowedToolIds: string[]; userId?: string | null } | null): SurfaceAvailabilityResult {
      const allAvailable = self.allAvailableToolIds;

      if (!surface) {
        return {
          allAvailableToolIds: allAvailable,
          surfaceId: "",
          surfaceAllowedToolIds: [],
          availableToolIds: allAvailable,
        };
      }

      const surfaceSet = new Set(surface.allowedToolIds.map((id: string) => id.toUpperCase()));
      const systemToolIds = self.systemToolIds;

      // System surfaces (userId empty): system tools always pass through
      const isSystemSurface = !surface.userId;
      const availableToolIds = allAvailable.filter((id: string) => {
        if (isSystemSurface && systemToolIds.includes(id)) return true;
        return toolIdInSet(id, surfaceSet);
      });

      return {
        allAvailableToolIds: allAvailable,
        surfaceId: surface.id,
        surfaceAllowedToolIds: surface.allowedToolIds,
        availableToolIds,
      };
    },

    /** Get session run profile. */
    getSessionRunProfile(sessionKey: string): { selectedToolIds: string[]; surfaceId?: string } | null {
      const entry = self.sessionProfiles.get(sessionKey);
      if (!entry) return null;
      return {
        selectedToolIds: [...entry.selectedToolIds],
        surfaceId: entry.surfaceId || undefined,
      };
    },

    /** Get session run profile ID. */
    getSessionRunProfileId(sessionKey: string): string | null {
      return self.sessionProfiles.get(sessionKey)?.runProfileId ?? null;
    },
  }))
  .views((self) => ({
    /** Compute effective tools — surface + run profile intersection. */
    computeEffectiveTools(
      surface: { id: string; allowedToolIds: string[]; userId?: string | null } | null,
      runProfile: { selectedToolIds: string[]; surfaceId?: string } | null,
    ): ToolCapabilityResult {
      const availability = self.computeSurfaceAvailability(surface);
      const availableSet = new Set(availability.availableToolIds);
      const systemToolIds = self.systemToolIds;

      const baselineToolIds = [...systemToolIds];
      const selectedToolIds = runProfile?.selectedToolIds ?? baselineToolIds;
      const effectiveToolIds = selectedToolIds.filter((id: string) => toolIdInSet(id, availableSet));

      return {
        allAvailableToolIds: availability.allAvailableToolIds,
        entitledToolIds: self.entitledToolIds,
        systemToolIds,
        customExtensionToolIds: [...self.extensionToolIds],
        surfaceId: availability.surfaceId,
        surfaceAllowedToolIds: availability.surfaceAllowedToolIds,
        runProfileSelectedToolIds: selectedToolIds,
        effectiveToolIds,
      };
    },
  }))
  .views((self) => ({
    /** Get effective tools for a scope, resolving session/default profiles. */
    getEffectiveToolsForScope(scopeType: ScopeType, sessionKey: string): string[] {
      const sessionEntry = self.sessionProfiles.get(sessionKey);
      let runProfile: { selectedToolIds: string[]; surfaceId?: string } | null =
        sessionEntry
          ? { selectedToolIds: [...sessionEntry.selectedToolIds], surfaceId: sessionEntry.surfaceId || undefined }
          : null;

      if (!runProfile && TRUSTED_SCOPE_TYPES.has(scopeType)) {
        runProfile = self.defaultProfileToolIds
          ? { selectedToolIds: [...self.defaultProfileToolIds], surfaceId: self.defaultProfileSurfaceId || undefined }
          : null;
      }

      if (!runProfile && !TRUSTED_SCOPE_TYPES.has(scopeType)) {
        return [];
      }

      const gqlProfile = runProfile
        ? { selectedToolIds: runProfile.selectedToolIds, surfaceId: runProfile.surfaceId ?? "" }
        : null;
      const result = self.computeEffectiveTools(null, gqlProfile);

      if (TRUSTED_SCOPE_TYPES.has(scopeType)) {
        const merged = new Set(result.effectiveToolIds);
        for (const id of self.systemToolIds) merged.add(id);
        return [...merged];
      }

      return result.effectiveToolIds;
    },
  }))
  .actions((self) => ({
    /**
     * Initialize from gateway tool catalog.
     *
     * Splits catalog into core (system) tool IDs and extension tool IDs.
     * Core tool IDs are used to filter the parent RootStore's systemTools array
     * (via updateSystemToolsFromCatalog). Extension tool IDs are stored locally.
     *
     * @param catalogTools — tools from gateway RPC `tools.catalog`
     * @param ourPluginIds — set of our own plugin IDs to exclude from extension tools
     */
    init(catalogTools: CatalogTool[], ourPluginIds: ReadonlySet<string>): void {
      const coreFromCatalog: string[] = [];
      const extensionsFromCatalog: string[] = [];

      for (const tool of catalogTools) {
        if (tool.source === "core") {
          coreFromCatalog.push(tool.id);
        } else if (tool.source === "plugin") {
          if (tool.pluginId && ourPluginIds.has(tool.pluginId)) continue;
          extensionsFromCatalog.push(tool.id);
        }
      }

      if (coreFromCatalog.length > 0) {
        // Delegate system tool filtering to the parent RootStore action
        const rootStore = getRoot(self) as any;
        if (typeof rootStore.updateSystemToolsFromCatalog === "function") {
          rootStore.updateSystemToolsFromCatalog(coreFromCatalog);
        }
      }
      applySnapshot(self.extensionToolIds, extensionsFromCatalog);
      self.initialized = true;
    },

    /** Set or clear the user's default RunProfile. */
    setDefaultRunProfile(profile: { selectedToolIds: string[]; surfaceId?: string } | null): void {
      if (profile) {
        self.defaultProfileToolIds = cast(profile.selectedToolIds);
        self.defaultProfileSurfaceId = profile.surfaceId ?? "";
      } else {
        self.defaultProfileToolIds = null;
        self.defaultProfileSurfaceId = "";
      }
    },

    /** Set or clear a session-specific RunProfile. */
    setSessionRunProfile(
      sessionKey: string,
      profile: { selectedToolIds: string[]; surfaceId?: string } | null,
      runProfileId: string | null = null,
    ): void {
      if (profile) {
        self.sessionProfiles.set(sessionKey, {
          selectedToolIds: cast(profile.selectedToolIds),
          surfaceId: profile.surfaceId ?? "",
          runProfileId,
          setAt: Date.now(),
        });

        // Cleanup stale entries
        if (self.sessionProfiles.size > SESSION_PROFILE_CLEANUP_THRESHOLD) {
          const now = Date.now();
          for (const [key, entry] of self.sessionProfiles) {
            if (now - entry.setAt > SESSION_PROFILE_TTL_MS) {
              self.sessionProfiles.delete(key);
            }
          }
        }
      } else {
        self.sessionProfiles.delete(sessionKey);
      }
    },
  }));

export interface ToolCapability extends Instance<typeof ToolCapabilityModel> {}
