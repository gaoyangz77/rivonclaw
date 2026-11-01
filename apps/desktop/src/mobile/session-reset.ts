import { createLogger } from "@rivonclaw/logger";

const log = createLogger("mobile-session-reset");

/** Payload of the `plugin.rivonclaw.mobile-session-reset-requested` event broadcast by the mobile channel plugin. */
export interface MobileSessionResetRequest {
  pairingId: string;
  sessionKey: string;
  requestId: string;
}

export interface MobileSessionResetDeps {
  request: (method: string, params: unknown) => Promise<unknown>;
  /** Broadcast an event to every Panel SSE client. */
  broadcastEvent: (event: string, data: unknown) => void;
}

/**
 * Reset the OpenClaw session a paired phone asked to reset, then report the
 * outcome back to the mobile channel plugin so it can send `reset_ack`.
 *
 * Runs here rather than in the plugin because the gateway only lets bundled or
 * trusted-official plugins dispatch gateway methods; Desktop's operator client
 * is the supported way to call `sessions.reset`.
 *
 * Never rejects: this is the event boundary, so failures are reported to the
 * plugin (reset failed) or logged (plugin unreachable; its own timeout then
 * answers the phone).
 */
export async function handleMobileSessionResetRequest(
  req: MobileSessionResetRequest,
  deps: MobileSessionResetDeps,
): Promise<void> {
  const { pairingId, sessionKey, requestId } = req;
  let error: string | undefined;
  try {
    await deps.request("sessions.reset", { key: sessionKey });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    log.error(`sessions.reset failed for mobile session ${sessionKey}:`, err);
  }

  if (error === undefined) {
    deps.broadcastEvent("session-reset", { sessionKey });
  }

  try {
    await deps.request("mobile_chat_reset_result", {
      pairingId,
      requestId,
      ok: error === undefined,
      ...(error !== undefined ? { error } : {}),
    });
  } catch (err) {
    log.error(`Failed to report mobile reset result for pairing ${pairingId}:`, err);
  }
}
