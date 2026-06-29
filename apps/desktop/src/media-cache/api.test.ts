import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { API } from "@rivonclaw/core/api-contract";
import { resetFirstPartyDomainRouteForTests, setFirstPartyDomainRoute } from "@rivonclaw/core";
import type { ApiContext } from "../app/api-context.js";
import { RouteRegistry } from "../infra/api/route-registry.js";
import { registerMediaCacheHandlers } from "./api.js";

let registry: RouteRegistry;

beforeEach(() => {
  resetFirstPartyDomainRouteForTests();
  registry = new RouteRegistry();
  registerMediaCacheHandlers(registry);
});

afterEach(() => {
  resetFirstPartyDomainRouteForTests();
});

function makeReq(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): IncomingMessage {
  const readable = new Readable({ read() {} });
  if (body !== undefined) readable.push(JSON.stringify(body));
  readable.push(null);
  (readable as any).method = method;
  (readable as any).headers = headers;
  return readable as unknown as IncomingMessage;
}

function makeRes(): ServerResponse & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: null as unknown,
    writeHead(status: number, _headers?: Record<string, string>) {
      res._status = status;
      return res;
    },
    end(data?: string) {
      if (data) res._body = JSON.parse(data);
    },
  } as unknown as ServerResponse & { _status: number; _body: unknown };
  return res;
}

async function dispatch(ctx: ApiContext, body: unknown, headers?: Record<string, string>) {
  const req = makeReq("POST", body, headers);
  const res = makeRes();
  const path = API["mediaCache.resolve"].path;
  const url = new URL(`http://localhost${path}`);
  const handled = await registry.dispatch(req, res, url, path, ctx);
  return { handled, res };
}

describe("media-cache resolve handler", () => {
  it("returns the original URL while the first-party route is global", async () => {
    const graphqlFetch = vi.fn();
    const sourceUrl = "https://p16-oec-general-useast5.ttcdn-us.com/image.jpeg?x=1";

    const { handled, res } = await dispatch(
      { authSession: { getAccessToken: () => "token", graphqlFetch } } as unknown as ApiContext,
      { sourceUrl },
    );

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({
      sourceUrl,
      url: sourceUrl,
      proxied: false,
      route: "global",
    });
    expect(graphqlFetch).not.toHaveBeenCalled();
  });

  it("resolves a proxy URL through the authenticated backend on the CN relay route", async () => {
    setFirstPartyDomainRoute("cn-relay");
    const graphqlFetch = vi.fn().mockResolvedValue({
      genOrGetCachedProxyUrl: {
        proxyUrl: "https://media-cache.example.com/cache.jpeg",
        status: "READY",
        lastError: null,
      },
    });

    const { res } = await dispatch(
      { authSession: { getAccessToken: () => "token", graphqlFetch } } as unknown as ApiContext,
      { sourceUrl: "https://p16-oec-general-useast5.ttcdn-us.com/image.jpeg" },
    );

    expect(res._status).toBe(200);
    expect(res._body).toEqual({
      sourceUrl: "https://p16-oec-general-useast5.ttcdn-us.com/image.jpeg",
      url: "https://media-cache.example.com/cache.jpeg",
      proxied: true,
      route: "cn-relay",
    });
    expect(graphqlFetch).toHaveBeenCalledWith(expect.stringContaining("genOrGetCachedProxyUrl"), {
      sourceUrl: "https://p16-oec-general-useast5.ttcdn-us.com/image.jpeg",
    });
  });

  it("resolves a proxy URL on the global route when forceProxy is true", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      genOrGetCachedProxyUrl: {
        proxyUrl: "https://media-cache.example.com/avatar.jpeg",
        status: "READY",
        lastError: null,
      },
    });

    const { res } = await dispatch(
      { authSession: { getAccessToken: () => "token", graphqlFetch } } as unknown as ApiContext,
      {
        sourceUrl: "https://p16-oec-general-useast5.ttcdn-us.com/avatar.jpeg",
        forceProxy: true,
      },
    );

    expect(res._status).toBe(200);
    expect(res._body).toEqual({
      sourceUrl: "https://p16-oec-general-useast5.ttcdn-us.com/avatar.jpeg",
      url: "https://media-cache.example.com/avatar.jpeg",
      proxied: true,
      route: "global",
    });
    expect(graphqlFetch).toHaveBeenCalledWith(expect.stringContaining("genOrGetCachedProxyUrl"), {
      sourceUrl: "https://p16-oec-general-useast5.ttcdn-us.com/avatar.jpeg",
    });
  });

  it("routes first-party object-storage proxy URLs through the CN relay", async () => {
    setFirstPartyDomainRoute("cn-relay");
    const graphqlFetch = vi.fn().mockResolvedValue({
      genOrGetCachedProxyUrl: {
        proxyUrl: "https://minio.rivonclaw.com/rivonclaw-assets/media-cache/2026-06/cache.jpg",
        status: "READY",
        lastError: null,
      },
    });

    const { res } = await dispatch(
      { authSession: { getAccessToken: () => "token", graphqlFetch } } as unknown as ApiContext,
      { sourceUrl: "https://p16-oec-general-useast5.ttcdn-us.com/image.jpeg" },
    );

    expect(res._status).toBe(200);
    expect(res._body).toMatchObject({
      url: "https://minio.zhuazhuaai.cn/rivonclaw-assets/media-cache/2026-06/cache.jpg",
      proxied: true,
      route: "cn-relay",
    });
  });

  it("requires authentication before calling the backend on the CN relay route", async () => {
    setFirstPartyDomainRoute("cn-relay");
    const graphqlFetch = vi.fn();

    const { res } = await dispatch(
      { authSession: { getAccessToken: () => null, graphqlFetch } } as unknown as ApiContext,
      { sourceUrl: "https://p16-oec-general-useast5.ttcdn-us.com/image.jpeg" },
    );

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ error: "Authentication required" });
    expect(graphqlFetch).not.toHaveBeenCalled();
  });

  it("rejects non-local browser origins unless the desktop token is present", async () => {
    setFirstPartyDomainRoute("cn-relay");

    const { res } = await dispatch(
      { desktopApiToken: "expected" } as ApiContext,
      { sourceUrl: "https://p16-oec-general-useast5.ttcdn-us.com/image.jpeg" },
      { origin: "https://evil.example" },
    );

    expect(res._status).toBe(403);
    expect(res._body).toEqual({ error: "Forbidden" });
  });
});
