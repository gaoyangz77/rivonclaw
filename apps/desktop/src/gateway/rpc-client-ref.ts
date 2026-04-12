import type { GatewayRpcClient } from "@rivonclaw/gateway";
import { openClawConnector } from "../openclaw/index.js";

/**
 * Get the active RPC client via the OpenClawConnector.
 *
 * Returns null if the connector's RPC client is not connected.
 */
export function getRpcClient(): GatewayRpcClient | null {
  try {
    return openClawConnector.ensureRpcReady();
  } catch {
    return null;
  }
}

/** @deprecated Use openClawConnector directly. Retained as a no-op stub during migration. */
export function setRpcClient(_client: GatewayRpcClient | null): void {}

/**
 * Wait for the gateway RPC client to become ready.
 * Polls the connector at 200ms intervals until connected or timeout.
 *
 * @deprecated Callers should migrate to openClawConnector.ensureRpcReady()
 *   and observe runtimeStatusStore.openClawConnector.sidecarState.
 */
export async function waitForGatewayReady(timeoutMs = 15_000): Promise<GatewayRpcClient> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return openClawConnector.ensureRpcReady();
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error("Gateway RPC client not ready within timeout");
}
