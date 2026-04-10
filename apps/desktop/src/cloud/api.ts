import type { IncomingMessage } from "node:http";
import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import { rootStore } from "../app/store/desktop-store.js";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";

const log = createLogger("cloud-graphql-proxy");

// ── Deletion mutation map ────────────────────────────────────────────────────
// Maps GraphQL operation names to __typename so the proxy can remove entities
// from Desktop MST after a successful delete mutation.
// (ingestGraphQLResponse skips boolean responses — this fills the gap.)
const DELETION_MUTATION_MAP: Record<string, string> = {
  DeleteShop: "Shop",
  DeleteSurface: "Surface",
  DeleteRunProfile: "RunProfile",
};

// ── ToolSpecs dedup cache ───────────────────────────────────────────────────
// ToolSpecs is stable data queried by both Panel and plugin on startup.
// Cache it briefly to coalesce concurrent requests into a single backend call.
const TOOLSPECS_CACHE_TTL_MS = 5_000;
const TOOLSPECS_OP_NAME = "ToolSpecsSync";
let toolSpecsCache: { data: unknown; ts: number; inflight?: Promise<unknown> } | null = null;

function extractOperationName(query: string): string | null {
  const m = query.match(/(?:query|mutation)\s+(\w+)/);
  return m?.[1] ?? null;
}

// ── POST /api/cloud/graphql ──

const cloudGraphql: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.authSession) {
    sendJson(res, 200, { errors: [{ message: "Auth session not ready" }] });
    return;
  }

  const body = await parseBody(req) as { query?: string; variables?: Record<string, unknown> };
  if (!body.query) {
    sendJson(res, 200, { errors: [{ message: "Missing query" }] });
    return;
  }

  const opName = extractOperationName(body.query);

  // ToolSpecs-only dedup: coalesce concurrent requests for this stable query
  if (opName === TOOLSPECS_OP_NAME && toolSpecsCache) {
    const isExtension = req.headers["x-request-source"] === "extension";
    if (toolSpecsCache.inflight) {
      try {
        const data = await toolSpecsCache.inflight;
        if (!isExtension) rootStore.ingestGraphQLResponse(data as Record<string, unknown>);
        sendJson(res, 200, { data });
      } catch (err) {
        sendJson(res, 200, { errors: [{ message: err instanceof Error ? err.message : "Cloud GraphQL request failed" }] });
      }
      return;
    }
    if (Date.now() - toolSpecsCache.ts < TOOLSPECS_CACHE_TTL_MS) {
      if (!isExtension) rootStore.ingestGraphQLResponse(toolSpecsCache.data as Record<string, unknown>);
      sendJson(res, 200, { data: toolSpecsCache.data });
      return;
    }
  }

  // Transparent proxy: always returns 200 with standard GraphQL response.
  try {
    const fetchPromise = ctx.authSession.graphqlFetch(body.query, body.variables);

    const prevCache = opName === TOOLSPECS_OP_NAME ? toolSpecsCache : null;
    if (opName === TOOLSPECS_OP_NAME) {
      toolSpecsCache = { data: prevCache?.data ?? null, ts: prevCache?.ts ?? 0, inflight: fetchPromise };
    }

    const data = await fetchPromise;

    // Only ingest Panel responses into MST. Extension (agent tool) responses
    // return partial entities that would overwrite complete store data.
    const isExtension = req.headers["x-request-source"] === "extension";
    if (!isExtension) {
      rootStore.ingestGraphQLResponse(data as Record<string, unknown>);
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

    sendJson(res, 200, { data });
  } catch (err) {
    if (opName === TOOLSPECS_OP_NAME) toolSpecsCache = null;
    // undici's "fetch failed" TypeError hides the real error in .cause
    const cause = err instanceof Error && "cause" in err ? (err as Error & { cause?: unknown }).cause : undefined;
    const detail = cause instanceof Error ? `${(err as Error).message}: ${cause.message}` : (err instanceof Error ? err.message : "Cloud GraphQL request failed");
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
    const message = err instanceof Error ? err.message : "Cloud REST proxy error";
    const statusMatch = message.match(/Cloud REST error: (\d+)/);
    const status = statusMatch ? Number(statusMatch[1]) : 502;
    sendJson(res, status, { error: message });
  }
};

// ── Registration ──

export function registerCloudHandlers(registry: RouteRegistry): void {
  registry.register(API["cloud.graphql"], cloudGraphql);
  registry.registerPrefix("/api/cloud/", cloudRest);
}
