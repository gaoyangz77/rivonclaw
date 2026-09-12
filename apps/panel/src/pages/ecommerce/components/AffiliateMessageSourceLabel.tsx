import { GQL } from "@rivonclaw/core";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { TkPrivate } from "../../../components/design-system/index.js";
import { shopDisplayLabel } from "../../../lib/shop-display.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import "./AffiliateMessageSourceLabel.css";

/** Resolve by message ownership, never by the selected view or the reply destination. */
export const AffiliateMessageSourceLabel = observer(function AffiliateMessageSourceLabel({
  message,
}: {
  message: Pick<
    GQL.AffiliateCreatorMessageHistoryItem,
    "channel" | "shopId" | "shopName" | "accountLabel"
  >;
}) {
  const { t } = useTranslation();
  const store = useEntityStore();
  const channelLabel = t(`ecommerce.affiliateWorkspace.messageChannels.${message.channel}`);
  if (message.channel === GQL.AffiliateMessageChannel.PlatformChat) {
    const shop = store.shops.find((candidate) => candidate.id === message.shopId);
    const alias = shop?.alias?.trim();
    const name = shop?.shopName?.trim() || message.shopName?.trim();
    if (alias || name) {
      const label = shopDisplayLabel({ alias, shopName: name });
      return (
        <TkPrivate
          className="affiliate-message-source-label"
          sensitive={label.sensitive}
          title={label.text}
        >
          {label.text}
        </TkPrivate>
      );
    }
    // Historical payloads may only carry a combined platform/account label.
    return (
      <TkPrivate
        className="affiliate-message-source-label"
        sensitive={Boolean(message.accountLabel)}
        title={message.accountLabel || channelLabel}
      >
        {message.accountLabel || channelLabel}
      </TkPrivate>
    );
  }
  // WhatsApp and email identify the messaging account, not a shop.
  return (
    <TkPrivate
      className="affiliate-message-source-label"
      sensitive={message.accountLabel == null && message.shopName != null}
      title={message.accountLabel ?? message.shopName ?? channelLabel}
    >
      {message.accountLabel ?? message.shopName ?? channelLabel}
    </TkPrivate>
  );
});
