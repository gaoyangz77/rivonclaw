import type { IncomingMessage } from "node:http";
import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import { rootStore } from "../app/store/desktop-store.js";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";
import { CloudRestError } from "./cloud-client.js";
import {
  invalidateToolSpecsCache,
  syncDesktopToolSpecs,
} from "./tool-specs-sync.js";
import {
  getActiveAffiliateRunCheckpoint,
  recordActiveAffiliateRunPredictionCacheIds,
} from "../affiliate/affiliate-run-checkpoints.js";
import { openClawConnector } from "../openclaw/index.js";

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

const TOOLSPECS_OP_NAME = "ToolSpecsSync";
const AFFILIATE_RESOLVE_WORK_ITEM_OP_NAME = "ResolveAffiliateWorkItem";
const AFFILIATE_PREDICT_CREATOR_PRODUCT_FIT_OP_NAME = "AffiliatePredictCreatorProductFit";
const AFFILIATE_RELATIONSHIP_TIMELINE_OP_NAME = "AffiliateRelationshipTimeline";
const MODULE_ENROLLMENT_OP_NAMES = new Set(["EnrollModule", "UnenrollModule"]);
// Backend no longer redacts Human Decision output from proposal projections;
// Desktop owns tool-path gating. This name-based recursive guard strips every
// matching key from extension-bound affiliate GraphQL responses. The canonical
// evidence location (predictionEvidence.humanDecision, ADR-058 cutover) is
// covered by the "humanDecision" key match; the canonical value field names
// below are defense-in-depth in case HD values ever surface outside a
// humanDecision-keyed object.
const AFFILIATE_STAFF_DECISION_FIELD_NAMES = new Set([
  "humanDecision",
  "humanDecisionSelection",
  "humanDecisionStatus",
  "humanApprovalProbability",
  "humanApprovalPercentile",
  "wouldApprove",
  "approvalCutoff",
  "historicalApprovalRate",
  // Canonical AffiliateHumanDecisionSignalValue field names.
  "approvalProbability",
  "approvalPercentile",
  "cutoff",
  // Legacy aliases for the same historical staff-imitation signal.
  "merchantAcceptance",
  "merchantAcceptanceSelection",
  "merchantAcceptanceStatus",
  "merchantAcceptanceProbability",
  "merchantAcceptancePercentile",
  "wouldAccept",
  "acceptanceCutoff",
]);

function extractOperationName(query: string): string | null {
  const m = query.match(/(?:query|mutation)\s+(\w+)/);
  return m?.[1] ?? null;
}

function isModuleEnrollmentOperation(opName: string | null): boolean {
  return opName !== null && MODULE_ENROLLMENT_OP_NAMES.has(opName);
}

function isAffiliateGraphqlOperation(opName: string | null, query: string): boolean {
  return opName?.toLowerCase().includes("affiliate") === true
    || /\b(?:affiliate[A-Z]|resolveAffiliate)/.test(query);
}

