import type { IncomingMessage } from "node:http";
import type { RouteHandler } from "./api-context.js";
import { sendJson } from "./route-utils.js";

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
 * Proxy route for TikTok image upload.
 *
 * The extension cannot call the cloud backend directly (no auth token access),
 * so it POSTs the raw image to the panel-server which forwards with the user's
 * access token to the cloud backend REST endpoint.
 */
export const handleCloudTikTokRoutes: RouteHandler = async (req, res, _url, pathname, ctx) => {
  if (pathname === "/api/cloud/tiktok/upload-image" && req.method === "POST") {
    if (!ctx.cloudClient) {
      sendJson(res, 401, { error: "Not authenticated" });
      return true;
    }

    const shopId = req.headers["x-shop-id"] as string | undefined;
    if (!shopId) {
      sendJson(res, 400, { error: "Missing x-shop-id header" });
      return true;
    }

    const contentType = req.headers["content-type"] ?? "image/png";
    const imageBuffer = await parseRawBody(req);

    if (imageBuffer.length === 0) {
      sendJson(res, 400, { error: "Empty request body" });
      return true;
    }

    try {
      const data = await ctx.cloudClient.rest("/api/tiktok/upload-image", {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "x-shop-id": shopId,
        },
        body: imageBuffer,
      });
      sendJson(res, 200, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      // Extract status code from CloudClient error message if available
      const statusMatch = message.match(/Cloud REST error: (\d+)/);
      const status = statusMatch ? Number(statusMatch[1]) : 502;
      sendJson(res, status, { error: message });
    }
    return true;
  }

  return false;
};
