export const CLOUD_TOOLS_PLUGIN_ID = "rivonclaw-cloud-tools";
export const CLOUD_TOOLS_STATUS_METHOD = "rivonclaw_cloud_tools.status";

const DEFAULT_CLOUD_TOOLS_CATALOG_ATTEMPTS = 8;
const DEFAULT_CLOUD_TOOLS_CATALOG_RETRY_MS = 1_000;

export type GatewayCatalogTool = {
  id: string;
  source: "core" | "plugin";
  pluginId?: string;
};

type GatewayCatalog = {
  groups?: Array<{
    tools?: Array<{
      id?: unknown;
      source?: unknown;
      pluginId?: unknown;
    }>;
  }>;
};

type RpcClientLike = {
  request<T>(method: string, params?: unknown): Promise<T>;
};

type CloudToolsStatus = {
  ready?: unknown;
  toolCount?: unknown;
};

export class CloudToolsNotReadyError extends Error {
  constructor(
    readonly attempts: number,
    readonly pluginToolCount: number,
    readonly catalogToolCount: number,
  ) {
    super(
      `Gateway ${CLOUD_TOOLS_PLUGIN_ID} was not ready after ${attempts} attempt(s) ` +
        `(plugin=${pluginToolCount}, catalog=${catalogToolCount})`,
    );
    this.name = "CloudToolsNotReadyError";
  }
}

type LoggerLike = {
  info(message: string): void;
  warn(message: string, err?: unknown): void;
};

export type LoadGatewayToolCatalogOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
  logger?: LoggerLike;
  sleep?: (ms: number) => Promise<void>;
};

export async function loadGatewayToolCatalogTools(
  rpc: RpcClientLike,
  options: LoadGatewayToolCatalogOptions = {},
): Promise<GatewayCatalogTool[]> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_CLOUD_TOOLS_CATALOG_ATTEMPTS);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_CLOUD_TOOLS_CATALOG_RETRY_MS);
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const tools = flattenGatewayCatalog(
      await rpc.request<GatewayCatalog>("tools.catalog", { includePlugins: true }),
    );

    const status = await getCloudToolsStatus(rpc);
    const catalogToolCount = countCloudTools(tools);
    if (status.ready && status.toolCount === catalogToolCount) {
      if (attempt > 1) {
        options.logger?.info(`Cloud tools became ready after ${attempt} attempt(s)`);
      }
      return tools;
    }

    if (attempt < maxAttempts) {
      options.logger?.info(
        status.ready
          ? `Gateway ${CLOUD_TOOLS_PLUGIN_ID} catalog is not synchronized yet ` +
              `(plugin=${status.toolCount}, catalog=${catalogToolCount}); retrying (${attempt}/${maxAttempts})`
          : `Gateway ${CLOUD_TOOLS_PLUGIN_ID} has not received ToolSpecs yet; retrying (${attempt}/${maxAttempts})`,
      );
    }

    if (attempt === maxAttempts) {
      const error = new CloudToolsNotReadyError(
        maxAttempts,
        status.toolCount,
        catalogToolCount,
      );
      options.logger?.warn(
        `${error.message}; refusing to initialize ToolCapability with an incomplete catalog`,
        error,
      );
      throw error;
    }

    await sleep(retryDelayMs);
  }

  throw new CloudToolsNotReadyError(maxAttempts, 0, 0);
}

function flattenGatewayCatalog(catalog: GatewayCatalog): GatewayCatalogTool[] {
  const tools: GatewayCatalogTool[] = [];
  for (const group of catalog.groups ?? []) {
    for (const tool of group.tools ?? []) {
      if (typeof tool.id !== "string") continue;
      if (tool.source !== "core" && tool.source !== "plugin") continue;
      tools.push({
        id: tool.id,
        source: tool.source,
        ...(typeof tool.pluginId === "string" ? { pluginId: tool.pluginId } : {}),
      });
    }
  }
  return tools;
}

function countCloudTools(tools: readonly GatewayCatalogTool[]): number {
  return tools.filter(
    (tool) => tool.source === "plugin" && tool.pluginId === CLOUD_TOOLS_PLUGIN_ID,
  ).length;
}

async function getCloudToolsStatus(
  rpc: RpcClientLike,
): Promise<{ ready: boolean; toolCount: number }> {
  try {
    const status = await rpc.request<CloudToolsStatus>(CLOUD_TOOLS_STATUS_METHOD);
    return {
      ready: status.ready === true,
      toolCount: typeof status.toolCount === "number" ? status.toolCount : 0,
    };
  } catch {
    return { ready: false, toolCount: 0 };
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