function redactAffiliateStaffDecisionEvidence(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactAffiliateStaffDecisionEvidence);
  }
  const record = asRecord(value);
  if (!record) return value;
  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (AFFILIATE_STAFF_DECISION_FIELD_NAMES.has(key)) continue;
    redacted[key] = redactAffiliateStaffDecisionEvidence(child);
  }
  return redacted;
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
  const hasLocalCloudProvider = rootStore.providerKeys.some((key: { provider?: string }) => key.provider === "rivonclaw-pro");
  if (hasLocalCloudProvider) return;
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
  query: string,
  variables: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (
    variables &&
    (opName === AFFILIATE_RELATIONSHIP_TIMELINE_OP_NAME || query.includes("affiliateRelationshipTimeline"))
  ) {
    const input = asRecord(variables.input);
    if (input) {
      const normalizedInput = { ...input };
      let changed = false;
      for (const field of ["startAt", "endAt"] as const) {
        const normalized = cleanOptionalAffiliateDateTime(input[field]);
        if (normalized === undefined) {
          if (field in normalizedInput) {
            delete normalizedInput[field];
            changed = true;
          }
        } else if (normalized !== input[field]) {
          normalizedInput[field] = normalized;
          changed = true;
        }
      }
      if (changed) {
        log.info("Normalized affiliate relationship timeline date range before proxying to backend");
        return {
          ...variables,
          input: normalizedInput,
        };
      }
    }
  }

  if (variables && looksLikeAffiliatePredictCreatorProductFitVariables(opName, variables)) {
    const normalized = sanitizeAffiliatePredictCreatorProductFitVariables(variables);
    if (normalized !== variables) {
      log.info("Normalized affiliate creator-product prediction payload before proxying to backend");
    }
    return normalized;
  }

  if (!variables) {
    return variables;
  }

  const isAffiliateResolveWorkItem =
    opName === AFFILIATE_RESOLVE_WORK_ITEM_OP_NAME ||
    query.includes("resolveAffiliateWorkItem") ||
    looksLikeAffiliateResolveWorkItemVariables(variables);
  if (!isAffiliateResolveWorkItem) {
    return variables;
  }

  const input = asRecord(variables.input);
  if (!input) return variables;
  if (!hasNonEmptyString(input.creatorRelationshipId)) {
    throw new Error("creatorRelationshipId is required for affiliate_resolve_work_item");
  }
  if (input.decision === "FAILED_OR_INCOMPLETE") {
    throw new Error(
      "FAILED_OR_INCOMPLETE is reserved for trusted system preflight failures and cannot be selected by the Affiliate Agent. " +
      "Retry the failed read or action tool. If the run cannot complete because the tool or runtime is unavailable, leave the work item unresolved so it remains retryable; do not transfer it to staff.",
    );
  }
  const inputWithCheckpoint = injectAffiliateResolveCheckpoint(input);
  // Action types and their typed payloads belong exclusively to the dynamic
  // Backend GraphQL/tool contract. Desktop must not shadow that schema: doing
  // so makes a Backend-added action unusable until every Desktop is released.
  // Only overwrite trusted run state and remove the retired scheduling field;
  // forward action/action(s) without inspecting or rewriting their contents.
  return {
    ...variables,
    input: {
      ...inputWithCheckpoint,
      nextSellerActionAt: undefined,
    },
  };
}

/**
 * Deprecated resolve inputs the Desktop no longer sends. The backend reads
 * shop and Business Developer provenance exclusively from the frozen agenda
 * snapshot named by agendaItemsSnapshotId, and deletes these input fields once
 * released Desktops stop sending them. Stripping happens here — at the trusted
 * proxy boundary every resolve call crosses — because the values can still
 * arrive from below: a cached backend tool spec may keep binding
 * `input.triggerShopId` from the session context, and a model may echo fields
 * it saw in an older schema. `undefined` serializes as absent.
 */
const DEPRECATED_AFFILIATE_RESOLVE_INPUT_STRIP = {
  triggerShopId: undefined,
  businessDeveloperIdSnapshot: undefined,
  businessDeveloperConfigRevision: undefined,
} as const;

function injectAffiliateResolveCheckpoint(input: Record<string, unknown>): Record<string, unknown> {
  const creatorRelationshipId = firstNonEmptyString(input.creatorRelationshipId);
  if (!creatorRelationshipId) {
    return {
      ...input,
      ...DEPRECATED_AFFILIATE_RESOLVE_INPUT_STRIP,
      predictionCacheIds: undefined,
      agendaItemsSnapshotId: undefined,
    };
  }
  const checkpoint = getActiveAffiliateRunCheckpoint(creatorRelationshipId);
  if (!checkpoint) {
    return {
      ...input,
      ...DEPRECATED_AFFILIATE_RESOLVE_INPUT_STRIP,
      predictionCacheIds: undefined,
      agendaItemsSnapshotId: undefined,
    };
  }
  return {
    ...input,
    ...DEPRECATED_AFFILIATE_RESOLVE_INPUT_STRIP,
    handledSignalAt: checkpoint.handledSignalAt,
    baseCheckpointId: checkpoint.baseCheckpointId,
    baseEventCursor: checkpoint.baseEventCursor,
    candidateCheckpointId: checkpoint.candidateCheckpointId,
    targetEventCursor: checkpoint.targetEventCursor,
    relationshipOperationalConfigRevision: checkpoint.relationshipOperationalConfigRevision,
    // The immutable agenda snapshot this run was dispatched with, captured at
    // the trusted Desktop boundary like the checkpoint itself — a
    // model-authored value is always overwritten. `undefined` serializes as
    // absent, so an old backend input schema and snapshot-less runs stay
    // untouched.
    agendaItemsSnapshotId: checkpoint.agendaItemsSnapshotId ?? undefined,
    // Prediction lineage is captured from Backend-delivered Working Agenda evidence.
    // Always overwrite any model-authored value at the trusted Desktop boundary.
    predictionCacheIds: checkpoint.predictionCacheIds?.length
      ? [...new Set(checkpoint.predictionCacheIds)]
      : undefined,
  };
}

