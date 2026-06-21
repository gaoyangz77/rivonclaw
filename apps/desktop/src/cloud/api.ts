import type { IncomingMessage } from "node:http";
import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import { rootStore } from "../app/store/desktop-store.js";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";
import { CloudRestError } from "./cloud-client.js";

const log = createLogger("cloud-graphql-proxy");

// ── Deletion mutation map ────────────────────────────────────────────────────
// Maps GraphQL operation names to __typename so the proxy can remove entities
// from Desktop MST after a successful delete mutation.
// (ingestGraphQLResponse skips boolean responses — this fills the gap.)
const DELETION_MUTATION_MAP: Record<string, string> = {
  DeleteShop: "Shop",
  DisconnectAdsAdvertiser: "AdsAdvertiser",
  DeleteSurface: "Surface",
  DeleteRunProfile: "RunProfile",
};

// ── ToolSpecs dedup cache ───────────────────────────────────────────────────
// ToolSpecs is stable data queried by both Panel and plugin on startup.
// Cache it briefly to coalesce concurrent requests into a single backend call.
const TOOLSPECS_CACHE_TTL_MS = 5_000;
const TOOLSPECS_OP_NAME = "ToolSpecsSync";
const AFFILIATE_RESOLVE_WORK_ITEM_OP_NAME = "ResolveAffiliateWorkItem";
const MODULE_ENROLLMENT_OP_NAMES = new Set(["EnrollModule", "UnenrollModule"]);
let toolSpecsCache: { data: unknown; ts: number; inflight?: Promise<unknown> } | null = null;

function extractOperationName(query: string): string | null {
  const m = query.match(/(?:query|mutation)\s+(\w+)/);
  return m?.[1] ?? null;
}

function isModuleEnrollmentOperation(opName: string | null): boolean {
  return opName !== null && MODULE_ENROLLMENT_OP_NAMES.has(opName);
}

function runAuthChangeInBackground(ctx: ApiContext): void {
  if (!ctx.onAuthChange) return;
  try {
    void Promise.resolve(ctx.onAuthChange("module-enrollment")).catch((err: unknown) => {
      log.warn("Background auth change after module enrollment failed", err);
    });
  } catch (err) {
    log.warn("Background auth change after module enrollment failed", err);
  }
}

function hasAllowedAccountLlmEntitlement(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const overview = (data as { billingOverview?: unknown }).billingOverview;
  if (!overview || typeof overview !== "object") return false;
  const accountLlm = (overview as { accountLlm?: unknown }).accountLlm;
  if (!accountLlm || typeof accountLlm !== "object") return false;
  const entitlement = (accountLlm as { entitlement?: unknown }).entitlement;
  return !!entitlement
    && typeof entitlement === "object"
    && (entitlement as { allowed?: unknown }).allowed === true;
}

function runCloudLlmEntitlementSyncInBackground(ctx: ApiContext): void {
  if (!ctx.authSession?.getAccessToken() || !ctx.onCloudLlmEntitlementAvailable) return;
  try {
    void Promise.resolve(ctx.onCloudLlmEntitlementAvailable()).catch((err: unknown) => {
      log.warn("Background cloud LLM provider sync after billing refresh failed", err);
    });
  } catch (err) {
    log.warn("Background cloud LLM provider sync after billing refresh failed", err);
  }
}

