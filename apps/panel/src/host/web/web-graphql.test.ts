import { ApolloLink, Observable, execute, gql } from "@apollo/client";
import { describe, expect, it, vi } from "vitest";
import {
  createBearerLink,
  createGraphQLRequester,
  createIngestLink,
  type OperationResult,
} from "./web-graphql.js";
import type { WebSession } from "./web-session.js";

const QUERY = gql`
  query ListShops {
    shops {
      id
    }
  }
`;

function fakeSession(tokens: string[], refreshResult = true): WebSession {
  let index = 0;
  return {
    boot: vi.fn(),
    refresh: vi.fn(async () => {
      if (refreshResult) index += 1;
      return refreshResult;
    }),
    getAccessToken: vi.fn(async () => tokens[Math.min(index, tokens.length - 1)] ?? null),
    peekAccessToken: () => null,
    user: () => null,
    signOut: vi.fn(),
    onExpired: vi.fn(() => () => {}),
  };
}

function run(link: ApolloLink) {
  return new Promise<{ results: unknown[]; error: unknown }>((resolve) => {
    const results: unknown[] = [];
    execute(link, { query: QUERY }, { client: {} as never }).subscribe({
      next: (r) => results.push(r),
      error: (error) => resolve({ results, error }),
      complete: () => resolve({ results, error: null }),
    });
  });
}

function terminating(handler: (authorization: string | undefined) => unknown) {
  const seen: Array<string | undefined> = [];
  const link = new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        const authorization = operation.getContext().headers?.authorization as string | undefined;
        seen.push(authorization);
        const out = handler(authorization);
        if (out instanceof Error) observer.error(out);
        else {
          observer.next(out as never);
          observer.complete();
        }
      }),
  );
  return { link, seen };
}

describe("bearer link", () => {
  it("sends the current access token", async () => {
    const { link, seen } = terminating(() => ({ data: { shops: [] } }));
    await run(createBearerLink(fakeSession(["t1"])).concat(link));
    expect(seen).toEqual(["Bearer t1"]);
  });

  it("refreshes once and replays when the backend answers UNAUTHENTICATED", async () => {
    const session = fakeSession(["old", "new"]);
    const { link, seen } = terminating((auth) =>
      auth === "Bearer new"
        ? { data: { shops: [] } }
        : { data: null, errors: [{ message: "x", extensions: { code: "UNAUTHENTICATED" } }] },
    );
    const { results, error } = await run(createBearerLink(session).concat(link));
    expect(error).toBeNull();
    expect(seen).toEqual(["Bearer old", "Bearer new"]);
    expect(session.refresh).toHaveBeenCalledOnce();
    expect(results).toEqual([{ data: { shops: [] } }]);
  });

  it("replays after an HTTP 401 too, and never more than once", async () => {
    const session = fakeSession(["a", "b"]);
    const unauthorized = Object.assign(new Error("401"), { statusCode: 401 });
    const { link, seen } = terminating(() => unauthorized);
    const { error } = await run(createBearerLink(session).concat(link));
    expect(seen).toEqual(["Bearer a", "Bearer b"]);
    expect(error).toBe(unauthorized);
  });

  it("fails the operation when the refresh finds no session, without replaying", async () => {
    const session = fakeSession(["a"], false);
    const { link, seen } = terminating(() => ({
      data: null,
      errors: [{ message: "x", extensions: { code: "UNAUTHENTICATED" } }],
    }));
    const { error } = await run(createBearerLink(session).concat(link));
    expect(seen).toEqual(["Bearer a"]);
    expect(String(error)).toMatch(/Authentication required/);
  });
});

describe("ingest link", () => {
  it("hands successful query data to the store and still returns it", async () => {
    const onResult = vi.fn<(r: OperationResult) => void>();
    const { link } = terminating(() => ({ data: { shops: [{ id: "s1" }] } }));
    const { results } = await run(createIngestLink(onResult).concat(link));
    expect(results).toEqual([{ data: { shops: [{ id: "s1" }] } }]);
    expect(onResult).toHaveBeenCalledWith({
      operationName: "ListShops",
      variables: {},
      data: { shops: [{ id: "s1" }] },
    });
  });

  it("does not ingest a result that carries errors", async () => {
    const onResult = vi.fn();
    const { link } = terminating(() => ({ data: { shops: [] }, errors: [{ message: "partial" }] }));
    await run(createIngestLink(onResult).concat(link));
    expect(onResult).not.toHaveBeenCalled();
  });
});

describe("startup requester", () => {
  it("refreshes and retries once on 401, then returns data", async () => {
    const session = fakeSession(["old", "new"]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { me: { userId: "u" } } })));
    const request = createGraphQLRequester({ session, graphqlUrl: "/g", fetchImpl });
    await expect(request("query { me { userId } }")).resolves.toEqual({ me: { userId: "u" } });
    expect(fetchImpl.mock.calls[1]![1].headers.authorization).toBe("Bearer new");
  });

  it("throws the GraphQL error message instead of returning partial data", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: "boom" }] })));
    const request = createGraphQLRequester({ session: fakeSession(["t"]), graphqlUrl: "/g", fetchImpl });
    await expect(request("query { x }")).rejects.toThrow("boom");
  });
});
