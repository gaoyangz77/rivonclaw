import { createLogger } from "@rivonclaw/logger";

const log = createLogger("cloud-tools-runtime");

export const CLOUD_TOOLS_RELOAD_METHOD = "rivonclaw_cloud_tools.reload";

export type CloudToolsRpcClient = {
  request(method: string, params?: unknown): Promise<unknown>;
};

export async function reloadCloudToolsFromSpecs(params: {
  rpc: CloudToolsRpcClient;
  toolSpecs: readonly Record<string, unknown>[];
  revision?: string | null;
  digest?: string | null;
}): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
  try {
    const payload = await params.rpc.request(CLOUD_TOOLS_RELOAD_METHOD, {
      toolSpecs: params.toolSpecs,
      revision: params.revision ?? params.digest ?? null,
      digest: params.digest ?? null,
    });
    log.info(`Pushed ${params.toolSpecs.length} ToolSpec(s) to cloud-tools plugin`);
    return { ok: true, payload };
  } catch (err) {
    log.warn("Failed to push ToolSpecs to cloud-tools plugin", err);
    return { ok: false, error: err };
  }
}
