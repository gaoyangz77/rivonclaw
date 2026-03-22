// ── WebSocket Notification Protocol ──────────────────────────────────────
// General-purpose notification channel between desktop and cloud backend.
// Shared by both server/backend and apps/desktop.

/** Base envelope for all server → client notifications. */
export interface WSNotificationBase {
  type: string;
  timestamp: number; // Unix ms
}

/** OAuth flow completed for a TikTok shop (or future OAuth targets). */
export interface OAuthCompleteNotification extends WSNotificationBase {
  type: "oauth_complete";
  payload: {
    shopId: string;
    shopName: string;
    platform: string;
  };
}

/** System-wide announcement from the operations team. */
export interface SystemAnnouncementNotification extends WSNotificationBase {
  type: "system_announcement";
  payload: {
    id: string;
    message: string;
    severity: "info" | "warning" | "critical";
  };
}

/** Scheduled maintenance window. */
export interface MaintenanceScheduledNotification extends WSNotificationBase {
  type: "maintenance_scheduled";
  payload: {
    startAt: string; // ISO 8601
    endAt: string;   // ISO 8601
    message: string;
  };
}

/** New app version available for download. */
export interface UpdateAvailableNotification extends WSNotificationBase {
  type: "update_available";
  payload: {
    version: string;
    releaseNotes?: string;
    downloadUrl?: string;
  };
}

/** Union of all server → client notification types. Extend by adding new members. */
export type ServerNotification =
  | OAuthCompleteNotification
  | SystemAnnouncementNotification
  | MaintenanceScheduledNotification
  | UpdateAvailableNotification;

/** Extract the `type` string literal from the notification union. */
export type ServerNotificationType = ServerNotification["type"];

/** Map notification type string to its payload shape. */
export type NotificationPayloadMap = {
  [K in ServerNotification["type"]]: Extract<ServerNotification, { type: K }>["payload"];
};

/** Client → Server messages (heartbeat only for now). */
export interface WSClientMessage {
  type: "pong";
}

/** Server → Client control frames. */
export interface WSServerPing {
  type: "ping";
}

/** All frames that the server can send (notifications + control). */
export type WSServerFrame = ServerNotification | WSServerPing;
