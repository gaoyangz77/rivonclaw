import { createLogger } from "@rivonclaw/logger";
import type { RemoteTelemetryClient } from "@rivonclaw/telemetry";

const log = createLogger("cs-telemetry");

/**
 * Module-level reference to the CS business-telemetry client.
 *
 * Set once during app bootstrap (`main.ts` → `setCsTelemetryClient`), read
 * from anywhere that needs to emit a CS BI event (the bridge/session
 * forwarding paths, and the panel-server route that relays plugin emits).
 *
 * Mirrors the pattern of `auth/session-ref.ts` and `app/storage-ref.ts` so
 * cross-module access does not require threading a dependency through every
 * constructor. Emitters are fire-and-forget but DO log — a silent drop is
 * impossible to diagnose, so every outcome (enqueued / dropped-no-client)
 * leaves a trail in the client log.
 */
let client: RemoteTelemetryClient | null = null;
let droppedCount = 0;

export function setCsTelemetryClient(instance: RemoteTelemetryClient | null): void {
  client = instance;
  log.info(`CS telemetry client ${instance ? "attached" : "detached"}`);
}

export function getCsTelemetryClient(): RemoteTelemetryClient | null {
  return client;
}

/**
 * Fire-and-forget emit. No-op when the client is missing — CS BI data is
 * statistical, not transactional; a dropped event must never block the
 * business path. Drops are counted and logged periodically so you can tell
 * the difference between "nothing emitted" and "emits silently blackholed".
 */
export function emitCsTelemetry(
  eventType: "cs.message" | "cs.token_snapshot" | "cs.tool_call",
  metadata: Record<string, unknown>,
): void {
  if (!client) {
    droppedCount++;
    // Log the first drop loudly, then every 50th — same complaint every
    // event would flood the log but a complete silence hides a real bug.
    if (droppedCount === 1 || droppedCount % 50 === 0) {
      log.warn(
        `CS telemetry client not initialized — dropping event (${eventType}); ` +
        `total drops this session: ${droppedCount}`,
      );
    }
    return;
  }
  log.info(
    `emit ${eventType} metadata-keys=${Object.keys(metadata).join(",")} queue-after=${client.getQueueSize() + 1}`,
  );
  client.track(eventType, metadata);
}
