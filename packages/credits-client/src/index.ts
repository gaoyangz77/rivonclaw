export interface LedgerEntry {
  id: string;
  delta: number;
  reason: "signup_bonus" | "consumption" | "recharge";
  model: string | null;
  tokens: number | null;
  created_at: string;
}

export interface CreditsClient {
  deviceAuth(deviceId: string): Promise<{ token: string; balance: number }>;
  getBalance(token: string): Promise<number>;
  getHistory(token: string, page?: number, limit?: number): Promise<{ entries: LedgerEntry[]; total: number }>;
  proxyStream(token: string, payload: unknown): Promise<Response>;
  createRechargeOrder(token: string, amount: number): Promise<{ orderId: string | null; status: string; message: string }>;
}

async function apiRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchInit } = init;
  const headers: Record<string, string> = {};
  if (fetchInit.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    ...fetchInit,
    headers: { ...(fetchInit.headers as Record<string, string> | undefined), ...headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function createCreditsClient(baseUrl: string): CreditsClient {
  return {
    deviceAuth(deviceId) {
      return apiRequest(baseUrl, "/api/auth/device", {
        method: "POST",
        body: JSON.stringify({ deviceId }),
      });
    },

    async getBalance(token) {
      const data = await apiRequest<{ balance: number }>(baseUrl, "/api/credits/balance", { token });
      return data.balance;
    },

    getHistory(token, page = 1, limit = 20) {
      return apiRequest(baseUrl, `/api/credits/history?page=${page}&limit=${limit}`, { token });
    },

    async proxyStream(token, payload) {
      const res = await fetch(`${baseUrl}/api/proxy/openrouter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      return res;
    },

    createRechargeOrder(token, amount) {
      return apiRequest(baseUrl, "/api/recharge/create", {
        method: "POST",
        token,
        body: JSON.stringify({ amount }),
      });
    },
  };
}
