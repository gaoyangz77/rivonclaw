import { Component, type ReactNode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse, type FieldNode } from "graphql";
import "./i18n/index.js";
import { WorkspaceTabProvider } from "./lib/workspace-tab-context.js";
import { ApolloWrapper } from "./providers/ApolloWrapper.js";
import { GraphQLLoadingProvider } from "./providers/GraphQLLoadingContext.js";
import { ToastProvider } from "./components/Toast.js";
import { EntityStoreProvider } from "./store/EntityStoreProvider.js";
import { RuntimeStatusProvider } from "./store/RuntimeStatusProvider.js";
import { entityStore } from "./store/entity-store.js";
import { getHost, installHost } from "./host/index.js";
import { createWebHost } from "./host/web/web-host.js";
import { ROUTES, isRouteAvailableOnHost } from "./routes.js";
import { App } from "./App.js";

/**
 * Regression guard for the browser build: nothing a web user can reach may call
 * Desktop. Every route the web host serves is rendered with the web host
 * installed and every network request is recorded; the only requests allowed
 * are GraphQL and the backend REST paths nginx proxies on the app host
 * (`/api/uploads/*`, `/api/ecommerce/*`). A Desktop REST call (`/api/status`,
 * `/api/settings/...`, `/api/channels/...`), a Desktop asset, or a Desktop-only
 * event listener fails the test.
 */

