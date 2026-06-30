export const SESSION_CHANNEL_IDS = [
  "telegram",
  "feishu",
  "lark",
  "whatsapp",
  "discord",
  "slack",
  "signal",
  "imessage",
  "webchat",
  "line",
  "googlechat",
  "matrix",
  "msteams",
  "mattermost",
  "openclaw-weixin",
] as const;

const SESSION_CHANNEL_ID_SET = new Set<string>(SESSION_CHANNEL_IDS);

/**
 * Some plugin-created channel sessions arrive before gateway metadata has been
 * hydrated. Their session keys still carry the channel id, e.g.
 * `agent:main:feishu:default:direct:ou_xxx`.
 */
export function inferSessionChannelFromKey(key: string): string | undefined {
  const parts = key.split(":");
  if (parts[0] !== "agent" || parts[1] !== "main") return undefined;
  const candidate = parts[2]?.toLowerCase();
  if (!candidate || !SESSION_CHANNEL_ID_SET.has(candidate)) return undefined;
  return candidate;
}

export type ChannelSessionRecipient = {
  channelId: string;
  accountId: string;
  recipientId: string;
};

export function parseChannelSessionRecipient(key: string): ChannelSessionRecipient | undefined {
  const parts = key.split(":");
  const channelId = inferSessionChannelFromKey(key);
  if (!channelId || parts.length < 6) return undefined;
  const accountId = parts[3]?.trim();
  const recipientId = parts[parts.length - 1]?.trim();
  if (!accountId || !recipientId) return undefined;
  return { channelId, accountId, recipientId };
}
