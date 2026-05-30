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

export type GatewayStartupTask = {
  name: string;
  requiresCloudTools?: boolean;
  run: () => Promise<void> | void;
};

export type RunGatewayStartupCoordinatorOptions = Pick<
  LoadGatewayToolCatalogOptions,
  "maxAttempts" | "retryDelayMs" | "sleep"
> & {
  rpc: RpcClientLike;
  logger?: LoggerLike;
  waitForCloudTools?: boolean;
  initializeToolCapability?: (catalogTools: GatewayCatalogTool[]) => Promise<void> | void;
  ensureAgentToolingReady?: () => Promise<void>;
  tasks?: readonly GatewayStartupTask[];
};

export async function runGatewayStartupCoordinator(
  options: RunGatewayStartupCoordinatorOptions,
): Promise<void> {
  const tasks = options.tasks ?? [];
  const waitForCloudTools =
    options.waitForCloudTools === true || tasks.some((task) => task.requiresCloudTools === true);

  if (options.ensureAgentToolingReady) {
    await options.ensureAgentToolingReady();
  } else if (options.initializeToolCapability) {
    const catalogTools = await loadGatewayToolCatalogTools(options.rpc, {
      waitForCloudTools,
      maxAttempts: options.maxAttempts,
      retryDelayMs: options.retryDelayMs,
      logger: options.logger,
      sleep: options.sleep,
    });

    await options.initializeToolCapability(catalogTools);
  }

  for (const task of tasks) {
    try {
      await task.run();
    } catch (err) {
      options.logger?.warn(`Gateway startup task failed: ${task.name}`, err);
    }
  }
}
