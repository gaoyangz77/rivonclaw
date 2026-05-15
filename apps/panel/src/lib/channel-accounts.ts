import type { ChannelAccountSnapshot, ChannelsStatusSnapshot } from "../api/index.js";
import { KNOWN_CHANNELS } from "./channel-defs.js";

const HIDDEN_CHANNEL_ACCOUNTS = new Set(["telegram:rivonclaw-support"]);

export interface AccountEntry {
  channelId: string;
  channelLabel: string;
  account: ChannelAccountSnapshot;
}

export interface MstChannelAccountLike {
  channelId: string;
  accountId: string;
  name: string | null;
  config: Record<string, unknown>;
  recipients?: ChannelAccountSnapshot["recipients"];
  status?: {
    hasContextToken?: boolean | null;
  };
}

const RUNTIME_FIELDS = [
  "configured",
  "healthy",
  "enabled",
  "running",
  "linked",
  "connected",
  "reconnectAttempts",
  "lastConnectedAt",
  "lastError",
  "lastStartAt",
  "lastStopAt",
  "lastInboundAt",
  "lastOutboundAt",
  "lastProbeAt",
  "mode",
  "dmPolicy",
  "groupPolicy",
  "streamMode",
  "allowFrom",
  "tokenSource",
  "botTokenSource",
  "appTokenSource",
  "credentialSource",
  "audienceType",
  "audience",
  "webhookPath",
  "webhookUrl",
  "baseUrl",
  "allowUnmentionedGroups",
  "cliPath",
  "dbPath",
  "port",
  "probe",
  "audit",
  "application",
] as const;

export function buildAccountsList(
  mstAccounts: ReadonlyArray<MstChannelAccountLike>,
  snapshot: ChannelsStatusSnapshot | null,
  t: (key: string) => string,
): AccountEntry[] {
  const allAccounts: AccountEntry[] = [];

  for (const mst of mstAccounts) {
    const { channelId, accountId } = mst;
    if (HIDDEN_CHANNEL_ACCOUNTS.has(`${channelId}:${accountId}`)) continue;

    const knownChannel = KNOWN_CHANNELS.find((channel) => channel.id === channelId);
    const channelLabel = knownChannel
      ? t(knownChannel.labelKey)
      : snapshot?.channelLabels[channelId] || channelId;

    const runtime = snapshot?.channelAccounts[channelId]?.find(
      (account) => account.accountId === accountId,
    );

    const account: ChannelAccountSnapshot = runtime
      ? buildAccountWithRuntime(mst, runtime)
      : buildAccountWithoutRuntime(mst);

    allAccounts.push({ channelId, channelLabel, account });
  }

  const mobileAccounts = snapshot?.channelAccounts["mobile"] ?? [];
  if (mobileAccounts.length > 0) {
    const mobileChannel = KNOWN_CHANNELS.find((channel) => channel.id === "mobile");
    const channelLabel = mobileChannel
      ? t(mobileChannel.labelKey)
      : snapshot?.channelLabels["mobile"] || "mobile";

    for (const account of mobileAccounts) {
      const isSyntheticDefault =
        account.accountId === "default" &&
        account.configured === false &&
        !account.name &&
        (account as { tokenSource?: string | null }).tokenSource === "none";

      if (isSyntheticDefault) continue;

      allAccounts.push({ channelId: "mobile", channelLabel, account });
    }
  }

  return allAccounts;
}

function buildAccountWithRuntime(
  mst: MstChannelAccountLike,
  runtime: ChannelAccountSnapshot,
): ChannelAccountSnapshot {
  const merged: ChannelAccountSnapshot = {
    accountId: mst.accountId,
    name: mst.name ?? runtime.name ?? null,
  };

  for (const field of RUNTIME_FIELDS) {
    const runtimeValue = (runtime as Record<string, unknown>)[field];
    if (runtimeValue !== undefined) {
      (merged as Record<string, unknown>)[field] = runtimeValue;
    }
  }

  const cfg = mst.config;
  if (merged.dmPolicy == null && typeof cfg.dmPolicy === "string") merged.dmPolicy = cfg.dmPolicy;
  if (merged.groupPolicy == null && typeof cfg.groupPolicy === "string") {
    merged.groupPolicy = cfg.groupPolicy;
  }
  if (merged.streamMode == null && typeof cfg.streamMode === "string") {
    merged.streamMode = cfg.streamMode;
  }
  if (merged.mode == null && typeof cfg.mode === "string") merged.mode = cfg.mode;
  if (merged.webhookUrl == null && typeof cfg.webhookUrl === "string") {
    merged.webhookUrl = cfg.webhookUrl;
  }
  if (mst.status?.hasContextToken !== undefined) {
    merged.contextTokenReady = mst.status.hasContextToken;
  }
  if (mst.recipients) {
    merged.recipients = mst.recipients;
  }

  return merged;
}

function buildAccountWithoutRuntime(mst: MstChannelAccountLike): ChannelAccountSnapshot {
  const cfg = mst.config;
  const enabledFromConfig = typeof cfg.enabled === "boolean" ? cfg.enabled : true;

  const account: ChannelAccountSnapshot = {
    accountId: mst.accountId,
    name: mst.name,
    configured: true,
    enabled: enabledFromConfig,
    running: null,
    linked: null,
    connected: null,
  };

  if (typeof cfg.dmPolicy === "string") account.dmPolicy = cfg.dmPolicy;
  if (typeof cfg.groupPolicy === "string") account.groupPolicy = cfg.groupPolicy;
  if (typeof cfg.streamMode === "string") account.streamMode = cfg.streamMode;
  if (typeof cfg.mode === "string") account.mode = cfg.mode;
  if (typeof cfg.webhookUrl === "string") account.webhookUrl = cfg.webhookUrl;
  if (mst.status?.hasContextToken !== undefined) {
    account.contextTokenReady = mst.status.hasContextToken;
  }
  if (mst.recipients) {
    account.recipients = mst.recipients;
  }

  return account;
}
