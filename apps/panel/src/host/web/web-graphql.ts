import { ApolloLink, HttpLink, Observable } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import type { WebSession } from "./web-session.js";

/** Operation names whose success deletes an entity the response cannot name (booleans). */
export const DELETION_MUTATION_MAP: Record<string, string> = {
  DeleteShop: "Shop",
  DisconnectAdsAdvertiser: "AdsAdvertiser",
  DeleteSurface: "Surface",
  DeleteRunProfile: "RunProfile",
};

export interface OperationResult {
  operationName: string | undefined;
  variables: Record<string, unknown>;
  data: Record<string, unknown>;
}

interface GraphQLErrorLike {
  message?: string;
  extensions?: { code?: unknown };
}

export function hasAuthError(errors: readonly GraphQLErrorLike[] | undefined): boolean {
  return !!errors?.some((error) => error.extensions?.code === "UNAUTHENTICATED");
}

function isUnauthorizedTransportError(error: unknown): boolean {
  return (error as { statusCode?: number } | null)?.statusCode === 401;
}

/**
 * Adds the bearer token and, when the backend rejects it, refreshes the
 * session once and replays the operation. The replay is the only retry: a
 * second rejection is passed through, and a failed refresh signs the session
 * out (the session reports it to `onSessionExpired`).
 */
export function createBearerLink(session: WebSession): ApolloLink {
  return new ApolloLink(
    (operation, forward) =>
      new Observable((observer) => {
        let current: { unsubscribe(): void } | null = null;
        let cancelled = false;

        const attempt = async (isRetry: boolean): Promise<void> => {
          const token = await session.getAccessToken();
          if (cancelled) return;
          operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
            headers: {
              ...headers,
              ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
          }));
          let retrying = false;
          current = forward(operation).subscribe({
            next(result) {
              if (!isRetry && hasAuthError(result.errors)) {
                retrying = true;
                void replay();
                return;
              }
              observer.next(result);
            },
            error(error) {
              if (!isRetry && isUnauthorizedTransportError(error)) {
                retrying = true;
                void replay();
                return;
              }
              observer.error(error);
            },
            complete() {
              if (!retrying) observer.complete();
            },
          });
        };

        const replay = async (): Promise<void> => {
          try {
            const signedIn = await session.refresh();
            if (cancelled) return;
            // Replaying without a session only repeats the rejection.
            if (!signedIn) {
              observer.error(new Error("Authentication required"));
              return;
            }
            await attempt(true);
          } catch (error) {
            observer.error(error);
          }
        };

        attempt(false).catch((error) => observer.error(error));
        return () => {
          cancelled = true;
          current?.unsubscribe();
        };
      }),
  );
}

/** Hands every successful query/mutation result to `onResult` (the store ingestion) and passes it on. */
export function createIngestLink(onResult: (result: OperationResult) => void): ApolloLink {
  return new ApolloLink(
    (operation, forward) =>
      new Observable((observer) => {
        const subscription = forward(operation).subscribe({
          next(result) {
            const definition = getMainDefinition(operation.query);
            const isSubscription =
              definition.kind === "OperationDefinition" && definition.operation === "subscription";
            if (!isSubscription && result.data && !result.errors?.length) {
              onResult({
                operationName: operation.operationName,
                variables: operation.variables ?? {},
                data: result.data as Record<string, unknown>,
              });
            }
            observer.next(result);
          },
          error: (error) => observer.error(error),
          complete: () => observer.complete(),
        });
        return () => subscription.unsubscribe();
      }),
  );
}

export function createWebGraphQLLink(options: {
  session: WebSession;
  graphqlUrl: string;
  onResult: (result: OperationResult) => void;
}): ApolloLink {
  return ApolloLink.from([
    createBearerLink(options.session),
    createIngestLink(options.onResult),
    new HttpLink({ uri: options.graphqlUrl, credentials: "include" }),
  ]);
}

/**
 * Plain authenticated GraphQL request for the host's own queries (startup
 * queries, subscription follow-ups). Panel's Apollo client is not involved,
 * so nothing here lands in its cache.
 */
export function createGraphQLRequester(options: {
  session: WebSession;
  graphqlUrl: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  async function send(query: string, variables: Record<string, unknown> | undefined) {
    const token = await options.session.getAccessToken();
    const response = await fetchImpl(options.graphqlUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
    if (response.status === 401) return { unauthenticated: true as const };
    if (!response.ok) throw new Error(`GraphQL request failed: ${response.status}`);
    return {
      unauthenticated: false as const,
      body: (await response.json()) as {
        data?: Record<string, unknown> | null;
        errors?: GraphQLErrorLike[];
      },
    };
  }

  return async function request<T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    let result = await send(query, variables);
    if (result.unauthenticated || hasAuthError(result.body.errors)) {
      if (!(await options.session.refresh())) throw new Error("Authentication required");
      result = await send(query, variables);
      if (result.unauthenticated) throw new Error("Authentication required");
    }
    const { data, errors } = result.body;
    if (errors?.length || !data) {
      throw new Error(errors?.map((e) => e.message).join("; ") || "Empty GraphQL response");
    }
    return data as T;
  };
}

export type GraphQLRequester = ReturnType<typeof createGraphQLRequester>;
