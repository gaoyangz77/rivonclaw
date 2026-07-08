import type { SecretStore } from "@rivonclaw/secrets";
import { getGraphqlUrl, GQL } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import {
  REFRESH_TOKEN_MUTATION,
  ME_QUERY,
  LOGOUT_MUTATION,
  LOGIN_MUTATION,
  REGISTER_MUTATION,
  REQUEST_CAPTCHA_MUTATION,
} from "../cloud/auth-queries.js";

const log = createLogger("auth-session");

const ACCESS_TOKEN_KEY = "auth.accessToken";
const REFRESH_TOKEN_KEY = "auth.refreshToken";
export type UserChangedListener = (user: GQL.MeResponse | null) => void | Promise<void>;

interface RefreshOptions {
  clearOnInvalid?: boolean;
}

interface GraphqlFetchOptions {
  autoRefresh?: boolean;
  includeAccessToken?: boolean;
  clearOnInvalidRefresh?: boolean;
}

function isRecoverableAuthErrorMessage(message: string): boolean {
  return /Not authenticated|Authentication required|Invalid token|Token expired|invalid signature|jwt malformed|jwt expired/i.test(message);
}

function isSessionInvalidErrorMessage(message: string): boolean {
  return /Not authenticated|Authentication required|Invalid token|Token expired|invalid signature|jwt malformed|jwt expired/i.test(message);
}

function isJwtSignatureMismatchErrorMessage(message: string): boolean {
  return /invalid signature/i.test(message);
}

