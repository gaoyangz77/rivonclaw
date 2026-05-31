import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { sendJson } from "../infra/api/route-utils.js";
import { CloudRestError } from "../cloud/cloud-client.js";
import { LocalLogUploadError, uploadCurrentLog } from "./upload-current-log.js";

const log = createLogger("log-upload");

const uploadLog: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.cloudClient) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }

  try {
    const data = await uploadCurrentLog(ctx.cloudClient, { deviceId: ctx.deviceId });
    sendJson(res, 200, data);
  } catch (err) {
    if (err instanceof LocalLogUploadError) {
      sendJson(res, err.status, err.body);
    } else if (err instanceof CloudRestError) {
      log.error("Cloud REST error during log upload", { status: err.status, body: err.body });
      sendJson(res, err.status, err.body ?? { error: err.message });
    } else {
      const message = err instanceof Error ? err.message : "Log upload failed";
      log.error("Log upload failed", { error: message, stack: err instanceof Error ? err.stack : undefined });
      sendJson(res, 500, { error: message });
    }
  }
};

export function registerLogsHandlers(registry: RouteRegistry): void {
  registry.register(API["logs.upload"], uploadLog);
}
