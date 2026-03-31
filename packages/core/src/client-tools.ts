/**
 * Client tool registry — declarative tool definitions for local (Desktop) tools.
 *
 * Pattern mirrors backend's @Tool decorator (server/backend/src/decorators/tool.ts):
 * - Backend: @Tool(id, { category, surfaces, runProfiles, ... }) on resolver methods
 *   → metadata extracted → served via GraphQL ToolSpec
 * - Client: defineClientTool({ id, category, surfaces, ... , execute })
 *   → registered in global registry → rivonclaw-local-tools plugin collects for gateway
 *   → ToolSpec metadata injected into MST for capability resolver
 *
 * ClientToolDef extends the codegen ToolSpec type directly — all metadata fields
 * (category, surfaces, runProfiles, etc.) inherit their types from GQL.ToolSpec,
 * ensuring compile-time consistency with the backend schema.
 */

import type { ToolSpec, ToolId } from "./generated/graphql.js";

// Re-export codegen enum consts for use by local tool definitions.
// These are the same values the backend uses via @Tool decorators.
export { ToolCategory, SystemSurface, SystemRunProfile } from "./generated/graphql.js";

// ── Tool execution types (matches OpenClaw plugin-sdk ToolDef shape) ──────

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

type ToolExecuteFn = (toolCallId: string, args: unknown) => Promise<ToolResult>;

// ── Client tool definition ───────────────────────────────────────────────

/**
 * A client-side tool definition, extending GQL.ToolSpec with execution fields.
 *
 * Metadata fields come directly from ToolSpec (via Partial + required overrides).
 * `id` is broadened to `string` because local tool IDs are not in the backend
 * ToolId enum. All other fields (category, surfaces, runProfiles, etc.) keep
 * their exact codegen types.
 */
export interface ClientToolDef extends Omit<Partial<ToolSpec>, "id" | "parameters"> {
  // ── Required metadata (same types as ToolSpec, id broadened for local tools) ──
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: ToolSpec["category"];

  /**
   * Tool parameter schema — TypeBox TObject for gateway registration.
   * Gateway reads `.properties` from this to build the tool's input schema.
   * This overrides ToolSpec.parameters (ToolParamSpec[]) because the gateway
   * needs the TypeBox schema, not the GraphQL param spec array.
   */
  parameters?: Record<string, unknown>;

  // ── Gateway plugin fields (not in ToolSpec) ──
  /** If true, tool is only available to the device owner (not channel contacts). */
  ownerOnly?: boolean;
  /** Tool implementation — called by the gateway when the agent invokes this tool. */
  execute: ToolExecuteFn;
}

// ── Registry ─────────────────────────────────────────────────────────────

const registry: ClientToolDef[] = [];

/**
 * Define and register a client-side tool.
 * Call at module scope — the tool is added to the global registry
 * and will be picked up by rivonclaw-local-tools plugin.
 */
export function defineClientTool(def: ClientToolDef): ClientToolDef {
  registry.push(def);
  return def;
}

/**
 * Get all registered client tools (for gateway plugin registration).
 * Called by rivonclaw-local-tools to build the tools array.
 */
export function getClientTools(): ClientToolDef[] {
  return [...registry];
}

/**
 * Extract ToolSpec-compatible metadata from all registered client tools.
 * Called by Desktop to inject client tool specs into MST alongside
 * backend-provided toolSpecs, so the capability resolver can manage them
 * in the same surface/runProfile system.
 */
export function getClientToolSpecs(): ToolSpec[] {
  return registry.map((def) => ({
    id: def.id as ToolId,
    name: def.name,
    displayName: def.displayName,
    description: def.description,
    category: def.category,
    operationType: def.operationType ?? "local",
    surfaces: def.surfaces,
    runProfiles: def.runProfiles,
    parameters: [],
    contextBindings: def.contextBindings,
    supportedPlatforms: def.supportedPlatforms,
    graphqlOperation: undefined,
    restMethod: undefined,
    restEndpoint: undefined,
    restContentType: undefined,
  }));
}
