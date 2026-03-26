import type { RouteHandler } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";
import { refreshCSShopContext } from "../cs-bridge/load-shop-contexts.js";

/**
 * Routes for CS bridge management.
 * Panel calls these after modifying shop CS config (businessPrompt, enabled, etc.).
 */
export const handleCSBridgeRoutes: RouteHandler = async (req, res, _url, pathname, ctx) => {

  // POST /api/cs-bridge/refresh-shop — refresh a single shop's CS context
  if (pathname === "/api/cs-bridge/refresh-shop" && req.method === "POST") {
    const body = await parseBody(req) as { shopId?: string };
    if (!body.shopId) {
      sendJson(res, 400, { error: "Missing shopId" });
      return true;
    }
    if (!ctx.csBridge || !ctx.authSession) {
      sendJson(res, 200, { ok: true, skipped: true }); // Bridge not running — no-op
      return true;
    }
    refreshCSShopContext(ctx.csBridge, ctx.authSession, body.shopId).catch(() => {});
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
};
