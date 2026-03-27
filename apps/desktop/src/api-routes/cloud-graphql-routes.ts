import type { RouteHandler } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";
import { entityCache } from "../entity-cache.js";

// ── Query-level dedup cache ─────────────────────────────────────────────────
// Prevents duplicate backend requests when Panel and plugin fire the same
// query within a short window (e.g., both query toolSpecs on startup).
// Keyed by GraphQL operation name; caches the resolved data + in-flight promise.
const DEDUP_TTL_MS = 5_000;
const dedupCache = new Map<string, { data: unknown; ts: number; inflight?: Promise<unknown> }>();

function extractOperationName(query: string): string | null {
  const m = query.match(/(?:query|mutation)\s+(\w+)/);
  return m?.[1] ?? null;
}

function isMutation(query: string): boolean {
  return /^\s*mutation\b/i.test(query);
}

export const handleCloudGraphqlRoutes: RouteHandler = async (req, res, _url, pathname, ctx) => {
  if (pathname === "/api/cloud/graphql" && req.method === "POST") {
    if (!ctx.authSession) {
      sendJson(res, 200, { errors: [{ message: "Auth session not ready" }] });
      return true;
    }

    const body = await parseBody(req) as { query?: string; variables?: Record<string, unknown> };
    if (!body.query) {
      sendJson(res, 200, { errors: [{ message: "Missing query" }] });
      return true;
    }

    // Dedup: return cached result if same query arrived recently.
    // Mutations always bypass the cache and, on success, clear all cached
    // query entries so that Apollo refetchQueries hits the backend.
    const opName = extractOperationName(body.query);
    const mutation = isMutation(body.query);
    if (opName && !mutation) {
      const cached = dedupCache.get(opName);
      if (cached) {
        // In-flight: await the same promise (coalesce concurrent requests)
        if (cached.inflight) {
          try {
            const data = await cached.inflight;
            sendJson(res, 200, { data });
          } catch (err) {
            sendJson(res, 200, { errors: [{ message: err instanceof Error ? err.message : "Cloud GraphQL request failed" }] });
          }
          return true;
        }
        // Fresh cache hit
        if (Date.now() - cached.ts < DEDUP_TTL_MS) {
          sendJson(res, 200, { data: cached.data });
          return true;
        }
      }
    }

    // Transparent proxy: always returns 200 with standard GraphQL response.
    try {
      const fetchPromise = ctx.authSession.graphqlFetch(body.query, body.variables);
      if (opName && !mutation) dedupCache.set(opName, { data: null, ts: 0, inflight: fetchPromise });

      const data = await fetchPromise;
      entityCache.getState().ingestGraphQLResponse(data as Record<string, unknown>);

      if (mutation) {
        // Mutation succeeded — invalidate all cached queries so subsequent
        // refetches (e.g. Apollo refetchQueries) hit the backend.
        dedupCache.clear();
      } else if (opName) {
        dedupCache.set(opName, { data, ts: Date.now() });
      }
      sendJson(res, 200, { data });
    } catch (err) {
      if (opName) dedupCache.delete(opName);
      const message = err instanceof Error ? err.message : "Cloud GraphQL request failed";
      sendJson(res, 200, { errors: [{ message }] });
    }
    return true;
  }

  return false;
};
