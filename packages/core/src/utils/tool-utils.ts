/**
 * Tool name utilities.
 *
 * Backend ToolId values are UPPER_CASE (e.g. "TIKTOK_SEND_MESSAGE").
 * Extension tool names are the lowercase equivalent ("tiktok_send_message").
 * This module provides the canonical conversion so extensions never hardcode
 * tool name strings.
 */

import type { ToolId } from "../generated/graphql.js";

/**
 * Convert a ToolId enum value to the lowercase tool name used by extensions.
 *
 * @example
 * ```ts
 * import { GQL, toolName } from "@rivonclaw/core";
 * const name = toolName(GQL.ToolId.TIKTOK_SEND_MESSAGE); // "tiktok_send_message"
 * ```
 */
export function toolName(id: ToolId): string {
  return id.toLowerCase();
}
