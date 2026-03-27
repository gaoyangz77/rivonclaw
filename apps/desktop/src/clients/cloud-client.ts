import type { AuthSessionManager } from "../auth/auth-session.js";
import { getApiBaseUrl } from "@rivonclaw/core";

export class CloudClient {
  constructor(
    private authSession: AuthSessionManager,
    private locale: string,
  ) {}

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

    let res = await fetch(url, {
      ...init,
      headers: makeHeaders(this.authSession.getAccessToken()),
    });

    if (res.status === 401) {
      const newToken = await this.authSession.refresh();
      res = await fetch(url, {
        ...init,
        headers: makeHeaders(newToken),
      });
    }

    if (!res.ok) throw new Error(`Cloud REST error: ${res.status}`);
    return res.json() as Promise<T>;
  }
}
