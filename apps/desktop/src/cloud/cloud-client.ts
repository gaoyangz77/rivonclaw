import type { AuthSessionManager } from "../auth/session.js";
import { getApiBaseUrl } from "@rivonclaw/core";

export class CloudRestError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`Cloud REST error: ${status}`);
  }
}

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

export class CloudClient {
  private fetchFn: FetchFn;

  constructor(
    private authSession: AuthSessionManager,
    private locale: string,
    fetchFn?: FetchFn,
  ) {
    this.fetchFn = fetchFn ?? fetch;
  }

  /** GraphQL query/mutation to Cloud backend (with auto-refresh). */
  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return this.authSession.graphqlFetch<T>(query, variables);
  }

  /** REST call to Cloud backend with auto-refresh on 401. */
  async rest<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${getApiBaseUrl(this.locale)}${path}`;
    const makeHeaders = (token: string | null): Record<string, string> => ({
      ...(init?.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });

    let res = await this.fetchFn(url, {
      ...init,
      headers: makeHeaders(this.authSession.getAccessToken()),
    });

    if (res.status === 401) {
      const newToken = await this.authSession.refresh();
      res = await this.fetchFn(url, {
        ...init,
        headers: makeHeaders(newToken),
      });
    }

    if (!res.ok) {
      let body: unknown;
      try { body = await res.json(); } catch { body = null; }
      throw new CloudRestError(res.status, body);
    }
    return res.json() as Promise<T>;
  }
}