function sanitizeCloudGraphqlVariables(
  opName: string | null,
  variables: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!variables || (opName !== AFFILIATE_RESOLVE_WORK_ITEM_OP_NAME && !looksLikeAffiliateResolveWorkItemVariables(variables))) {
    return variables;
  }

  const input = asRecord(variables.input);
  if (!input || input.decision !== "REQUEST_ACTION") return variables;

  const actionLike = input.action != null ? [input.action] : Array.isArray(input.actions) ? input.actions : [];
  const context = buildAffiliateResolveActionContext(input);
  const normalizedActions = actionLike.map((action) => normalizeAffiliateResolveAction(action, context));
  const hasNormalizedAction = normalizedActions.some((action, index) => action !== actionLike[index]);
  if (actionLike.length > 0 && normalizedActions.every((action) => !isInvalidAffiliateResolveAction(action))) {
    if (!hasNormalizedAction) return variables;
    log.info("Normalized affiliate resolve work item action payload before proxying to backend");
    return {
      ...variables,
      input: {
        ...input,
        action: input.action != null ? normalizedActions[0] : undefined,
        actions: Array.isArray(input.actions) ? normalizedActions : undefined,
      },
    };
  }

  if (actionLike.length === 0 || normalizedActions.some(isInvalidAffiliateResolveAction)) {
    const reason =
      "Desktop blocked an invalid affiliate action payload before sending it to backend. " +
      "The agent attempted REQUEST_ACTION but omitted required typed action fields. " +
      "This is a tool payload schema error, not a business reason for NEEDS_STAFF_REVIEW. " +
      "Retry affiliate_resolve_work_item with decision REQUEST_ACTION and the corrected typed action. " +
      "For SEND_MESSAGE use action.messageText with the exact creator-facing message; never send messageIntent: {}. " +
      "For REVIEW_SAMPLE_APPLICATION use action.sampleReviewIntent with sampleApplicationRecordId, platformApplicationId, decision, and optional rejectReason.";
    throw new Error(
      `${reason} raw=${describeAffiliateResolveActionShape(actionLike)} normalized=${describeAffiliateResolveActionShape(normalizedActions)} ${describeAffiliateResolveActionRepairHint(context)}`,
    );
  }

  return variables;
}

function looksLikeAffiliateResolveWorkItemVariables(variables: Record<string, unknown>): boolean {
  const input = asRecord(variables.input);
  if (!input) return false;
  return (
    typeof input.decision === "string" &&
    (hasNonEmptyString(input.collaborationRecordId) ||
      hasNonEmptyString(input.shopId) ||
      input.action != null ||
      Array.isArray(input.actions))
  );
}

interface AffiliateResolveActionContext {
  collaborationRecordId?: string;
  sampleApplicationRecordId?: string;
  platformApplicationId?: string;
  predictionCacheIds?: string[];
}

function buildAffiliateResolveActionContext(input: Record<string, unknown>): AffiliateResolveActionContext {
  const collaborationRecordId = firstNonEmptyString(input.collaborationRecordId);
  const context: AffiliateResolveActionContext = {
    collaborationRecordId: collaborationRecordId ?? undefined,
    predictionCacheIds: Array.isArray(input.predictionCacheIds)
      ? input.predictionCacheIds.filter(hasNonEmptyString)
      : undefined,
  };

  const collaboration = collaborationRecordId
    ? rootStore.affiliateWorkspace.getCollaborationRecord(collaborationRecordId)
    : null;
  if (!collaboration) return context;

  const directSample = rootStore.affiliateWorkspace.getSampleApplicationRecord(
    collaboration.sampleApplicationRecordId,
  );
  const linkedSample = directSample
    ?? rootStore.affiliateWorkspace.sampleApplicationsForCollaboration(collaboration)[0]
    ?? null;

  if (linkedSample?.id) context.sampleApplicationRecordId = linkedSample.id;
  if (linkedSample?.platformApplicationId) {
    context.platformApplicationId = linkedSample.platformApplicationId;
  }

  return context;
}

function normalizeAffiliateResolveAction(
  value: unknown,
  context?: AffiliateResolveActionContext,
): unknown {
  const action = asRecord(value);
  if (!action) return value;
  const actionType = normalizeAffiliateActionType(action.type);
  if (!actionType) return value;

  switch (actionType) {
    case "SEND_MESSAGE":
      return normalizeAffiliateSendMessageAction({ ...action, type: actionType });
    case "REVIEW_SAMPLE_APPLICATION":
      return normalizeAffiliateSampleReviewAction({ ...action, type: actionType }, context);
    case "CREATE_TARGET_COLLABORATION":
      return normalizeAffiliateTargetCollaborationAction({ ...action, type: actionType });
    default:
      return value;
  }
}

