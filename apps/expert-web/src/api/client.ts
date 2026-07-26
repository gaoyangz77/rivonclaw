import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  Observable,
} from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getAccessToken } from "./auth-session.js";

function websocketUrl(): string {
  const configured = import.meta.env.VITE_EXPERT_GRAPHQL_WS_URL as string | undefined;
  if (configured) return configured;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/graphql`;
}

const authLink = new ApolloLink(
  (operation, forward) =>
    new Observable((observer) => {
      const token = getAccessToken();
      operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
        headers: {
          ...headers,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      }));
      return forward(operation).subscribe(observer);
    }),
);

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_EXPERT_GRAPHQL_URL || "/api/graphql",
  credentials: "include",
});

const wsLink =
  typeof window === "undefined"
    ? null
    : new GraphQLWsLink(
        createClient({
          url: websocketUrl,
          lazy: true,
          retryAttempts: 5,
          connectionParams: () => {
            const token = getAccessToken();
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      );

const transportLink = wsLink
  ? ApolloLink.split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return definition.kind === "OperationDefinition" && definition.operation === "subscription";
      },
      wsLink,
      httpLink,
    )
  : httpLink;

export const apolloClient = new ApolloClient({
  link: authLink.concat(transportLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: { fetchPolicy: "network-only" },
    watchQuery: { fetchPolicy: "cache-and-network" },
  },
});
