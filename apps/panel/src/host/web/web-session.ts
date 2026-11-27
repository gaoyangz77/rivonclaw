/**
 * Browser session (ADR-054): the access token lives in memory only; the
 * HttpOnly refresh cookie is the durable credential. Same protocol as
 * `server/web/src/api/client.ts` and `auth-session.ts`, implemented against
 * the same backend mutations (`webRefresh`, `webLogout`).
 */

const WEB_REFRESH = `mutation WebRefresh { webRefresh { accessToken user { userId email name } } }`;
const WEB_LOGOUT = `mutation WebLogout { webLogout }`;

/** Refresh this long before the access token expires. */
const REFRESH_LEEWAY_MS = 60_000;

export interface WebSessionUser {
  userId: string;
  email: string;
  name?: string | null;
}

export interface WebSession {
  /** Try to establish a session from the refresh cookie. False = signed out. */
  boot(): Promise<boolean>;
  /** A usable access token (refreshing first when it is about to expire), or null when signed out. */
  getAccessToken(): Promise<string | null>;
  /** Force a refresh (after the backend rejected the token). False = signed out. */
  refresh(): Promise<boolean>;
  /** Current in-memory token without refreshing, for transports that cannot await. */
  peekAccessToken(): string | null;
  user(): WebSessionUser | null;
  /** Revoke the browser session and drop the token. */
  signOut(): Promise<void>;
  /** Fires when a refresh finds the session gone. */
  onExpired(handler: () => void): () => void;
}

export interface WebSessionOptions {
  graphqlUrl: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string }[];
}

export function tokenExpiryMs(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function createWebSession(options: WebSessionOptions): WebSession {
  const fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  const now = options.now ?? Date.now;
  let accessToken: string | null = null;
  let expiresAt: number | null = null;
  let user: WebSessionUser | null = null;
  let inflight: Promise<boolean> | null = null;
  const expiredHandlers = new Set<() => void>();

  async function post<T>(query: string): Promise<GraphQLResponse<T>> {
    const response = await fetchImpl(options.graphqlUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error(`Session request failed: ${response.status}`);
    return (await response.json()) as GraphQLResponse<T>;
  }

  function clear(): void {
    accessToken = null;
    expiresAt = null;
    user = null;
  }

  function refresh(): Promise<boolean> {
    if (inflight) return inflight;
    const run = (async () => {
      const result = await post<{
        webRefresh?: { accessToken: string; user: WebSessionUser } | null;
      }>(WEB_REFRESH);
      const payload = result.data?.webRefresh;
      // A GraphQL error here is the backend saying there is no browser
      // session ("Browser session not found", an expired or revoked cookie).
      // Transport failures throw above and are not mistaken for sign-out.
      if (!payload) {
        const hadSession = accessToken !== null;
        clear();
        if (hadSession) for (const handler of expiredHandlers) handler();
        return false;
      }
      accessToken = payload.accessToken;
      expiresAt = tokenExpiryMs(payload.accessToken);
      user = payload.user;
      return true;
    })().finally(() => {
      inflight = null;
    });
    inflight = run;
    return run;
  }

  return {
    boot: refresh,
    refresh,
    peekAccessToken: () => accessToken,
    user: () => user,
    async getAccessToken() {
      if (inflight) await inflight;
      if (accessToken && expiresAt !== null && expiresAt - now() < REFRESH_LEEWAY_MS) {
        await refresh();
      }
      return accessToken;
    },
    async signOut() {
      try {
        await post<{ webLogout: boolean }>(WEB_LOGOUT);
      } finally {
        clear();
      }
    },
    onExpired(handler) {
      expiredHandlers.add(handler);
      return () => expiredHandlers.delete(handler);
    },
  };
}
