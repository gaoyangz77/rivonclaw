import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { TkPrivate } from "../../../components/design-system/index.js";
import type { ShopDisplayLabel } from "../../../lib/shop-display.js";

type Conversation = GQL.CustomerServiceConversationInboxItem;

/**
 * One row of the customer-service inbox list: shop + time, buyer name with
 * its badges, and the latest message preview.
 *
 * The badge group can hold three badges at once (escalation, bad review,
 * status). The list defaults to its 240px minimum width, where those three
 * badges alone are wider than the row, so the head row is allowed to wrap in
 * `CustomerServiceWorkspace.css`: badges drop beneath the name instead of
 * squeezing it, and the group wraps internally when even a full line is too
 * narrow. The name only truncates when it is wider than the whole row, and
 * carries a `title` so the full name stays reachable.
 */
export function CustomerServiceConversationRow({
  item,
  active,
  buyerName,
  shopLabel,
  timeLabel,
  onSelect,
  onOpenBadReviews,
}: {
  item: Conversation;
  active: boolean;
  buyerName: string;
  shopLabel: ShopDisplayLabel;
  timeLabel: string;
  onSelect: () => void;
  onOpenBadReviews: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      className={active ? "cs-conversation-row active" : "cs-conversation-row"}
      type="button"
      onClick={onSelect}
    >
      <span className="cs-conversation-meta">
        <TkPrivate as="span" sensitive={shopLabel.sensitive}>
          {shopLabel.text}
        </TkPrivate>
        <span>{timeLabel}</span>
      </span>
      <span className="cs-conversation-row-head">
        <strong title={buyerName}>{buyerName}</strong>
        <span className="cs-conversation-badges">
          {item.openEscalationCount > 0 && <EscalationStateBadge conversation={item} />}
          <BadReviewBadge conversation={item} onClick={onOpenBadReviews} />
          <span
            className={
              item.status === GQL.CustomerServiceConversationStatus.Pending
                ? "badge badge-warning"
                : "badge badge-info"
            }
          >
            {conversationStatusLabel(item.status, t)}
          </span>
        </span>
      </span>
      <span className="cs-conversation-preview">{conversationPreview(item, t)}</span>
    </button>
  );
}

export function EscalationStateBadge({
  conversation,
  onClick,
  variant = "list",
}: {
  conversation: Conversation;
  onClick?: () => void;
  variant?: "list" | "detail";
}) {
  const { t } = useTranslation();
  if (!(conversation.openEscalationCount > 0)) return null;
  const label = t("ecommerce.customerServiceWorkspace.escalationBadge");
  if (!onClick) {
    return <span className="badge badge-warning cs-open-escalation-badge">{label}</span>;
  }
  const className =
    variant === "detail"
      ? "badge badge-warning cs-open-escalation-badge cs-open-escalation-button cs-open-escalation-button-detail"
      : "badge badge-warning cs-open-escalation-badge cs-open-escalation-button";
  return (
    <button
      className={className}
      type="button"
      aria-label={t("ecommerce.customerServiceWorkspace.openEscalationDetails")}
      title={t("ecommerce.customerServiceWorkspace.openEscalationDetails")}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {label}
      {variant === "detail" && (
        <span className="cs-open-escalation-action-label">
          {t("ecommerce.customerServiceWorkspace.viewEscalationDetails")}
        </span>
      )}
    </button>
  );
}

export function BadReviewBadge({
  conversation,
  onClick,
  variant = "list",
}: {
  conversation: Conversation;
  onClick: () => void;
  variant?: "list" | "detail";
}) {
  const { t } = useTranslation();
  const count = conversation.recentBadReviews?.length ?? 0;
  if (count <= 0) return null;
  const className =
    variant === "detail"
      ? "badge cs-bad-review-badge cs-bad-review-button cs-bad-review-button-detail"
      : "badge cs-bad-review-badge cs-bad-review-button";
  return (
    <button
      className={className}
      type="button"
      aria-label={t("ecommerce.customerServiceWorkspace.openBadReviewDetails")}
      title={t("ecommerce.customerServiceWorkspace.openBadReviewDetails")}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {t("ecommerce.customerServiceWorkspace.badReviewBadge")}
      {variant === "detail" && count > 1 && <span className="cs-bad-review-count">{count}</span>}
    </button>
  );
}

function conversationStatusLabel(
  status: GQL.CustomerServiceConversationStatus,
  t: (key: string) => string,
): string {
  if (status === GQL.CustomerServiceConversationStatus.Resolved)
    return t("ecommerce.customerServiceWorkspace.conversationStatusReplied");
  return t("ecommerce.customerServiceWorkspace.conversationStatusPending");
}

function conversationPreview(item: Conversation, t: (key: string) => string): string {
  if (item.latestMessageType === "ESCALATION")
    return t("ecommerce.customerServiceWorkspace.noPreview");
  return item.latestMessagePreview || t("ecommerce.customerServiceWorkspace.noPreview");
}
