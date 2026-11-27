import { CLOUD_REST_PREFIX } from "@rivonclaw/core/api-contract";
import type { HostAdapter, HostEventName } from "../host-adapter.js";
import { bootstrapEntities, type WebHostStore } from "./web-bootstrap.js";
import {
  DELETION_MUTATION_MAP,
  createGraphQLRequester,
  createWebGraphQLLink,
  type OperationResult,
} from "./web-graphql.js";
import { createWebSession, type WebSession } from "./web-session.js";
import { createWebSettings, type SettingsStorage } from "./web-settings.js";
import { createWebSubscriptions } from "./web-subscriptions.js";

const MODULE_ENROLLMENT_OPERATIONS = new Set(["EnrollModule", "UnenrollModule"]);
const SIGN_IN_PATH = "/account/login";

export interface WebHostOptions {
  store: WebHostStore;
  /** Put the stored preferences into the runtime status store. */
  applySettings: (all: Record<string, string>) => void;
  storage: SettingsStorage;
  /** Leave this document for `url` (a full page load; the access token is not carried over). */
  navigate: (url: string) => void;
  /** The Panel path the viewer is on, for the sign-in return path. */
  currentPath: () => string;
  graphqlUrl?: string;
  wsUrl?: string | (() => string);
  fetchImpl?: typeof fetch;
}

export interface WebHost extends HostAdapter {
  /**
   * Establish the session from the refresh cookie. False means signed out and
   * the viewer is already on their way to the sign-in page; do not render.
   * When true, the startup queries and subscriptions are running.
   */
  start(): Promise<boolean>;
  readonly session: WebSession;
}

export function signInUrl(returnPath: string): string {
  return `${SIGN_IN_PATH}?returnPath=${encodeURIComponent(returnPath)}`;
}

function defaultWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/graphql`;
}

/**
 * The host for the browser build (ADR-123 decision 2). There is no Desktop:
 * GraphQL goes straight to the backend with the browser session, this host
 * writes Panel's own entity store from the responses, and the discrete events
 * come from backend subscriptions.
 */
export function createWebHost(options: WebHostOptions): WebHost {
  const graphqlUrl = options.graphqlUrl ?? "/api/graphql";
  const session = createWebSession({ graphqlUrl, fetchImpl: options.fetchImpl });
  const request = createGraphQLRequester({ session, graphqlUrl, fetchImpl: options.fetchImpl });
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  const handlers = new Map<HostEventName, Set<(payload: unknown) => void>>();
  let latestEntitySnapshot: { payload: unknown } | null = null;
  function emit(event: HostEventName, payload: unknown): void {
    if (event === "entity-snapshot") latestEntitySnapshot = { payload };
    for (const handler of Array.from(handlers.get(event) ?? [])) handler(payload);
  }

  let signedIn = false;
  let bootstrap: Promise<void> = Promise.resolve();

  const subscriptions = createWebSubscriptions({
    wsUrl: options.wsUrl ?? defaultWsUrl,
    session,
    store: options.store,
    request,
    emit,
    onReconnected: () =>
      loadEntities().catch((error) => console.error("[web-host] reload after reconnect failed", error)),
  });

  function loadEntities(): Promise<void> {
    bootstrap = bootstrapEntities(options.store, request).then((ok) => {
      if (!ok) return;
      // Shop-scoped subscriptions depend on which shops the account has.
      subscriptions.start();
      emit("entity-snapshot", null);
    });
    return bootstrap;
  }

  function onResult({ operationName, variables, data }: OperationResult): void {
    options.store.ingestGraphQLResponse(data);
    const deleted = operationName ? DELETION_MUTATION_MAP[operationName] : undefined;
    if (deleted && typeof variables.id === "string") options.store.removeEntity(deleted, variables.id);
    if (operationName && MODULE_ENROLLMENT_OPERATIONS.has(operationName)) {
      loadEntities().catch((error) => console.error("[web-host] reload after enrollment failed", error));
    }
  }

  const settings = createWebSettings({
    storage: options.storage,
    onChange: options.applySettings,
  });

  session.onExpired(() => {
    signedIn = false;
    subscriptions.stop();
    options.navigate(signInUrl(options.currentPath()));
  });

  const notSupported = (what: string) => () => {
    throw new Error(`${what} is not available in the browser`);
  };

  return {
    kind: "web",
    capabilities: new Set(),
    stateFeed: "local",
    session,

    graphql: {
      createLink: () => createWebGraphQLLink({ session, graphqlUrl, onResult }),
    },

    cloud: {
      async fetch(path, init) {
        if (!path.startsWith(CLOUD_REST_PREFIX.pathPrefix)) {
          throw new Error(`Not a cloud REST path: ${path}`);
        }
        const target = `/api/${path.slice(CLOUD_REST_PREFIX.pathPrefix.length)}`;
        const send = async () => {
          const headers = new Headers(init?.headers);
          const token = await session.getAccessToken();
          if (token) headers.set("authorization", `Bearer ${token}`);
          return fetchImpl(target, { ...init, headers, credentials: "include" });
        };
        const response = await send();
        if (response.status !== 401) return response;
        return (await session.refresh()) ? send() : response;
      },
    },

    events: {
      subscribe(event, handler) {
        let set = handlers.get(event);
        if (!set) {
          set = new Set();
          handlers.set(event, set);
        }
        set.add(handler);
        if (event === "entity-snapshot" && latestEntitySnapshot) handler(latestEntitySnapshot.payload);
        return () => set.delete(handler);
      },
    },

    auth: {
      async getSession() {
        await bootstrap;
        return { authenticated: signedIn, tokenPresent: signedIn };
      },
      login: async () => notSupported("Signing in from the Panel")(),
      register: async () => notSupported("Registering from the Panel")(),
      async logout() {
        await session.signOut();
        signedIn = false;
        subscriptions.stop();
        options.store.clearCloudEntities();
        options.navigate(SIGN_IN_PATH);
      },
      onSessionExpired: (handler) => session.onExpired(handler),
      switchToMember: async () => notSupported("Switching into a sub-account")(),
      returnToOwner: async () => notSupported("Returning to the main account")(),
      startSignIn: (returnPath) => options.navigate(signInUrl(returnPath)),
    },

    settings,

    async start() {
      options.applySettings(settings.load());
      if (!(await session.boot())) {
        options.navigate(signInUrl(options.currentPath()));
        return false;
      }
      signedIn = true;
      loadEntities().catch((error) => console.error("[web-host] startup queries failed", error));
      return true;
    },
  };
}
