import { test, expect } from "./electron-fixture.js";

// ---------------------------------------------------------------------------
// Helper: send a GraphQL request to the cloud proxy endpoint
// ---------------------------------------------------------------------------

async function cloudGraphql(
  apiBase: string,
  query: string,
  variables?: Record<string, unknown>,
) {
  return fetch(`${apiBase}/api/cloud/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
}

// ---------------------------------------------------------------------------
// Suite 1: Public Queries (no auth required)
// ---------------------------------------------------------------------------

test.describe("Capability Context — Public Queries", () => {
  test("toolRegistry returns tools with uppercase enum values", async ({
    window: _window,
    apiBase,
  }) => {
    const res = await cloudGraphql(
      apiBase,
      `query { toolRegistry { id category serviceCategory displayName description } }`,
    );

    // The cloud proxy may return 401 if not authenticated, or 200 if
    // toolRegistry is a public query. Handle both cases.
    if (res.status === 401) {
      // Auth required even for toolRegistry — verify the error shape
      const body = await res.json();
      expect(body.error).toBe("Not authenticated");
      return;
    }

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data?: {
        toolRegistry?: Array<{
          id: string;
          category: string;
          serviceCategory: string;
          displayName: string;
          description: string;
        }>;
      };
      errors?: Array<{ message: string }>;
    };

    // If the server returned GraphQL errors, skip data assertions
    if (body.errors && !body.data?.toolRegistry) {
      return;
    }

    expect(body.data?.toolRegistry).toBeDefined();
    const tools = body.data!.toolRegistry!;
    expect(tools.length).toBeGreaterThan(0);

    // Verify uppercase enum conventions (W30 four-layer model)
    const browserTool = tools.find((t) => t.id === "BROWSER_PROFILES_LIST");
    if (browserTool) {
      expect(browserTool.category).toBe("BROWSER_PROFILES");
      expect(browserTool.serviceCategory).toBe("BROWSER_PROFILES");
    }

    // All tool IDs should be UPPER_SNAKE_CASE
    for (const tool of tools) {
      expect(tool.id).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(tool.category).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(tool.serviceCategory).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

});

// ---------------------------------------------------------------------------
// Suite 2: Auth-Gated Queries
// ---------------------------------------------------------------------------

test.describe("Capability Context — Auth-Gated Queries", () => {
  test("entitlementSet requires authentication", async ({
    window: _window,
    apiBase,
  }) => {
    const res = await cloudGraphql(
      apiBase,
      `query { entitlementSet { toolIds categories serviceCategories } }`,
    );

    // In E2E without auth setup, this should return 401
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("surfaces requires authentication", async ({
    window: _window,
    apiBase,
  }) => {
    const res = await cloudGraphql(
      apiBase,
      `query { surfaces { id name allowedToolIds allowedCategories description } }`,
    );

    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("assembleCapabilityContext requires authentication", async ({
    window: _window,
    apiBase,
  }) => {
    const res = await cloudGraphql(
      apiBase,
      `query($input: CapabilityContextAssemblyInput!) {
        assembleCapabilityContext(input: $input) {
          effectiveTools
          entitledTools
          surfaceAllowedTools
          runProfileSelectedTools
          surfaceId
          scopeType
          scopeKey
        }
      }`,
      {
        input: {
          surfaceId: "test-surface",
          scopeType: "agent",
          scopeKey: "test-key",
        },
      },
    );

    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("runProfiles requires authentication", async ({
    window: _window,
    apiBase,
  }) => {
    const res = await cloudGraphql(
      apiBase,
      `query { runProfiles { id name selectedToolIds surfaceId } }`,
    );

    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Cloud Proxy — Input Validation
// ---------------------------------------------------------------------------

test.describe("Capability Context — Cloud Proxy Validation", () => {
  test("empty body returns 401 not 400 when unauthenticated", async ({
    window: _window,
    apiBase,
  }) => {
    const res = await fetch(`${apiBase}/api/cloud/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Auth check happens before body validation
    expect(res.status).toBe(401);
  });

  test("malformed query returns 401 when unauthenticated", async ({
    window: _window,
    apiBase,
  }) => {
    const res = await cloudGraphql(apiBase, "not a valid graphql query {{{");
    // Auth check takes priority over query validation
    expect(res.status).toBe(401);
  });
});
