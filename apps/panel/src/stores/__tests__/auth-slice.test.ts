// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before the import of the module under test
// ---------------------------------------------------------------------------

const mockFetchJson = vi.fn();
const mockFetchVoid = vi.fn();

vi.mock("../../api/client.js", () => ({
  fetchJson: (...args: unknown[]) => mockFetchJson(...args),
  fetchVoid: (...args: unknown[]) => mockFetchVoid(...args),
}));

const mockQuery = vi.fn();
vi.mock("../../api/apollo-client.js", () => ({
  getClient: () => ({ query: mockQuery }),
}));

vi.mock("../../api/settings.js", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("../../api/auth-queries.js", () => ({
  ME_QUERY: "ME_QUERY_MOCK",
}));

// ---------------------------------------------------------------------------
// Minimal store harness — creates a fake PanelStore with only the auth slice
// and stubs for the methods that auth-slice calls on sibling slices.
// ---------------------------------------------------------------------------

import { createAuthSlice } from "../slices/auth-slice.js";
import type { AuthSlice } from "../slices/auth-slice.js";

type StubStore = AuthSlice & {
  syncEnrolledModules: ReturnType<typeof vi.fn>;
  fetchSubscription: ReturnType<typeof vi.fn>;
  fetchLlmQuota: ReturnType<typeof vi.fn>;
  fetchSurfaces: ReturnType<typeof vi.fn>;
  fetchRunProfiles: ReturnType<typeof vi.fn>;
  fetchAvailableTools: ReturnType<typeof vi.fn>;
  fetchProviderKeys: ReturnType<typeof vi.fn>;
  resetSubscription: ReturnType<typeof vi.fn>;
  resetSurfaces: ReturnType<typeof vi.fn>;
  resetRunProfiles: ReturnType<typeof vi.fn>;
  resetAvailableTools: ReturnType<typeof vi.fn>;
};

function createTestStore(): StubStore {
  let state: StubStore;
  const set = (partial: Partial<StubStore>) => {
    Object.assign(state, partial);
  };
  const get = () => state;

  // Stubs for sibling slices
  const siblings = {
    syncEnrolledModules: vi.fn(),
    fetchSubscription: vi.fn(),
    fetchLlmQuota: vi.fn(),
    fetchSurfaces: vi.fn(),
    fetchRunProfiles: vi.fn(),
    fetchAvailableTools: vi.fn(),
    fetchProviderKeys: vi.fn(),
    resetSubscription: vi.fn(),
    resetSurfaces: vi.fn(),
    resetRunProfiles: vi.fn(),
    resetAvailableTools: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authSlice = (createAuthSlice as any)(set, get, {} as any);
  state = { ...authSlice, ...siblings };
  return state;
}

const FAKE_USER = {
  userId: "u1",
  email: "a@b.com",
  name: "Test",
  plan: "FREE",
  createdAt: "2024-01-01",
  enrolledModules: [],
  entitlementKeys: [],
  defaultRunProfileId: null,
  llmKey: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auth-slice", () => {
  describe("state shape", () => {
    it("does not have a token property", () => {
      const store = createTestStore();
      expect("token" in store).toBe(false);
    });

    it("has an authenticated property initialised to false", () => {
      const store = createTestStore();
      expect(store.authenticated).toBe(false);
    });

    it("does not have a setToken method", () => {
      const store = createTestStore();
      expect("setToken" in store).toBe(false);
    });
  });

  describe("login()", () => {
    it("calls fetchJson /auth/login and sets user + authenticated", async () => {
      const store = createTestStore();
      mockFetchJson.mockResolvedValue({ user: FAKE_USER });

      const input = { email: "a@b.com", password: "pw", captchaToken: "ct", captchaAnswer: "ca" };
      await store.login(input);

      expect(mockFetchJson).toHaveBeenCalledWith("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      expect(store.user).toEqual(FAKE_USER);
      expect(store.authenticated).toBe(true);
      expect(store.syncEnrolledModules).toHaveBeenCalled();
      expect(store.fetchSubscription).toHaveBeenCalled();
      expect(store.fetchProviderKeys).toHaveBeenCalled();
    });
  });

  describe("register()", () => {
    it("calls fetchJson /auth/register and sets user + authenticated", async () => {
      const store = createTestStore();
      mockFetchJson.mockResolvedValue({ user: FAKE_USER });

      const input = { email: "a@b.com", password: "pw", name: "Test", captchaToken: "ct", captchaAnswer: "ca" };
      await store.register(input);

      expect(mockFetchJson).toHaveBeenCalledWith("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      expect(store.user).toEqual(FAKE_USER);
      expect(store.authenticated).toBe(true);
      expect(store.syncEnrolledModules).toHaveBeenCalled();
    });
  });

  describe("initSession()", () => {
    it("hydrates from /auth/session when authenticated with user", async () => {
      const store = createTestStore();
      mockFetchJson.mockResolvedValue({ authenticated: true, user: FAKE_USER });

      await store.initSession();

      expect(mockFetchJson).toHaveBeenCalledWith("/auth/session");
      expect(store.user).toEqual(FAKE_USER);
      expect(store.authenticated).toBe(true);
      expect(store.authLoading).toBe(false);
      expect(store.fetchSubscription).toHaveBeenCalled();
    });

    it("falls back to ME_QUERY when authenticated but no user", async () => {
      const store = createTestStore();
      mockFetchJson.mockResolvedValue({ authenticated: true, user: null });
      mockQuery.mockResolvedValue({ data: { me: FAKE_USER } });

      await store.initSession();

      expect(mockQuery).toHaveBeenCalledWith({
        query: "ME_QUERY_MOCK",
        fetchPolicy: "network-only",
      });
      expect(store.user).toEqual(FAKE_USER);
      expect(store.authenticated).toBe(true);
      expect(store.authLoading).toBe(false);
    });

    it("sets authenticated=false when ME_QUERY fails", async () => {
      const store = createTestStore();
      mockFetchJson.mockResolvedValue({ authenticated: true, user: null });
      mockQuery.mockRejectedValue(new Error("network error"));

      await store.initSession();

      expect(store.authenticated).toBe(false);
      expect(store.authLoading).toBe(false);
    });

    it("sets authLoading=false when not authenticated", async () => {
      const store = createTestStore();
      mockFetchJson.mockResolvedValue({ authenticated: false, user: null });

      await store.initSession();

      expect(store.authenticated).toBe(false);
      expect(store.user).toBeNull();
      expect(store.authLoading).toBe(false);
      expect(store.fetchProviderKeys).toHaveBeenCalled();
    });

    it("sets authLoading=false when Desktop is unreachable", async () => {
      const store = createTestStore();
      mockFetchJson.mockRejectedValue(new Error("network error"));

      await store.initSession();

      expect(store.authLoading).toBe(false);
      expect(store.fetchProviderKeys).toHaveBeenCalled();
    });
  });

  describe("logout()", () => {
    it("calls fetchVoid /auth/logout and clears state", () => {
      const store = createTestStore();
      // Simulate logged-in state
      Object.assign(store, { user: FAKE_USER, authenticated: true });

      store.logout();

      expect(mockFetchVoid).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
      expect(store.user).toBeNull();
      expect(store.authenticated).toBe(false);
      expect(store.resetSubscription).toHaveBeenCalled();
      expect(store.resetSurfaces).toHaveBeenCalled();
      expect(store.resetRunProfiles).toHaveBeenCalled();
      expect(store.resetAvailableTools).toHaveBeenCalled();
      expect(store.fetchProviderKeys).toHaveBeenCalled();
    });
  });

  describe("clearAuth()", () => {
    it("clears user and authenticated without calling /auth/logout", () => {
      const store = createTestStore();
      Object.assign(store, { user: FAKE_USER, authenticated: true });

      store.clearAuth();

      expect(mockFetchVoid).not.toHaveBeenCalled();
      expect(store.user).toBeNull();
      expect(store.authenticated).toBe(false);
      expect(store.resetSubscription).toHaveBeenCalled();
      expect(store.fetchProviderKeys).toHaveBeenCalled();
    });
  });
});
