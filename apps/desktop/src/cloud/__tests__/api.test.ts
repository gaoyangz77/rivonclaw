import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiContext } from "../../app/api-context.js";
import { RouteRegistry } from "../../infra/api/route-registry.js";
import { registerCloudHandlers } from "../api.js";

// ---------------------------------------------------------------------------
// Test registry
// ---------------------------------------------------------------------------

let registry: RouteRegistry;

beforeEach(() => {
  registry = new RouteRegistry();
  registerCloudHandlers(registry);
});

async function dispatch(method: string, path: string, ctx: ApiContext, body?: unknown) {
  const req = makeReq(method, body);
  const res = makeRes();
  const url = new URL(`http://localhost${path}`);
  const handled = await registry.dispatch(req, res, url, path, ctx);
  return { handled, res };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(method: string, body?: unknown): IncomingMessage {
  const readable = new Readable({ read() {} });
  if (body !== undefined) {
    readable.push(JSON.stringify(body));
  }
  readable.push(null);
  (readable as any).method = method;
  (readable as any).headers = {};
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("cloud-graphql handler", () => {
  const pathname = "/api/cloud/graphql";

  it("returns false for non-matching routes", async () => {
    const ctx = {} as ApiContext;
    const { handled } = await dispatch("POST", "/api/other", ctx, { query: "{ me { id } }" });
    expect(handled).toBe(false);
  });

  it("rejects non-POST requests to /api/cloud/graphql via REST prefix guard", async () => {
    const ctx = {} as ApiContext;
    const { handled, res } = await dispatch("GET", pathname, ctx);
    // The REST prefix handler matches /api/cloud/* and rejects _rest === "graphql"
    expect(handled).toBe(true);
    expect(res._status).toBe(404);
    expect(res._body).toEqual({ error: "Not found" });
  });

  it("returns 200 with errors when authSession is not available", async () => {
    const ctx = {} as ApiContext;
    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ me { id } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Auth session not ready" }] });
  });

  it("returns 200 with errors when body is missing query field", async () => {
    const ctx = {
      authSession: { getAccessToken: () => "valid-token" },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { variables: {} });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Missing query" }] });
  });

  it("forwards public queries without token (transparent proxy)", async () => {
    const mockData = { skills: [{ slug: "1password" }] };
    const ctx = {
      authSession: {
        getAccessToken: () => null,
        graphqlFetch: vi.fn().mockResolvedValue(mockData),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ skills { slug } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ data: mockData });
  });

  it("returns { data } on successful graphqlFetch", async () => {
    const mockData = {
      me: {
        userId: "1",
        email: "test@example.com",
        name: "Test",
        plan: "FREE",
        createdAt: "2025-01-01T00:00:00Z",
        enrolledModules: [],
        entitlementKeys: [],
        defaultRunProfileId: null,
        llmKey: null,
      },
    };
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch: vi.fn().mockResolvedValue(mockData),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ me { userId email } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ data: mockData });
  });

  it("returns 200 with errors on auth-related errors", async () => {
    const ctx = {
      authSession: {
        getAccessToken: () => "expired-token",
        graphqlFetch: vi.fn().mockRejectedValue(new Error("Token expired")),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ me { id } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Token expired" }] });
  });

  it("returns 200 with errors for 'Not authenticated'", async () => {
    const ctx = {
      authSession: {
        getAccessToken: () => null,
        graphqlFetch: vi.fn().mockRejectedValue(new Error("Not authenticated")),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ me { id } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Not authenticated" }] });
  });

  it("returns 200 with errors on non-auth errors", async () => {
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch: vi.fn().mockRejectedValue(new Error("Internal server error")),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ shop { id } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Internal server error" }] });
  });

  it("handles non-Error thrown values", async () => {
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch: vi.fn().mockRejectedValue("string-error"),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ me { id } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Cloud GraphQL request failed" }] });
  });
});
