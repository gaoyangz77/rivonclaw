import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GQL } from "@rivonclaw/core";
import type { SecretStore } from "@rivonclaw/secrets";
import { AuthSessionManager } from "../session.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSecretStore(): SecretStore {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
  } as unknown as SecretStore;
}

const mockUser: GQL.MeResponse = {
  userId: "u1",
  email: "test@example.com",
  name: "Test",
  createdAt: "2025-01-01T00:00:00Z",
  enrolledModules: ["GLOBAL_ECOMMERCE_SELLER"],
  entitlementKeys: [],
  defaultRunProfileId: "SHOP_OPERATIONS",
};

// ---------------------------------------------------------------------------
// Tests: loginWithCredentials
// ---------------------------------------------------------------------------

describe("AuthSessionManager.loginWithCredentials", () => {
  let secretStore: SecretStore;
  let fetchFn: ReturnType<typeof vi.fn>;
  let manager: AuthSessionManager;

  beforeEach(() => {
    secretStore = makeSecretStore();
    fetchFn = vi.fn();
    manager = new AuthSessionManager(secretStore, "en", fetchFn as unknown as typeof fetch);
  });

  it("calls graphqlFetch with the correct mutation, stores tokens, and returns user", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        data: {
          login: {
            accessToken: "at-new",
            refreshToken: "rt-new",
            user: mockUser,
          },
        },
      }),
    });

    const result = await manager.loginWithCredentials({
      email: "test@example.com",
      password: "password123",
    });

    expect(result).toEqual(mockUser);

    // Verify tokens were stored
    expect(secretStore.set).toHaveBeenCalledWith("auth.accessToken", "at-new");
    expect(secretStore.set).toHaveBeenCalledWith("auth.refreshToken", "rt-new");

    // Verify the access token is now available
    expect(manager.getAccessToken()).toBe("at-new");

    // Verify the cached user is set
    expect(manager.getCachedUser()).toEqual(mockUser);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Verify graphqlFetch was called with a login mutation
    const callBody = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(callBody.query).toContain("login(input: $input)");
    expect(callBody.variables).toEqual({
      input: { email: "test@example.com", password: "password123" },
    });
  });

  it("throws on auth error", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        errors: [{ message: "Invalid credentials" }],
      }),
    });

    await expect(
      manager.loginWithCredentials({ email: "bad@test.com", password: "wrong" }),
    ).rejects.toThrow("Invalid credentials");

    // Tokens should not have been stored
    expect(manager.getAccessToken()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: registerWithCredentials
// ---------------------------------------------------------------------------

describe("AuthSessionManager.registerWithCredentials", () => {
  let secretStore: SecretStore;
  let fetchFn: ReturnType<typeof vi.fn>;
  let manager: AuthSessionManager;

  beforeEach(() => {
    secretStore = makeSecretStore();
    fetchFn = vi.fn();
    manager = new AuthSessionManager(secretStore, "en", fetchFn as unknown as typeof fetch);
  });

  it("calls graphqlFetch with the correct mutation, stores tokens, and returns user", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        data: {
          register: {
            accessToken: "at-reg",
            refreshToken: "rt-reg",
            user: mockUser,
          },
        },
      }),
    });

    const result = await manager.registerWithCredentials({
      email: "new@example.com",
      password: "securepass",
      name: "New User",
    });

    expect(result).toEqual(mockUser);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Verify tokens were stored
    expect(secretStore.set).toHaveBeenCalledWith("auth.accessToken", "at-reg");
    expect(secretStore.set).toHaveBeenCalledWith("auth.refreshToken", "rt-reg");

    // Verify graphqlFetch was called with a register mutation
    const callBody = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(callBody.query).toContain("register(input: $input)");
    expect(callBody.variables).toEqual({
      input: { email: "new@example.com", password: "securepass", name: "New User" },
    });
  });

  it("throws on registration error", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        errors: [{ message: "Email already exists" }],
      }),
    });

    await expect(
      manager.registerWithCredentials({ email: "dup@test.com", password: "pass" }),
    ).rejects.toThrow("Email already exists");
  });
});

// ---------------------------------------------------------------------------
// Tests: requestCaptcha
// ---------------------------------------------------------------------------