async function ensureAffiliateResolveCheckpointSnapshot(
  opName: string | null,
  query: string,
  variables: Record<string, unknown> | undefined,
): Promise<void> {
  if (!variables) return;
  const isAffiliateResolveWorkItem =
    opName === AFFILIATE_RESOLVE_WORK_ITEM_OP_NAME ||
    query.includes("resolveAffiliateWorkItem") ||
    looksLikeAffiliateResolveWorkItemVariables(variables);
  if (!isAffiliateResolveWorkItem) return;

  const input = asRecord(variables.input);
  if (!input) return;
  const creatorRelationshipId = firstNonEmptyString(input.creatorRelationshipId);
  if (!creatorRelationshipId) return;

  const checkpoint = getActiveAffiliateRunCheckpoint(creatorRelationshipId);
  if (!checkpoint) return;

  await openClawConnector.request("sessions.checkpoint.create", {
    key: checkpoint.sessionKey,
    checkpointId: checkpoint.candidateCheckpointId,
    summary: `Affiliate run ${checkpoint.runId} candidate checkpoint before work resolution`,
  });
}

function looksLikeAffiliatePredictCreatorProductFitVariables(
  opName: string | null,
  variables: Record<string, unknown>,
): boolean {
  if (opName === AFFILIATE_PREDICT_CREATOR_PRODUCT_FIT_OP_NAME) return true;
  const input = asRecord(variables.input);
  if (!input) return false;
  return (
    hasNonEmptyString(input.creatorRelationshipId) &&
    hasNonEmptyString(input.shopId) &&
    hasNonEmptyString(input.productId) &&
    input.decision === undefined &&
    input.action === undefined &&
    input.actions === undefined &&
    input.subjects === undefined
  );
}

function sanitizeAffiliatePredictCreatorProductFitVariables(
  variables: Record<string, unknown>,
): Record<string, unknown> {
  const input = asRecord(variables.input);
  if (!input) return variables;
  const normalizedInput = omitEmptyAffiliateStrings({
    ...input,
    // CreatorRelationship is the business boundary; backend can derive the
    // platform creator identity. Agent-supplied creatorId/creatorOpenId is
    // optional and easy to confuse with relationship ids, so do not forward it.
    creatorId: undefined,
    creatorOpenId: undefined,
  });
  return normalizedInput === input ? variables : { ...variables, input: normalizedInput };
}

