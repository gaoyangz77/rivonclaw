import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import { ME_QUERY, LOGIN_MUTATION, REGISTER_MUTATION } from "../api/auth-queries.js";
import {
  setTokenGetter,
  setOnTokenRefreshed,
  setOnRefreshFailed,
} from "../api/apollo-client.js";
import { trackEvent } from "../api/index.js";
import { cloudLlmProvider } from "../lib/cloud-llm-provider.js";

interface AuthState {
  user: GQL.MeResponse | null;
  token: string | null;
  loading: boolean;
  login: (input: GQL.LoginInput) => Promise<void>;
  register: (input: GQL.RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const TOKEN_KEY = "rivonclaw.auth.token";
const REFRESH_KEY = "rivonclaw.auth.refreshToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<GQL.MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(token);
  const initializedRef = useRef(false);

  // Keep refs in sync for the apollo link getters
  useEffect(() => {
    tokenRef.current = token;
    setTokenGetter(() => tokenRef.current);
  }, [token]);

  // Fetch session from desktop and handle one-time localStorage migration
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      // One-time migration: push localStorage tokens to desktop, then remove
      const legacyToken = localStorage.getItem(TOKEN_KEY);
      if (legacyToken) {
        const legacyRefresh = localStorage.getItem(REFRESH_KEY);
        try {
          await fetch("/api/auth/store-tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: legacyToken,
              refreshToken: legacyRefresh,
            }),
          });
        } catch {
          // Migration is best-effort; desktop session fetch below will still work
        }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
      }

      // Fetch current session from desktop
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = (await res.json()) as {
            accessToken: string | null;
            user: GQL.MeResponse | null;
          };
          if (session.accessToken) {
            tokenRef.current = session.accessToken;
            setToken(session.accessToken);
            if (session.user) {
              setUser(session.user);
              setLoading(false);
              return; // Have both token and user, skip ME_QUERY
            }
            // Token exists but no cached user — ME_QUERY will validate below
            return;
          }
        }
      } catch {
        // Desktop unreachable — stay logged out
      }
      setLoading(false);
    })();
  }, []);

  // Register getters and callbacks on mount
  useEffect(() => {
    setTokenGetter(() => tokenRef.current);

    setOnTokenRefreshed((accessToken: string) => {
      tokenRef.current = accessToken;
      setToken(accessToken);
    });

    setOnRefreshFailed(() => {
      setToken(null);
      setUser(null);
    });
  }, []);

  // Validate existing token on mount via ME_QUERY
  const { data: meData, error: meError, loading: meLoading } = useQuery<{ me: GQL.MeResponse }>(
    ME_QUERY,
    { skip: !token },
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (meLoading) return;
    if (meData?.me) {
      setUser(meData.me);
      setLoading(false);
    } else if (meError) {
      // Token invalid — clear it
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  }, [meData, meError, meLoading, token]);

  // Auto-provision RivonClaw Pro provider when user has llmKey
  useEffect(() => {
    if (user?.llmKey?.key) {
      cloudLlmProvider.provision(user.llmKey.key);
    }
  }, [user]);

  const [loginMutation] = useMutation<{ login: GQL.AuthPayload }>(LOGIN_MUTATION);
  const [registerMutation] = useMutation<{ register: GQL.AuthPayload }>(REGISTER_MUTATION);

  const login = useCallback(async (input: GQL.LoginInput) => {
    const { data } = await loginMutation({ variables: { input } });
    if (!data?.login) throw new Error("Login failed");
    const payload = data.login;
    await fetch("/api/auth/store-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      }),
    });
    tokenRef.current = payload.accessToken;
    setToken(payload.accessToken);
    setUser({
      userId: payload.userId,
      email: payload.email,
      plan: payload.plan,
      name: null,
      llmKey: payload.llmKey,
      createdAt: new Date().toISOString(),
    });
    trackEvent("auth.login");
  }, [loginMutation]);

  const register = useCallback(async (input: GQL.RegisterInput) => {
    const { data } = await registerMutation({ variables: { input } });
    if (!data?.register) throw new Error("Registration failed");
    const payload = data.register;
    await fetch("/api/auth/store-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      }),
    });
    tokenRef.current = payload.accessToken;
    setToken(payload.accessToken);
    setUser({
      userId: payload.userId,
      email: payload.email,
      plan: payload.plan,
      name: null,
      llmKey: payload.llmKey,
      createdAt: new Date().toISOString(),
    });
    trackEvent("auth.register");
  }, [registerMutation]);

  const logout = useCallback(() => {
    cloudLlmProvider.teardown();
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    trackEvent("auth.logout");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
