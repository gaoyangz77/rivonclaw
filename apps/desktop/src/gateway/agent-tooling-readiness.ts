import { openClawConnector } from "../openclaw/index.js";
import {
  loadGatewayToolCatalogTools,
  type GatewayCatalogTool,
  type LoadGatewayToolCatalogOptions,
} from "./tool-catalog-loader.js";

type RpcClientLike = Parameters<typeof loadGatewayToolCatalogTools>[0];

type LoggerLike = {
  info(message: string): void;
  warn(message: string, err?: unknown): void;
};

type AgentToolingReadinessDeps = Pick<
  LoadGatewayToolCatalogOptions,
  "maxAttempts" | "retryDelayMs" | "sleep"
> & {
  getRpc: () => RpcClientLike;
  isAuthenticated: () => boolean;
  initializeToolCapability: (catalogTools: GatewayCatalogTool[]) => Promise<void> | void;
  logger?: LoggerLike;
};

let deps: AgentToolingReadinessDeps | null = null;
let generation = 0;
let readyGeneration = -1;
let inflight: { generation: number; promise: Promise<void> } | null = null;

export function configureAgentToolingReadiness(nextDeps: AgentToolingReadinessDeps): void {
  deps = nextDeps;
}

export function __clearAgentToolingReadinessForTests(): void {
  deps = null;
  generation = 0;
  readyGeneration = -1;
  inflight = null;
}

export function resetAgentToolingReadiness(reason: string): void {
  generation += 1;
  readyGeneration = -1;
  inflight = null;
  deps?.logger?.info(`Agent tooling readiness reset: ${reason} (generation=${generation})`);
}

export async function ensureAgentToolingReady(): Promise<void> {
  if (!deps) {
    throw new Error("Agent tooling readiness has not been configured");
  }

  while (readyGeneration !== generation) {
    const currentGeneration = generation;
    if (!inflight || inflight.generation !== currentGeneration) {
      inflight = {
        generation: currentGeneration,
        promise: initializeForGeneration(currentGeneration),
      };
    }

    await inflight.promise;
  }
}

export async function requestAgent<T = unknown>(params: unknown, timeoutMs?: number): Promise<T> {
  if (deps) {
    await ensureAgentToolingReady();
  }
  if (timeoutMs === undefined) {
    return openClawConnector.request<T>("agent", params);
  }
  return openClawConnector.request<T>("agent", params, timeoutMs);
}

async function initializeForGeneration(targetGeneration: number): Promise<void> {
  const currentDeps = deps;
  if (!currentDeps) {
    throw new Error("Agent tooling readiness has not been configured");
  }

  try {
    const catalogTools = await loadGatewayToolCatalogTools(currentDeps.getRpc(), {
      waitForCloudTools: currentDeps.isAuthenticated(),
      maxAttempts: currentDeps.maxAttempts,
      retryDelayMs: currentDeps.retryDelayMs,
      logger: currentDeps.logger,
      sleep: currentDeps.sleep,
    });
    await currentDeps.initializeToolCapability(catalogTools);

    if (generation === targetGeneration) {
      readyGeneration = targetGeneration;
      currentDeps.logger?.info(`Agent tooling ready (generation=${targetGeneration})`);
    }
  } catch (err) {
    if (inflight?.generation === targetGeneration) {
      inflight = null;
    }
    currentDeps.logger?.warn(
      `Agent tooling readiness failed (generation=${targetGeneration})`,
      err,
    );
    throw err;
  }
}
