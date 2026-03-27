import type { GatewayRpcClient } from "@rivonclaw/gateway";

let _client: GatewayRpcClient | null = null;

export function setRpcClient(client: GatewayRpcClient | null): void {
  _client = client;
}

export function getRpcClient(): GatewayRpcClient | null {
  return _client;
}
