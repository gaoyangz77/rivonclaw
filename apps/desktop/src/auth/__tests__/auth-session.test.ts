import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SecretStore } from "@rivonclaw/secrets";
import { AuthSessionManager } from "../auth-session.js";

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

const mockUser = {
  userId: "u1",
  email: "test@example.com",
  name: "Test",
  plan: "FREE" as any,
  createdAt: "2025-01-01T00:00:00Z",
  enrolledModules: [],
  entitlementKeys: [],
  llmKey: null,
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
