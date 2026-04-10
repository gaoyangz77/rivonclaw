import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiContext } from "../../app/api-context.js";
import { RouteRegistry } from "../../infra/api/route-registry.js";
import { registerAuthHandlers } from "../api.js";

// ---------------------------------------------------------------------------
// Test registry — mimics production dispatch
// ---------------------------------------------------------------------------

let registry: RouteRegistry;

beforeEach(() => {
  registry = new RouteRegistry();
  registerAuthHandlers(registry);
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

const mockUser = {
  userId: "u1",
  email: "test@example.com",
  name: "Test",
  plan: "FREE",
  createdAt: "2025-01-01T00:00:00Z",
  enrolledModules: [],
  entitlementKeys: [],
};

// ---------------------------------------------------------------------------
// Tests: POST /api/auth/login
// ---------------------------------------------------------------------------

describe("POST /api/auth/login", () => {
  let onAuthChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onAuthChange = vi.fn();
  });

  it("returns 200 with user on successful login", async () => {
    const ctx = {
      authSession: {
        loginWithCredentials: vi.fn().mockResolvedValue(mockUser),
      },
      onAuthChange,
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/login", ctx, { email: "test@example.com", password: "pass123" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ user: mockUser });
    expect(ctx.authSession!.loginWithCredentials).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "pass123",
    });
    expect(onAuthChange).toHaveBeenCalled();
  });

  it("returns 400 when email is missing", async () => {
    const ctx = {
      authSession: { loginWithCredentials: vi.fn() },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/login", ctx, { password: "pass123" });

    expect(handled).toBe(true);
    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: "Missing email or password" });
  });

  it("returns 400 when password is missing", async () => {
    const ctx = {
      authSession: { loginWithCredentials: vi.fn() },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/login", ctx, { email: "test@example.com" });

    expect(handled).toBe(true);
    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: "Missing email or password" });
  });

  it("returns 400 when cloud returns an error", async () => {
    const ctx = {
      authSession: {
        loginWithCredentials: vi.fn().mockRejectedValue(new Error("Invalid credentials")),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/login", ctx, { email: "test@example.com", password: "wrong" });

    expect(handled).toBe(true);
    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: "Invalid credentials" });
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/auth/register
// ---------------------------------------------------------------------------

describe("POST /api/auth/register", () => {
  let onAuthChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onAuthChange = vi.fn();
  });

  it("returns 200 with user on successful registration", async () => {
    const ctx = {
      authSession: {
        registerWithCredentials: vi.fn().mockResolvedValue(mockUser),
      },
      onAuthChange,
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/register", ctx, { email: "new@example.com", password: "securepass", name: "New User" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ user: mockUser });
    expect(ctx.authSession!.registerWithCredentials).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "securepass",
      name: "New User",
    });
    expect(onAuthChange).toHaveBeenCalled();
  });

  it("returns 400 when email or password is missing", async () => {
    const ctx = {
      authSession: { registerWithCredentials: vi.fn() },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/register", ctx, { email: "new@example.com" });

    expect(handled).toBe(true);
    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: "Missing email or password" });
  });

  it("returns 400 when cloud returns an error", async () => {
    const ctx = {
      authSession: {
        registerWithCredentials: vi.fn().mockRejectedValue(new Error("Email already exists")),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/register", ctx, { email: "dup@example.com", password: "pass" });

    expect(handled).toBe(true);
    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: "Email already exists" });
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/auth/session
// ---------------------------------------------------------------------------

describe("GET /api/auth/session", () => {
  it("returns user and authenticated flag (no accessToken exposed)", async () => {
    const ctx = {
      authSession: {
        getCachedUser: vi.fn().mockReturnValue(mockUser),
        getAccessToken: vi.fn().mockReturnValue("some-token"),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("GET", "/api/auth/session", ctx);

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ user: mockUser, authenticated: true });
    expect((res._body as any).accessToken).toBeUndefined();
  });

  it("returns authenticated: false when no token exists", async () => {
    const ctx = {
      authSession: {
        getCachedUser: vi.fn().mockReturnValue(null),
        getAccessToken: vi.fn().mockReturnValue(null),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("GET", "/api/auth/session", ctx);

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ user: null, authenticated: false });
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/auth/request-captcha
// ---------------------------------------------------------------------------

describe("POST /api/auth/request-captcha", () => {
  it("returns captcha data on success", async () => {
    const captchaData = { token: "cap-tok", svg: "<svg>...</svg>" };
    const ctx = {
      authSession: {
        requestCaptcha: vi.fn().mockResolvedValue(captchaData),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/request-captcha", ctx);

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual(captchaData);
  });

  it("returns 500 on captcha failure", async () => {
    const ctx = {
      authSession: {
        requestCaptcha: vi.fn().mockRejectedValue(new Error("Rate limited")),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/request-captcha", ctx);

    expect(handled).toBe(true);
    expect(res._status).toBe(500);
    expect(res._body).toEqual({ error: "Rate limited" });
  });
});

// ---------------------------------------------------------------------------
// Tests: backward compatibility — existing routes still work
// ---------------------------------------------------------------------------

describe("backward compatibility", () => {
  it("POST /api/auth/store-tokens still works", async () => {
    const ctx = {
      authSession: {
        storeTokens: vi.fn().mockResolvedValue(undefined),
        validate: vi.fn().mockResolvedValue(mockUser),
        setCachedUser: vi.fn(),
      },
      onAuthChange: vi.fn(),
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/store-tokens", ctx, { accessToken: "at", refreshToken: "rt" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect((res._body as any).ok).toBe(true);
    expect((res._body as any).user).toEqual(mockUser);
  });

  it("POST /api/auth/refresh still works", async () => {
    const ctx = {
      authSession: {
        refresh: vi.fn().mockResolvedValue("new-at"),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", "/api/auth/refresh", ctx);

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect((res._body as any).accessToken).toBe("new-at");
  });

  it("returns unauthenticated when authSession is not present", async () => {
    const ctx = {} as ApiContext;

    const { handled, res } = await dispatch("GET", "/api/auth/session", ctx);

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ user: null, authenticated: false });
  });
});
