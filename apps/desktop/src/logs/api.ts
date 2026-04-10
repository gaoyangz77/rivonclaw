import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { API } from "@rivonclaw/core/api-contract";
import { LOG_DIR } from "@rivonclaw/logger";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { sendJson } from "../infra/api/route-utils.js";
import { CloudRestError } from "../cloud/cloud-client.js";

const LOG_FILENAME = "rivonclaw.log";
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

const uploadLog: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.cloudClient) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }

  const logPath = join(LOG_DIR, LOG_FILENAME);

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(logPath);
  } catch {
    sendJson(res, 404, { error: "Log file not found" });
    return;
  }

  if (fileBuffer.length > MAX_UPLOAD_SIZE) {
    sendJson(res, 413, { error: "Log file too large" });
    return;
  }

  try {
    const data = await ctx.cloudClient.rest("/api/client-logs/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-filename": LOG_FILENAME,
      },
      body: fileBuffer,
    });
    sendJson(res, 200, data);
  } catch (err) {
    if (err instanceof CloudRestError) {
      sendJson(res, err.status, err.body ?? { error: err.message });
    } else {
      const message = err instanceof Error ? err.message : "Log upload failed";
      sendJson(res, 500, { error: message });
    }
  }
};

export function registerLogsHandlers(registry: RouteRegistry): void {
  registry.register(API["logs.upload"], uploadLog);
}
