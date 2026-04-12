import { describe, it, expect, vi, beforeEach } from "vitest";
import { initCookieSync, pushStoredCookiesToGateway, pullAndPersistCookies } from "../cookie-sync.js";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockIsReady = vi.fn<() => boolean>();
const mockRequest = vi.fn<(...args: any[]) => any>();

vi.mock("../../openclaw/index.js", () => ({
  openClawConnector: {
    get isReady() { return mockIsReady(); },
    request: (...args: any[]) => mockRequest(...args),
  },
}));

// ─── Test Helpers ───────────────────────────────────────────────────────────

function createMockStore() {
  return {
    readCookieSnapshot: vi.fn(),
    ensureDir: vi.fn(),
    writeCookieSnapshot: vi.fn(),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("pushStoredCookiesToGateway", () => {
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = createMockStore();
    mockIsReady.mockReturnValue(false);
  });

  it("does nothing when connector is not ready", async () => {
    mockIsReady.mockReturnValue(false);
    initCookieSync({
      getSessionStateStack: () => ({ store: mockStore }) as any,
      getManagedBrowserEntries: () => [],
    });

    await pushStoredCookiesToGateway();

    expect(mockStore.readCookieSnapshot).not.toHaveBeenCalled();
  });

  it("does nothing when sessionStateStack is null", async () => {
    mockIsReady.mockReturnValue(true);
    initCookieSync({
      getSessionStateStack: () => null,
      getManagedBrowserEntries: () => [],
    });

    await pushStoredCookiesToGateway();

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("calls openClawConnector.request for each entry with stored cookies", async () => {
    mockIsReady.mockReturnValue(true);

    const cookies1 = [{ name: "session", value: "abc" }];
    const cookies2 = [{ name: "token", value: "xyz" }];

    mockStore.readCookieSnapshot
      .mockResolvedValueOnce(Buffer.from(JSON.stringify(cookies1)))
      .mockResolvedValueOnce(Buffer.from(JSON.stringify(cookies2)));

    initCookieSync({
      getSessionStateStack: () => ({ store: mockStore }) as any,
      getManagedBrowserEntries: () => [
        { profileId: "profile-1", port: 9222 },
        { profileId: "profile-2", port: 9223 },
      ] as any,
    });

    await pushStoredCookiesToGateway();

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenCalledWith("browser_profiles_push_cookies", {
      profileName: "profile-1",
      cookies: cookies1,
      cdpPort: 9222,
    });
    expect(mockRequest).toHaveBeenCalledWith("browser_profiles_push_cookies", {
      profileName: "profile-2",
      cookies: cookies2,
      cdpPort: 9223,
    });
  });

  it("skips entries with no stored cookies (readCookieSnapshot returns null)", async () => {
    mockIsReady.mockReturnValue(true);

    mockStore.readCookieSnapshot.mockResolvedValueOnce(null);

    initCookieSync({
      getSessionStateStack: () => ({ store: mockStore }) as any,
      getManagedBrowserEntries: () => [
        { profileId: "profile-empty", port: 9222 },
      ] as any,
    });

    await pushStoredCookiesToGateway();

    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("pullAndPersistCookies", () => {
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = createMockStore();
    mockIsReady.mockReturnValue(false);
  });

  it("does nothing when connector is not ready", async () => {
    mockIsReady.mockReturnValue(false);
    initCookieSync({
      getSessionStateStack: () => ({ store: mockStore }) as any,
      getManagedBrowserEntries: () => [],
    });

    await pullAndPersistCookies("my-profile");

    expect(mockStore.writeCookieSnapshot).not.toHaveBeenCalled();
  });

  it("pulls cookies and writes to store", async () => {
    mockIsReady.mockReturnValue(true);

    const cookies = [{ name: "auth", value: "token123", domain: ".example.com" }];
    mockRequest.mockResolvedValue({ cookies });

    initCookieSync({
      getSessionStateStack: () => ({ store: mockStore }) as any,
      getManagedBrowserEntries: () => [],
    });

    await pullAndPersistCookies("my-profile");

    expect(mockRequest).toHaveBeenCalledWith("browser_profiles_pull_cookies", {
      profileName: "my-profile",
    });
    expect(mockStore.ensureDir).toHaveBeenCalledWith("managed_profile", "my-profile");
    expect(mockStore.writeCookieSnapshot).toHaveBeenCalledWith(
      "managed_profile",
      "my-profile",
      Buffer.from(JSON.stringify(cookies), "utf-8"),
    );
  });

  it("skips when gateway returns empty cookies array", async () => {
    mockIsReady.mockReturnValue(true);

    mockRequest.mockResolvedValue({ cookies: [] });

    initCookieSync({
      getSessionStateStack: () => ({ store: mockStore }) as any,
      getManagedBrowserEntries: () => [],
    });

    await pullAndPersistCookies("empty-profile");

    expect(mockStore.ensureDir).not.toHaveBeenCalled();
    expect(mockStore.writeCookieSnapshot).not.toHaveBeenCalled();
  });
});
