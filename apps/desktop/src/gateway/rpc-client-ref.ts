import type { GatewayRpcClient } from "@rivonclaw/gateway";

let _client: GatewayRpcClient | null = null;

export function setRpcClient(client: GatewayRpcClient | null): void {
  _client = client;
}

export function getRpcClient(): GatewayRpcClient | null {
  return _client;
}

/**
 * Wait until the Desktop → Gateway RPC connection is established and ready.
 *
 * - **Idempotent**: resolves immediately if already connected.
 * - **Timeout-aware**: rejects with an error if the connection is not ready
 *   within `timeoutMs` milliseconds.
 *
 * Uses polling (200 ms interval) because the RPC client exposes an
 * `onConnect` callback but no event emitter that external callers can
 * subscribe to after construction.
 */
export async function waitForGatewayReady(timeoutMs = 30_000): Promise<GatewayRpcClient> {
  const rpc = getRpcClient();
  if (rpc?.isConnected()) return rpc;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
    const rpc = getRpcClient();
    if (rpc?.isConnected()) return rpc;
  }
  throw new Error(`Gateway not ready within ${timeoutMs}ms`);
}
