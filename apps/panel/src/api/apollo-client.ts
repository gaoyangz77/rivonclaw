import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { API } from "@rivonclaw/core/api-contract";

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
    link: createHttpLink({ uri: API["cloud.graphql"].path }),
    cache: new InMemoryCache({
      typePolicies: {
        // Stage IDs are stable inside a shop/configuration, but copied experiment
        // variants intentionally reuse them. They are embedded values rather than
        // globally addressable entities and must not collapse across variants.
        UnpaidOrderReachoutStage: {
          keyFields: false,
        },
      },
    }),
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
