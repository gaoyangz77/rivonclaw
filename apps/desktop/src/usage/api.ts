import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { sendJson } from "../infra/api/route-utils.js";

const log = createLogger("panel-server");

const getKeyUsage: EndpointHandler = async (_req, res, url, _params, ctx: ApiContext) => {
  const { queryService } = ctx;
  if (!queryService) {
    sendJson(res, 501, { error: "Per-key usage tracking not available" });
    return;
  }
  try {
    const windowStart = url.searchParams.get("windowStart");
    const windowEnd = url.searchParams.get("windowEnd");
    const results = await queryService.queryUsage({
      windowStart: windowStart ? Number(windowStart) : 0,
      windowEnd: windowEnd ? Number(windowEnd) : Date.now(),
      keyId: url.searchParams.get("keyId") ?? undefined,
      provider: url.searchParams.get("provider") ?? undefined,
      model: url.searchParams.get("model") ?? undefined,
    });
    sendJson(res, 200, results);
  } catch (err) {
    log.error("Failed to query key usage:", err);
    sendJson(res, 500, { error: "Failed to query key usage" });
  }
};

const getActiveKey: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  const { storage } = ctx;
  try {
    const activeKey = storage.providerKeys.getActive();
    sendJson(
      res,
      200,
      activeKey
        ? {
            keyId: activeKey.id,
            keyLabel: activeKey.label,
            provider: activeKey.provider,
            model: activeKey.model,
            authType: activeKey.authType ?? "api_key",
          }
        : null,
    );
  } catch (err) {
    log.error("Failed to get active key:", err);
    sendJson(res, 500, { error: "Failed to get active key" });
  }
};

const getTimeseries: EndpointHandler = async (_req, res, url, _params, ctx: ApiContext) => {
  const { queryService } = ctx;
  if (!queryService) {
    sendJson(res, 501, { error: "Per-key usage tracking not available" });
    return;
  }
  try {
    const windowStart = Number(url.searchParams.get("windowStart")) || 0;
    const windowEnd = Number(url.searchParams.get("windowEnd")) || Date.now();
    const buckets = queryService.queryTimeseries({ windowStart, windowEnd });
    sendJson(res, 200, buckets);
  } catch (err) {
    log.error("Failed to query key usage timeseries:", err);
    sendJson(res, 500, { error: "Failed to query key usage timeseries" });
  }
};

export function registerUsageHandlers(registry: RouteRegistry): void {
  registry.register(API["usage.keyUsage"], getKeyUsage);
  registry.register(API["usage.activeKey"], getActiveKey);
  registry.register(API["usage.timeseries"], getTimeseries);
}
