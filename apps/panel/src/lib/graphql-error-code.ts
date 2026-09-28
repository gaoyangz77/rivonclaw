/**
 * The `extensions.code` of the first GraphQL error carried by an Apollo
 * mutation or query failure, or null when the failure carries none (a network
 * error, or a resolver error the backend did not classify).
 *
 * Apollo Client 4 exposes GraphQL errors as `errors` on `CombinedGraphQLErrors`;
 * `graphQLErrors` is the Apollo Client 3 shape, still accepted so the helper
 * reads either.
 */
export function graphQLErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as {
    graphQLErrors?: Array<{ extensions?: { code?: unknown } }>;
    errors?: Array<{ extensions?: { code?: unknown } }>;
  };
  const code = value.graphQLErrors?.[0]?.extensions?.code ?? value.errors?.[0]?.extensions?.code;
  return typeof code === "string" ? code : null;
}
