import { normalizeTelegramDebugOperatorUserIds } from "./telegram-debug-support.js";

export async function fetchTelegramDebugOperatorUserIds(params: {
  apiRoot: string;
  proxyToken: string;
  deviceId: string;
  fetchFn: typeof fetch;
}): Promise<string[]> {
  const root = params.apiRoot.trim().replace(/\/+$/, "");
  const url = `${root}/telegram-debug/devices/${encodeURIComponent(params.deviceId)}/bot${encodeURIComponent(params.proxyToken)}/debug-config`;
  const res = await params.fetchFn(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Telegram debug relay config failed: HTTP ${res.status}`);
  }

  const body = await res.json() as { operatorUserIds?: unknown };
  return normalizeTelegramDebugOperatorUserIds(
    Array.isArray(body.operatorUserIds) ? body.operatorUserIds : [],
  );
}

