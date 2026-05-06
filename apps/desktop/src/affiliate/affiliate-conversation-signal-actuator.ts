import { createLogger } from "@rivonclaw/logger";
import type { AffiliateConversationSignalPayload } from "../cloud/backend-subscription-client.js";

const log = createLogger("affiliate-signal-actuator");

/**
 * Wire affiliate backend signals into the desktop subscription lifecycle.
 *
 * Business execution is intentionally left empty for now. Keeping this as a
 * separate actuator gives us the subscription plumbing without coupling
 * affiliate workflow decisions to the lower-level GraphQL subscription client.
 */
export async function handleAffiliateConversationSignal(
  signal: AffiliateConversationSignalPayload,
): Promise<void> {
  log.info(
    `Affiliate signal received: type=${signal.type} shop=${signal.platformShopId} ` +
    `conv=${signal.conversationId ?? ""} msg=${signal.messageId ?? ""}`,
  );
}
