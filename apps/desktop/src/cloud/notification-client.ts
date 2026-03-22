import WebSocket from "ws";
import { createLogger } from "@rivonclaw/logger";
import { getApiBaseUrl } from "@rivonclaw/core";
import type {
  ServerNotification,
  ServerNotificationType,
  NotificationPayloadMap,
  WSServerFrame,
} from "@rivonclaw/core";

const log = createLogger("notification-client");

// ── Reconnect backoff constants ─────────────────────────────────────────
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

type NotificationListener<T extends ServerNotificationType> = (payload: NotificationPayloadMap[T]) => void;

/**
 * General-purpose WebSocket client for receiving server-pushed notifications.
 * Designed for the Electron main process. Automatically reconnects on disconnect.
 *
 * Usage:
 *   const client = new NotificationClient(locale);
 *   client.on("oauth_complete", (payload) => { ... });
 *   client.connect(getAccessToken);
 *   // Later:
 *   client.disconnect();
 */
export class NotificationClient {
  private ws: WebSocket | null = null;
  private locale: string;
  private getToken: (() => string | null) | null = null;
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private intentionalClose = false;
  private connected = false;

  constructor(locale: string) {
    this.locale = locale;
  }

  /**
   * Start connecting to the notification WebSocket.
   * @param getToken - Function that returns the current JWT access token, or null if not authenticated.
   */
  connect(getToken: () => string | null): void {
    this.getToken = getToken;
    this.intentionalClose = false;
    this.doConnect();
  }

  /**
   * Disconnect and stop reconnecting.
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Reconnect (e.g. after token refresh). Closes existing connection and opens a new one.
   */
  reconnect(): void {
    if (!this.getToken) return;
    this.disconnect();
    this.intentionalClose = false;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.doConnect();
  }

  /**
   * Whether the client currently has an open WebSocket connection.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Register a listener for a specific notification type.
   */
  on<T extends ServerNotificationType>(type: T, listener: NotificationListener<T>): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  /**
   * Remove a listener for a specific notification type.
   */
  off<T extends ServerNotificationType>(type: T, listener: NotificationListener<T>): void {
    const set = this.listeners.get(type);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  // ── Private ──────────────────────────────────────────────────────────

  private doConnect(): void {
    if (!this.getToken) return;

    const token = this.getToken();
    if (!token) {
      log.info("No auth token available, deferring notification connection");
      return;
    }

    const baseUrl = getApiBaseUrl(this.locale);
    // Convert http(s):// to ws(s)://
    const wsBase = baseUrl.replace(/^http/, "ws");
    const url = `${wsBase}/ws/notifications?token=${encodeURIComponent(token)}`;

    log.info("Connecting to notification WebSocket...");

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      log.error("Failed to create WebSocket", { error: err instanceof Error ? err.message : String(err) });
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      log.info("Notification WebSocket connected");
      this.connected = true;
      this.backoffMs = INITIAL_BACKOFF_MS; // Reset backoff on successful connection
    });

    this.ws.on("message", (data: Buffer) => {
      try {
        const frame = JSON.parse(data.toString("utf-8")) as WSServerFrame;

        if (frame.type === "ping") {
          // Respond to server heartbeat
          this.ws?.send(JSON.stringify({ type: "pong" }));
          return;
        }

        // It's a notification — dispatch to listeners
        const notification = frame as ServerNotification;
        const set = this.listeners.get(notification.type);
        if (set) {
          for (const listener of set) {
            try {
              listener(notification.payload);
            } catch (err) {
              log.error("Notification listener error", {
                type: notification.type,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    this.ws.on("close", (code, reason) => {
      this.connected = false;
      log.info(`Notification WebSocket closed: ${code} ${reason.toString("utf-8")}`);
      this.ws = null;
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    this.ws.on("error", (err) => {
      log.error("Notification WebSocket error", { error: err.message });
      // The 'close' event will follow — reconnect is handled there
    });
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    this.clearReconnectTimer();

    log.info(`Reconnecting in ${this.backoffMs}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, this.backoffMs);

    // Exponential backoff
    this.backoffMs = Math.min(this.backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
