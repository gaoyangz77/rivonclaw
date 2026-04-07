// apps/panel/src/hooks/useCreditsAuth.ts
import { useState, useEffect, useCallback } from "react";
import {
  getCreditsToken, setCreditsToken, clearCreditsToken,
  apiRegister, apiLogin, apiMe,
  type MeResponse,
} from "../api/credits-auth.js";

interface CreditsAuthState {
  token: string | null;
  me: MeResponse | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): void;
}

export function useCreditsAuth(): CreditsAuthState {
  const [token, setToken] = useState<string | null>(() => getCreditsToken());
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // On mount (or token change), verify token and load profile
  useEffect(() => {
    if (!token) { setMe(null); return; }
    setLoading(true);
    apiMe(token)
      .then(setMe)
      .catch(() => {
        // Token invalid or expired — clear it
        clearCreditsToken();
        setToken(null);
        setMe(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    setCreditsToken(result.token);
    setToken(result.token);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const result = await apiRegister(email, password);
    setCreditsToken(result.token);
    setToken(result.token);
  }, []);

  const logout = useCallback(() => {
    clearCreditsToken();
    setToken(null);
    setMe(null);
  }, []);

  return { token, me, loading, login, register, logout };
}
