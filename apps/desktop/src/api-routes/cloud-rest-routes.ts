import type { IncomingMessage } from "node:http";
import type { RouteHandler } from "./api-context.js";
import { sendJson } from "./route-utils.js";
import { DEFAULTS } from "@rivonclaw/core";

/**
 * Parse raw binary body from an incoming request.
 */
function parseRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Generic REST proxy for cloud backend.
 *
 * Convention: strip "/cloud" from the path to get the backend endpoint.
 *   /api/cloud/tiktok/send-image  →  /api/tiktok/send-image
 *   /api/cloud/foo/bar            →  /api/foo/bar
 *
 * Extensions cannot call the cloud backend directly (no auth token),
 * so they POST to the panel-server which forwards with the JWT.
 */
export const handleCloudRestRoutes: RouteHandler = async (req, res, _url, pathname, ctx) => {
  if (!pathname.startsWith(DEFAULTS.api.cloudRestPrefix) || pathname === DEFAULTS.api.cloudGraphql) {
    return false;
  }

  if (!ctx.cloudClient) {
    sendJson(res, 401, { error: "Not authenticated" });
    return true;
  }

  // Strip "/cloud" → /api/cloud/tiktok/send-image → /api/tiktok/send-image
  const backendPath = pathname.replace("/cloud", "");

  const body = await parseRawBody(req);

  // Forward all custom headers (x-shop-id, x-conversation-id, etc.)
  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.startsWith("x-") || key === "content-type") {
      forwardHeaders[key] = value as string;
    }
  }
  if (!forwardHeaders["content-type"]) {
    forwardHeaders["content-type"] = "application/octet-stream";
  }

  try {
    const data = await ctx.cloudClient.rest(backendPath, {
      method: (req.method ?? "POST") as "GET" | "POST" | "PUT" | "DELETE",
      headers: forwardHeaders,
      body: body.length > 0 ? body : undefined,
    });
    sendJson(res, 200, data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud REST proxy error";
    const statusMatch = message.match(/Cloud REST error: (\d+)/);
    const status = statusMatch ? Number(statusMatch[1]) : 502;
    sendJson(res, status, { error: message });
  }
  return true;
};
