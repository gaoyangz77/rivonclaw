/** Scope types for tool selection — determines what context a tool selection is bound to */
export type ToolScopeType = "chat_session" | "cron_job" | "cs_session" | "affiliate_session" | "unknown";

/** Enum version of ToolScopeType for runtime validation and switch/case usage. */
export enum ScopeType {
  /** OpenClaw-native sessions: ChatPage, Channels (Telegram, Feishu, etc.) */
  CHAT_SESSION = "chat_session",
  /** Scheduled cron job runs */
  CRON_JOB = "cron_job",
  /** Customer service sessions (CS bridge — untrusted, tools locked by bridge) */
  CS_SESSION = "cs_session",
  /** Affiliate creator-management sessions (untrusted, tools locked by bridge/runtime) */
  AFFILIATE_SESSION = "affiliate_session",
  /** Unrecognized session key format — untrusted, gets empty tools by default */
  UNKNOWN = "unknown",
}

/** Trusted scopes receive the user's default RunProfile when no explicit profile is set. */
export const TRUSTED_SCOPE_TYPES = new Set<ScopeType>([
  ScopeType.CHAT_SESSION,
  ScopeType.CRON_JOB,
]);

/** A single tool's selection state */
export interface ToolSelection {
  toolId: string;
  enabled: boolean;
}

/** Identifies the scope for a tool selection */
export interface ToolSelectionScope {
  scopeType: ToolScopeType;
  scopeKey: string;
}

/** Full scoped tool configuration with selections and metadata */
export interface ScopedToolConfig extends ToolSelectionScope {
  selectedTools: ToolSelection[];
  updatedAt: number;
}