function normalizeAffiliateActionType(value: unknown): string | null {
  return typeof value === "string" ? value.trim().toUpperCase() : null;
}

function normalizeAffiliateSampleReviewAction(
  action: Record<string, unknown>,
  context?: AffiliateResolveActionContext,
): unknown {
  const existingIntent = asRecord(action.sampleReviewIntent);
  if (existingIntent && !isInvalidAffiliateResolveAction(action)) {
    return pickAffiliateActionFields(action, "sampleReviewIntent", existingIntent);
  }

  const sampleApplicationRecordId = firstNonEmptyString(
    existingIntent?.sampleApplicationRecordId,
    action.sampleApplicationRecordId,
    context?.sampleApplicationRecordId,
  );
  const platformApplicationId = firstNonEmptyString(
    existingIntent?.platformApplicationId,
    action.platformApplicationId,
    context?.platformApplicationId,
  );
  const decision = firstNormalizedSampleReviewDecision(
    existingIntent?.decision ??
      existingIntent?.reviewDecision ??
      existingIntent?.sampleDecision,
    action.decision,
    action.reviewDecision,
    action.sampleDecision,
  );
  const rejectReason = firstNonEmptyString(
    existingIntent?.rejectReason,
    action.rejectReason,
    action.reason,
    action.reject_reason,
  );
  if (
    !sampleApplicationRecordId ||
    !platformApplicationId ||
    !decision
  ) {
    return action;
  }

  const sampleReviewIntent: Record<string, unknown> = {
    sampleApplicationRecordId,
    platformApplicationId,
    decision,
  };
  if (hasNonEmptyString(rejectReason)) {
    sampleReviewIntent.rejectReason = rejectReason;
  } else if (decision === "REJECT") {
    sampleReviewIntent.rejectReason = "OTHER";
  }
  return pickAffiliateActionFields(action, "sampleReviewIntent", sampleReviewIntent);
}

function normalizeSampleReviewDecision(value: unknown): "APPROVE" | "REJECT" | null {
  if (!hasNonEmptyString(value)) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "APPROVE" || normalized === "APPROVED" || normalized === "ACCEPT") {
    return "APPROVE";
  }
  if (normalized === "REJECT" || normalized === "REJECTED" || normalized === "DECLINE" || normalized === "DENY" || normalized === "DENIED") {
    return "REJECT";
  }
  return null;
}

