import { DEFAULTS } from "./defaults.js";

/**
 * Relay WebSocket payload limits.
 *
 * The single source of truth is DEFAULTS.relay.maxClientBytes in defaults.ts.
 * All other limits are derived from it.
 *
 * If you change the value, also update the matching constant in:
 *   - client/mobile/src/engine/mobileSync.ts  (MAX_WS_PAYLOAD — must match RELAY_MAX_PAYLOAD_BYTES)
 *   - server/chat-relay/src/index.ts           (maxPayload   — must match RELAY_MAX_PAYLOAD_BYTES)
 */

/** Max raw file bytes a client should accept before base64 encoding. */
export const RELAY_MAX_CLIENT_BYTES = DEFAULTS.relay.maxClientBytes;

/** Human-readable version for UI display (MB). */
export const RELAY_MAX_CLIENT_MB = Math.floor(RELAY_MAX_CLIENT_BYTES / (1024 * 1024));

/** Relay server WebSocket maxPayload — derived as client limit × 1.34 (base64 overhead) + 1 MB headroom, rounded up. */
export const RELAY_MAX_PAYLOAD_BYTES = Math.ceil(RELAY_MAX_CLIENT_BYTES * 1.34 + 1024 * 1024);