export class AuthSessionManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private cachedUser: GQL.MeResponse | null = null;
  private refreshPromise: Promise<string> | null = null;
  private userChangedListeners: UserChangedListener[] = [];

  constructor(
    private secretStore: SecretStore,
    private locale: string,
    private fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response>,
  ) {}

  /**
   * Low-level cached-user listener.
   *
   * Desktop business side effects should use the app-level auth lifecycle
   * instead, so they run after bootstrap, ToolSpecs staging, and gateway
   * restart/reinit have settled.
   */
  onUserChanged(listener: UserChangedListener): void {
    this.userChangedListeners.push(listener);
  }

  private async setUser(user: GQL.MeResponse | null): Promise<void> {
    this.cachedUser = user;
    for (const listener of this.userChangedListeners) {
      try {
        await listener(user);
      } catch { /* listener errors must not break auth flow */ }
    }
  }

  /** Load tokens from keychain into memory. Call once at startup. */
  async loadFromKeychain(): Promise<void> {
    this.accessToken = await this.secretStore.get(ACCESS_TOKEN_KEY) ?? null;
    this.refreshToken = await this.secretStore.get(REFRESH_TOKEN_KEY) ?? null;
    log.info(`loadFromKeychain: access=${this.accessToken ? "found" : "missing"} refresh=${this.refreshToken ? "found" : "missing"}`);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getCachedUser(): GQL.MeResponse | null {
    return this.cachedUser;
  }

  /** Set the cached user directly (e.g. from JWT fallback when validate() fails). */
  setCachedUser(user: GQL.MeResponse): void {
    this.cachedUser = user;
  }

  async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    await this.secretStore.set(ACCESS_TOKEN_KEY, accessToken);
    await this.secretStore.set(REFRESH_TOKEN_KEY, refreshToken);
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    await this.setUser(null);
    await this.secretStore.delete(ACCESS_TOKEN_KEY);
    await this.secretStore.delete(REFRESH_TOKEN_KEY);
  }

  /** Refresh the access token using the stored refresh token. Single-flight. */
  async refresh(options?: RefreshOptions): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.doRefresh(options).finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doRefresh(options?: RefreshOptions): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const result = await this.graphqlFetch<{ refreshToken: { accessToken: string; refreshToken: string; user: GQL.MeResponse } }>(
        REFRESH_TOKEN_MUTATION,
        { refreshToken: this.refreshToken },
        { autoRefresh: false, includeAccessToken: false },
      );

      const payload = result.refreshToken;
      await this.storeTokens(payload.accessToken, payload.refreshToken);
      await this.setUser(payload.user);
      return payload.accessToken;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (options?.clearOnInvalid === true && isJwtSignatureMismatchErrorMessage(msg)) {
        await this.clearTokens();
      }
      throw err;
    }
  }

  /** Validate the current session by calling the ME query. */
  async validate(): Promise<GQL.MeResponse | null> {
    if (!this.accessToken) return null;

    try {
      log.info("validate: sending ME_QUERY...");
      const result = await this.graphqlFetch<{ me: GQL.MeResponse }>(ME_QUERY);
      log.info(`validate: success, user=${result.me.email}`);
      await this.setUser(result.me);
      return result.me;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isAuthError = isSessionInvalidErrorMessage(msg);
      if (isAuthError) {
        log.error("JWT rejected during validate; keeping stored auth tokens", { reason: msg });
        await this.setUser(null);
      } else {
        log.warn("validate: non-auth error, keeping tokens.", err);
      }
      return null;
    }
  }

  /** Best-effort cloud logout. */
  async logout(): Promise<void> {
    const rt = this.refreshToken;
    await this.clearTokens();
    if (rt) {
      try {
        await this.graphqlFetch(LOGOUT_MUTATION, { refreshToken: rt });
      } catch {
        // Best-effort — ignore failures
      }
    }
  }

  /** Log in with email/password credentials. Desktop calls Cloud, stores tokens, returns user. */
  async loginWithCredentials(input: { email: string; password: string; captchaToken?: string; captchaAnswer?: string }): Promise<GQL.MeResponse> {
    const data = await this.graphqlFetch<{ login: GQL.AuthPayload }>(LOGIN_MUTATION, { input });
    await this.storeTokens(data.login.accessToken, data.login.refreshToken);
    await this.setUser(data.login.user);
    return data.login.user;
  }

  /** Register with email/password credentials. Desktop calls Cloud, stores tokens, returns user. */
  async registerWithCredentials(input: { email: string; password: string; name?: string; captchaToken?: string; captchaAnswer?: string; inviteCode?: string | null }): Promise<GQL.MeResponse> {
    const data = await this.graphqlFetch<{ register: GQL.AuthPayload }>(REGISTER_MUTATION, { input });
    await this.storeTokens(data.register.accessToken, data.register.refreshToken);
    await this.setUser(data.register.user);
    return data.register.user;
  }

  /** Request a CAPTCHA challenge from the Cloud. */
  async requestCaptcha(options?: { deterministicToken?: string }): Promise<{ token: string; svg: string }> {
    const variables = options?.deterministicToken
      ? { deterministicToken: options.deterministicToken }
      : undefined;
    const data = await this.graphqlFetch<{ requestCaptcha: { token: string; svg: string } }>(
      REQUEST_CAPTCHA_MUTATION,
      variables,
    );
    return data.requestCaptcha;
  }

  /** Lightweight GraphQL fetch to the cloud backend. Public so config builder can use it. */
  async graphqlFetch<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    options?: GraphqlFetchOptions,
  ): Promise<T> {
    const url = getGraphqlUrl(this.locale);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const autoRefresh = options?.autoRefresh !== false;
    const clearOnInvalidRefresh = options?.clearOnInvalidRefresh === true;
    if (options?.includeAccessToken !== false && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const doFetch = () => this.fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });

    let res = await doFetch();

    let refreshed = false;
    if (autoRefresh && res.status === 401 && this.refreshToken) {
      headers["Authorization"] = `Bearer ${await this.refresh({ clearOnInvalid: clearOnInvalidRefresh })}`;
      refreshed = true;
      res = await doFetch();
    }

    let json = await res.json() as { data?: T; errors?: Array<{ message: string }> };

    // Some servers return auth errors as GraphQL errors (HTTP 200) rather than HTTP 401.
    // Attempt a token refresh if we haven't already.
    if (autoRefresh && json.errors?.length && !refreshed && this.refreshToken) {
      const msg = json.errors.map(e => e.message).join("; ");
      if (isRecoverableAuthErrorMessage(msg)) {
        headers["Authorization"] = `Bearer ${await this.refresh({ clearOnInvalid: clearOnInvalidRefresh })}`;
        res = await doFetch();
        json = await res.json() as { data?: T; errors?: Array<{ message: string }> };
      }
    }

    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    if (!json.data) {
      throw new Error("No data returned from cloud GraphQL");
    }
    return json.data;
  }
}
