/**
 * TikTok Shop Plugin
 *
 * Registers TikTok Shop customer service, order, product, logistics,
 * and shop management tools for the CS agent.
 *
 * Architecture:
 * - Extension is a thin client: tools call backend GraphQL API
 * - Backend is source of truth for TikTok API calls (ISV mode)
 * - ADR-032: CS tools enforce per-session data isolation at the tool layer
 *
 * Discovery: OpenClaw auto-discovers this plugin via the openclaw.plugin.json
 * manifest when the extensions/ directory is in plugins.load.paths.
 */

import { defineRivonClawPlugin } from "@rivonclaw/plugin-sdk";
import { getAllTools } from "./tools.js";

export default defineRivonClawPlugin({
  id: "tiktok-shop",
  name: "TikTok Shop",
  tools: getAllTools(),
  toolVisibility: "managed",

  setup(api) {
    const toolCount = getAllTools().length;
    api.logger.info(`TikTok Shop plugin loaded with ${toolCount} tools (includes buyer-scoped variants)`);
  },
});
