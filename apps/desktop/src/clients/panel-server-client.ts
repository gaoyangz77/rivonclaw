import { DEFAULT_PANEL_PORT } from "@rivonclaw/core";

const BASE = `http://127.0.0.1:${DEFAULT_PANEL_PORT}`;

export async function panelServerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`Panel-server error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function panelServerFireAndForget(path: string, init?: RequestInit): void {
  fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  }).catch(() => {});
}
