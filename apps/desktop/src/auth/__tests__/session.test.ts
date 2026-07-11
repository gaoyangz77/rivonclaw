import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GQL } from "@rivonclaw/core";
import { SecretStoreAccessError, type SecretStore } from "@rivonclaw/secrets";
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

describe("AuthSessionManager secure storage", () => {
  it("keeps desktop startup alive while exposing an unavailable keychain", async () => {
    const secretStore = makeSecretStore();
    secretStore.get = vi.fn(async () => {
      throw new SecretStoreAccessError("get", "auth.accessToken");
    });
    const manager = new AuthSessionManager(secretStore, "en", vi.fn() as unknown as typeof fetch);

    await expect(manager.loadFromKeychain()).resolves.toBeUndefined();
    expect(manager.getAccessToken()).toBeNull();
    expect(manager.isSecureStorageAvailable()).toBe(false);
  });

  it("marks secure storage healthy after tokens are persisted", async () => {
    const secretStore = makeSecretStore();
    const manager = new AuthSessionManager(
      secretStore,
      "en",
      vi.fn() as unknown as typeof fetch,
    );

    await manager.storeTokens("access", "refresh");
    expect(manager.isSecureStorageAvailable()).toBe(true);
    expect(vi.mocked(secretStore.set).mock.calls).toEqual([
      ["auth.refreshToken", "refresh"],
      ["auth.accessToken", "access"],
    ]);
  });
});

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

  it("does not clear stored tokens for a JWT signature error even when clearing is requested", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        errors: [{ message: "invalid signature" }],
      }),
    });

    await expect(manager.refresh({ clearOnInvalid: true })).rejects.toThrow("invalid signature");

    expect(manager.getAccessToken()).toBe("stale-at");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.refreshToken");
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

  it("clears stored tokens when the backend rejects the refresh token", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        errors: [{ message: "Refresh token revoked or invalid" }],
      }),
    });

    await expect(manager.refresh()).rejects.toThrow("Refresh token revoked or invalid");

    expect(manager.getAccessToken()).toBeNull();
    expect(manager.getCachedUser()).toBeNull();
    expect(secretStore.delete).toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).toHaveBeenCalledWith("auth.refreshToken");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("preserves a newer token persisted while an older refresh request was in flight", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => {
        await secretStore.set("auth.refreshToken", "newer-rt");
        await secretStore.set("auth.accessToken", "newer-at");
        return { errors: [{ message: "Refresh token revoked or invalid" }] };
      },
    });

    await expect(manager.refresh()).rejects.toThrow("Refresh token revoked or invalid");

    expect(manager.getAccessToken()).toBe("newer-at");
    expect(secretStore.delete).not.toHaveBeenCalled();
  });

  it("does not clear tokens for an imprecise refresh-token error", async () => {
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        errors: [{ message: "Refresh token temporarily unavailable" }],
      }),
    });

    await expect(manager.refresh()).rejects.toThrow("Refresh token temporarily unavailable");

    expect(manager.getAccessToken()).toBe("stale-at");
    expect(secretStore.delete).not.toHaveBeenCalled();
  });

  it("keeps a successfully refreshed session in memory when secure storage is unavailable", async () => {
    vi.mocked(secretStore.set).mockImplementation(async (key) => {
      if (key === "auth.refreshToken") {
        throw new SecretStoreAccessError("set", key);
      }
    });
    fetchFn.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        data: {
          refreshToken: {
            accessToken: "fresh-at",
            refreshToken: "fresh-rt",
            user: mockUser,
          },
        },
      }),
    });

    await expect(manager.refresh()).resolves.toBe("fresh-at");

    expect(manager.getAccessToken()).toBe("fresh-at");
    expect(manager.getCachedUser()).toEqual(mockUser);
    expect(manager.isSecureStorageAvailable()).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
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

  it("does not clear stored tokens when GraphQL explicitly requests clearing for a JWT signature mismatch", async () => {
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

    expect(manager.getAccessToken()).toBe("stale-at");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.refreshToken");
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

  it("keeps the cached auth session when validate sees a generic auth failure", async () => {
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
        status: 401,
        json: async () => ({
          errors: [{ message: "Authentication required" }],
        }),
      });

    await expect(manager.validate()).resolves.toBeNull();

    expect(manager.getAccessToken()).toBe("validate-at");
    expect(manager.getCachedUser()).toEqual(mockUser);
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.refreshToken");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("keeps the cached auth session when validate sees an illegal JWT signature", async () => {
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
    expect(manager.getCachedUser()).toEqual(mockUser);
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.accessToken");
    expect(secretStore.delete).not.toHaveBeenCalledWith("auth.refreshToken");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
