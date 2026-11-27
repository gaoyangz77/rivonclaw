import type { ApolloLink } from "@apollo/client";

/**
 * Host adapter (ADR-123 decision 2).
 *
 * The same Panel build runs inside Desktop and in the browser. The host
 * adapter is the only place that knows which one it is: Panel code reaches
 * GraphQL transport, the real-time stream, auth state and host capabilities
 * through this interface and nowhere else.
 *
 * What stays outside the adapter on purpose:
 * - The entity store (MST) is the single source of truth for business state,
 *   including the current user. The host fills it through the event stream
 *   (`entity-snapshot` / `entity-patch`); it does not own a second copy.
 * - Desktop-only REST (`fetchJson` against `API[...]`) stays in `api/` and
 *   store models. Those modules are gated by a {@link HostCapability}, not
 *   abstracted: a host that lacks the capability never mounts them.
 */

export type HostKind = "desktop" | "web";

/**
 * What a host can do beyond the shared backend features. Routes declare the
 * ones they need (`RouteEntry.requires`); components may check them with
 * `hostSupports()`.
 */
export const HOST_CAPABILITIES = [
  /** Chat through the local OpenClaw gateway (WebSocket, chat sessions, agent settings). */
  "localGateway",
  /** Local messaging channels, pairing and allowlists. */
  "channels",
  /** Scheduled tasks managed by the local OpenClaw cron. */
  "localCron",
  /** Local file system access: file dialog, workspace and state directories, open-folder. */
  "localFiles",
  /** Speech-to-text and extras credentials stored on the machine. */
  "stt",
  /** Doctor diagnostics and log upload. */
  "doctor",
  /** Skills installed into the local OpenClaw state directory. */
  "localSkills",
  /** Desktop application updates and changelog. */
  "desktopUpdates",
  /** Desktop-held app settings (runtime status store, auto-launch, telemetry opt-out, onboarding). */
  "desktopSettings",
  /** Local LLM key usage reported by Desktop's key store. */
  "localLlmUsage",
  /** Sign-in flows that go through Desktop: captcha, Google, browser hand-off. */
  "desktopAuthFlows",
] as const;

export type HostCapability = (typeof HOST_CAPABILITIES)[number];

/**
 * Discrete events both hosts must be able to emit. The Desktop host forwards
 * them from `/api/events`; the web host derives them from backend GraphQL
 * subscriptions.
 */
export const HOST_SHARED_EVENTS = [
  "entity-snapshot",
  "entity-patch",
  "shop-updated",
  "oauth-complete",
  "ads-oauth-complete",
  "cs-conversation-changed",
  "cs-escalation-event",
  "affiliate-workbench-changed",
  "affiliate-work-item-changed",
  "affiliate-escalation-changed",
  "affiliate-action-proposal-changed",
  "affiliate-outreach-account-connected",
] as const;

/** Events that only exist while Desktop runs; a host without Desktop never emits them. */
export const HOST_DESKTOP_ONLY_EVENTS = [
  "status-snapshot",
  "status-patch",
  "inbound",
  "chat-mirror",
  "session-reset",
  "recipient-added",
  "update-available",
  "scene-snapshot",
  "idle-snapshot",
] as const;

export type HostEventName =
  | (typeof HOST_SHARED_EVENTS)[number]
  | (typeof HOST_DESKTOP_ONLY_EVENTS)[number];

export interface HostEvents {
  /**
   * Subscribe to a host event. Returns an unsubscribe function.
   *
   * Snapshot events (`*-snapshot`) are replayed to a late subscriber with the
   * latest payload, so subscribing after connect still self-heals. Payloads
   * arrive as parsed `unknown`; callers narrow them.
   *
   * An event the host never emits is still subscribable and simply silent.
   */
  subscribe(event: HostEventName, handler: (payload: unknown) => void): () => void;
}

export interface HostGraphQL {
  /**
   * The terminating Apollo link that carries GraphQL operations to the
   * backend. Desktop: HTTP to Desktop's proxy, which injects the JWT and
   * ingests the response. Web: HTTP/WebSocket straight to the backend.
   * Panel composes its own error/refresh links in front of it.
   */
  createLink(): ApolloLink;
}

export interface HostCloud {
  /**
   * `fetch` for backend REST endpoints (uploads, attachments, manual replies).
   * `path` is a `CLOUD_REST[...]` contract path (`/api/cloud/...`); the host
   * maps it to wherever the backend lives and adds credentials. Returns the
   * raw Response: status handling stays with the caller.
   */
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

export interface HostAuthSession {
  authenticated: boolean;
  /** A token exists but may not be validated yet. */
  tokenPresent?: boolean;
  /** Desktop only: this build can switch into a sub-account. */
  memberLoginAvailable?: boolean;
  /** Set while the owner is acting as a sub-account. */
  accountSwitch?: { ownerLabel: string; memberLabel: string } | null;
}

export interface HostLoginInput {
  email: string;
  password: string;
  captchaToken?: string;
  captchaAnswer?: string;
}

export interface HostRegisterInput extends HostLoginInput {
  name?: string | null;
  inviteCode?: string | null;
}

export interface HostAuth {
  /** Whether the host holds a session. The user entity itself arrives through the entity store. */
  getSession(): Promise<HostAuthSession>;
  login(input: HostLoginInput): Promise<void>;
  register(input: HostRegisterInput): Promise<void>;
  /** Ends the session on the host. The caller clears Panel-side state. */
  logout(): Promise<void>;
  /** Fires when any host request learns the session is no longer valid. */
  onSessionExpired(handler: () => void): () => void;
  /** Act as a sub-account, then reload into it. */
  switchToMember(memberId: string): Promise<void>;
  /** Leave a sub-account, then reload into the owner. */
  returnToOwner(): Promise<void>;
}

export interface HostAdapter {
  readonly kind: HostKind;
  readonly capabilities: ReadonlySet<HostCapability>;
  readonly graphql: HostGraphQL;
  readonly cloud: HostCloud;
  readonly events: HostEvents;
  readonly auth: HostAuth;
}