function looksLikeAffiliateResolveWorkItemVariables(variables: Record<string, unknown>): boolean {
  const input = asRecord(variables.input);
  if (!input) return false;
  return (
    typeof input.decision === "string" &&
    hasNonEmptyString(input.creatorRelationshipId) &&
    (hasNonEmptyString(input.shopId) ||
      input.action != null ||
      Array.isArray(input.actions))
  );
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

function cleanOptionalAffiliateDateTime(value: unknown): unknown {
  if (!hasNonEmptyString(value)) return undefined;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return undefined;
  return Number.isNaN(Date.parse(trimmed)) ? undefined : trimmed;
}

function omitEmptyAffiliateStrings<T extends Record<string, unknown>>(record: T): T {
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === "") {
      changed = true;
      continue;
    }
    if (Array.isArray(value)) {
      const normalizedArray = value.map((item) => (
        asRecord(item) ? omitEmptyAffiliateStrings(item as Record<string, unknown>) : item
      ));
      if (normalizedArray.some((item, index) => item !== value[index])) changed = true;
      next[key] = normalizedArray;
      continue;
    }
    if (asRecord(value)) {
      const normalizedValue = omitEmptyAffiliateStrings(value as Record<string, unknown>);
      if (normalizedValue !== value) changed = true;
      if (Object.keys(normalizedValue).length === 0) {
        changed = true;
        continue;
      }
      next[key] = normalizedValue;
      continue;
    }
    next[key] = value;
  }
  return changed ? (next as T) : record;
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

  const body = (await parseBody(req)) as {
    query?: string;
    variables?: Record<string, unknown>;
    extensions?: { rivonclaw?: Record<string, unknown> };
  };
  if (!body.query) {
    sendJson(res, 200, { errors: [{ message: "Missing query" }] });
    return;
  }

  const opName = extractOperationName(body.query);
  let variables: Record<string, unknown> | undefined;
  try {
    variables = sanitizeCloudGraphqlVariables(opName, body.query, body.variables);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud GraphQL request failed";
    log.warn(`Cloud GraphQL proxy rejected request (op=${opName ?? "unknown"}): ${message}`);
    sendJson(res, 200, { errors: [{ message }] });
    return;
  }

  if (opName === TOOLSPECS_OP_NAME) {
    const isExtension = req.headers["x-request-source"] === "extension";
    if (isExtension) {
      sendJson(res, 200, {
        errors: [{ message: "ToolSpecsSync is desktop-owned; extensions receive ToolSpecs from Desktop via gateway RPC" }],
      });
      return;
    }
    try {
      const snapshot = await syncDesktopToolSpecs({
        authSession: ctx.authSession,
        rootStore,
        source: "cloud-graphql-proxy",
      });
      sendJson(res, 200, { data: snapshot.data });
    } catch (err) {
      sendJson(res, 200, {
        errors: [
          { message: err instanceof Error ? err.message : "Cloud GraphQL request failed" },
        ],
      });
    }
    return;
  }

  // Transparent proxy: always returns 200 with standard GraphQL response.
  try {
    await ensureAffiliateResolveCheckpointSnapshot(opName, body.query, variables);
    const isExtension = req.headers["x-request-source"] === "extension";
    const requestedPersistent = body.extensions?.rivonclaw;
    const requestExtensions =
      isExtension &&
      requestedPersistent?.persistResult === true &&
      typeof requestedPersistent.toolId === "string"
        ? {
            rivonclaw: {
              persistResult: true,
              toolId: requestedPersistent.toolId,
            },
          }
        : undefined;
    const envelope = isExtension
      ? await ctx.authSession.graphqlFetchEnvelope(body.query, variables, requestExtensions)
      : null;
    const data = envelope ? envelope.data : await ctx.authSession.graphqlFetch(body.query, variables);
    captureAffiliatePredictionEvidence(opName, variables, data);

    // Only ingest Panel responses into MST. Extension (agent tool) responses
    // return partial entities that would overwrite complete store data.
    if (!isExtension) {
      rootStore.ingestGraphQLResponse(data as Record<string, unknown>);
    }

    // Delete mutations return booleans, which ingestGraphQLResponse skips.
    // Use the explicit map to remove the entity from Desktop MST → SSE patch → Panel.
    const deleteTypeName = opName && DELETION_MUTATION_MAP[opName];
    if (deleteTypeName && body.variables?.id) {
      rootStore.removeEntity(deleteTypeName, body.variables.id as string);
    }

    if (isModuleEnrollmentOperation(opName)) {
      invalidateToolSpecsCache();
      runAuthChangeInBackground(ctx);
    }

    if (!isExtension && hasAllowedAccountLlmEntitlement(data)) {
      runCloudLlmEntitlementSyncInBackground(ctx);
    }

    const responseData = isExtension && isAffiliateGraphqlOperation(opName, body.query)
      ? redactAffiliateStaffDecisionEvidence(data)
      : data;
    const responseEnvelope = envelope
      ? { ...envelope, data: responseData }
      : { data: responseData };
    sendJson(res, 200, responseEnvelope);
  } catch (err) {
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

function captureAffiliatePredictionEvidence(
  opName: string | null,
  variables: Record<string, unknown> | undefined,
  data: unknown,
): void {
  if (!variables || !looksLikeAffiliatePredictCreatorProductFitVariables(opName, variables)) return;
  const creatorRelationshipId = firstNonEmptyString(
    asRecord(variables.input)?.creatorRelationshipId,
  );
  if (!creatorRelationshipId) return;
  const payload = asRecord(asRecord(data)?.affiliatePredictCreatorProductFit);
  const prediction = asRecord(payload?.prediction);
  const predictionPayload = asRecord(payload?.predictionPayload);
  const nestedPredictions = Array.isArray(predictionPayload?.predictions)
    ? predictionPayload.predictions
    : [];
  const cacheIds = [
    prediction?.cacheId,
    ...nestedPredictions.map((value) => asRecord(value)?.cacheId),
  ].filter(hasNonEmptyString);
  if (!cacheIds.length) return;
  recordActiveAffiliateRunPredictionCacheIds({ creatorRelationshipId, cacheIds });
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
    const requestBody = body.length > 0 ? new Uint8Array(body) : undefined;
    const response = await ctx.cloudClient.restResponse(backendPath, {
      method: (req.method ?? "POST") as "GET" | "POST" | "PUT" | "DELETE",
      headers: forwardHeaders,
      body: requestBody,
    });
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    if (contentType.includes("application/json")) {
      sendJson(res, response.status, await response.json());
      return;
    }
    res.statusCode = response.status;
    res.setHeader("Content-Type", contentType);
    for (const header of ["content-length", "x-affiliate-file-name"]) {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.end(Buffer.from(await response.arrayBuffer()));
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
