import type { RouteHandler } from "./api-context.js";
import { sendJson, parseBody } from "./route-utils.js";
import {
  ACCESS_MODE_KEY,
  DEFAULT_ACCESS_MODE,
  type AccessMode,
} from "@rivonclaw/core";

export const handleCreditsRoutes: RouteHandler = async (req, res, url, pathname, ctx) => {
  const { storage, creditsClient, creditsToken, onProviderChange } = ctx;

  // GET /api/credits/balance
  if (pathname === "/api/credits/balance" && req.method === "GET") {
    const token = creditsToken?.();
    if (!token || !creditsClient) {
      sendJson(res, 200, { balance: null, mode: storage.settings.get(ACCESS_MODE_KEY) ?? DEFAULT_ACCESS_MODE });
      return true;
    }
    try {
      const balance = await creditsClient.getBalance(token);
      sendJson(res, 200, { balance, mode: storage.settings.get(ACCESS_MODE_KEY) ?? DEFAULT_ACCESS_MODE });
    } catch {
      sendJson(res, 200, { balance: null, mode: storage.settings.get(ACCESS_MODE_KEY) ?? DEFAULT_ACCESS_MODE });
    }
    return true;
  }

  // GET /api/credits/history
  if (pathname === "/api/credits/history" && req.method === "GET") {
    const token = creditsToken?.();
    if (!token || !creditsClient) {
      sendJson(res, 200, { entries: [], total: 0 });
      return true;
    }
    try {
      const page = parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
      const limit = parseInt(url.searchParams.get("limit") ?? "20", 10) || 20;
      const data = await creditsClient.getHistory(token, page, limit);
      sendJson(res, 200, data);
    } catch {
      sendJson(res, 200, { entries: [], total: 0 });
    }
    return true;
  }

  // GET /api/credits/mode
  if (pathname === "/api/credits/mode" && req.method === "GET") {
    const mode = storage.settings.get(ACCESS_MODE_KEY) ?? DEFAULT_ACCESS_MODE;
    sendJson(res, 200, { mode });
    return true;
  }

  // POST /api/credits/mode
  if (pathname === "/api/credits/mode" && req.method === "POST") {
    const body = await parseBody(req) as { mode?: string };
    const validModes: AccessMode[] = ["credits", "coding-plan", "subscription"];
    if (!body.mode || !validModes.includes(body.mode as AccessMode)) {
      sendJson(res, 400, { error: "Invalid mode. Must be one of: credits, coding-plan, subscription" });
      return true;
    }
    storage.settings.set(ACCESS_MODE_KEY, body.mode);
    onProviderChange?.({ configOnly: true });
    sendJson(res, 200, { mode: body.mode });
    return true;
  }

  // POST /api/recharge/create (stub)
  if (pathname === "/api/recharge/create" && req.method === "POST") {
    sendJson(res, 200, { orderId: null, status: "unavailable", message: "充值功能即将上线，敬请期待" });
    return true;
  }

  return false;
};
