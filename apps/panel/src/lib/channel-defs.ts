/**
 * Shared channel definitions used across multiple features.
 * Feature-specific rendering (StatusBadge) stays in pages/channels/channel-defs.tsx.
 */

export const KNOWN_CHANNELS = [
  {
    id: "openclaw-weixin",
    labelKey: "channels.channelWeixin",
    tutorialUrl: "",
    tooltip: "channels.tooltipWeixin",
  },
  {
    id: "feishu",
    labelKey: "channels.channelFeishu",
    tutorialUrl: "https://docs.openclaw.ai/channels/feishu",
    tooltip: "channels.tooltipFeishu",
  },
  {
    id: "telegram",
    labelKey: "channels.channelTelegram",
    tutorialUrl: "https://docs.openclaw.ai/channels/telegram",
    tooltip: "channels.tooltipTelegram",
  },
  {
    id: "discord",
    labelKey: "channels.channelDiscord",
    tutorialUrl: "https://docs.openclaw.ai/channels/discord",
    tooltip: "channels.tooltipDiscord",
  },
  {
    id: "slack",
    labelKey: "channels.channelSlack",
    tutorialUrl: "https://docs.openclaw.ai/channels/slack",
    tooltip: "channels.tooltipSlack",
  },
  {
    id: "googlechat",
    labelKey: "channels.channelGoogleChat",
    tutorialUrl: "https://docs.openclaw.ai/channels/googlechat",
    tooltip: "channels.tooltipGoogleChat",
  },
  {
    id: "signal",
    labelKey: "channels.channelSignal",
    tutorialUrl: "https://docs.openclaw.ai/channels/signal",
    tooltip: "channels.tooltipSignal",
  },
  {
    id: "imessage",
    labelKey: "channels.channelIMessage",
    tutorialUrl: "https://docs.openclaw.ai/channels/imessage",
    tooltip: "channels.tooltipIMessage",
  },
  {
    id: "line",
    labelKey: "channels.channelLine",
    tutorialUrl: "https://docs.openclaw.ai/channels/line",
    tooltip: "channels.tooltipLine",
  },
  {
    id: "matrix",
    labelKey: "channels.channelMatrix",
    tutorialUrl: "https://docs.openclaw.ai/channels/matrix",
    tooltip: "channels.tooltipMatrix",
  },
  {
    id: "mattermost",
    labelKey: "channels.channelMattermost",
    tutorialUrl: "https://docs.openclaw.ai/channels/mattermost",
    tooltip: "channels.tooltipMattermost",
  },
  {
    id: "msteams",
    labelKey: "channels.channelMsteams",
    tutorialUrl: "https://docs.openclaw.ai/channels/msteams",
    tooltip: "channels.tooltipMsteams",
  },
  { id: "mobile", labelKey: "nav.mobile", tutorialUrl: "", tooltip: "mobile.description" },
] as const;

/**
 * Channels no longer offered for new connections. 爪聊 (the mobile chat app) was
 * retired (founder, 2026-11-23): it stays in KNOWN_CHANNELS so an existing
 * pairing still renders with its label and can be disconnected.
 */
export const RETIRED_CHANNELS = new Set<string>(["mobile"]);

/**
 * What 「连接新通道」 offers, in display order: WeChat and Feishu first — the
 * two most sellers connect — then the rest as before.
 */
export const CONNECTABLE_CHANNELS = KNOWN_CHANNELS.filter((channel) => !RETIRED_CHANNELS.has(channel.id));

export const QR_LOGIN_CHANNELS = new Set(["openclaw-weixin"]);
