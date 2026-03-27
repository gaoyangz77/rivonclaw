import type {
  CatalogTool,
  SurfaceAvailabilityResult,
  ToolCapabilityResult,
  GQL,
} from "@rivonclaw/core";
import { ScopeType, TRUSTED_SCOPE_TYPES } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import { OUR_PLUGIN_IDS } from "../generated/our-plugin-ids.js";
import { SYSTEM_TOOL_CATALOG } from "../generated/system-tool-catalog.js";
import { entityCache } from "../entity-cache.js";

const log = createLogger("tool-capability-resolver");

/** Tool metadata for Panel display. */
export interface ToolInfo {
  id: string;
  displayName: string;
  description: string;
  category: string;
  source: "system" | "extension" | "entitled";
}

/** Surface metadata for Panel display. */
export interface SurfaceInfo {
  id: string;
  name: string;
  userId: string;
  /** Resolved tool IDs available in this surface (from CapabilityResolver, not raw allowedToolIds). */
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

/**
 * Case-insensitive tool ID matching.
 * Backend stores tool IDs as UPPER_CASE enums, frontend uses lower_case.
 */
export function toolIdMatch(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

/** Check if a tool ID is in a set (case-insensitive). */
function toolIdInSet(toolId: string, idSet: Set<string>): boolean {
  return idSet.has(toolId) || idSet.has(toolId.toUpperCase());
}

/**
 * ToolCapabilityResolver — the SINGLE source of truth for tool lists on the client.
 *
 * Responsibilities:
 * 1. Tool catalog: aggregates system + extension + entitled tools
 * 2. Surface resolution: given a surface, returns available tools
 *    (system surfaces automatically include system tools)
 * 3. RunProfile resolution: given a profile, returns selected tools
 * 4. Combined computation: surface ∩ profile → effective tools
 * 5. System presets: manages system-level surfaces and run profiles
 *    (derived from entity-cache toolSpecs)
 *
 * Data sources:
 * - System tools: static catalog (pre-seeded), overwritten by gateway catalog on init()
 * - Extension tools: from gateway catalog on init()
 * - Entitled tools + system presets: entity-cache (toolSpecs)
 */

/** Minimal RunProfile shape for internal storage. */
interface StoredRunProfile {
  selectedToolIds: string[];
  surfaceId?: string;
}

const SESSION_PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_PROFILE_CLEANUP_THRESHOLD = 100;

/** Default surface: unrestricted, always present. */
const DEFAULT_SURFACE: SurfaceInfo = {
  id: "Default",
  name: "Default",
  userId: "",
  resolvedToolIds: [],  // Populated dynamically — Default means "all tools"
};

interface TimestampedProfile {
  profile: StoredRunProfile;
  runProfileId: string | null;
  setAt: number;
}

export class ToolCapabilityResolver {
  /** Pre-seeded from static catalog; overwritten by gateway catalog on init(). */
  private systemToolIds: string[] = SYSTEM_TOOL_CATALOG.map((t) => t.id);
  private customExtensionToolIds: string[] = [];
  private initialized = false;

  private sessionProfiles = new Map<string, TimestampedProfile>();
  private defaultProfile: StoredRunProfile | null = null;

  // ── Initialization ──

  init(catalogTools: CatalogTool[]): void {
    const coreFromCatalog: string[] = [];
    const extensionsFromCatalog: string[] = [];

    for (const tool of catalogTools) {
      if (tool.source === "core") {
        coreFromCatalog.push(tool.id);
      } else if (tool.source === "plugin") {
        if (tool.pluginId && OUR_PLUGIN_IDS.has(tool.pluginId)) {
          continue;
        }
        extensionsFromCatalog.push(tool.id);
      }
    }

    if (coreFromCatalog.length > 0) {
      this.systemToolIds = coreFromCatalog;
    }
    this.customExtensionToolIds = extensionsFromCatalog;

    this.initialized = true;
    const entitled = this.getEntitledToolIds();
    log.info(
      `Initialized: ${entitled.length} entitled, ` +
      `${this.systemToolIds.length} system, ` +
      `${this.customExtensionToolIds.length} custom extension tools`,
    );
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ── Tool catalog ──

  getSystemToolIds(): string[] {
    return this.systemToolIds;
  }

  getCustomExtensionToolIds(): string[] {
    return this.customExtensionToolIds;
  }

  private getEntitledToolIds(): string[] {
    return entityCache.getState().toolSpecs.map(s => s.id);
  }

  /** All available tool IDs = system ∪ extension ∪ entitled */
  getAllAvailableToolIds(): string[] {
    return [
      ...this.systemToolIds,
      ...this.customExtensionToolIds,
      ...this.getEntitledToolIds(),
    ];
  }

  /** Full tool list with display metadata for Panel UI. */
  getToolList(): ToolInfo[] {
    const systemMetaMap = new Map(SYSTEM_TOOL_CATALOG.map((t) => [t.id, t]));
    const toolSpecs = entityCache.getState().toolSpecs;

    return [
      ...this.systemToolIds.map(id => {
        const meta = systemMetaMap.get(id);
        return {
          id,
          displayName: meta?.label ?? id,
          description: meta?.description ?? "",
          category: meta?.section ?? "system",
          source: "system" as const,
        };
      }),
      ...this.customExtensionToolIds.map(id => ({
        id,
        displayName: id,
        description: "",
        category: "Extension",
        source: "extension" as const,
      })),
      ...toolSpecs.map(s => ({
        id: s.id,
        displayName: s.displayName,
        description: s.description,
        category: s.category,
        source: "entitled" as const,
      })),
    ];
  }

  // ── System presets (surfaces + run profiles from toolSpecs) ──

  /** All surfaces: Default + derived from toolSpecs + user-created from entity-cache. */
  getAllSurfaces(): SurfaceInfo[] {
    const allToolIds = this.getAllAvailableToolIds();

    // Default surface: all tools
    const defaultSurface: SurfaceInfo = { ...DEFAULT_SURFACE, resolvedToolIds: allToolIds };

    // Derived from toolSpecs
    const derivedSurfaces = entityCache.getState().getDerivedSurfaces();
    const systemSurfaces: SurfaceInfo[] = derivedSurfaces.map(s => ({
      id: s.id,
      name: s.name,
      userId: s.userId ?? "",
      // System surfaces: entitled tools from allowedToolIds + system tools always included
      resolvedToolIds: [...this.systemToolIds, ...s.allowedToolIds],
    }));

    // User-created from entity-cache
    const userSurfaces: SurfaceInfo[] = entityCache.getState().surfaces.map(s => ({
      id: s.id,
      name: s.name,
      userId: s.userId ?? "",
      // User surfaces: strict — only what they selected
      resolvedToolIds: s.allowedToolIds,
    }));

    return [defaultSurface, ...systemSurfaces, ...userSurfaces];
  }

  /** All run profiles: derived from toolSpecs + user-created from entity-cache. */
  getAllRunProfiles(): RunProfileInfo[] {
    const derivedProfiles = entityCache.getState().getDerivedRunProfiles();
    const systemProfiles: RunProfileInfo[] = derivedProfiles.map(p => ({
      id: p.id,
      name: p.name,
      userId: p.userId ?? "",
      surfaceId: p.surfaceId ?? "Default",
      selectedToolIds: p.selectedToolIds,
    }));

    const userProfiles: RunProfileInfo[] = entityCache.getState().runProfiles.map(p => ({
      id: p.id,
      name: p.name,
      userId: p.userId ?? "",
      surfaceId: p.surfaceId ?? "Default",
      selectedToolIds: p.selectedToolIds,
    }));

    return [...systemProfiles, ...userProfiles];
  }

  // ── Session RunProfile state ──

  setDefaultRunProfile(profile: StoredRunProfile | null): void {
    this.defaultProfile = profile;
    log.info(profile ? `Default RunProfile set (${profile.selectedToolIds.length} tools)` : "Default RunProfile cleared");
  }

  setSessionRunProfile(sessionKey: string, profile: StoredRunProfile | null, runProfileId: string | null = null): void {
    if (profile) {
      this.sessionProfiles.set(sessionKey, { profile, runProfileId, setAt: Date.now() });

      if (this.sessionProfiles.size > SESSION_PROFILE_CLEANUP_THRESHOLD) {
        const now = Date.now();
        for (const [key, entry] of this.sessionProfiles) {
          if (now - entry.setAt > SESSION_PROFILE_TTL_MS) this.sessionProfiles.delete(key);
        }
      }
    } else {
      this.sessionProfiles.delete(sessionKey);
    }
  }

  getSessionRunProfile(sessionKey: string): StoredRunProfile | null {
    return this.sessionProfiles.get(sessionKey)?.profile ?? null;
  }

  getSessionRunProfileId(sessionKey: string): string | null {
    return this.sessionProfiles.get(sessionKey)?.runProfileId ?? null;
  }

  // ── Runtime: effective tools for agent sessions ──

  getEffectiveToolsForScope(scopeType: ScopeType, sessionKey: string): string[] {
    let runProfile: StoredRunProfile | null = this.sessionProfiles.get(sessionKey)?.profile ?? null;
    if (!runProfile && TRUSTED_SCOPE_TYPES.has(scopeType)) {
      runProfile = this.defaultProfile;
    }

    if (!runProfile && !TRUSTED_SCOPE_TYPES.has(scopeType)) {
      return [];
    }

    const gqlProfile: GQL.RunProfile | null = runProfile
      ? { id: "", name: "", selectedToolIds: runProfile.selectedToolIds, surfaceId: runProfile.surfaceId ?? "", createdAt: "", updatedAt: "" }
      : null;
    const result = this.computeEffectiveTools(null, gqlProfile);

    if (TRUSTED_SCOPE_TYPES.has(scopeType)) {
      const merged = new Set(result.effectiveToolIds);
      for (const id of this.systemToolIds) merged.add(id);
      return [...merged];
    }

    return result.effectiveToolIds;
  }

  // ── Four-layer computation ──

  computeSurfaceAvailability(surface: GQL.Surface | null): SurfaceAvailabilityResult {
    const allAvailable = this.getAllAvailableToolIds();

    if (!surface) {
      return {
        allAvailableToolIds: allAvailable,
        surfaceId: "",
        surfaceAllowedToolIds: [],
        availableToolIds: allAvailable,
      };
    }

    const surfaceSet = new Set(surface.allowedToolIds.map(id => id.toUpperCase()));

    // System surfaces (userId empty): system tools always pass through
    const isSystemSurface = !surface.userId;
    const availableToolIds = allAvailable.filter(id => {
      if (isSystemSurface && this.systemToolIds.includes(id)) return true;
      return toolIdInSet(id, surfaceSet);
    });

    return {
      allAvailableToolIds: allAvailable,
      surfaceId: surface.id,
      surfaceAllowedToolIds: surface.allowedToolIds,
      availableToolIds,
    };
  }

  computeEffectiveTools(
    surface: GQL.Surface | null,
    runProfile: GQL.RunProfile | null,
  ): ToolCapabilityResult {
    const availability = this.computeSurfaceAvailability(surface);
    const availableSet = new Set(availability.availableToolIds);

    const baselineToolIds = [...this.systemToolIds];
    const selectedToolIds = runProfile?.selectedToolIds ?? baselineToolIds;
    const effectiveToolIds = selectedToolIds.filter(id => toolIdInSet(id, availableSet));

    return {
      allAvailableToolIds: availability.allAvailableToolIds,
      entitledToolIds: this.getEntitledToolIds(),
      systemToolIds: this.systemToolIds,
      customExtensionToolIds: this.customExtensionToolIds,
      surfaceId: availability.surfaceId,
      surfaceAllowedToolIds: availability.surfaceAllowedToolIds,
      runProfileSelectedToolIds: selectedToolIds,
      effectiveToolIds,
    };
  }
}

/** Singleton instance */
export const toolCapabilityResolver = new ToolCapabilityResolver();
