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
 * The ToolSpec shape is unified with the backend: same fields, same semantics.
 * Types are imported from GraphQL codegen (GQL namespace) — not redefined.
 */

import type { ToolSpec, ToolParamSpec, ToolContextBinding, ToolId, ToolCategory } from "./generated/graphql.js";

// ── Tool execution types (matches OpenClaw plugin-sdk ToolDef shape) ──────

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

type ToolExecuteFn = (toolCallId: string, args: unknown) => Promise<ToolResult>;

// ── Client tool definition ───────────────────────────────────────────────

/**
 * A client-side tool definition, combining ToolSpec metadata (for capability
 * resolver) with an execute function (for gateway plugin registration).
 *
 * Metadata fields mirror GQL.ToolSpec — the same shape the backend produces
 * via @Tool decorators. This ensures client and backend tools participate
 * identically in the surface/runProfile system.
 */
export interface ClientToolDef {
  // ── ToolSpec metadata (mirrors GQL.ToolSpec) ──
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  operationType?: string;
  surfaces?: string[];
  runProfiles?: string[];
  parameters?: ToolParamSpec[];
  contextBindings?: ToolContextBinding[];
  supportedPlatforms?: string[];

  // ── Gateway plugin fields (not in ToolSpec) ──
  /** If true, tool is only available to the device owner (not channel contacts). */
  ownerOnly?: boolean;
  /** TypeBox schema for gateway parameter validation. */
  gatewayParameters?: unknown;
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
    category: def.category as ToolCategory,
    operationType: def.operationType ?? "local",
    surfaces: def.surfaces,
    runProfiles: def.runProfiles,
    parameters: def.parameters ?? [],
    contextBindings: def.contextBindings,
    supportedPlatforms: def.supportedPlatforms,
    graphqlOperation: undefined,
    restMethod: undefined,
    restEndpoint: undefined,
    restContentType: undefined,
  }));
}
