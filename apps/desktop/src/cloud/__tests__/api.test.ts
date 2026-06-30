import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiContext } from "../../app/api-context.js";
import { rootStore } from "../../app/store/desktop-store.js";
import { RouteRegistry } from "../../infra/api/route-registry.js";
import { toMstSnapshot } from "../../providers/provider-key-utils.js";
import { __resetCloudGraphqlProxyForTests, registerCloudHandlers } from "../api.js";
import { TOOL_SPECS_SYNC_QUERY } from "../init-queries.js";

// ---------------------------------------------------------------------------
// Test registry
// ---------------------------------------------------------------------------

let registry: RouteRegistry;

beforeEach(() => {
  __resetCloudGraphqlProxyForTests();
  rootStore.loadProviderKeys([]);
  registry = new RouteRegistry();
  registerCloudHandlers(registry);
});

async function dispatch(
  method: string,
  path: string,
  ctx: ApiContext,
  body?: unknown,
  headers?: Record<string, string>,
) {
  const req = makeReq(method, body, headers);
  const res = makeRes();
  const url = new URL(`http://localhost${path}`);
  const handled = await registry.dispatch(req, res, url, path, ctx);
  return { handled, res };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): IncomingMessage {
  const readable = new Readable({ read() {} });
  if (body !== undefined) {
    readable.push(JSON.stringify(body));
  }
  readable.push(null);
  (readable as any).method = method;
  (readable as any).headers = headers;
  return readable as unknown as IncomingMessage;
}

