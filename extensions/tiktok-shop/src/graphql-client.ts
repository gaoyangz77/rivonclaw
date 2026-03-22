/**
 * Thin GraphQL client for calling the backend via the local panel-server proxy.
 * All TikTok API calls are proxied: extension -> panel proxy -> backend -> TikTok.
 */

const PANEL_BASE_URL = "http://127.0.0.1:3210";
const GRAPHQL_PATH = "/api/cloud/graphql";

export interface GraphQLResult<T = Record<string, unknown>> {
  data?: T | null;
  errors?: Array<{ message: string }>;
}

export async function graphqlFetch<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphQLResult<T>> {
  const res = await fetch(`${PANEL_BASE_URL}${GRAPHQL_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP error: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as GraphQLResult<T>;
}
