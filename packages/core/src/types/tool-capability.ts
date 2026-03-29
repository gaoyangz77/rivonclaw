/**
 * Tool Capability types — shared types for the four-layer tool authority model.
 *
 * These types are used by Desktop's ToolCapabilityModel and
 * pushed to the gateway's capability-manager plugin.
 */

/** Tool info from gateway catalog (tools.catalog RPC response) */
export interface CatalogTool {
  id: string;
  source: "core" | "plugin";
  pluginId?: string;
}

/** Result of computeSurfaceAvailability (Layer 1 ∪ then ∩ Layer 2) */
export interface SurfaceAvailabilityResult {
  /** All tools in the pool (entitled ∪ system ∪ custom) */
  allAvailableToolIds: string[];
  /** Surface restriction applied */
  surfaceId: string;
  surfaceAllowedToolIds: string[];
  /** Tools available after surface restriction — candidates for RunProfile selection */
  availableToolIds: string[];
}

/** Result of computeEffectiveTools (Layer 1 ∪ then ∩ Layer 2 ∩ Layer 3) */
export interface ToolCapabilityResult {
  /** All tools in the pool (entitled ∪ system ∪ custom) */
  allAvailableToolIds: string[];
  /** Paid tools from subscription */
  entitledToolIds: string[];
  /** System tools from gateway (read, write, exec, etc.) */
  systemToolIds: string[];
  /** User's custom extension tools */
  customExtensionToolIds: string[];
  /** Surface restriction applied */
  surfaceId: string;
  /** Tools allowed by surface (empty = unrestricted) */
  surfaceAllowedToolIds: string[];
  /** Tools selected by RunProfile (empty if no RunProfile) */
  runProfileSelectedToolIds: string[];
  /** Final result: the tools that can be used */
  effectiveToolIds: string[];
}
