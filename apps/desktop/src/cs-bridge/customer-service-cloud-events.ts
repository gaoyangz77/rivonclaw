import type { AuthSessionManager } from "../auth/session.js";
import type { BackendSubscriptionClient } from "../cloud/backend-subscription-client.js";
import { handleCsConversationChanged } from "./cs-conversation-signal-actuator.js";
import { handleCsEscalationEvent } from "./cs-escalation-event-actuator.js";
import type {
  CsConversationChangedPayload,
  CsEscalationEventDeliveryPayload,
} from "../cloud/backend-subscription-client.js";

export interface RegisterCustomerServiceCloudEventsOptions {
  backendSubscription: BackendSubscriptionClient;
  authSession: AuthSessionManager;
  deviceId: string;
  getShopIds: () => string[];
  onEscalationEvent?: (delivery: CsEscalationEventDeliveryPayload) => void;
  onConversationChanged?: (conversation: CsConversationChangedPayload) => void;
}

/**
 * Register cloud-driven customer service side effects.
 *
 * Keep this layer business-specific: the subscription client owns GraphQL
 * transport and auth lifecycle; CS actuators own local device gating and
 * bridge dispatch.
 */
export function registerCustomerServiceCloudEvents({
  backendSubscription,
  authSession,
  deviceId,
  getShopIds,
  onEscalationEvent,
  onConversationChanged,
}: RegisterCustomerServiceCloudEventsOptions): void {
  backendSubscription.subscribeToCsEscalationEvents((event) => {
    onEscalationEvent?.(event);
    void handleCsEscalationEvent(authSession, deviceId, event);
  });

  backendSubscription.subscribeToCsConversationChanges(
    (conversation) => {
      onConversationChanged?.(conversation);
      void handleCsConversationChanged(deviceId, conversation);
    },
    { getShopIds },
  );
}
