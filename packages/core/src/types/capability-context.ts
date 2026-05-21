import type { ToolScopeType } from "./tool-selection.js";

// --- Unified Runtime Context ---

/** Authority mode for tool enforcement */
export type AuthorityMode = "local" | "remote";

/**
 * Unified agent run capability context — the single authority envelope per agent run.
 * Assembled by backend, cached and enforced by desktop.
 *
 * Four-layer progressive narrowing:
 *   effectiveTools = entitlement ∩ surface ∩ runProfile
 *
 * Business entity types (Surface, RunProfile, EntitlementSet, etc.) are defined
 * only in the backend (TypeGraphQL + Typegoose) and consumed on the frontend
 * via GraphQL codegen (ADR-027).
 */
export interface AgentRunCapabilityContext {
  // --- Run metadata (identity, not authority) ---
  scopeType: ToolScopeType;
  scopeKey: string;

  // --- Four-layer authority ---
  /** Layer 1: Tools the user is entitled to (from subscription) */
  entitledTools: string[];
  /** Layer 2: Surface this run operates within */
  surfaceId: string;
  /** Layer 2: Tools allowed by the surface */
  surfaceAllowedTools: string[];
  /** Layer 3: Tools selected for this run profile */
  runProfileSelectedTools: string[];
  /** Effective tools = entitlement ∩ surface ∩ runProfile (computed by backend) */
  effectiveTools: string[];

  // --- Domain-specific capability bindings (extensible) ---
  entitlementSnapshot?: Record<string, boolean>;
}

// --- Desktop Enforcement ---

/** Result of tool call enforcement check */
export interface ToolCallEnforcementResult {
  allowed: boolean;
  blockReason?: string;
}
