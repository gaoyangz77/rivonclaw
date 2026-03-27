import { DEFAULTS } from "./defaults.js";

const PANEL_URL = `http://127.0.0.1:${DEFAULTS.ports.panel}`;

/** Send a GraphQL query through Desktop's Cloud proxy. */
export async function extensionGraphqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: T | null; errors?: Array<{ message: string }> }> {
  const res = await fetch(`${PANEL_URL}/api/cloud/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<{ data?: T | null; errors?: Array<{ message: string }> }>;
}

/** Make a REST call to Desktop's panel-server. */
export async function extensionRestFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PANEL_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`Extension REST error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}
