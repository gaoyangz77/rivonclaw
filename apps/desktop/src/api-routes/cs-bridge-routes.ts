import type { RouteHandler } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";
import { refreshCSShopContext } from "../cs-bridge/load-shop-contexts.js";
import { getCsBridge } from "../gateway/gateway-connection.js";

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
    const bridge = getCsBridge();
    if (!bridge || !ctx.authSession) {
      sendJson(res, 200, { ok: true, skipped: true }); // Bridge not running — no-op
      return true;
    }
    refreshCSShopContext(bridge, ctx.authSession, body.shopId, ctx.deviceId ?? "unknown").catch(() => {});
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/cs-bridge/binding-status — get current shop binding conflicts
  if (pathname === "/api/cs-bridge/binding-status" && req.method === "GET") {
    const bridge = getCsBridge();
    if (!bridge) {
      sendJson(res, 200, { connected: false, conflicts: [] });
      return true;
    }
    sendJson(res, 200, {
      connected: true,
      conflicts: bridge.getBindingConflicts(),
    });
    return true;
  }

  // POST /api/cs-bridge/force-bind — force-bind a shop (take over from another device)
  if (pathname === "/api/cs-bridge/force-bind" && req.method === "POST") {
    const body = await parseBody(req) as { shopId?: string };
    if (!body.shopId) {
      sendJson(res, 400, { error: "Missing shopId" });
      return true;
    }
    getCsBridge()?.forceBindShop(body.shopId);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // POST /api/cs-bridge/unbind — unbind a shop from this device
  if (pathname === "/api/cs-bridge/unbind" && req.method === "POST") {
    const body = await parseBody(req) as { shopId?: string };
    if (!body.shopId) {
      sendJson(res, 400, { error: "Missing shopId" });
      return true;
    }
    getCsBridge()?.unbindShop(body.shopId);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
};
