/**
 * Subset of the OpenClaw gateway `sessions.usage` RPC contract that Desktop
 * consumes. The gateway owns transcript storage and aggregation; Desktop only
 * reads the aggregated result over RPC and must never read transcripts itself.
 *
 * Source of truth: vendor `src/shared/usage-types.ts` (`SessionsUsageResult`).
 */

/** Token / cost totals as reported by the gateway (`CostUsageTotals`). */
export interface GatewayUsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
}

/** One provider/model bucket of `aggregates.byModel` (`SessionModelUsage`). */
export interface GatewayModelUsage {
  provider?: string;
  model?: string;
  count: number;
  totals: GatewayUsageTotals;
}

export interface GatewaySessionsUsageResult {
  aggregates: {
    byModel: GatewayModelUsage[];
  };
}

/** Params for the `sessions.usage` RPC (the gateway schema is a closed object). */
export type GatewaySessionsUsageParams = { agentScope: "all"; range: "all"; limit: number };

/** Request function injected into usage consumers; backed by the gateway RPC client. */
export type GatewayRequestFn = <T>(method: string, params?: unknown) => Promise<T>;