const ALLOWED = [/^\/api\/graphql$/, /^\/api\/uploads\//, /^\/api\/ecommerce\//];
const DESKTOP_ONLY_EVENTS = [
  "status-snapshot",
  "status-patch",
  "inbound",
  "chat-mirror",
  "session-reset",
  "recipient-added",
  "update-available",
  "scene-snapshot",
  "idle-snapshot",
];

const requests: string[] = [];

class Boundary extends Component<{ children: ReactNode; onError: (e: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function pathOf(input: unknown): string {
  const raw = typeof input === "string" ? input : (input as Request | URL).toString();
  return new URL(raw, "http://localhost").pathname;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** An empty list for every root field, so pages render their empty state instead of crashing on `{}`. */
function emptyAnswer(body: string) {
  const { query } = JSON.parse(body || "{}") as { query?: string };
  if (!query) return { data: {} };
  const data: Record<string, unknown> = {};
  for (const definition of parse(query).definitions) {
    if (definition.kind !== "OperationDefinition") continue;
    for (const selection of definition.selectionSet.selections) {
      const field = selection as FieldNode;
      data[field.alias?.value ?? field.name.value] = [];
    }
  }
  return { data };
}

function installWebHost() {
  const recorder = vi.fn(async (input: unknown, init?: RequestInit) => {
    const path = pathOf(input);
    requests.push(path);
    if (path === "/api/graphql") return jsonResponse(emptyAnswer(String(init?.body ?? "")));
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", recorder);
  const host = createWebHost({
    store: {
      clearCloudEntities: () => entityStore.clearCloudEntities(),
      clearCloudDataExceptUser: (o) => entityStore.clearCloudDataExceptUser(o),
      setAuthBootstrap: (s, e) => entityStore.setAuthBootstrap(s, e ?? null),
      ingestGraphQLResponse: (d) => entityStore.ingestGraphQLResponse(d),
      removeEntity: (t, id) => entityStore.removeEntity(t, id),
      upsertShopsFromGraphQL: (s, r) => entityStore.upsertShopsFromGraphQL(s, r),
      shopIds: () => entityStore.shops.map((s) => s.id),
    },
    applySettings: () => {},
    storage: window.localStorage,
    navigate: () => {},
    currentPath: () => "/",
  });
  const subscribed: string[] = [];
  const subscribe = host.events.subscribe.bind(host.events);
  host.events.subscribe = (event, handler) => {
    subscribed.push(event);
    return subscribe(event, handler);
  };
  installHost(host);
  return subscribed;
}

function signedInStore() {
  entityStore.ingestGraphQLResponse({
    me: {
      __typename: "MeResponse",
      userId: "u1",
      email: "owner@example.com",
      name: "Owner",
      enrolledModules: ["GLOBAL_ECOMMERCE_SELLER"],
      entitlementKeys: [],
      accountId: "u1",
      isOwner: true,
      permissionScopes: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    shops: [
      { __typename: "Shop", id: "shop-1", platform: "TIKTOK_SHOP", platformShopId: "p1", shopName: "Brightloom" },
    ],
  });
  entityStore.setAuthBootstrap("ready", null);
}

function shell(children: ReactNode, onError: (e: unknown) => void) {
  return (
    <ApolloWrapper>
      <GraphQLLoadingProvider>
        <EntityStoreProvider>
          <RuntimeStatusProvider>
            <ToastProvider>
              <Boundary onError={onError}>
                <WorkspaceTabProvider
                  value={{ tabId: "t", active: true, view: {}, setView: () => {}, setDirty: () => {} }}
                >
                  {children}
                </WorkspaceTabProvider>
              </Boundary>
            </ToastProvider>
          </RuntimeStatusProvider>
        </EntityStoreProvider>
      </GraphQLLoadingProvider>
    </ApolloWrapper>
  );
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

function desktopAssetsInDom(): string[] {
  return [...document.querySelectorAll("[src],[href]")]
    .map((el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "")
    .filter((value) => /^\/(?:api|office)\//.test(value) && !ALLOWED.some((re) => re.test(value)));
}

const desktop = getHost();
let subscribed: string[];

beforeEach(() => {
  requests.length = 0;
  window.localStorage.clear();
  subscribed = installWebHost();
  signedInStore();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  entityStore.clearCloudEntities();
  installHost(desktop);
});

describe("web host serves no route that reaches Desktop", () => {
  const webRoutes = () => {
    installWebHost();
    const routes = ROUTES.filter((route) => isRouteAvailableOnHost(route));
    installHost(desktop);
    return routes;
  };

  it("has routes to check", () => {
    expect(webRoutes().length).toBeGreaterThanOrEqual(20);
  });

  for (const route of ROUTES) {
    it(`${route.path}`, async () => {
      if (!isRouteAvailableOnHost(route)) return; // not served on the web host
      const errors: unknown[] = [];
      const Page = route.component;
      render(shell(<Page />, (e) => errors.push(e)));
      await settle();

      // The synthetic backend answers every root field with an empty list, which a few pages
      // (nested connection shapes) cannot render. That is a limit of this fixture, not of the
      // page: any other render failure is real.
      const real = errors.map(String).filter((e) => !/Cannot read properties of undefined/.test(e));
      expect(real, `${route.path} failed to render`).toEqual([]);
      const forbidden = requests.filter((path) => !ALLOWED.some((re) => re.test(path)));
      expect(forbidden, `${route.path} called Desktop`).toEqual([]);
      expect(desktopAssetsInDom(), `${route.path} loads a Desktop asset`).toEqual([]);
      expect(subscribed.filter((e) => DESKTOP_ONLY_EVENTS.includes(e)), `${route.path} listens to Desktop-only events`).toEqual([]);
    });
  }

  it("would notice a Desktop call (the recorder and the allow-list are live)", async () => {
    const { fetchJson } = await import("./api/client.js");
    await fetchJson("/status").catch(() => {});
    expect(requests.filter((path) => !ALLOWED.some((re) => re.test(path)))).toEqual(["/api/status"]);
  });

  it("the application shell (navigation, banners, modals) calls no Desktop endpoint either", async () => {
    window.history.replaceState({}, "", "/commerce/shops");
    render(shell(<App />, () => {}));
    await settle();
    await settle();
    expect(requests.filter((path) => !ALLOWED.some((re) => re.test(path)))).toEqual([]);
    expect(desktopAssetsInDom()).toEqual([]);
    expect(subscribed.filter((e) => DESKTOP_ONLY_EVENTS.includes(e))).toEqual([]);
  });
});
