import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn(), assign: vi.fn() }));
vi.mock("../../api/client.js", () => ({ fetchJson: mocks.fetchJson }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { location: { assign: mocks.assign } });
});
afterEach(() => vi.unstubAllGlobals());

// The global test setup already loaded desktop-auth with the real client, so the
// mocked client only applies to a fresh import.
let createDesktopAuth: typeof import("./desktop-auth.js").createDesktopAuth;
let AUTH_EXPIRED_EVENT: string;
let returnToOwner: () => Promise<void>;
let switchToMember: (memberId: string) => Promise<void>;

beforeEach(async () => {
  vi.resetModules();
  ({ createDesktopAuth, AUTH_EXPIRED_EVENT } = await import("./desktop-auth.js"));
  ({ returnToOwner, switchToMember } = createDesktopAuth());
});

describe("account switching navigation", () => {
  it("reloads the actual account route after switching identity", async () => {
    mocks.fetchJson.mockResolvedValueOnce({ memberLoginAvailable: true });
    mocks.fetchJson.mockResolvedValue({ ok: true });
    await switchToMember("bd-1");
    expect(mocks.fetchJson.mock.calls[1][1]).toEqual({
      method: "POST",
      body: JSON.stringify({ memberId: "bd-1" }),
    });
    expect(mocks.assign).toHaveBeenCalledWith("/account/profile");
    await returnToOwner();
    expect(mocks.assign).toHaveBeenCalledTimes(2);
  });

  it("keeps the current page when the identity change fails", async () => {
    mocks.fetchJson.mockResolvedValueOnce({ memberLoginAvailable: true });
    mocks.fetchJson.mockRejectedValue(new Error("Member disabled"));
    await expect(switchToMember("disabled-bd")).rejects.toThrow("Member disabled");
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("reports an old Desktop without attempting the missing switch endpoint", async () => {
    mocks.fetchJson.mockResolvedValueOnce({ authenticated: true });
    await expect(switchToMember("bd-1")).rejects.toMatchObject({
      code: "ACCOUNT_SWITCH_CLIENT_UNAVAILABLE",
    });
    expect(mocks.fetchJson).toHaveBeenCalledTimes(1);
    expect(mocks.assign).not.toHaveBeenCalled();
  });
});

describe("desktop session", () => {
  it("reads the session, logs in and registers through Desktop's auth endpoints", async () => {
    const auth = createDesktopAuth();
    mocks.fetchJson.mockResolvedValue({ authenticated: true });
    await expect(auth.getSession()).resolves.toEqual({ authenticated: true });
    expect(mocks.fetchJson).toHaveBeenLastCalledWith("/auth/session");

    await auth.login({ email: "a@b.c", password: "pw" });
    expect(mocks.fetchJson).toHaveBeenLastCalledWith("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.c", password: "pw" }),
    });
    await auth.register({ email: "a@b.c", password: "pw", name: "A" });
    expect(mocks.fetchJson).toHaveBeenLastCalledWith("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.c", password: "pw", name: "A" }),
    });
  });

  it("posts logout to Desktop and lets a failure reach the caller", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    const auth = createDesktopAuth();
    await auth.logout();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    await expect(auth.logout()).rejects.toThrow("down");
  });

  it("relays the 401 window event to session-expired subscribers until unsubscribed", () => {
    const listeners = new Map<string, () => void>();
    vi.stubGlobal("window", {
      addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
      removeEventListener: (name: string) => listeners.delete(name),
    });
    const handler = vi.fn();
    const unsubscribe = createDesktopAuth().onSessionExpired(handler);
    listeners.get(AUTH_EXPIRED_EVENT)?.();
    expect(handler).toHaveBeenCalledOnce();
    unsubscribe();
    expect(listeners.has(AUTH_EXPIRED_EVENT)).toBe(false);
  });
});
