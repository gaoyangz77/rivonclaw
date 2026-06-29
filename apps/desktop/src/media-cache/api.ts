import type { IncomingMessage } from "node:http";
import { getFirstPartyDomainRoute, routeFirstPartyUrl, type FirstPartyDomainRoute } from "@rivonclaw/core";
import { API } from "@rivonclaw/core/api-contract";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";

const GEN_OR_GET_CACHED_PROXY_URL_MUTATION = /* GraphQL */ `
  mutation GenOrGetCachedProxyUrl($sourceUrl: String!) {
    genOrGetCachedProxyUrl(sourceUrl: $sourceUrl) {
      proxyUrl
      status
      lastError
    }
  }
`;

type MediaCacheResolveBody = {
  sourceUrl?: unknown;
  forceProxy?: unknown;
};

type MediaCacheResolveResult = {
  sourceUrl: string;
  url: string;
  proxied: boolean;
  route: FirstPartyDomainRoute;
};

type GenOrGetCachedProxyUrlResponse = {
  genOrGetCachedProxyUrl: {
    proxyUrl?: string | null;
    status: "FETCHING" | "READY" | "FAILED" | "DELETED";
    lastError?: string | null;
  };
};

function parseRemoteHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isTrustedLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" && isLoopbackHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function hasValidDesktopToken(req: IncomingMessage, ctx: ApiContext): boolean {
  const expected = ctx.desktopApiToken;
  const actual = req.headers["x-rivonclaw-desktop-token"];
  return !!expected && actual === expected;
}

function isAuthorizedLocalRequest(req: IncomingMessage, ctx: ApiContext): boolean {
  return hasValidDesktopToken(req, ctx) || isTrustedLocalOrigin(req.headers.origin);
}

function result(
  sourceUrl: string,
  url: string,
  proxied: boolean,
  route: FirstPartyDomainRoute,
): MediaCacheResolveResult {
  return { sourceUrl, url, proxied, route };
}

const resolveMediaCacheUrl: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!isAuthorizedLocalRequest(req, ctx)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  const body = (await parseBody(req)) as MediaCacheResolveBody;
  const sourceUrl = parseRemoteHttpUrl(body.sourceUrl);
  if (!sourceUrl) {
    sendJson(res, 400, { error: "sourceUrl must be an http(s) URL" });
    return;
  }

  const forceProxy = body.forceProxy === true;
  const route = getFirstPartyDomainRoute();
  if (route !== "cn-relay" && !forceProxy) {
    sendJson(res, 200, result(sourceUrl, sourceUrl, false, route));
    return;
  }

  if (!ctx.authSession?.getAccessToken()) {
    sendJson(res, 401, { error: "Authentication required" });
    return;
  }

  try {
    const data = await ctx.authSession.graphqlFetch<GenOrGetCachedProxyUrlResponse>(
      GEN_OR_GET_CACHED_PROXY_URL_MUTATION,
      { sourceUrl },
    );
    const cached = data.genOrGetCachedProxyUrl;
    if (cached.status !== "READY" || !cached.proxyUrl) {
      sendJson(res, 502, { error: cached.lastError ?? "Remote media cache is not ready" });
      return;
    }
    sendJson(res, 200, result(sourceUrl, String(routeFirstPartyUrl(cached.proxyUrl)), true, route));
  } catch (err) {
    sendJson(res, 502, {
      error: err instanceof Error ? err.message : "Remote media cache request failed",
    });
  }
};

export function registerMediaCacheHandlers(registry: RouteRegistry): void {
  registry.register(API["mediaCache.resolve"], resolveMediaCacheUrl);
}
