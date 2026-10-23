import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { expect, it, vi } from "vitest";
import {
  createCategoryRefreshLink,
  PRODUCT_CATEGORIES_SYNC_QUERY,
} from "../product-categories-query.js";

it("transmits forced language refresh as a Desktop-only GraphQL extension", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: {
          productCategories: {
            locale: "fr",
            fetchedAt: new Date().toISOString(),
            items: [],
            marketVersions: [],
            syncStatus: [],
          },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: createCategoryRefreshLink().concat(
      createHttpLink({ uri: "http://localhost/graphql", fetch }),
    ),
  });
  await client.query({
    query: PRODUCT_CATEGORIES_SYNC_QUERY,
    variables: { locale: "fr" },
    fetchPolicy: "no-cache",
    context: { forceCategoriesRefresh: true, http: { includeExtensions: true } },
  });
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.variables).toEqual({ locale: "fr" });
  expect(body.extensions).toMatchObject({ rivonclaw: { forceCategoriesRefresh: true } });
});