function makeRes(): ServerResponse & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: null as unknown,
    writeHead(status: number, _headers?: Record<string, string>) {
      res._status = status;
      return res;
    },
    end(data?: string) {
      if (data) res._body = JSON.parse(data);
    },
  } as unknown as ServerResponse & { _status: number; _body: unknown };
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("cloud-graphql handler", () => {
  const pathname = "/api/cloud/graphql";

  it("returns false for non-matching routes", async () => {
    const ctx = {} as ApiContext;
    const { handled } = await dispatch("POST", "/api/other", ctx, { query: "{ me { id } }" });
    expect(handled).toBe(false);
  });

  it("rejects non-POST requests to /api/cloud/graphql via REST prefix guard", async () => {
    const ctx = {} as ApiContext;
    const { handled, res } = await dispatch("GET", pathname, ctx);
    // The REST prefix handler matches /api/cloud/* and rejects _rest === "graphql"
    expect(handled).toBe(true);
    expect(res._status).toBe(404);
    expect(res._body).toEqual({ error: "Not found" });
  });

  it("returns 200 with errors when authSession is not available", async () => {
    const ctx = {} as ApiContext;
    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ me { id } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Auth session not ready" }] });
  });

  it("returns 200 with errors when body is missing query field", async () => {
    const ctx = {
      authSession: { getAccessToken: () => "valid-token" },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { variables: {} });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Missing query" }] });
  });

  it("forwards public queries without token (transparent proxy)", async () => {
    const mockData = { skills: [{ slug: "1password" }] };
    const ctx = {
      authSession: {
        getAccessToken: () => null,
        graphqlFetch: vi.fn().mockResolvedValue(mockData),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: "{ skills { slug } }",
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ data: mockData });
  });

  it("returns { data } on successful graphqlFetch", async () => {
    const mockData = {
      me: {
        userId: "1",
        email: "test@example.com",
        name: "Test",
        createdAt: "2025-01-01T00:00:00Z",
        enrolledModules: [],
        entitlementKeys: [],
        defaultRunProfileId: null,
      },
    };
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch: vi.fn().mockResolvedValue(mockData),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: "{ me { userId email } }",
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ data: mockData });
  });

  it("rejects malformed affiliate resolve work item actions before proxying", async () => {
    const graphqlFetch = vi.fn();
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const mutation = `
      mutation ResolveAffiliateWorkItem($input: ResolveAffiliateWorkItemInput!) {
        resolveAffiliateWorkItem(input: $input) {
          decision
          stale
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: mutation,
      variables: {
        input: {
          shopId: "shop-1",
          collaborationRecordId: "collab-1",
          handledSignalAt: "2026-06-14T07:17:07.966Z",
          decision: "REQUEST_ACTION",
          operatorSummary: "Approve the sample.",
          action: {
            type: "REVIEW_SAMPLE_APPLICATION",
            sampleReviewIntent: {},
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(res._body).toEqual({
      errors: [
        {
          message: expect.stringContaining(
            "Desktop blocked an invalid affiliate action payload before sending it to backend",
          ),
        },
      ],
    });
  });

  it("normalizes flattened affiliate sample review actions before proxying", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "REQUEST_ACTION",
        stale: false,
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const mutation = `
      mutation ResolveAffiliateWorkItem($input: ResolveAffiliateWorkItemInput!) {
        resolveAffiliateWorkItem(input: $input) {
          decision
          stale
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: mutation,
      variables: {
        input: {
          shopId: "shop-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Reject the sample.",
          action: {
            type: "REVIEW_SAMPLE_APPLICATION",
            predictionCacheIds: ["pred-1"],
            sampleApplicationRecordId: "sample-1",
            platformApplicationId: "platform-app-1",
            decision: "REJECT",
            rejectReason: "OTHER",
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).toHaveBeenCalledWith(
      mutation,
      expect.objectContaining({
        input: expect.objectContaining({
          decision: "REQUEST_ACTION",
          action: {
            type: "REVIEW_SAMPLE_APPLICATION",
            predictionCacheIds: ["pred-1"],
            expiresAt: undefined,
            sampleReviewIntent: {
              sampleApplicationRecordId: "sample-1",
              platformApplicationId: "platform-app-1",
              decision: "REJECT",
              rejectReason: "OTHER",
            },
          },
        }),
      }),
    );
  });

  it("normalizes common sample review aliases and defaults reject reason", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "REQUEST_ACTION",
        stale: false,
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const mutation = `
      mutation ResolveAffiliateWorkItem($input: ResolveAffiliateWorkItemInput!) {
        resolveAffiliateWorkItem(input: $input) {
          decision
          stale
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: mutation,
      variables: {
        input: {
          shopId: "shop-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Decline the sample.",
          action: {
            type: "REVIEW_SAMPLE_APPLICATION",
            sampleApplicationRecordId: "sample-1",
            platformApplicationId: "platform-app-1",
            sampleDecision: "DENIED",
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).toHaveBeenCalledWith(
      mutation,
      expect.objectContaining({
        input: expect.objectContaining({
          decision: "REQUEST_ACTION",
          action: {
            type: "REVIEW_SAMPLE_APPLICATION",
            predictionCacheIds: undefined,
            expiresAt: undefined,
            sampleReviewIntent: {
              sampleApplicationRecordId: "sample-1",
              platformApplicationId: "platform-app-1",
              decision: "REJECT",
              rejectReason: "OTHER",
            },
          },
        }),
      }),
    );
  });

  it("blocks bundled sample review actions when decision is missing", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "REQUEST_ACTION",
        stale: false,
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const mutation = `
      mutation ResolveAffiliateWorkItem($input: ResolveAffiliateWorkItemInput!) {
        resolveAffiliateWorkItem(input: $input) {
          decision
          stale
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: mutation,
      variables: {
        input: {
          shopId: "shop-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Review the sample and send a reply.",
          actions: [
            {
              type: "REVIEW_SAMPLE_APPLICATION",
              sampleReviewIntent: {
                sampleApplicationRecordId: "sample-1",
                platformApplicationId: "platform-app-1",
              },
            },
            {
              type: "SEND_MESSAGE",
              messageText: "Thanks for your interest. After reviewing the request, we are not moving forward with this sample.",
            },
          ],
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(res._body).toEqual({
      errors: [
        {
          message: expect.stringContaining(
            "Desktop blocked an invalid affiliate action payload before sending it to backend",
          ),
        },
      ],
    });
  });

  it("does not infer sample review decisions from creator-facing message text", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "REQUEST_ACTION",
        stale: false,
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const mutation = `
      mutation ResolveAffiliateWorkItem($input: ResolveAffiliateWorkItemInput!) {
        resolveAffiliateWorkItem(input: $input) {
          decision
          stale
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: mutation,
      variables: {
        input: {
          shopId: "shop-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Review the sample and send a reply.",
          actions: [
            {
              type: "REVIEW_SAMPLE_APPLICATION",
              sampleReviewIntent: {
                sampleApplicationRecordId: "sample-1",
                platformApplicationId: "platform-app-1",
              },
            },
            {
              type: "SEND_MESSAGE",
              messageText: "Thank you for applying. After review, we are not moving forward with this sample collaboration.",
            },
          ],
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(res._body).toEqual({
      errors: [
        {
          message: expect.stringContaining(
            "Desktop blocked an invalid affiliate action payload before sending it to backend",
          ),
        },
      ],
    });
  });

  it("blocks placeholder sample review decisions instead of guessing from sibling message text", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "REQUEST_ACTION",
        stale: false,
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const mutation = `
      mutation ResolveAffiliateWorkItem($input: ResolveAffiliateWorkItemInput!) {
        resolveAffiliateWorkItem(input: $input) {
          decision
          stale
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: mutation,
      variables: {
        input: {
          shopId: "shop-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Review the sample and send a reply.",
          actions: [
            {
              type: "REVIEW_SAMPLE_APPLICATION",
              sampleReviewIntent: {
                sampleApplicationRecordId: "sample-1",
                platformApplicationId: "platform-app-1",
                decision: "APPROVE_OR_REJECT",
              },
            },
            {
              type: "SEND_MESSAGE",
              messageText: "Thank you for applying. After review, we are not moving forward with this sample collaboration.",
            },
          ],
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(res._body).toEqual({
      errors: [
        {
          message: expect.stringContaining(
            "Desktop blocked an invalid affiliate action payload before sending it to backend",
          ),
        },
      ],
    });
  });

  it("blocks empty sample review intents even when sibling message implies rejection", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "REQUEST_ACTION",
        stale: false,
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const mutation = `
      mutation ResolveAffiliateWorkItem($input: ResolveAffiliateWorkItemInput!) {
        resolveAffiliateWorkItem(input: $input) {
          decision
          stale
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: mutation,
      variables: {
        input: {
          shopId: "shop-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Approve or reject the sample request and send a reply.",
          actions: [
            {
              type: "REVIEW_SAMPLE_APPLICATION",
              sampleReviewIntent: {},
              sampleApplicationRecordId: "sample-1",
              platformApplicationId: "platform-app-1",
            },
            {
              type: "SEND_MESSAGE",
              messageText: "Thank you for applying. After review, we're not moving forward with this sample collaboration.",
            },
          ],
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(res._body).toEqual({
      errors: [
        {
          message: expect.stringContaining(
            "Desktop blocked an invalid affiliate action payload before sending it to backend",
          ),
        },
      ],
    });
  });

  it("normalizes affiliate send message actions to the matching typed intent only", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "REQUEST_ACTION",
        stale: false,
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const mutation = `
      mutation ResolveAffiliateWorkItem($input: ResolveAffiliateWorkItemInput!) {
        resolveAffiliateWorkItem(input: $input) {
          decision
          stale
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: mutation,
      variables: {
        input: {
          shopId: "shop-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Reply to creator.",
          action: {
            type: "SEND_MESSAGE",
            predictionCacheIds: ["pred-1"],
            messageIntent: {
              messageType: "TEXT",
              text: "Thanks for the update.",
              conversationId: "conv-1",
            },
            sampleReviewIntent: {
              sampleApplicationRecordId: "sample-1",
              platformApplicationId: "platform-app-1",
              decision: "APPROVE",
            },
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).toHaveBeenCalledWith(
      mutation,
      expect.objectContaining({
        input: expect.objectContaining({
          decision: "REQUEST_ACTION",
          action: {
            type: "SEND_MESSAGE",
            predictionCacheIds: ["pred-1"],
            expiresAt: undefined,
            messageIntent: {
              messageType: "TEXT",
              text: "Thanks for the update.",
              conversationId: "conv-1",
            },
          },
        }),
      }),
    );
  });

  it("normalizes anonymous affiliate resolve mutations by input shape", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "REQUEST_ACTION",
        stale: false,
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const mutation = `
      mutation($input: ResolveAffiliateWorkItemInput!) {
        resolveAffiliateWorkItem(input: $input) {
          decision
          stale
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: mutation,
      variables: {
        input: {
          shopId: "shop-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Reply to creator.",
          action: {
            type: "SEND_MESSAGE",
            messageIntent: {},
            text: "Thanks for the update.",
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).toHaveBeenCalledWith(
      mutation,
      expect.objectContaining({
        input: expect.objectContaining({
          action: {
            type: "SEND_MESSAGE",
            predictionCacheIds: undefined,
            expiresAt: undefined,
            messageIntent: {
              messageType: "TEXT",
              text: "Thanks for the update.",
            },
          },
        }),
      }),
    );
  });

  it("normalizes common send message text aliases into messageIntent.text", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "REQUEST_ACTION",
        stale: false,
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const mutation = `
      mutation($input: ResolveAffiliateWorkItemInput!) {
        resolveAffiliateWorkItem(input: $input) {
          decision
          stale
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query: mutation,
      variables: {
        input: {
          shopId: "shop-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          action: {
            type: "send_message",
            messageIntent: {
              messageType: "TEXT",
              content: "Creator-facing reply.",
            },
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).toHaveBeenCalledWith(
      mutation,
      expect.objectContaining({
        input: expect.objectContaining({
          action: {
            type: "SEND_MESSAGE",
            predictionCacheIds: undefined,
            expiresAt: undefined,
            messageIntent: {
              messageType: "TEXT",
              content: "Creator-facing reply.",
              text: "Creator-facing reply.",
            },
          },
        }),
      }),
    );
  });

  it("returns 200 with errors on auth-related errors", async () => {
    const ctx = {
      authSession: {
        getAccessToken: () => "expired-token",
        graphqlFetch: vi.fn().mockRejectedValue(new Error("Token expired")),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ me { id } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Token expired" }] });
  });

  it("returns 200 with errors for 'Not authenticated'", async () => {
    const ctx = {
      authSession: {
        getAccessToken: () => null,
        graphqlFetch: vi.fn().mockRejectedValue(new Error("Not authenticated")),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ me { id } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Not authenticated" }] });
  });

  it("returns 200 with errors on non-auth errors", async () => {
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch: vi.fn().mockRejectedValue(new Error("Internal server error")),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ shop { id } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Internal server error" }] });
  });

  it("handles non-Error thrown values", async () => {
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch: vi.fn().mockRejectedValue("string-error"),
      },
    } as unknown as ApiContext;

    const { handled, res } = await dispatch("POST", pathname, ctx, { query: "{ me { id } }" });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ errors: [{ message: "Cloud GraphQL request failed" }] });
  });

  it("invalidates cached toolSpecs and refreshes auth state after module enrollment changes", async () => {
    const toolSpecsQuery = TOOL_SPECS_SYNC_QUERY;
    const enrollMutation =
      "mutation EnrollModule($moduleId: ModuleId!) { enrollModule(moduleId: $moduleId) { __typename userId email name createdAt enrolledModules entitlementKeys defaultRunProfileId } }";
    const onAuthChange = vi.fn().mockResolvedValue(undefined);
    const graphqlFetch = vi.fn(async (query: string) => {
      if (query === toolSpecsQuery) {
        const toolSpecsCallCount = graphqlFetch.mock.calls.filter(
          ([q]) => q === toolSpecsQuery,
        ).length;
        return {
          toolSpecs: [
            {
              id: toolSpecsCallCount === 1 ? "old-tool" : "new-tool",
              name: toolSpecsCallCount === 1 ? "old-tool" : "new-tool",
              displayName: toolSpecsCallCount === 1 ? "Old tool" : "New tool",
              category: "ecommerce",
            },
          ],
        };
      }
      if (query === enrollMutation) {
        return {
          enrollModule: {
            __typename: "MeResponse",
            userId: "1",
            email: "user@example.com",
            name: "User",
            createdAt: "2026-05-24T00:00:00.000Z",
            enrolledModules: ["GLOBAL_ECOMMERCE_SELLER"],
            entitlementKeys: [],
            defaultRunProfileId: null,
          },
        };
      }
      throw new Error(`Unexpected query: ${query}`);
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
      onAuthChange,
    } as unknown as ApiContext;

    const first = await dispatch(
      "POST",
      pathname,
      ctx,
      { query: toolSpecsQuery },
    );
    const cached = await dispatch(
      "POST",
      pathname,
      ctx,
      { query: toolSpecsQuery },
    );
    await dispatch("POST", pathname, ctx, {
      query: enrollMutation,
      variables: { moduleId: "GLOBAL_ECOMMERCE_SELLER" },
    });
    const refreshed = await dispatch(
      "POST",
      pathname,
      ctx,
      { query: toolSpecsQuery },
    );
    const extensionAttempt = await dispatch(
      "POST",
      pathname,
      ctx,
      { query: toolSpecsQuery },
      { "x-request-source": "extension" },
    );

    expect(first.res._body).toEqual({
      data: { toolSpecs: [expect.objectContaining({ id: "old-tool" })] },
    });
    expect(cached.res._body).toEqual({
      data: { toolSpecs: [expect.objectContaining({ id: "old-tool" })] },
    });
    expect(refreshed.res._body).toEqual({
      data: { toolSpecs: [expect.objectContaining({ id: "new-tool" })] },
    });
    expect(extensionAttempt.res._body).toEqual({
      errors: [{ message: "ToolSpecsSync is desktop-owned; extensions receive ToolSpecs from Desktop via gateway RPC" }],
    });
    expect(graphqlFetch.mock.calls.filter(([query]) => query === toolSpecsQuery)).toHaveLength(2);
    expect(onAuthChange).toHaveBeenCalledTimes(1);
  });

  it("syncs cloud LLM provider when billing overview reports account LLM entitlement is allowed", async () => {
    const onCloudLlmEntitlementAvailable = vi.fn().mockResolvedValue(undefined);
    const data = {
      billingOverview: {
        accountLlm: {
          planId: "RIVONCLAW_AI_PRO",
          entitlement: {
            scopeType: "ACCOUNT",
            scopeId: "user-1",
            product: "RIVONCLAW_AI",
            allowed: true,
            code: "ALLOWED",
            source: "SUBSCRIPTION",
            subscription: null,
            validUntil: null,
            usage: [],
          },
        },
        shops: [],
      },
    };
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch: vi.fn().mockResolvedValue(data),
      },
      onCloudLlmEntitlementAvailable,
    } as unknown as ApiContext;

    const { res } = await dispatch("POST", pathname, ctx, {
      query: "query BillingOverview { billingOverview { accountLlm { entitlement { allowed } } } }",
    });
    await Promise.resolve();

    expect(res._body).toEqual({ data });
    expect(onCloudLlmEntitlementAvailable).toHaveBeenCalledTimes(1);
  });

  it("does not sync cloud LLM provider on billing polling when local cloud key already exists", async () => {
    const onCloudLlmEntitlementAvailable = vi.fn().mockResolvedValue(undefined);
    await rootStore.loadProviderKeys([
      await toMstSnapshot(
        {
          id: "cloud-rivonclaw-pro",
          provider: "rivonclaw-pro",
          label: "RivonClaw AI",
          model: "gpt-5.5",
          isDefault: true,
          authType: "custom",
          baseUrl: "https://api.rivonclaw.com/llm/v1",
          customProtocol: "openai",
          customModelsJson: JSON.stringify([{ id: "gpt-5.5" }]),
          source: "cloud",
          createdAt: "",
          updatedAt: "",
        },
        { get: async () => null } as any,
      ),
    ]);
    const data = {
      billingOverview: {
        accountLlm: {
          planId: "RIVONCLAW_AI_PRO",
          entitlement: {
            scopeType: "ACCOUNT",
            scopeId: "user-1",
            product: "RIVONCLAW_AI",
            allowed: true,
            code: "ALLOWED",
            source: "SUBSCRIPTION",
            subscription: null,
            validUntil: null,
            usage: [],
          },
        },
        shops: [],
      },
    };
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch: vi.fn().mockResolvedValue(data),
      },
      onCloudLlmEntitlementAvailable,
    } as unknown as ApiContext;

    const { res } = await dispatch("POST", pathname, ctx, {
      query: "query BillingOverview { billingOverview { accountLlm { entitlement { allowed } } } }",
    });
    await Promise.resolve();

    expect(res._body).toEqual({ data });
    expect(onCloudLlmEntitlementAvailable).not.toHaveBeenCalled();
  });

  it("does not sync cloud LLM provider for signed-out billing overview responses", async () => {
    const onCloudLlmEntitlementAvailable = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      authSession: {
        getAccessToken: () => null,
        graphqlFetch: vi.fn().mockResolvedValue({
          billingOverview: {
            accountLlm: {
              planId: "RIVONCLAW_AI_PRO",
              entitlement: {
                scopeType: "ACCOUNT",
                scopeId: "user-1",
                product: "RIVONCLAW_AI",
                allowed: true,
                code: "ALLOWED",
                source: "SUBSCRIPTION",
                subscription: null,
                validUntil: null,
                usage: [],
              },
            },
            shops: [],
          },
        }),
      },
      onCloudLlmEntitlementAvailable,
    } as unknown as ApiContext;

    await dispatch("POST", pathname, ctx, {
      query: "query BillingOverview { billingOverview { accountLlm { entitlement { allowed } } } }",
    });
    await Promise.resolve();

    expect(onCloudLlmEntitlementAvailable).not.toHaveBeenCalled();
  });
});
