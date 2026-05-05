import { createLogger } from "@rivonclaw/logger";
import type { AuthSessionManager } from "../auth/session.js";
import {
  CS_ACK_ESCALATION_EVENT_MUTATION,
  CS_CLAIM_ESCALATION_EVENT_MUTATION,
} from "../cloud/cs-queries.js";
import type { CsEscalationEventDeliveryPayload } from "../cloud/backend-subscription-client.js";
import { getCsBridge } from "../gateway/connection.js";

const log = createLogger("cs-escalation-actuator");

const localRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlightEvents = new Set<string>();

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? "unknown_error");
}

function scheduleLocalRetry(
  authSession: AuthSessionManager,
  deviceId: string,
  delivery: CsEscalationEventDeliveryPayload,
): void {
  if (localRetryTimers.has(delivery.event.id)) return;
  const timer = setTimeout(() => {
    localRetryTimers.delete(delivery.event.id);
    void handleCsEscalationEvent(authSession, deviceId, delivery);
  }, 10_000);
  localRetryTimers.set(delivery.event.id, timer);
}

async function claimEvent(
  authSession: AuthSessionManager,
  eventId: string,
): Promise<CsEscalationEventDeliveryPayload | null> {
  const data = await authSession.graphqlFetch<{
    csClaimEscalationEvent: CsEscalationEventDeliveryPayload | null;
  }>(CS_CLAIM_ESCALATION_EVENT_MUTATION, {
    input: { eventId },
  });
  return data.csClaimEscalationEvent;
}

async function ackEvent(params: {
  authSession: AuthSessionManager;
  eventId: string;
  success: boolean;
}): Promise<void> {
  await params.authSession.graphqlFetch(CS_ACK_ESCALATION_EVENT_MUTATION, {
    input: {
      eventId: params.eventId,
      success: params.success,
    },
  });
}

export async function handleCsEscalationEvent(
  authSession: AuthSessionManager,
  deviceId: string,
  delivery: CsEscalationEventDeliveryPayload,
): Promise<void> {
  const { event } = delivery;
  if (inFlightEvents.has(event.id)) return;

  const bridge = getCsBridge();
  if (!bridge) {
    log.info(`CS escalation event ${event.id} arrived before CS bridge was ready; retrying locally`);
    scheduleLocalRetry(authSession, deviceId, delivery);
    return;
  }

  inFlightEvents.add(event.id);
  try {
    const claimed = await claimEvent(authSession, event.id);
    if (!claimed) {
      log.info(`CS escalation event ${event.id} was not claimable; skipping`);
      return;
    }

    await bridge.executeCsEscalationEvent(claimed);
    await ackEvent({
      authSession,
      eventId: claimed.event.id,
      success: true,
    });
    log.info(`Handled CS escalation event ${claimed.event.id} (${claimed.event.type})`);
  } catch (err) {
    const message = formatError(err);
    log.warn(`Failed to handle CS escalation event ${event.id}: ${message}`);
    try {
      await ackEvent({
        authSession,
        eventId: event.id,
        success: false,
      });
    } catch (ackErr) {
      log.warn(`Failed to ack CS escalation event ${event.id} failure: ${formatError(ackErr)}`);
    }
  } finally {
    inFlightEvents.delete(event.id);
  }
}