function firstNormalizedSampleReviewDecision(
  ...values: unknown[]
): "APPROVE" | "REJECT" | null {
  for (const value of values) {
    const normalized = normalizeSampleReviewDecision(value);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeAffiliateSendMessageAction(action: Record<string, unknown>): unknown {
  const existingIntent = asRecord(action.messageIntent);
  if (existingIntent) {
    const messageIntent: Record<string, unknown> = { ...existingIntent };
    if (!hasNonEmptyString(messageIntent.text)) {
      const text = firstNonEmptyString(
        messageIntent.text,
        messageIntent.messageText,
        messageIntent.content,
        messageIntent.body,
        action.text,
        action.messageText,
        action.content,
        action.body,
      );
      if (text) messageIntent.text = text;
    }
    if (!hasNonEmptyString(messageIntent.messageType)) {
      messageIntent.messageType = action.messageType ?? "TEXT";
    }
    return pickAffiliateActionFields(action, "messageIntent", messageIntent);
  }

  const text = firstNonEmptyString(action.text, action.messageText, action.content, action.body);
  if (!text) return action;
  const messageIntent: Record<string, unknown> = {
    messageType: action.messageType ?? "TEXT",
    text,
  };
  for (const field of ["conversationId", "creatorId", "creatorOpenId", "productId"]) {
    if (hasNonEmptyString(action[field])) messageIntent[field] = action[field];
  }
  return pickAffiliateActionFields(action, "messageIntent", messageIntent);
}

function normalizeAffiliateTargetCollaborationAction(action: Record<string, unknown>): unknown {
  const existingIntent = asRecord(action.targetCollaborationIntent);
  if (!existingIntent) return action;
  return pickAffiliateActionFields(action, "targetCollaborationIntent", existingIntent);
}

function pickAffiliateActionFields(
  action: Record<string, unknown>,
  intentField: "messageIntent" | "sampleReviewIntent" | "targetCollaborationIntent",
  intentValue: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: action.type,
    predictionCacheIds: action.predictionCacheIds,
    expiresAt: action.expiresAt,
    [intentField]: intentValue,
  };
}

function isInvalidAffiliateResolveAction(value: unknown): boolean {
  const action = asRecord(value);
  if (!action) return true;
  switch (action.type) {
    case "SEND_MESSAGE": {
      const messageIntent = asRecord(action.messageIntent);
      return !hasNonEmptyString(messageIntent?.text);
    }
    case "REVIEW_SAMPLE_APPLICATION": {
      const sampleReviewIntent = asRecord(action.sampleReviewIntent);
      return (
        !hasNonEmptyString(sampleReviewIntent?.sampleApplicationRecordId) ||
        !hasNonEmptyString(sampleReviewIntent?.platformApplicationId) ||
        !["APPROVE", "REJECT"].includes(String(sampleReviewIntent?.decision ?? ""))
      );
    }
    case "CREATE_TARGET_COLLABORATION":
      return !asRecord(action.targetCollaborationIntent);
    default:
      return true;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (hasNonEmptyString(value)) return value;
  }
  return null;
}

function describeAffiliateResolveActionShape(actions: unknown[]): string {
  const shapes = actions.map((value) => {
    const action = asRecord(value);
    if (!action) return { action: typeof value };
    const messageIntent = asRecord(action.messageIntent);
    const sampleReviewIntent = asRecord(action.sampleReviewIntent);
    const targetCollaborationIntent = asRecord(action.targetCollaborationIntent);
    return {
      type: action.type,
      fields: Object.keys(action).sort(),
      scalarPreview: scalarPreview(action, [
        "decision",
        "reviewDecision",
        "sampleDecision",
        "rejectReason",
        "reason",
        "messageText",
        "text",
        "content",
        "body",
      ]),
      messageIntentFields: messageIntent ? Object.keys(messageIntent).sort() : [],
      messageIntentPreview: messageIntent ? scalarPreview(messageIntent, [
        "text",
        "messageText",
        "content",
        "body",
        "messageType",
      ]) : undefined,
      sampleReviewIntentFields: sampleReviewIntent ? Object.keys(sampleReviewIntent).sort() : [],
      sampleReviewIntentPreview: sampleReviewIntent ? scalarPreview(sampleReviewIntent, [
        "sampleApplicationRecordId",
        "platformApplicationId",
        "decision",
        "reviewDecision",
        "sampleDecision",
        "rejectReason",
        "reason",
      ]) : undefined,
      targetCollaborationIntentFields: targetCollaborationIntent ? Object.keys(targetCollaborationIntent).sort() : [],
    };
  });
  return `actionShape=${JSON.stringify(shapes)}`;
}

function scalarPreview(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const preview: Record<string, unknown> = {};
  for (const key of keys) {
    if (!(key in record)) continue;
    const value = record[key];
    if (typeof value === "string") {
      preview[key] = value.length > 120 ? `${value.slice(0, 117)}...` : value;
    } else if (typeof value === "number" || typeof value === "boolean" || value == null) {
      preview[key] = value;
    } else if (Array.isArray(value)) {
      preview[key] = `[array:${value.length}]`;
    } else if (typeof value === "object") {
      preview[key] = "{object}";
    }
  }
  return preview;
}

function describeAffiliateResolveActionRepairHint(context: AffiliateResolveActionContext): string {
  const hints: string[] = [];
  if (context.sampleApplicationRecordId && context.platformApplicationId) {
    hints.push(
      `reviewSampleTemplate=${JSON.stringify({
        type: "REVIEW_SAMPLE_APPLICATION",
        predictionCacheIds: context.predictionCacheIds?.length ? context.predictionCacheIds : undefined,
        sampleReviewIntent: {
          sampleApplicationRecordId: context.sampleApplicationRecordId,
          platformApplicationId: context.platformApplicationId,
          decision: "APPROVE_OR_REJECT",
          rejectReason: "required when decision is REJECT",
        },
      })}`,
    );
  }
  hints.push(
    `sendMessageTemplate=${JSON.stringify({
      type: "SEND_MESSAGE",
      predictionCacheIds: context.predictionCacheIds?.length ? context.predictionCacheIds : undefined,
      messageText: "exact creator-facing message",
    })}`,
  );
  return hints.join(" ");
}

export function invalidateToolSpecsCache(): void {
  toolSpecsCache = null;
}

export function __resetCloudGraphqlProxyForTests(): void {
  invalidateToolSpecsCache();
}

// ── POST /api/cloud/graphql ──

const cloudGraphql: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.authSession) {
    sendJson(res, 200, { errors: [{ message: "Auth session not ready" }] });
    return;
  }

  const body = (await parseBody(req)) as { query?: string; variables?: Record<string, unknown> };
  if (!body.query) {
    sendJson(res, 200, { errors: [{ message: "Missing query" }] });
    return;
  }

  const opName = extractOperationName(body.query);
  let variables: Record<string, unknown> | undefined;
  try {
    variables = sanitizeCloudGraphqlVariables(opName, body.variables);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud GraphQL request failed";
    log.warn(`Cloud GraphQL proxy rejected request (op=${opName ?? "unknown"}): ${message}`);
    sendJson(res, 200, { errors: [{ message }] });
    return;
  }

  // ToolSpecs-only dedup: coalesce concurrent requests for this stable query
  if (opName === TOOLSPECS_OP_NAME && toolSpecsCache) {
    const isExtension = req.headers["x-request-source"] === "extension";
    if (toolSpecsCache.inflight) {
      try {
        const data = await toolSpecsCache.inflight;
        if (!isExtension) rootStore.ingestGraphQLResponse(data as Record<string, unknown>);
        sendJson(res, 200, { data });
      } catch (err) {
        sendJson(res, 200, {
          errors: [
            { message: err instanceof Error ? err.message : "Cloud GraphQL request failed" },
          ],
        });
      }
      return;
    }
    if (Date.now() - toolSpecsCache.ts < TOOLSPECS_CACHE_TTL_MS) {
      if (!isExtension)
        rootStore.ingestGraphQLResponse(toolSpecsCache.data as Record<string, unknown>);
      sendJson(res, 200, { data: toolSpecsCache.data });
      return;
    }
  }

  // Transparent proxy: always returns 200 with standard GraphQL response.
  try {
    const fetchPromise = ctx.authSession.graphqlFetch(body.query, variables);

    const prevCache = opName === TOOLSPECS_OP_NAME ? toolSpecsCache : null;
    if (opName === TOOLSPECS_OP_NAME) {
      toolSpecsCache = {
        data: prevCache?.data ?? null,
        ts: prevCache?.ts ?? 0,
        inflight: fetchPromise,
      };
    }

    const data = await fetchPromise;

    // Only ingest Panel responses into MST. Extension (agent tool) responses
    // return partial entities that would overwrite complete store data.
    const isExtension = req.headers["x-request-source"] === "extension";
    if (!isExtension) {
      rootStore.ingestGraphQLResponse(data as Record<string, unknown>);
      if (opName === "AffiliateConversationMessages") {
        const input = variables?.input as { shopId?: string; conversationId?: string; pageToken?: string | null } | undefined;
        const page = (data as Record<string, unknown>)?.affiliateConversationMessages;
        if (input?.shopId && input.conversationId && page && typeof page === "object") {
          rootStore.affiliateWorkspace.ingestAffiliateConversationMessages(
            input.shopId,
            input.conversationId,
            page as any,
            input.pageToken ? "append" : "replace",
          );
        }
      }
    }

    // Delete mutations return booleans, which ingestGraphQLResponse skips.
    // Use the explicit map to remove the entity from Desktop MST → SSE patch → Panel.
    const deleteTypeName = opName && DELETION_MUTATION_MAP[opName];
    if (deleteTypeName && body.variables?.id) {
      rootStore.removeEntity(deleteTypeName, body.variables.id as string);
    }

    if (opName === TOOLSPECS_OP_NAME) {
      // Only update cache if we got real data — preserve previous good cache on empty results
      const specs = (data as Record<string, unknown>)?.toolSpecs;
      const hasData = Array.isArray(specs) && specs.length > 0;
      if (hasData || !prevCache?.data) {
        toolSpecsCache = { data, ts: Date.now() };
      } else {
        // Restore previous good cache — backend returned empty (likely auth not ready after hot reload)
        toolSpecsCache = prevCache;
      }
    }

    if (isModuleEnrollmentOperation(opName)) {
      toolSpecsCache = null;
      runAuthChangeInBackground(ctx);
    }

    if (!isExtension && hasAllowedAccountLlmEntitlement(data)) {
      runCloudLlmEntitlementSyncInBackground(ctx);
    }

    sendJson(res, 200, { data });
  } catch (err) {
    if (opName === TOOLSPECS_OP_NAME) toolSpecsCache = null;
    // undici's "fetch failed" TypeError hides the real error in .cause
    const cause =
      err instanceof Error && "cause" in err
        ? (err as Error & { cause?: unknown }).cause
        : undefined;
    const detail =
      cause instanceof Error
        ? `${(err as Error).message}: ${cause.message}`
        : err instanceof Error
          ? err.message
          : "Cloud GraphQL request failed";
    log.warn(`Cloud GraphQL proxy error (op=${opName ?? "unknown"}): ${detail}`);
    sendJson(res, 200, { errors: [{ message: detail }] });
  }
};