describe("AuthSessionManager.requestCaptcha", () => {
  let secretStore: SecretStore;
  let fetchFn: ReturnType<typeof vi.fn>;
  let manager: AuthSessionManager;

  beforeEach(() => {
    secretStore = makeSecretStore();
    fetchFn = vi.fn();
    manager = new AuthSessionManager(secretStore, "en", fetchFn as unknown as typeof fetch);
  });

  it("returns captcha data from the cloud", async () => {
    const captchaData = { token: "cap-tok", svg: "<svg>...</svg>" };
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        data: { requestCaptcha: captchaData },
      }),
    });

    const result = await manager.requestCaptcha();

    expect(result).toEqual(captchaData);

    const callBody = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(callBody.query).toContain("requestCaptcha");
    expect(callBody.variables).toBeUndefined();
  });

  it("passes deterministic captcha request token to the cloud", async () => {
    const captchaData = { token: "backend-cap-tok", svg: "<svg>0000</svg>" };
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        data: { requestCaptcha: captchaData },
      }),
    });

    const result = await manager.requestCaptcha({ deterministicToken: "request-token" });

    expect(result).toEqual(captchaData);

    const callBody = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(callBody.query).toContain("requestCaptcha");
    expect(callBody.variables).toEqual({ deterministicToken: "request-token" });
  });

  it("throws on captcha request failure", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        errors: [{ message: "Rate limited" }],
      }),
    });

    await expect(manager.requestCaptcha()).rejects.toThrow("Rate limited");
  });
});

describe("AuthSessionManager.refresh", () => {
  let secretStore: SecretStore;
  let fetchFn: ReturnType<typeof vi.fn>;
  let manager: AuthSessionManager;

  beforeEach(async () => {
    secretStore = makeSecretStore();
    fetchFn = vi.fn();
    manager = new AuthSessionManager(secretStore, "en", fetchFn as unknown as typeof fetch);
    await manager.storeTokens("stale-at", "stale-rt");
  });

  it("keeps stored tokens by default when refresh sees a different JWT signature", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        errors: [{ message: "invalid signature" }],
      }),
    });

    await expect(manager.refresh()).rejects.toThrow("invalid signature");

    expect(manager.getAccessToken()).toBe("stale-at");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.refreshToken");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("only clears stored tokens when explicitly asked and the JWT signature is invalid", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        errors: [{ message: "invalid signature" }],
      }),
    });

    await expect(manager.refresh({ clearOnInvalid: true })).rejects.toThrow("invalid signature");

    expect(manager.getAccessToken()).toBeNull();
    expect(manager.getCachedUser()).toBeNull();
    expect(secretStore.delete).toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).toHaveBeenCalledWith("auth.refreshToken");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("does not clear stored tokens for generic auth errors even when clearing is requested", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 401,
      json: async () => ({
        errors: [{ message: "Authentication required" }],
      }),
    });

    await expect(manager.refresh({ clearOnInvalid: true })).rejects.toThrow("Authentication required");

    expect(manager.getAccessToken()).toBe("stale-at");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.refreshToken");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("does not clear stored tokens when background GraphQL auto-refresh sees an invalid JWT", async () => {
    fetchFn
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          errors: [{ message: "Authentication required" }],
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          errors: [{ message: "invalid signature" }],
        }),
      });

    await expect(
      manager.graphqlFetch("query CreateCsSession { shops { id } }"),
    ).rejects.toThrow("invalid signature");

    expect(manager.getAccessToken()).toBe("stale-at");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.refreshToken");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("can explicitly clear stored tokens when GraphQL auto-refresh sees a JWT signature mismatch", async () => {
    fetchFn
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          errors: [{ message: "Authentication required" }],
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          errors: [{ message: "invalid signature" }],
        }),
      });

    await expect(
      manager.graphqlFetch("query ValidateMe { me { userId } }", undefined, { clearOnInvalidRefresh: true }),
    ).rejects.toThrow("invalid signature");

    expect(manager.getAccessToken()).toBeNull();
    expect(secretStore.delete).toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).toHaveBeenCalledWith("auth.refreshToken");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does not recursively refresh when the refresh mutation returns 401", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 401,
      json: async () => ({
        errors: [{ message: "Authentication required" }],
      }),
    });

    await expect(manager.refresh()).rejects.toThrow("Authentication required");

    expect(manager.getAccessToken()).toBe("stale-at");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.refreshToken");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("keeps stored tokens when validate sees an invalid JWT", async () => {
    await manager.storeTokens("validate-at", "validate-rt");
    manager.setCachedUser(mockUser);

    fetchFn
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          errors: [{ message: "Authentication required" }],
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          errors: [{ message: "invalid signature" }],
        }),
      });

    await expect(manager.validate()).resolves.toBeNull();

    expect(manager.getAccessToken()).toBe("validate-at");
    expect(manager.getCachedUser()).toBeNull();
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.refreshToken");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
