/**
 * Client Tool Spec Loader -- RPC-based discovery
 *
 * After the gateway connects, calls the "get_client_tool_specs" RPC method
 * registered by rivonclaw-local-tools plugin. If the plugin isn't loaded
 * (private repo not available), the RPC fails silently -- no client tools.
 */

import { createLogger } from "@rivonclaw/logger";
import { rootStore } from "../app/store/desktop-store.js";

const log = createLogger("client-tool-loader");

const CLOUD_OWNED_CS_TOOL_IDS = new Set([
  "cs_escalate",
  "cs_respond",
  "cs_continue",
  "cs_get_escalation_result",
]);

/**
 * Load client tool specs from the gateway via RPC.
 * @param rpcClient - the gateway RPC client (available after gateway connects)
 */
export async function loadClientToolSpecs(
  rpcClient: { request: <T>(method: string, params?: unknown) => Promise<T> },
): Promise<void> {
  try {
    const result = await rpcClient.request<{ specs: Array<Record<string, unknown>> }>(
      "get_client_tool_specs",
    );
    const specs = (result.specs ?? []).filter((spec) => {
      const id = typeof spec.id === "string" ? spec.id : "";
      const name = typeof spec.name === "string" ? spec.name : "";
      return !CLOUD_OWNED_CS_TOOL_IDS.has(id) && !CLOUD_OWNED_CS_TOOL_IDS.has(name);
    });
    if (specs.length === 0) {
      log.info("No client tool specs from gateway (plugin may not be loaded)");
      return;
    }

    rootStore.loadClientToolSpecs(specs);
    log.info(`Loaded ${specs.length} client tool spec(s) via gateway RPC`);
  } catch (e) {
    // RPC method not registered (plugin not loaded) -- skip
    log.info("get_client_tool_specs RPC not available:", e instanceof Error ? e.message : e);
  }
}
