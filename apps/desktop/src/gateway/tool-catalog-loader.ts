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

type LoggerLike = {
  info(message: string): void;
  warn(message: string, err?: unknown): void;
};

export type LoadGatewayToolCatalogOptions = {
  waitForCloudTools?: boolean;
  maxAttempts?: number;
  retryDelayMs?: number;
  logger?: LoggerLike;
  sleep?: (ms: number) => Promise<void>;
};

export async function loadGatewayToolCatalogTools(
  rpc: RpcClientLike,
  options: LoadGatewayToolCatalogOptions = {},
): Promise<GatewayCatalogTool[]> {
  const waitForCloudTools = options.waitForCloudTools ?? true;
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_CLOUD_TOOLS_CATALOG_ATTEMPTS);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_CLOUD_TOOLS_CATALOG_RETRY_MS);
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const tools = flattenGatewayCatalog(
      await rpc.request<GatewayCatalog>("tools.catalog", { includePlugins: true }),
    );

    if (!waitForCloudTools) return tools;

    if (hasCloudTools(tools)) {
      const status = await getCloudToolsStatus(rpc);
      if (status.ready) {
        if (attempt > 1) {
          options.logger?.info(`Cloud tools became ready after ${attempt} attempt(s)`);
        }
        return tools;
      }

      if (attempt < maxAttempts) {
        options.logger?.info(
          `Gateway tools.catalog includes ${CLOUD_TOOLS_PLUGIN_ID}, but ToolSpecs are not ready yet; retrying (${attempt}/${maxAttempts})`,
        );
      }
    } else {
      if (attempt < maxAttempts) {
        options.logger?.info(
          `Gateway tools.catalog does not include ${CLOUD_TOOLS_PLUGIN_ID} yet; retrying (${attempt}/${maxAttempts})`,
        );
      }
    }

    if (attempt === maxAttempts) {
      options.logger?.warn(
        `Gateway ${CLOUD_TOOLS_PLUGIN_ID} tools were not ready after ${maxAttempts} attempt(s); initializing ToolCapability with the latest catalog`,
      );
      return tools;
    }

    await sleep(retryDelayMs);
  }

  return [];
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

function hasCloudTools(tools: readonly GatewayCatalogTool[]): boolean {
  return tools.some((tool) => tool.source === "plugin" && tool.pluginId === CLOUD_TOOLS_PLUGIN_ID);
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
