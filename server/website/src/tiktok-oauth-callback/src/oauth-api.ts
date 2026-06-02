import { ApolloClient, HttpLink, InMemoryCache, gql } from "@apollo/client/core";
import {
  OAuthBackend,
  type CompleteTikTokOAuthData,
  type CompleteTikTokOAuthVariables,
  type OAuthEndpointAttempt,
} from "./oauth-types";

const COMPLETE_TIKTOK_OAUTH = gql`
  mutation CompleteTikTokOAuth($code: String!, $state: String!) {
    completeTikTokOAuth(code: $code, state: $state) {
      shopId
      shopName
      platform
    }
  }
`;

export function resolveOAuthEndpoints(): OAuthEndpointAttempt[] {
  const params = new URLSearchParams(window.location.search);
  const override = params.get("graphqlEndpoint");
  if (override) {
    return [{ backend: OAuthBackend.PRODUCTION, endpoint: override }];
  }

  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return [
      { backend: OAuthBackend.PRODUCTION, endpoint: "http://localhost:4100/graphql" },
      { backend: OAuthBackend.STAGING, endpoint: "http://localhost:4101/graphql" },
    ];
  }

  return [
    { backend: OAuthBackend.PRODUCTION, endpoint: "https://api.rivonclaw.com/graphql" },
    { backend: OAuthBackend.STAGING, endpoint: "https://api-stg.rivonclaw.com/graphql" },
  ];
}

export async function completeTikTokOAuth(
  endpoint: string,
  code: string,
  state: string,
): Promise<CompleteTikTokOAuthData> {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: endpoint, fetch }),
    defaultOptions: {
      mutate: {
        errorPolicy: "all",
      },
    },
  });

  const result = await client.mutate<CompleteTikTokOAuthData, CompleteTikTokOAuthVariables>({
    mutation: COMPLETE_TIKTOK_OAUTH,
    variables: { code, state },
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new Error("OAuth callback response did not include data.");
  }

  return result.data;
}
