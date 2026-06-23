import { KNOWN_CHANNELS } from "../../lib/channel-defs.js";
import type { ChannelAccountSnapshot } from "../../api/index.js";

export {
  buildAccountsList,
  type AccountEntry,
  type MstChannelAccountLike,
} from "../../lib/channel-accounts.js";

type DisplayStatus = boolean | null | undefined | "activation-required" | "reauth-required" | "send-unavailable";

export function StatusBadge({ status, t }: { status: DisplayStatus; t: (key: string) => string }) {
  const variant = status === true
    ? "badge-success"
    : status === false || status === "activation-required" || status === "reauth-required"
      ? "badge-danger"
      : "badge-warning";
  const text = status === true
    ? t("channels.statusYes")
    : status === false
      ? t("channels.statusNo")
      : status === "activation-required"
        ? t("channels.statusWeChatActivationRequired")
        : status === "reauth-required"
          ? t("channels.statusWeChatReauthRequired")
          : status === "send-unavailable"
            ? t("channels.statusWeChatSendUnavailable")
            : t("channels.statusUnknown");

  return (
    <span className={`badge ${variant}`}>
      {text}
    </span>
  );
}

export function resolveDisplayedRunningStatus(
  channelId: string,
  account: Pick<ChannelAccountSnapshot, "running" | "connected" | "healthy" | "healthState" | "contextTokenReady">,
): DisplayStatus {
  if (channelId !== "openclaw-weixin") {
    return account.running;
  }
  if (account.healthState === "reauth-required") {
    return "reauth-required";
  }
  if (account.healthState === "send-unavailable") {
    return "send-unavailable";
  }
  if (account.contextTokenReady === false) {
    return "activation-required";
  }
  if (
    account.running === false ||
    account.connected === false ||
    account.healthy === false
  ) {
    return false;
  }
  if (account.contextTokenReady === true) {
    return true;
  }
  if (account.running === true) {
    return true;
  }
  return account.running;
}

/** Return all known channels (no locale-based filtering). */
export function getVisibleChannels(_lang: string, _selectedDropdownChannel: string) {
  return [...KNOWN_CHANNELS];
}