// ── Cloud REST proxy ────────────────────────────────────────────────────────

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
 *   /api/cloud/tiktok/send-image  ->  /api/tiktok/send-image
 *   /api/cloud/foo/bar            ->  /api/foo/bar
 *
 * Extensions cannot call the cloud backend directly (no auth token),
 * so they POST to the panel-server which forwards with the JWT.
 */
const cloudRest: EndpointHandler = async (req, res, _url, params, ctx: ApiContext) => {
  // Safety guard: if the remainder is "graphql", reject it.
  // The registry checks exact matches first (cloud.graphql is registered
  // separately), but this guard catches edge cases.
  if (params._rest === "graphql") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (!ctx.cloudClient) {
    sendJson(res, 401, { error: "Not authenticated" });
    return;
  }

  // Reconstruct the backend path from the prefix remainder.
  // /api/cloud/tiktok/send-image -> _rest = "tiktok/send-image" -> /api/tiktok/send-image
  const backendPath = `/api/${params._rest}`;

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
    if (err instanceof CloudRestError) {
      sendJson(res, err.status, err.body ?? { error: err.message });
    } else {
      const message = err instanceof Error ? err.message : "Cloud REST proxy error";
      sendJson(res, 502, { error: message });
    }
  }
};

// ── Registration ──

export function registerCloudHandlers(registry: RouteRegistry): void {
  registry.register(API["cloud.graphql"], cloudGraphql);
  registry.registerPrefix("/api/cloud/", cloudRest);
}
