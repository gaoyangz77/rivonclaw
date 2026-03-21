import type {
  CatalogTool,
  SurfaceAvailabilityResult,
  ToolCapabilityResult,
  GQL,
} from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import { OUR_PLUGIN_IDS } from "../generated/our-plugin-ids.js";
import { SYSTEM_TOOL_CATALOG } from "../generated/system-tool-catalog.js";

const log = createLogger("tool-capability-resolver");

/** Tool metadata for Panel display. */
export interface ToolInfo {
  id: string;
  displayName: string;
  description: string;
  category: string;
  allowed: boolean;
  source: "system" | "extension" | "entitled";
}

/** Entitled tool metadata from backend. */
export interface EntitledToolMeta {
  id: string;
  displayName: string;
  description: string;
  category: string;
  allowed: boolean;
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
 * ToolCapabilityResolver — pure computation engine for the four-layer tool model.
 *
 * Responsibilities:
 * - Holds the tool catalog: system, extension, entitled (three categories)
 * - Computes effective tools given a Surface and RunProfile
 * - Provides tool listing with display metadata for Panel UI
 *
 * Does NOT manage: sessions, scopes, caching, or business routing.
 * Those belong in the route layer (scope→RunProfile) and the
 * capability-manager plugin (per-session caching).
 *
 * Layer 1 (Entitlement): paid tools from backend
 * Layer 2 (Surface): usage scenario boundary (null = unrestricted)
 * Layer 3 (RunProfile): per-run tool selection (null = unrestricted)
 * Layer 4 (Tool Execution): capability-manager plugin enforcement (external)
 */
export class ToolCapabilityResolver {
  private entitledToolIds: string[] = [];
  /** Pre-seeded from static catalog; overwritten by gateway catalog on init(). */
  private systemToolIds: string[] = SYSTEM_TOOL_CATALOG.map((t) => t.id);
  private customExtensionToolIds: string[] = [];
  private initialized = false;

  /**
   * Initialize with entitled tools from backend and tool catalog from gateway.
   * Call after gateway connects and entitlements are fetched.
   */
  init(entitledToolIds: string[], catalogTools: CatalogTool[]): void {
    this.entitledToolIds = entitledToolIds;

    // Only overwrite systemToolIds if gateway catalog has core tools;
    // otherwise keep the static pre-seeded list as fallback.
    const coreFromCatalog: string[] = [];
    const extensionsFromCatalog: string[] = [];

    for (const tool of catalogTools) {
      if (tool.source === "core") {
        coreFromCatalog.push(tool.id);
      } else if (tool.source === "plugin") {
        if (tool.pluginId && OUR_PLUGIN_IDS.has(tool.pluginId)) {
          continue; // Infrastructure plugins — exempted by capability-manager directly
        }
        extensionsFromCatalog.push(tool.id);
      }
    }

    if (coreFromCatalog.length > 0) {
      this.systemToolIds = coreFromCatalog;
    }
    this.customExtensionToolIds = extensionsFromCatalog;

    this.initialized = true;
    log.info(
      `Initialized: ${this.entitledToolIds.length} entitled, ` +
      `${this.systemToolIds.length} system, ` +
      `${this.customExtensionToolIds.length} custom extension tools`,
    );
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /** Update entitled tools independently of gateway init (e.g., on login/logout). */
  setEntitledToolIds(ids: string[]): void {
    this.entitledToolIds = ids;
  }

  // ── Tool catalog ──

  /** All available tool IDs = system ∪ extension ∪ entitled */
  getAllAvailableToolIds(): string[] {
    return [
      ...this.systemToolIds,
      ...this.customExtensionToolIds,
      ...this.entitledToolIds,
    ];
  }

  /**
   * Build the full tool list with display metadata for Panel UI.
   * @param entitledMeta Rich metadata for entitled tools from AuthSession.
   */
  getToolList(entitledMeta: EntitledToolMeta[]): ToolInfo[] {
    const metaMap = new Map<string, EntitledToolMeta>();
    for (const t of entitledMeta) {
      metaMap.set(t.id, t);
    }

    // Use resolver's entitledToolIds if available (post-init), otherwise fall back
    // to entitledMeta IDs (pre-init, gateway not connected yet but user is logged in)
    const entitledIds = this.entitledToolIds.length > 0
      ? this.entitledToolIds
      : entitledMeta.map(t => t.id);

    const systemMetaMap = new Map(SYSTEM_TOOL_CATALOG.map((t) => [t.id, t]));

    return [
      ...this.systemToolIds.map(id => {
        const meta = systemMetaMap.get(id);
        return {
          id,
          displayName: meta?.label ?? id,
          description: meta?.description ?? "",
          category: meta?.section ?? "SYSTEM",
          allowed: true,
          source: "system" as const,
        };
      }),
      ...this.customExtensionToolIds.map(id => ({
        id,
        displayName: id,
        description: "",
        category: "EXTENSION",
        allowed: true,
        source: "extension" as const,
      })),
      ...entitledIds.map(id => {
        const meta = metaMap.get(id);
        return {
          id,
          displayName: meta?.displayName ?? id,
          description: meta?.description ?? "",
          category: meta?.category ?? "ENTITLED",
          allowed: meta?.allowed ?? true,
          source: "entitled" as const,
        };
      }),
    ];
  }

  // ── Four-layer computation ──

  /**
   * Compute tool availability after Surface restriction (Layer 1 ∪ then ∩ Layer 2).
   * Surface = null means unrestricted (all tools pass).
   */
  computeSurfaceAvailability(surface: GQL.Surface | null): SurfaceAvailabilityResult {
    const allAvailable = this.getAllAvailableToolIds();

    // Surface = null → unrestricted (ChatPage, CronJob, OpenClaw native sessions)
    if (!surface) {
      return {
        allAvailableToolIds: allAvailable,
        surfaceId: "",
        surfaceAllowedToolIds: [],
        availableToolIds: allAvailable,
      };
    }

    // Surface with allowedToolIds (including empty []) → strict filtering
    const surfaceSet = new Set(surface.allowedToolIds.map(id => id.toUpperCase()));
    const availableToolIds = allAvailable.filter(id => toolIdInSet(id, surfaceSet));

    return {
      allAvailableToolIds: allAvailable,
      surfaceId: surface.id,
      surfaceAllowedToolIds: surface.allowedToolIds,
      availableToolIds,
    };
  }

  /**
   * Compute the final effective tool set (Layer 1 ∪ then ∩ Layer 2 ∩ Layer 3).
   * Surface = null → unrestricted (no surface filtering).
   * RunProfile = null → baseline only (system + extension, no entitled).
   *   Entitled tools require explicit opt-in via a RunProfile.
   */
  computeEffectiveTools(
    surface: GQL.Surface | null,
    runProfile: GQL.RunProfile | null,
  ): ToolCapabilityResult {
    const availability = this.computeSurfaceAvailability(surface);
    const availableSet = new Set(availability.availableToolIds);

    // No RunProfile → baseline tools only (system + extension, no entitled)
    const baselineToolIds = [...this.systemToolIds, ...this.customExtensionToolIds];
    const selectedToolIds = runProfile?.selectedToolIds ?? baselineToolIds;
    const effectiveToolIds = selectedToolIds.filter(id => toolIdInSet(id, availableSet));

    return {
      allAvailableToolIds: availability.allAvailableToolIds,
      entitledToolIds: this.entitledToolIds,
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
