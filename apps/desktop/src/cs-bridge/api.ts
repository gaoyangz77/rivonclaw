import { API } from "@rivonclaw/core/api-contract";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";
import { getCsBridge } from "../gateway/connection.js";
import { formatDetailedErrorMessage } from "../utils/error-format.js";
import {
  CS_ESCALATE_MUTATION,
  CS_GET_ESCALATION_RESULT_QUERY,
  CS_RESPOND_MUTATION,
} from "../cloud/cs-queries.js";

type CsEscalateMutationResult = {
  csEscalate: { ok: boolean; escalationId?: string | null; status?: string | null; error?: string | null };
};

type CsRespondMutationResult = {
  csRespond: { ok: boolean; escalationId?: string | null; status?: string | null; version?: number | null; error?: string | null };
};

type CsGetEscalationResultQueryResult = {
  csGetEscalationResult: unknown | null;
};

/**
 * Routes for CS bridge management.
 *
 * Session-level operations (escalate, escalation-result, start-conversation,
 * get-escalation) get a session from the bridge and call session methods directly.
 */

// ── POST /api/cs-bridge/sync ──

const sync: EndpointHandler = async (_req, res, _url, _params, _ctx) => {
  const bridge = getCsBridge();
  if (!bridge) {
    sendJson(res, 200, { ok: true, skipped: true });
    return;
  }
  bridge.syncFromCache();
  sendJson(res, 200, { ok: true });
};

// ── POST /api/cs-bridge/refresh-shop ──
// Shares the same logic as sync

const refreshShop: EndpointHandler = async (_req, res, _url, _params, _ctx) => {
  const bridge = getCsBridge();
  if (!bridge) {
    sendJson(res, 200, { ok: true, skipped: true });
    return;
  }
  bridge.syncFromCache();
  sendJson(res, 200, { ok: true });
};

// ── GET /api/cs-bridge/binding-status ──

const bindingStatus: EndpointHandler = async (_req, res, _url, _params, _ctx) => {
  const bridge = getCsBridge();
  if (!bridge) {
    sendJson(res, 200, { connected: false, conflicts: [] });
    return;
  }
  sendJson(res, 200, { connected: true, conflicts: bridge.getBindingConflicts() });
};

// ── POST /api/cs-bridge/unbind ──

const unbind: EndpointHandler = async (req, res, _url, _params, _ctx) => {
  const body = await parseBody(req) as { shopId?: string };
  if (!body.shopId) { sendJson(res, 400, { error: "Missing shopId" }); return; }
  getCsBridge()?.unbindShop(body.shopId);
  sendJson(res, 200, { ok: true });
};

// ── POST /api/cs-bridge/escalate ──

const escalate: EndpointHandler = async (req, res, _url, _params, _ctx) => {
  if (!_ctx.authSession) { sendJson(res, 401, { error: "Not authenticated" }); return; }

  const body = await parseBody(req) as Record<string, unknown>;
  const missing = ["shopId", "conversationId", "buyerUserId", "reason"]
    .filter((f) => !body[f] || typeof body[f] !== "string");
  if (missing.length > 0) {
    sendJson(res, 400, { error: `Missing required fields: ${missing.join(", ")}` });
    return;
  }

  try {
    const result = await _ctx.authSession.graphqlFetch(CS_ESCALATE_MUTATION, {
      shopId: body.shopId as string,
      conversationId: body.conversationId as string,
      buyerUserId: body.buyerUserId as string,
      reason: body.reason as string,
      orderId: typeof body.orderId === "string" ? body.orderId : undefined,
      context: typeof body.context === "string" ? body.context : undefined,
    }) as CsEscalateMutationResult;
    sendJson(res, result.csEscalate.ok ? 200 : 400, result.csEscalate);
  } catch (err) {
    sendJson(res, 500, { error: formatDetailedErrorMessage(err) });
  }
};

// ── POST /api/cs-bridge/escalation-result ──

const escalationResult: EndpointHandler = async (req, res, _url, _params, _ctx) => {
  if (!_ctx.authSession) { sendJson(res, 401, { error: "Not authenticated" }); return; }

  const body = await parseBody(req) as Record<string, unknown>;
  const missing = ["escalationId", "decision", "instructions"]
    .filter((f) => !body[f] || typeof body[f] !== "string");
  if (missing.length > 0) {
    sendJson(res, 400, { error: `Missing required fields: ${missing.join(", ")}` });
    return;
  }

  try {
    const result = await _ctx.authSession.graphqlFetch(CS_RESPOND_MUTATION, {
      escalationId: body.escalationId as string,
      decision: body.decision as string,
      instructions: body.instructions as string,
      resolved: body.resolved === true,
    }) as CsRespondMutationResult;
    sendJson(res, result.csRespond.ok ? 200 : 400, result.csRespond);
  } catch (err) {
    sendJson(res, 500, { error: formatDetailedErrorMessage(err) });
  }
};

// ── GET /api/cs-bridge/escalation/:id ──

const getEscalation: EndpointHandler = async (_req, res, _url, params, _ctx) => {
  if (!_ctx.authSession) { sendJson(res, 401, { error: "Not authenticated" }); return; }

  const escalationId = params.id!;
  if (!escalationId) {
    sendJson(res, 400, { error: "Missing escalation ID" });
    return;
  }

  try {
    const result = await _ctx.authSession.graphqlFetch(
      CS_GET_ESCALATION_RESULT_QUERY,
      { escalationId },
    ) as CsGetEscalationResultQueryResult;
    if (!result.csGetEscalationResult) {
      sendJson(res, 404, { error: `Escalation ${escalationId} not found` });
      return;
    }
    sendJson(res, 200, result.csGetEscalationResult);
  } catch (err) {
    sendJson(res, 500, { error: formatDetailedErrorMessage(err) });
  }
};

// ── POST /api/cs-bridge/start-conversation ──

const startConversation: EndpointHandler = async (req, res, _url, _params, _ctx) => {
  const bridge = getCsBridge();
  if (!bridge) { sendJson(res, 503, { error: "CS bridge not available" }); return; }

  const body = await parseBody(req) as Record<string, unknown>;
  const missing = ["shopId", "conversationId"]
    .filter((f) => !body[f] || typeof body[f] !== "string");
  if (missing.length > 0) {
    sendJson(res, 400, { error: `Missing required fields: ${missing.join(", ")}` });
    return;
  }

  try {
    const session = await bridge.getOrCreateSession(body.shopId as string, {
      conversationId: body.conversationId as string,
      buyerUserId: typeof body.buyerUserId === "string" ? body.buyerUserId : undefined,
      orderId: typeof body.orderId === "string" ? body.orderId : undefined,
    });
    const result = await session.dispatchCatchUp({
      operatorInstruction: typeof body.operatorInstruction === "string"
        ? body.operatorInstruction
        : undefined,
    });
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 500, { error: formatDetailedErrorMessage(err) });
  }
};

// ── Registration ──

export function registerCsBridgeHandlers(registry: RouteRegistry): void {
  registry.register(API["csBridge.sync"], sync);
  registry.register(API["csBridge.refreshShop"], refreshShop);
  registry.register(API["csBridge.bindingStatus"], bindingStatus);
  registry.register(API["csBridge.unbind"], unbind);
  registry.register(API["csBridge.escalate"], escalate);
  registry.register(API["csBridge.escalationResult"], escalationResult);
  registry.register(API["csBridge.escalation.get"], getEscalation);
  registry.register(API["csBridge.startConversation"], startConversation);
}
