/**
 * Capability Manager Plugin
 *
 * Unified enforcement and disclosure hook based on the four-layer
 * capability context model (W30).
 *
 * Architecture (synchronous HTTP pull pattern):
 * 1. before_tool_resolve / before_tool_call triggers
 * 2. Plugin calls Desktop HTTP: GET /api/tools/effective-tools?sessionKey=xxx
 * 3. Desktop's ToolCapabilityResolver computes effectiveTools
 * 4. Plugin uses result (cached per session for subsequent calls)
 * 5. before_tool_resolve filters LLM tool list to effectiveTools only (Layer 3)
 * 6. before_tool_call blocks unauthorized calls as defense-in-depth (Layer 4)
 *
 * ToolCapabilityResolver is the single source of truth.
 * This plugin is a pure executor — it does not make data decisions.
 */

import { defineRivonClawPlugin } from "@rivonclaw/plugin-sdk";
import {
  installOpenClawChannelRegistryGuard,
  restoreOpenClawChannelRegistryIfPolluted,
} from "./channel-registry-guard.js";

/** Desktop injects RIVONCLAW_PANEL_PORT into the gateway env at startup. */
const PANEL_BASE_URL = `http://127.0.0.1:${process.env.RIVONCLAW_PANEL_PORT || "3210"}`;

type PluginHookBeforeToolCallEvent = {
  toolName: string;
  params: Record<string, unknown>;
};

type PluginHookToolContext = {
  sessionKey?: string;
};

type PluginHookBeforeToolCallResult = {
  block?: boolean;
  blockReason?: string;
};

/**
 * Fetch effective tools from Desktop's ToolCapabilityResolver.
 * No caching — always fetches fresh to reflect mid-session RunProfile changes.
 * This is a localhost HTTP call with negligible latency.
 */
async function getEffectiveTools(sessionKey: string): Promise<string[] | null> {
  try {
    const res = await fetch(
      `${PANEL_BASE_URL}/api/tools/effective-tools?sessionKey=${encodeURIComponent(sessionKey)}`,
    );
    if (!res.ok) return null;
    const data = await res.json() as { effectiveToolIds?: string[] };
    return data.effectiveToolIds ?? [];
  } catch {
    return null;
  }
}

export default defineRivonClawPlugin({
  id: "rivonclaw-capability-manager",
  name: "Capability Manager",

  setup(api) {
    installOpenClawChannelRegistryGuard(api.logger);

    // ── before_tool_resolve: filter tool visibility (Layer 3) ──────
    // Removes tools not in effectiveTools from the LLM's tool list.
    // This is the primary disclosure control — the LLM only sees tools
    // the user has selected via the four-layer model.
    api.on(
      "before_tool_resolve",
      async (
        event: { tools: string[] },
        ctx: { sessionKey?: string },
      ) => {
        restoreOpenClawChannelRegistryIfPolluted("before_tool_resolve", api.logger);
        if (!ctx.sessionKey) return {};

        const effectiveTools = await getEffectiveTools(ctx.sessionKey);
        restoreOpenClawChannelRegistryIfPolluted("after effective-tools resolve", api.logger);
        if (!effectiveTools) {
          return { tools: [] };
        }

        const effectiveUpper = new Set(effectiveTools.map(t => t.toUpperCase()));
        const filtered = event.tools.filter(name => effectiveUpper.has(name.toUpperCase()));
        return { tools: filtered };
      },
    );

    // ── before_tool_call: enforcement (Layer 4 defense-in-depth) ──────
    api.on(
      "before_tool_call",
      async (
        event: PluginHookBeforeToolCallEvent,
        ctx: PluginHookToolContext,
      ): Promise<PluginHookBeforeToolCallResult | void> => {
        restoreOpenClawChannelRegistryIfPolluted("before_tool_call", api.logger);
        if (!ctx.sessionKey) return;

        const effectiveTools = await getEffectiveTools(ctx.sessionKey);
        if (!effectiveTools) {
          return {
            block: true,
            blockReason: "Could not resolve capability context",
          };
        }

        const toolUpper = event.toolName.toUpperCase();
        if (!effectiveTools.some(t => t.toUpperCase() === toolUpper)) {
          return {
            block: true,
            blockReason: `Tool "${event.toolName}" is not permitted in this run. It was excluded by the capability context (entitlement ∩ surface ∩ runProfile). Contact the workspace administrator to adjust permissions.`,
          };
        }

        return;
      },
      { priority: 50 },
    );

    // No cache lifecycle hooks needed — getEffectiveTools fetches fresh every time.
  },
});
