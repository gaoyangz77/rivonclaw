/**
 * Shared channel definitions used across multiple features.
 * Feature-specific rendering (StatusBadge) stays in pages/channels/channel-defs.tsx.
 */

/** Display order of 「连接新通道」: WeChat and Feishu first — the two most sellers connect. */
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
] as const;

export const QR_LOGIN_CHANNELS = new Set(["openclaw-weixin"]);
