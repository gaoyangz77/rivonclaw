import { readChannelOwnerAgentId } from "@rivonclaw/gateway";
import { createLogger } from "@rivonclaw/logger";
import type { AuthSessionManager } from "../auth/session.js";
import {
  ACK_AFFILIATE_ESCALATION_NOTIFICATION_MUTATION,
  CLAIM_AFFILIATE_ESCALATION_NOTIFICATION_MUTATION,
  PENDING_AFFILIATE_ESCALATION_NOTIFICATIONS_QUERY,
} from "../cloud/affiliate-queries.js";
import { openClawConnector } from "../openclaw/index.js";

const log = createLogger("affiliate-escalation-notification");
const inFlight = new Set<string>();

export interface AffiliateEscalationNotificationPayload {
  id: string;
  creatorRelationshipId: string;
  reason: string;
  question: string;
  context?: string | null;
  creatorName?: string | null;
  creatorUsername?: string | null;
  businessDeveloperName?: string | null;
  sourceAgendaItemsSnapshotJson: string;
  escalationChannelId?: string | null;
  escalationRecipientId?: string | null;
}

function route(value: string): { channel: string; accountId: string } {
  const separator = value.indexOf(":");
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error("Affiliate escalation channel route is malformed");
  }
  return { channel: value.slice(0, separator), accountId: value.slice(separator + 1) };
}

function snapshotSummary(value: string): { shops: string; latest: string } {
  try {
    const snapshot = JSON.parse(value) as {
      involvedShopInstructions?: Array<{ shopName?: string; shopId?: string }>;
      agendaItems?: Array<{ key?: string; requiredAction?: string; updatedAt?: string }>;
    };
    const shops = (snapshot.involvedShopInstructions ?? [])
      .map((shop) => shop.shopName || shop.shopId)
      .filter(Boolean)
      .join(", ");
    const latest = [...(snapshot.agendaItems ?? [])].sort((left, right) =>
      String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")),
    )[0];
    return {
      shops: shops || "(unavailable)",
      latest: latest?.requiredAction || latest?.key || "(unavailable)",
    };
  } catch {
    return { shops: "(unavailable)", latest: "(unavailable)" };
  }
}

async function claim(
  authSession: AuthSessionManager,
  deviceId: string,
  escalationId: string,
): Promise<{ claimToken: string; escalation: AffiliateEscalationNotificationPayload } | null> {
  const data = await authSession.graphqlFetch<{
    claimAffiliateEscalationNotification: {
      claimToken: string;
      escalation: AffiliateEscalationNotificationPayload;
    } | null;
  }>(CLAIM_AFFILIATE_ESCALATION_NOTIFICATION_MUTATION, { escalationId, deviceId });
  return data.claimAffiliateEscalationNotification;
}

async function ack(
  authSession: AuthSessionManager,
  deviceId: string,
  escalationId: string,
  claimToken: string,
  success: boolean,
  error?: string,
): Promise<void> {
  await authSession.graphqlFetch(ACK_AFFILIATE_ESCALATION_NOTIFICATION_MUTATION, {
    input: { escalationId, deviceId, claimToken, success, error },
  });
}

export async function handleAffiliateEscalationNotification(
  authSession: AuthSessionManager,
  deviceId: string,
  escalationId: string,
): Promise<void> {
  if (inFlight.has(escalationId)) return;
  inFlight.add(escalationId);
  let claimed: Awaited<ReturnType<typeof claim>> = null;
  try {
    claimed = await claim(authSession, deviceId, escalationId);
    if (!claimed) return;
    const escalation = claimed.escalation;
    if (!escalation.escalationChannelId || !escalation.escalationRecipientId) {
      throw new Error("Affiliate escalation notification route is unavailable");
    }
    const { channel, accountId } = route(escalation.escalationChannelId);
    const summary = snapshotSummary(escalation.sourceAgendaItemsSnapshotJson);
    const ownerAgentId = readChannelOwnerAgentId();
    await openClawConnector.request("send", {
      to: escalation.escalationRecipientId,
      channel,
      accountId,
      ...(ownerAgentId ? { agentId: ownerAgentId } : {}),
      idempotencyKey: `affiliate-escalation:${escalation.id}`,
      message: [
        "Affiliate Agent escalation",
        `Escalation ID: ${escalation.id}`,
        `Creator: ${escalation.creatorName || escalation.creatorUsername || escalation.creatorRelationshipId}`,
        `Business developer: ${escalation.businessDeveloperName || "(unassigned)"}`,
        `Shops: ${summary.shops}`,
        `Reason: ${escalation.reason}`,
        `Agent question: ${escalation.question}`,
        ...(escalation.context ? [`Context: ${escalation.context}`] : []),
        `Latest agenda: ${summary.latest}`,
        "Open Affiliate Workbench > Pending to inspect the frozen agenda.",
        "Reply with a final decision and instructions, quoting the Escalation ID.",
      ].join("\n"),
    });
    await ack(authSession, deviceId, escalation.id, claimed.claimToken, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn("Failed to send Affiliate escalation notification", { escalationId, error: message });
    if (claimed) {
      try {
        await ack(authSession, deviceId, escalationId, claimed.claimToken, false, message);
      } catch (ackError) {
        log.warn("Failed to ack Affiliate escalation notification failure", ackError);
      }
    }
  } finally {
    inFlight.delete(escalationId);
  }
}

export async function catchUpAffiliateEscalationNotifications(
  authSession: AuthSessionManager,
  deviceId: string,
): Promise<void> {
  const data = await authSession.graphqlFetch<{
    pendingAffiliateEscalationNotifications: AffiliateEscalationNotificationPayload[];
  }>(PENDING_AFFILIATE_ESCALATION_NOTIFICATIONS_QUERY, { deviceId, limit: 50 });
  for (const escalation of data.pendingAffiliateEscalationNotifications) {
    await handleAffiliateEscalationNotification(authSession, deviceId, escalation.id);
  }
}
