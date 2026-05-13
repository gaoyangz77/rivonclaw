import { KNOWN_CHANNELS } from "../../lib/channel-defs.js";

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

/** Return all known channels (no locale-based filtering). */
export function getVisibleChannels(_lang: string, _selectedDropdownChannel: string) {
  return [...KNOWN_CHANNELS];
}
