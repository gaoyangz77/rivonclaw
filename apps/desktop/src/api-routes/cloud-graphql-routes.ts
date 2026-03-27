import type { RouteHandler } from "./api-context.js";
import { parseBody, sendJson } from "./route-utils.js";

export const handleCloudGraphqlRoutes: RouteHandler = async (req, res, _url, pathname, ctx) => {
  if (pathname === "/api/cloud/graphql" && req.method === "POST") {
    if (!ctx.authSession) {
      sendJson(res, 200, { errors: [{ message: "Auth session not ready" }] });
      return true;
    }

    const body = await parseBody(req) as { query?: string; variables?: Record<string, unknown> };
    if (!body.query) {
      sendJson(res, 200, { errors: [{ message: "Missing query" }] });
      return true;
    }

    // Transparent proxy: always returns 200 with standard GraphQL response.
    // graphqlFetch adds Bearer token if available, forwards without token
    // for public queries. Cloud decides auth.
    try {
      const data = await ctx.authSession.graphqlFetch(body.query, body.variables);
      sendJson(res, 200, { data });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cloud GraphQL request failed";
      sendJson(res, 200, { errors: [{ message }] });
    }
    return true;
  }

  return false;
};
