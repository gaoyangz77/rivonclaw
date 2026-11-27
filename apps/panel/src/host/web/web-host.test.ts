import { describe, expect, it, vi } from "vitest";
import { createWebHost, signInUrl, type WebHostOptions } from "./web-host.js";

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const refreshOk = () =>
  respond({ data: { webRefresh: { accessToken: "tok", user: { userId: "u1", email: "a@b.c" } } } });
const refreshDenied = () => respond({ errors: [{ message: "Browser session not found" }], data: null });

function setup(fetchImpl: typeof fetch, overrides: Partial<WebHostOptions> = {}) {
  const store = {
    clearCloudEntities: vi.fn(),
    clearCloudDataExceptUser: vi.fn(),
    setAuthBootstrap: vi.fn(),
    ingestGraphQLResponse: vi.fn(),
    removeEntity: vi.fn(),
    upsertShopsFromGraphQL: vi.fn(),
    shopIds: () => [],
  };
  const storage = new Map<string, string>();
  const navigate = vi.fn();
  const applySettings = vi.fn();
  const host = createWebHost({
    store,
    applySettings,
    storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v) },
    navigate,
    currentPath: () => "/commerce/shops?x=1",
    fetchImpl,
    wsUrl: "ws://unused",
    ...overrides,
  });
  return { host, store, navigate, applySettings, storage };
}

describe("web host", () => {
  it("is the web host with no Desktop capability and a local state feed", () => {
    const { host } = setup(vi.fn());
    expect(host.kind).toBe("web");
    expect(host.capabilities.size).toBe(0);
    expect(host.stateFeed).toBe("local");
  });

  it("sends a signed-out viewer to the account page, returning to where they were", async () => {
    const { host, navigate } = setup(vi.fn().mockResolvedValue(refreshDenied()));
    await expect(host.start()).resolves.toBe(false);
    expect(navigate).toHaveBeenCalledWith("/account/login?returnPath=%2Fcommerce%2Fshops%3Fx%3D1");
    expect(signInUrl("/a b")).toBe("/account/login?returnPath=%2Fa%20b");
  });

  it("starts with a session: loads the stored preferences, then the entities in the background", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const query = JSON.parse(String(init.body)).query as string;
      if (query.includes("webRefresh")) return refreshOk();
      if (query.includes("me {") || query.includes("me{")) return respond({ data: { me: null } });
      return respond({ data: {} });
    });
    const { host, store, applySettings } = setup(fetchImpl);
    const snapshots = vi.fn();
    host.events.subscribe("entity-snapshot", snapshots);

    await expect(host.start()).resolves.toBe(true);
    expect(applySettings).toHaveBeenCalledWith({});
    // No account behind the session: the bootstrap reports signed out and no snapshot is announced.
    await expect(host.auth.getSession()).resolves.toMatchObject({ authenticated: true });
    expect(store.setAuthBootstrap).toHaveBeenCalledWith("signed_out", null);
    expect(snapshots).not.toHaveBeenCalled();
  });

  it("announces 'entities reloaded' once the startup queries have populated the store", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const query = JSON.parse(String(init.body)).query as string;
      if (query.includes("webRefresh")) return refreshOk();
      if (query.includes("me {") || query.includes("me{")) {
        return respond({ data: { me: { userId: "u1", enrolledModules: [] } } });
      }
      return respond({ data: {} });
    });
    const { host, store } = setup(fetchImpl);
    const snapshots = vi.fn();
    host.events.subscribe("entity-snapshot", snapshots);
    await host.start();
    await host.auth.getSession();
    expect(store.ingestGraphQLResponse).toHaveBeenCalledWith({ me: { userId: "u1", enrolledModules: [] } });
    expect(snapshots).toHaveBeenCalledWith(null);
    // A late subscriber still hears about the load that already happened.
    const late = vi.fn();
    host.events.subscribe("entity-snapshot", late);
    expect(late).toHaveBeenCalledWith(null);
  });

  it("maps cloud REST paths onto the backend and authenticates them, refreshing once on 401", async () => {
    const calls: Array<{ url: string; authorization: string | null }> = [];
    let uploads = 0;
    const fetchImpl = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (url === "/api/graphql") return refreshOk();
      uploads += 1;
      calls.push({ url, authorization: new Headers(init.headers).get("authorization") });
      return uploads === 1 ? new Response("", { status: 401 }) : new Response("ok");
    });
    const { host } = setup(fetchImpl);
    // Install a session first.
    await host.session.boot();

    const response = await host.cloud.fetch("/api/cloud/uploads/images", { method: "POST" });

    expect(await response.text()).toBe("ok");
    expect(calls.map((c) => c.url)).toEqual(["/api/uploads/images", "/api/uploads/images"]);
    expect(calls.every((c) => c.authorization === "Bearer tok")).toBe(true);
    await expect(host.cloud.fetch("/api/other", {})).rejects.toThrow(/Not a cloud REST path/);
  });

  it("starts sign-in by leaving for the account page, and refuses in-Panel credential flows", async () => {
    const { host, navigate } = setup(vi.fn());
    host.auth.startSignIn("/commerce/ads");
    expect(navigate).toHaveBeenCalledWith("/account/login?returnPath=%2Fcommerce%2Fads");
    await expect(host.auth.login({ email: "a", password: "b" })).rejects.toThrow(/not available in the browser/);
    await expect(host.auth.switchToMember("m")).rejects.toThrow(/not available in the browser/);
  });

  it("signs out: revokes the session, empties the store and leaves for the account page", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_u: string, init: RequestInit) => {
      const query = JSON.parse(String(init.body)).query as string;
      return query.includes("webLogout") ? respond({ data: { webLogout: true } }) : refreshOk();
    });
    const { host, store, navigate } = setup(fetchImpl);
    await host.session.boot();
    await host.auth.logout();
    expect(store.clearCloudEntities).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/account/login");
    expect(host.session.peekAccessToken()).toBeNull();
  });

  it("goes to sign-in when a later refresh finds the session gone", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(refreshOk())
      .mockResolvedValue(refreshDenied());
    const { host, navigate } = setup(fetchImpl);
    const expired = vi.fn();
    host.auth.onSessionExpired(expired);
    await host.session.boot();
    await host.session.refresh();
    expect(expired).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/account/login?returnPath=%2Fcommerce%2Fshops%3Fx%3D1");
  });

  it("keeps preferences in browser storage and applies them to the runtime status store", async () => {
    const { host, applySettings, storage } = setup(vi.fn());
    await host.settings.update({ privacy_mode: "true" });
    await host.settings.update({ panel_theme: "dark" });
    expect(applySettings).toHaveBeenLastCalledWith({ privacy_mode: "true", panel_theme: "dark" });
    await expect(host.settings.getAll()).resolves.toEqual({ privacy_mode: "true", panel_theme: "dark" });
    expect(storage.size).toBe(1);

    const workspace = { tabs: [], activeTabId: "t" } as never;
    await host.settings.saveWorkspace("u1", workspace);
    await expect(host.settings.getWorkspace("u1")).resolves.toEqual(workspace);
    await expect(host.settings.getWorkspace("someone-else")).resolves.toBeNull();
  });
});
