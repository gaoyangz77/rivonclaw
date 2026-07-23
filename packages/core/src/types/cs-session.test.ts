import { afterEach, describe, expect, it } from "vitest";
import {
  getInjectedParams,
  registerCSSession,
  registerToolSession,
  resolveSessionContext,
  resolveToolSessionContext,
  unregisterToolSession,
} from "./cs-session.js";

const SESSION_KEY = "agent:affiliate:affiliate:user:relationship";

afterEach(() => unregisterToolSession(SESSION_KEY));

describe("tool session context", () => {
  it("injects and resolves Affiliate relationship routing context", () => {
    registerToolSession(SESSION_KEY, {
      kind: "AFFILIATE",
      shopId: "shop-1",
      creatorRelationshipId: "relationship-1",
    });

    const injected = getInjectedParams(SESSION_KEY, { attachmentRef: "attachment-1" });

    expect(resolveToolSessionContext(injected ?? undefined)).toEqual({
      kind: "AFFILIATE",
      shopId: "shop-1",
      creatorRelationshipId: "relationship-1",
    });
    expect(resolveSessionContext(injected ?? undefined)).toBeNull();
  });

  it("preserves legacy customer-service resolution", () => {
    registerCSSession(SESSION_KEY, {
      shopId: "shop-1",
      conversationId: "conversation-1",
      buyerUserId: "buyer-1",
    });

    const injected = getInjectedParams(SESSION_KEY, {});

    expect(resolveSessionContext(injected ?? undefined)).toEqual({
      shopId: "shop-1",
      conversationId: "conversation-1",
      buyerUserId: "buyer-1",
    });
  });
});
