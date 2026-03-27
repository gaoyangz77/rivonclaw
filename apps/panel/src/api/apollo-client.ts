import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";

let _loadingCallbacks: { start: () => void; stop: () => void } | null = null;

export function registerLoadingCallbacks(start: () => void, stop: () => void) {
  _loadingCallbacks = { start, stop };
}

export async function trackedQuery<T>(fn: () => Promise<T>): Promise<T> {
  _loadingCallbacks?.start();
  try {
    return await fn();
  } finally {
    _loadingCallbacks?.stop();
  }
}

let _client: ApolloClient | null = null;

export function createApolloClient() {
  _client = new ApolloClient({
    link: createHttpLink({ uri: "/api/cloud/graphql" }),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-and-network",
      },
    },
  });

  return _client;
}

/**
 * Return the Apollo Client instance created by ApolloWrapper.
 * Must be called after createApolloClient() has been invoked (i.e. after the React tree mounts).
 */
export function getClient(): ApolloClient {
  if (!_client) {
    throw new Error("Apollo client not initialised — getClient() called before createApolloClient()");
  }
  return _client;
}
