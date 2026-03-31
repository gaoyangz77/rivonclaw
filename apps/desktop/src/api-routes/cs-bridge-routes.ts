import type { RouteHandler } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";
import { getCsBridge } from "../gateway/gateway-connection.js";

/**
 * Routes for CS bridge management.
 * The bridge reactively syncs from the entity cache (populated by Panel's
 * GraphQL requests flowing through Desktop's proxy), so no explicit refresh
 * endpoint is needed for shop data. The routes below manage relay bindings.
 */
export const handleCSBridgeRoutes: RouteHandler = async (req, res, _url, pathname, _ctx) => {

  // POST /api/cs-bridge/sync — trigger a manual re-sync from entity cache
  // POST /api/cs-bridge/refresh-shop — backward-compatible alias (Panel calls this after mutations;
  //   with the reactive architecture the entity cache already handled it, but a manual sync is harmless)
  if ((pathname === "/api/cs-bridge/sync" || pathname === "/api/cs-bridge/refresh-shop") && req.method === "POST") {
    const bridge = getCsBridge();
    if (!bridge) {
      sendJson(res, 200, { ok: true, skipped: true });
      return true;
    }
    bridge.syncFromCache();
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

  // POST /api/cs-bridge/admin-directive — dispatch a verified manager directive to a CS agent session
  if (pathname === "/api/cs-bridge/admin-directive" && req.method === "POST") {
    const bridge = getCsBridge();
    if (!bridge) {
      sendJson(res, 503, { error: "CS bridge not available" });
      return true;
    }

    const body = await parseBody(req) as Record<string, unknown>;
    const missing = ["shopId", "conversationId", "buyerUserId", "decision", "instructions"]
      .filter((f) => !body[f] || typeof body[f] !== "string");
    if (missing.length > 0) {
      sendJson(res, 400, { error: `Missing required fields: ${missing.join(", ")}` });
      return true;
    }

    try {
      const result = await bridge.dispatchAdminDirective({
        shopId: body.shopId as string,
        conversationId: body.conversationId as string,
        buyerUserId: body.buyerUserId as string,
        decision: body.decision as string,
        instructions: body.instructions as string,
        orderId: typeof body.orderId === "string" ? body.orderId : undefined,
      });
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  // POST /api/cs-bridge/escalate — send escalation to merchant's configured channel
  if (pathname === "/api/cs-bridge/escalate" && req.method === "POST") {
    const bridge = getCsBridge();
    if (!bridge) {
      sendJson(res, 503, { error: "CS bridge not available" });
      return true;
    }

    const body = await parseBody(req) as Record<string, unknown>;
    const missing = ["shopId", "conversationId", "buyerUserId", "reason"]
      .filter((f) => !body[f] || typeof body[f] !== "string");
    if (missing.length > 0) {
      sendJson(res, 400, { error: `Missing required fields: ${missing.join(", ")}` });
      return true;
    }

    try {
      const result = await bridge.escalate({
        shopId: body.shopId as string,
        conversationId: body.conversationId as string,
        buyerUserId: body.buyerUserId as string,
        orderId: typeof body.orderId === "string" ? body.orderId : undefined,
        reason: body.reason as string,
        context: typeof body.context === "string" ? body.context : undefined,
      });
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  // POST /api/cs-bridge/start-session — manually start a CS session (catch-up for missed webhooks)
  if (pathname === "/api/cs-bridge/start-session" && req.method === "POST") {
    const bridge = getCsBridge();
    if (!bridge) {
      sendJson(res, 503, { error: "CS bridge not available" });
      return true;
    }

    const body = await parseBody(req) as Record<string, unknown>;
    const missing = ["shopId", "conversationId", "buyerUserId"]
      .filter((f) => !body[f] || typeof body[f] !== "string");
    if (missing.length > 0) {
      sendJson(res, 400, { error: `Missing required fields: ${missing.join(", ")}` });
      return true;
    }

    try {
      const result = await bridge.startSession({
        shopId: body.shopId as string,
        conversationId: body.conversationId as string,
        buyerUserId: body.buyerUserId as string,
        orderId: typeof body.orderId === "string" ? body.orderId : undefined,
      });
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }

  return false;
};
