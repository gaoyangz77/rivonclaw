/**
 * Client tool type definitions for local (Desktop) tools.
 *
 * ClientToolDef extends the codegen ToolSpec type directly — all metadata fields
 * (category, surfaces, runProfiles, etc.) inherit their types from GQL.ToolSpec,
 * ensuring compile-time consistency with the backend schema.
 *
 * Codegen enum consts (ToolCategory, SystemSurface, SystemRunProfile) are
 * re-exported here so local tool plugins can import them from a single subpath.
 */

import type { ToolSpec } from "./generated/graphql.js";

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
