import { KNOWN_CHANNELS } from "../../lib/channel-defs.js";
import type { ChannelAccountSnapshot } from "../../api/index.js";

export {
  buildAccountsList,
  type AccountEntry,
  type MstChannelAccountLike,
} from "../../lib/channel-accounts.js";

export function StatusBadge({ status, t }: { status: boolean | null | undefined; t: (key: string) => string }) {
  const variant = status === true ? "badge-success" : status === false ? "badge-danger" : "badge-warning";
  const text = status === true ? t("channels.statusYes") : status === false ? t("channels.statusNo") : t("channels.statusUnknown");

  return (
    <span className={`badge ${variant}`}>
      {text}
    </span>
  );
}

export function resolveDisplayedRunningStatus(
  channelId: string,
  account: Pick<ChannelAccountSnapshot, "running" | "healthy" | "healthState" | "outboundHealthy">,
): boolean | null | undefined {
  if (channelId !== "openclaw-weixin") {
    return account.running;
  }
  if (
    account.running === false ||
    account.healthy === false ||
    account.outboundHealthy === false ||
    account.healthState === "send-unavailable" ||
    account.healthState === "reauth-required"
  ) {
    return false;
  }
  if (account.running === true && account.healthy === true && account.healthState === "healthy") {
    return true;
  }
  if (account.running === true && account.outboundHealthy !== true) {
    return null;
  }
  return account.running;
}

/** Return all known channels (no locale-based filtering). */
export function getVisibleChannels(_lang: string, _selectedDropdownChannel: string) {
  return [...KNOWN_CHANNELS];
}
