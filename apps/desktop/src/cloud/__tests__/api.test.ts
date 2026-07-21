import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiContext } from "../../app/api-context.js";
import { rootStore } from "../../app/store/desktop-store.js";
import {
  registerActiveAffiliateRunCheckpoint,
  unregisterActiveAffiliateRunCheckpoint,
} from "../../affiliate/affiliate-run-checkpoints.js";
import { RouteRegistry } from "../../infra/api/route-registry.js";
import { toMstSnapshot } from "../../providers/provider-key-utils.js";
import { __resetCloudGraphqlProxyForTests, registerCloudHandlers } from "../api.js";
import { TOOL_SPECS_SYNC_QUERY } from "../init-queries.js";

const mockOpenClawRequest = vi.hoisted(() => vi.fn());

vi.mock("../../openclaw/index.js", () => ({
  openClawConnector: {
    request: (...args: unknown[]) => mockOpenClawRequest(...args),
  },
}));

// ---------------------------------------------------------------------------
// Test registry
// ---------------------------------------------------------------------------

let registry: RouteRegistry;

beforeEach(() => {
  __resetCloudGraphqlProxyForTests();
  mockOpenClawRequest.mockReset();
  mockOpenClawRequest.mockResolvedValue({ ok: true });
  unregisterActiveAffiliateRunCheckpoint({
    creatorRelationshipId: "relationship-1",
    runId: "run-checkpoint-1",
  });
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

  it("whitelists persistentResult extensions and preserves the backend envelope for tools", async () => {
    const envelope = {
      data: null,
      extensions: {
        persistentResult: { jobId: "job-1", status: "QUEUED", pollAfterMs: 1000 },
      },
    };
    const graphqlFetchEnvelope = vi.fn().mockResolvedValue(envelope);
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetchEnvelope,
      },
    } as unknown as ApiContext;

    const { res } = await dispatch(
      "POST",
      pathname,
      ctx,
      {
        query: "query GetData { getData { id } }",
        variables: { id: "1" },
        extensions: {
          rivonclaw: {
            persistResult: true,
            toolId: "ECOM_GET_BI_DATA",
            ignored: "not-forwarded",
          },
        },
      },
      { "x-request-source": "extension" },
    );

    expect(graphqlFetchEnvelope).toHaveBeenCalledWith(
      "query GetData { getData { id } }",
      { id: "1" },
      {
        rivonclaw: {
          persistResult: true,
          toolId: "ECOM_GET_BI_DATA",
        },
      },
    );
    expect(res._body).toEqual(envelope);
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
          creatorRelationshipId: "relationship-1",
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

  it("rejects affiliate resolve work item calls without creatorRelationshipId", async () => {
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
          decision: "REQUEST_ACTION",
          operatorSummary: "Reply to creator.",
          action: {
            type: "SEND_MESSAGE",
            messageText: "Thanks for the update.",
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
          message: "creatorRelationshipId is required for affiliate_resolve_work_item",
        },
      ],
    });
  });

  it("injects the active affiliate run checkpoint into resolve work item calls", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "REQUEST_ACTION",
        stale: false,
        proposal: {
          id: "proposal-1",
          status: "PENDING",
          operatorSummary: "Follow up.",
          baseCheckpointId: null,
          candidateCheckpointId: "candidate-checkpoint-1",
        },
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;
    registerActiveAffiliateRunCheckpoint({
      creatorRelationshipId: "relationship-1",
      sessionKey: "agent:main:affiliate:user-1:relationship-1",
      runId: "run-checkpoint-1",
      baseCheckpointId: null,
      baseEventCursor: 7,
      handledSignalAt: "2026-06-14T07:17:07.966Z",
      candidateCheckpointId: "candidate-checkpoint-1",
      targetEventCursor: 9,
      relationshipOperationalConfigRevision: 4,
      businessDeveloperIdSnapshot: null,
      businessDeveloperConfigRevision: null,
    });

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
          creatorRelationshipId: "relationship-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Follow up.",
          baseCheckpointId: "agent-supplied-wrong-base",
          handledSignalAt: "2026-01-01T00:00:00.000Z",
          candidateCheckpointId: null,
          relationshipOperationalConfigRevision: 99,
          businessDeveloperIdSnapshot: "agent-supplied-wrong-bd",
          businessDeveloperConfigRevision: 99,
          action: {
            type: "SEND_MESSAGE",
            messageIntent: {
              parts: [{ kind: "TEXT", text: "Hi, just checking in." }],
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
          baseCheckpointId: null,
          baseEventCursor: 7,
          handledSignalAt: "2026-06-14T07:17:07.966Z",
          candidateCheckpointId: "candidate-checkpoint-1",
          targetEventCursor: 9,
          relationshipOperationalConfigRevision: 4,
          businessDeveloperIdSnapshot: null,
          businessDeveloperConfigRevision: null,
        }),
      }),
    );
    expect(mockOpenClawRequest).toHaveBeenCalledWith(
      "sessions.checkpoint.create",
      expect.objectContaining({
        key: "agent:main:affiliate:user-1:relationship-1",
        checkpointId: "candidate-checkpoint-1",
      }),
    );
    expect(mockOpenClawRequest.mock.invocationCallOrder[0]).toBeLessThan(
      graphqlFetch.mock.invocationCallOrder[0],
    );
  });

  it("does not proxy affiliate work resolution when the candidate checkpoint cannot be captured", async () => {
    mockOpenClawRequest.mockRejectedValueOnce(new Error("session transcript not found"));
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
    registerActiveAffiliateRunCheckpoint({
      creatorRelationshipId: "relationship-1",
      sessionKey: "agent:main:affiliate:user-1:relationship-1",
      runId: "run-checkpoint-1",
      baseCheckpointId: null,
      baseEventCursor: 7,
      handledSignalAt: "2026-06-14T07:17:07.966Z",
      candidateCheckpointId: "candidate-checkpoint-1",
      targetEventCursor: 9,
      relationshipOperationalConfigRevision: 4,
      businessDeveloperIdSnapshot: null,
      businessDeveloperConfigRevision: null,
    });

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
          creatorRelationshipId: "relationship-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Follow up.",
          action: {
            type: "SEND_MESSAGE",
            messageIntent: {
              parts: [{ kind: "TEXT", text: "Hi, just checking in." }],
            },
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(res._body).toEqual({
      errors: [{ message: "session transcript not found" }],
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
          creatorRelationshipId: "relationship-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Reject the sample.",
          action: {
            type: "REVIEW_SAMPLE_APPLICATION",
            predictionCacheIds: ["pred-1"],
            sampleApplicationRecordId: "sample-1",
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
            sampleReviewIntent: {
              sampleApplicationRecordId: "sample-1",
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
          creatorRelationshipId: "relationship-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Decline the sample.",
          action: {
            type: "REVIEW_SAMPLE_APPLICATION",
            sampleApplicationRecordId: "sample-1",
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
            sampleReviewIntent: {
              sampleApplicationRecordId: "sample-1",
              decision: "REJECT",
              rejectReason: "OTHER",
            },
          },
        }),
      }),
    );
  });

  it("drops empty unrelated affiliate action intents before proxying", async () => {
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
          creatorRelationshipId: "relationship-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Reject the sample.",
          action: {
            type: "REVIEW_SAMPLE_APPLICATION",
            messageIntent: {},
            targetCollaborationIntent: {},
            sampleReviewIntent: {
              sampleApplicationRecordId: "sample-1",
              platformApplicationId: "platform-app-1",
              decision: "REJECT",
              rejectReason: "OTHER",
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

  it("prefers bundled affiliate actions when a stale singular action is also present", async () => {
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
          creatorRelationshipId: "relationship-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Reject the sample and notify the creator.",
          action: {
            type: "REVIEW_SAMPLE_APPLICATION",
            messageIntent: {},
            targetCollaborationIntent: {},
            sampleReviewIntent: {},
          },
          actions: [
            {
              type: "REVIEW_SAMPLE_APPLICATION",
              sampleReviewIntent: {
                sampleApplicationRecordId: "sample-1",
                platformApplicationId: "platform-app-1",
                decision: "REJECT",
                rejectReason: "OTHER",
              },
            },
            {
              type: "SEND_MESSAGE",
              messageIntent: {
                parts: [{
                  kind: "TEXT",
                  text: "Thanks for applying. We are not moving forward with this sample collaboration.",
                }],
              },
            },
          ],
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    const sentInput = (graphqlFetch.mock.calls[0]?.[1] as { input?: Record<string, unknown> } | undefined)?.input;
    expect(sentInput?.action).toBeUndefined();
    expect(sentInput?.actions).toEqual([
      {
        type: "REVIEW_SAMPLE_APPLICATION",
        sampleReviewIntent: {
          sampleApplicationRecordId: "sample-1",
          platformApplicationId: "platform-app-1",
          decision: "REJECT",
          rejectReason: "OTHER",
        },
      },
      {
        type: "SEND_MESSAGE",
        messageIntent: {
          parts: [{
            kind: "TEXT",
            text: "Thanks for applying. We are not moving forward with this sample collaboration.",
          }],
        },
      },
    ]);
  });

  it("normalizes anonymous affiliate resolve mutations from agent tool calls", async () => {
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
          creatorRelationshipId: "relationship-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Send the creator a reply.",
          action: {
            type: "SEND_MESSAGE",
            messageIntent: {},
          },
          actions: [
            {
              type: "SEND_MESSAGE",
              messageIntent: {
                parts: [{
                  kind: "TEXT",
                  text: "Thanks for the update. We will review and get back to you soon.",
                }],
              },
            },
          ],
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    const sentInput = (graphqlFetch.mock.calls[0]?.[1] as { input?: Record<string, unknown> } | undefined)?.input;
    expect(sentInput?.action).toBeUndefined();
    expect(sentInput?.actions).toEqual([
      {
        type: "SEND_MESSAGE",
        messageIntent: {
          parts: [{
            kind: "TEXT",
            text: "Thanks for the update. We will review and get back to you soon.",
          }],
        },
      },
    ]);
  });

  it("drops empty optional date ranges from anonymous affiliate timeline queries", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      affiliateRelationshipTimeline: {
        items: [],
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const query = `
      query AffiliateRelationshipTimeline($input: AffiliateRelationshipTimelineInput!) {
        affiliateRelationshipTimeline(input: $input) {
          items { id }
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query,
      variables: {
        input: {
          shopId: "shop-1",
          creatorRelationshipId: "relationship-1",
          startAt: null,
          endAt: "",
          limit: 20,
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).toHaveBeenCalledWith(query, {
      input: {
        shopId: "shop-1",
        creatorRelationshipId: "relationship-1",
        limit: 20,
      },
    });
  });

  it("drops stale action payloads from non-action affiliate resolve decisions", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      resolveAffiliateWorkItem: {
        decision: "NEEDS_STAFF_REVIEW",
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
          creatorRelationshipId: "relationship-1",
          decision: "NEEDS_STAFF_REVIEW",
          operatorSummary: "Staff should review this sample manually.",
          action: {
            type: "SEND_MESSAGE",
            messageIntent: {},
            targetCollaborationIntent: {},
            sampleReviewIntent: {},
            expiresAt: "",
          },
          nextSellerActionAt: "",
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    const sentInput = (graphqlFetch.mock.calls[0]?.[1] as { input?: Record<string, unknown> } | undefined)?.input;
    expect(sentInput).toEqual({
      creatorRelationshipId: "relationship-1",
      decision: "NEEDS_STAFF_REVIEW",
      operatorSummary: "Staff should review this sample manually.",
    });
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
          creatorRelationshipId: "relationship-1",
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
          creatorRelationshipId: "relationship-1",
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
          creatorRelationshipId: "relationship-1",
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
          creatorRelationshipId: "relationship-1",
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
          creatorRelationshipId: "relationship-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Reply to creator.",
          action: {
            type: "SEND_MESSAGE",
            predictionCacheIds: ["pred-1"],
            messageIntent: {
              parts: [{
                kind: "text",
                text: "Thanks for the update.",
                providerMessageId: "must-not-forward",
              }],
              providerConversationId: "must-not-forward",
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
              parts: [{
                kind: "TEXT",
                text: "Thanks for the update.",
              }],
            },
          },
        }),
      }),
    );
  });

  it("normalizes structured message parts in anonymous affiliate resolve mutations", async () => {
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
          creatorRelationshipId: "relationship-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Reply to creator.",
          action: {
            type: "SEND_MESSAGE",
            messageIntent: {
              parts: [{ kind: "text", text: "Thanks for the update." }],
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
              parts: [{
                kind: "TEXT",
                text: "Thanks for the update.",
              }],
            },
          },
        }),
      }),
    );
  });

  it("rejects removed send message text aliases", async () => {
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
          creatorRelationshipId: "relationship-1",
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
    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(res._body).toEqual({
      errors: [{
        message: expect.stringContaining("messageIntent.parts"),
      }],
    });
  });

  it("drops empty optional affiliate resolve fields and does not forward creator identity on SEND_MESSAGE", async () => {
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
          creatorRelationshipId: "relationship-1",
          collaborationRecordId: "collab-1",
          decision: "REQUEST_ACTION",
          operatorSummary: "Reply to creator.",
          nextSellerActionAt: ",",
          action: {
            type: "SEND_MESSAGE",
            creatorId: "relationship-1",
            creatorOpenId: "open-id",
            expiresAt: ",",
            messageIntent: {
              parts: [{ kind: "TEXT", text: "Stale singular action." }],
            },
          },
          actions: [
            {
              type: "SEND_MESSAGE",
              creatorId: "relationship-1",
              expiresAt: ",",
              messageIntent: {
                parts: [{ kind: "TEXT", text: "Thanks for the update." }],
              },
            },
          ],
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).toHaveBeenCalledWith(
      mutation,
      expect.objectContaining({
        input: expect.not.objectContaining({
          nextSellerActionAt: expect.anything(),
        }),
      }),
    );
    const sentInput = (graphqlFetch.mock.calls[0]?.[1] as { input?: Record<string, unknown> } | undefined)?.input;
    expect(sentInput?.action).toBeUndefined();
    expect(sentInput?.actions).toEqual([
      {
        type: "SEND_MESSAGE",
        messageIntent: {
          parts: [{ kind: "TEXT", text: "Thanks for the update." }],
        },
      },
    ]);
  });

  it("normalizes creator-product prediction variables to relationship-primary identity", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      affiliatePredictCreatorProductFit: {
        predictionPayload: {
          status: "OK",
          predictions: [],
        },
      },
    });
    const ctx = {
      authSession: {
        getAccessToken: () => "valid-token",
        graphqlFetch,
      },
    } as unknown as ApiContext;

    const query = `
      query AffiliatePredictCreatorProductFit($input: AffiliateCreatorProductFitInput!) {
        affiliatePredictCreatorProductFit(input: $input) {
          predictionPayload { status }
        }
      }
    `;

    const { handled, res } = await dispatch("POST", pathname, ctx, {
      query,
      variables: {
        input: {
          shopId: "shop-1",
          creatorRelationshipId: "relationship-1",
          creatorId: "relationship-1",
          creatorOpenId: "",
          productId: "product-1",
          sampleApplicationRecordId: "",
        },
      },
    });

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(graphqlFetch).toHaveBeenCalledWith(
      query,
      expect.objectContaining({
        input: {
          shopId: "shop-1",
          creatorRelationshipId: "relationship-1",
          productId: "product-1",
        },
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
