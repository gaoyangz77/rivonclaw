import type { IncomingMessage, ServerResponse } from "node:http";
import { createLogger } from "@rivonclaw/logger";
import type { RouteEntry } from "@rivonclaw/core/api-contract";
import { sendJson } from "./route-utils.js";

const log = createLogger("route-registry");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Handler for a single registered endpoint.
 *
 * Unlike the legacy `RouteHandler` which returns `boolean`, a registry handler
 * is only called when the route already matched — it just processes the request.
 * Parametric segments (`:id`, `:channelId`) are extracted into `params`.
 *
 * The context parameter is typed as `any` so infra/ has no dependency on
 * app/ or domain types. Domain handlers annotate `ctx: ApiContext` explicitly
 * to get full type safety in their implementations.
 */
export type EndpointHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  params: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
) => Promise<void>;

interface ParametricRoute {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: EndpointHandler;
  /** Segment count for sorting (more segments = higher priority). */
  segments: number;
}

interface PrefixRoute {
  prefix: string;
  handler: EndpointHandler;
}

// ---------------------------------------------------------------------------
// Path compilation
// ---------------------------------------------------------------------------

/**
 * Compile a path pattern like `/api/rules/:id` into a regex and param names.
 * Returns null for paths with no parameters (exact match).
 */
function compilePath(path: string): { pattern: RegExp; paramNames: string[] } | null {
  const paramNames: string[] = [];
  let hasParams = false;
  const regexStr = path.replace(/:([^/]+)/g, (_match, name: string) => {
    paramNames.push(name);
    hasParams = true;
    return "([^/]+)";
  });
  if (!hasParams) return null;
  return { pattern: new RegExp(`^${regexStr}$`), paramNames };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class RouteRegistry {
  /** O(1) exact-match lookup: "GET:/api/rules" → handler */
  private exact = new Map<string, EndpointHandler>();

  /** Parametric routes with pre-compiled regex, sorted by segment count desc. */
  private parametric: ParametricRoute[] = [];
  private parametricDirty = false;

  /** Prefix-match routes (e.g., cloud REST proxy). */
  private prefixes: PrefixRoute[] = [];

  /** All registered definitions (for docs/enumeration). */
  private registered: Array<{ method: string; path: string }> = [];

  /**
   * Register a handler for a route definition from the API contract.
   */
  register(def: RouteEntry, handler: EndpointHandler): void {
    const compiled = compilePath(def.path);
    if (compiled) {
      // Parametric route
      this.parametric.push({
        method: def.method,
        pattern: compiled.pattern,
        paramNames: compiled.paramNames,
        handler,
        segments: def.path.split("/").length,
      });
      this.parametricDirty = true;
    } else {
      // Exact match
      this.exact.set(`${def.method}:${def.path}`, handler);
    }
    this.registered.push({ method: def.method, path: def.path });
  }

  /**
   * Register a prefix-match handler (e.g., cloud REST proxy wildcard).
   * The remainder of the path after the prefix is passed as `params._rest`.
   */
  registerPrefix(prefix: string, handler: EndpointHandler): void {
    this.prefixes.push({ prefix, handler });
    this.registered.push({ method: "*", path: `${prefix}*` });
  }

  /**
   * Dispatch an incoming request. Returns true if handled.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async dispatch(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    pathname: string,
    ctx: any,
  ): Promise<boolean> {
    const method = req.method ?? "GET";

    // 1. Exact match (O(1))
    const exactHandler = this.exact.get(`${method}:${pathname}`);
    if (exactHandler) {
      await this.safeCall(exactHandler, req, res, url, {}, ctx);
      return true;
    }

    // 2. Parametric routes (sorted by specificity)
    if (this.parametricDirty) {
      // Sort by segment count descending so more-specific patterns match first.
      // e.g., /api/provider-keys/:id/activate (5 segments) before /api/provider-keys/:id (4 segments)
      this.parametric.sort((a, b) => b.segments - a.segments);
      this.parametricDirty = false;
    }
    for (const route of this.parametric) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(pathname);
      if (match) {
        const params: Record<string, string> = {};
        for (let i = 0; i < route.paramNames.length; i++) {
          params[route.paramNames[i]!] = decodeURIComponent(match[i + 1]!);
        }
        await this.safeCall(route.handler, req, res, url, params, ctx);
        return true;
      }
    }

    // 3. Prefix match (cloud proxy)
    for (const { prefix, handler } of this.prefixes) {
      if (pathname.startsWith(prefix)) {
        const rest = pathname.slice(prefix.length);
        await this.safeCall(handler, req, res, url, { _rest: rest }, ctx);
        return true;
      }
    }

    return false;
  }

  /**
   * Enumerate all registered routes (for docs generation).
   */
  listRoutes(): ReadonlyArray<{ method: string; path: string }> {
    return this.registered;
  }

  /**
   * Call a handler with a safety net. If the handler throws, send 500.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async safeCall(
    handler: EndpointHandler,
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    params: Record<string, string>,
    ctx: any,
  ): Promise<void> {
    try {
      await handler(req, res, url, params, ctx);
    } catch (err) {
      log.error(`Route handler error [${req.method} ${req.url}]:`, err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" });
      }
    }
  }
}
