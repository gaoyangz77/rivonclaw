/**
 * Known channel types supported by OpenClaw extensions.
 * This list covers the major messaging platform integrations.
 */
export const ALL_CHANNELS = [
  "telegram",
  "discord",
  "slack",
  "whatsapp",
  "feishu",
  "wecom",
  "signal",
  "line",
  "googlechat",
  "matrix",
  "mattermost",
  "msteams",
  "imessage",
] as const;

export type ChannelType = (typeof ALL_CHANNELS)[number];

/**
 * Channels that are built-in to OpenClaw (vendor extensions ready to use).
 */
export const BUILTIN_CHANNELS: readonly ChannelType[] = [
  "telegram",
  "discord",
  "slack",
  "whatsapp",
  "feishu",
  "signal",
  "line",
  "googlechat",
  "matrix",
  "mattermost",
  "msteams",
  "imessage",
];

/**
 * Channels that are custom RivonClaw extensions (WIP or planned).
 */
export const CUSTOM_CHANNELS: readonly ChannelType[] = [];
