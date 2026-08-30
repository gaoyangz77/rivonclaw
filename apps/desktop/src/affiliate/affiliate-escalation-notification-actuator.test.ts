import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  readChannelOwnerAgentId: vi.fn(() => "shop-operations"),
}));

vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@rivonclaw/gateway", () => ({
  readChannelOwnerAgentId: mocks.readChannelOwnerAgentId,
}));

vi.mock("../openclaw/index.js", () => ({
  openClawConnector: { request: mocks.request },
}));

import {
  catchUpAffiliateEscalationNotifications,
  handleAffiliateEscalationNotification,
  type AffiliateEscalationNotificationPayload,
} from "./affiliate-escalation-notification-actuator.js";

const escalation: AffiliateEscalationNotificationPayload = {
  id: "esc-001",
  creatorRelationshipId: "relationship-001",
  creatorName: "Creator One",
  creatorUsername: "creator_one",
  businessDeveloperName: "BD One",
  reason: "A replacement sample needs employee approval",
  question: "Should we send the replacement sample?",
  context: "The first package was lost.",
  escalationChannelId: "telegram:ops-account",
  escalationRecipientId: "ops-recipient",
  sourceAgendaItemsSnapshotJson: JSON.stringify({
    involvedShopInstructions: [{ shopName: "Shop One" }],
    agendaItems: [
      {
        key: "older-message",
        requiredAction: "REPLY_TO_CREATOR",
        updatedAt: "2026-08-29T10:00:00.000Z",
      },
      {
        key: "latest-sample",
        requiredAction: "REVIEW_SAMPLE_APPLICATION",
        updatedAt: "2026-08-30T10:00:00.000Z",
      },
    ],
  }),
};

describe("Affiliate escalation notification actuator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.request.mockResolvedValue({ ok: true });
  });

  it("claims through the BD device, sends a resolvable notification, and acks success", async () => {
    const graphqlFetch = vi.fn(async (query: string, variables: unknown) => {
      if (query.includes("ClaimAffiliateEscalationNotification")) {
        expect(variables).toEqual({ escalationId: escalation.id, deviceId: "device-001" });
        return {
          claimAffiliateEscalationNotification: {
            claimToken: "claim-001",
            escalation,
          },
        };
      }
      if (query.includes("AckAffiliateEscalationNotification")) {
        expect(variables).toEqual({
          input: {
            escalationId: escalation.id,
            deviceId: "device-001",
            claimToken: "claim-001",
            success: true,
          },
        });
        return { ackAffiliateEscalationNotification: true };
      }
      throw new Error(`Unexpected GraphQL operation: ${query}`);
    });

    await handleAffiliateEscalationNotification(
      { graphqlFetch } as never,
      "device-001",
      escalation.id,
    );

    expect(mocks.request).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        to: "ops-recipient",
        channel: "telegram",
        accountId: "ops-account",
        agentId: "shop-operations",
        idempotencyKey: "affiliate-escalation:esc-001",
        message: expect.stringMatching(
          /Escalation ID: esc-001[\s\S]*Creator One[\s\S]*Shop One[\s\S]*REVIEW_SAMPLE_APPLICATION[\s\S]*final decision/,
        ),
      }),
    );
    expect(graphqlFetch).toHaveBeenCalledTimes(2);
  });

  it("acks a delivery failure so the durable outbox can retry", async () => {
    mocks.request.mockRejectedValueOnce(new Error("channel unavailable"));
    const graphqlFetch = vi.fn(async (query: string, variables: any) => {
      if (query.includes("ClaimAffiliateEscalationNotification")) {
        return {
          claimAffiliateEscalationNotification: {
            claimToken: "claim-002",
            escalation,
          },
        };
      }
      if (query.includes("AckAffiliateEscalationNotification")) {
        expect(variables.input).toEqual(
          expect.objectContaining({
            escalationId: escalation.id,
            claimToken: "claim-002",
            success: false,
            error: "channel unavailable",
          }),
        );
        return { ackAffiliateEscalationNotification: true };
      }
      throw new Error(`Unexpected GraphQL operation: ${query}`);
    });

    await handleAffiliateEscalationNotification(
      { graphqlFetch } as never,
      "device-001",
      escalation.id,
    );

    expect(graphqlFetch).toHaveBeenCalledTimes(2);
  });

  it("catches up durable pending notifications after startup or reconnect", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      if (query.includes("PendingAffiliateEscalationNotifications")) {
        return { pendingAffiliateEscalationNotifications: [escalation] };
      }
      if (query.includes("ClaimAffiliateEscalationNotification")) {
        return {
          claimAffiliateEscalationNotification: {
            claimToken: "claim-003",
            escalation,
          },
        };
      }
      if (query.includes("AckAffiliateEscalationNotification")) {
        return { ackAffiliateEscalationNotification: true };
      }
      throw new Error(`Unexpected GraphQL operation: ${query}`);
    });

    await catchUpAffiliateEscalationNotifications(
      { graphqlFetch } as never,
      "device-001",
    );

    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(graphqlFetch).toHaveBeenCalledTimes(3);
  });
});
