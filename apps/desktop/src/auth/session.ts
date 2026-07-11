import { SecretStoreAccessError, type SecretStore } from "@rivonclaw/secrets";
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

export interface GraphqlResponseEnvelope<T> {
  data?: T | null;
  errors?: Array<{ message: string }>;
  extensions?: Record<string, unknown>;
}

function isRecoverableAuthErrorMessage(message: string): boolean {
  return /Not authenticated|Authentication required|Invalid token|Token expired|invalid signature|jwt malformed|jwt expired/i.test(message);
}

function isSessionInvalidErrorMessage(message: string): boolean {
  return /Not authenticated|Authentication required|Invalid token|Token expired|invalid signature|jwt malformed|jwt expired/i.test(message)
    || isTerminalRefreshErrorMessage(message);
}

function isTerminalRefreshErrorMessage(message: string): boolean {
  return message.split(";").some((part) => part.trim() === "Refresh token revoked or invalid");
}

class JwtIllegalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtIllegalError";
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isJwtIllegalErrorMessage(message: string): boolean {
  return /invalid signature/i.test(message);
}

function isJwtIllegalError(error: unknown): error is JwtIllegalError {
  return error instanceof JwtIllegalError;
}

export class AuthSessionManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private cachedUser: GQL.MeResponse | null = null;
  private refreshPromise: Promise<string> | null = null;
  private userChangedListeners: UserChangedListener[] = [];
  private secureStorageAvailable = true;

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
    try {
      this.accessToken = (await this.secretStore.get(ACCESS_TOKEN_KEY)) ?? null;
      this.refreshToken = (await this.secretStore.get(REFRESH_TOKEN_KEY)) ?? null;
      this.secureStorageAvailable = true;
    } catch (error) {
      if (!(error instanceof SecretStoreAccessError)) throw error;
      this.accessToken = null;
      this.refreshToken = null;
      this.secureStorageAvailable = false;
      log.error("loadFromKeychain: secure storage unavailable");
    }
    log.info(`loadFromKeychain: access=${this.accessToken ? "found" : "missing"} refresh=${this.refreshToken ? "found" : "missing"}`);
  }

  isSecureStorageAvailable(): boolean {
    return this.secureStorageAvailable;
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
    try {
      // A successful backend refresh revokes the previous refresh token. Persist
      // its replacement first so an access-token write failure cannot strand the
      // next process with a server-revoked refresh token.
      await this.secretStore.set(REFRESH_TOKEN_KEY, refreshToken);
      await this.secretStore.set(ACCESS_TOKEN_KEY, accessToken);
      this.secureStorageAvailable = true;
    } catch (error) {
      if (error instanceof SecretStoreAccessError) this.secureStorageAvailable = false;
      throw error;
    }
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
    // Kept for call-site compatibility; session invalidation is deliberately
    // controlled only by the backend's explicit refresh-token rejection.
    void options;
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }
    const attemptedRefreshToken = this.refreshToken;

    try {
      const result = await this.graphqlFetch<{ refreshToken: { accessToken: string; refreshToken: string; user: GQL.MeResponse } }>(
        REFRESH_TOKEN_MUTATION,
        { refreshToken: attemptedRefreshToken },
        { autoRefresh: false, includeAccessToken: false },
      );

      const payload = result.refreshToken;
      try {
        await this.storeTokens(payload.accessToken, payload.refreshToken);
      } catch (error) {
        if (!(error instanceof SecretStoreAccessError)) throw error;
        // The backend refresh already succeeded and rotated the token. Keep the
        // new pair alive in memory instead of repeating a state-changing refresh.
        log.error("Refreshed auth session could not be persisted; keeping it in memory");
      }
      await this.setUser(payload.user);
      return payload.accessToken;
    } catch (err) {
      const terminalRefreshError = isTerminalRefreshErrorMessage(getErrorMessage(err));
      if (terminalRefreshError) {
        log.warn("Refresh token is no longer valid; clearing stored auth session");
        await this.invalidateRejectedRefreshToken(attemptedRefreshToken);
      }
      throw err;
    }
  }

  private async invalidateRejectedRefreshToken(rejectedToken: string): Promise<void> {
    if (this.refreshToken !== rejectedToken) return;

    try {
      const storedRefreshToken = await this.secretStore.get(REFRESH_TOKEN_KEY);
      if (storedRefreshToken && storedRefreshToken !== rejectedToken) {
        // Another process refreshed and persisted a newer token after this
        // request started. Adopt it instead of deleting the newer session.
        this.refreshToken = storedRefreshToken;
        this.accessToken = (await this.secretStore.get(ACCESS_TOKEN_KEY)) ?? null;
        log.info("Preserving a newer auth session found in secure storage");
        return;
      }

      this.accessToken = null;
      this.refreshToken = null;
      await this.setUser(null);
      await this.secretStore.delete(ACCESS_TOKEN_KEY);
      await this.secretStore.delete(REFRESH_TOKEN_KEY);
    } catch (error) {
      if (!(error instanceof SecretStoreAccessError)) throw error;
      this.accessToken = null;
      this.refreshToken = null;
      this.secureStorageAvailable = false;
      await this.setUser(null);
      log.error("Rejected auth session could not be removed because secure storage is unavailable");
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
      const msg = getErrorMessage(err);
      const isAuthError = isSessionInvalidErrorMessage(msg);
      if (isJwtIllegalError(err)) {
        log.warn("validate: JWT rejected, keeping cached auth session", { reason: msg });
      } else if (isTerminalRefreshErrorMessage(msg)) {
        log.warn("validate: refresh token rejected; auth session was cleared", { reason: msg });
      } else if (isAuthError) {
        log.warn("validate: auth rejected, keeping cached auth session.", { reason: msg });
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
    const json = await this.graphqlFetchEnvelope<T>(query, variables, undefined, options);
    if (!json.data) {
      throw new Error("No data returned from cloud GraphQL");
    }
    return json.data;
  }

  /** GraphQL request that preserves top-level extensions for agent tool jobs. */
  async graphqlFetchEnvelope<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    requestExtensions?: Record<string, unknown>,
    options?: GraphqlFetchOptions,
  ): Promise<GraphqlResponseEnvelope<T>> {
    const url = getGraphqlUrl(this.locale);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const autoRefresh = options?.autoRefresh !== false;
    if (options?.includeAccessToken !== false && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const doFetch = () => this.fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables, extensions: requestExtensions }),
    });

    let res = await doFetch();

    let refreshed = false;
    if (autoRefresh && res.status === 401 && this.refreshToken) {
      headers["Authorization"] = `Bearer ${await this.refresh()}`;
      refreshed = true;
      res = await doFetch();
    }

    let json = await res.json() as GraphqlResponseEnvelope<T>;

    // Some servers return auth errors as GraphQL errors (HTTP 200) rather than HTTP 401.
    // Attempt a token refresh if we haven't already.
    if (autoRefresh && json.errors?.length && !refreshed && this.refreshToken) {
      const msg = json.errors.map(e => e.message).join("; ");
      if (isRecoverableAuthErrorMessage(msg)) {
        headers["Authorization"] = `Bearer ${await this.refresh()}`;
        res = await doFetch();
        json = await res.json() as GraphqlResponseEnvelope<T>;
      }
    }

    if (json.errors?.length) {
      const msg = json.errors.map((e) => e.message).join("; ");
      if (isJwtIllegalErrorMessage(msg)) {
        throw new JwtIllegalError(msg);
      }
      throw new Error(msg);
    }
    return json;
  }
}
