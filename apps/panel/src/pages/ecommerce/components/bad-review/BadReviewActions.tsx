import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { TkButton } from "../../../../components/design-system/index.js";
import type { BadReviewRowNode } from "../../../../store/models/EcommerceBadReviewModel.js";

const PREFIX = "ecommerce.badReview.actions";

/** Start follow-up (manual shops) and Open conversation. Neither is possible without a buyer. */
export const BadReviewActions = observer(function BadReviewActions({
  review,
  busy,
  onStart,
  onOpenConversation,
}: {
  review: BadReviewRowNode;
  busy: boolean;
  onStart: (shopId: string, reviewId: string) => void;
  onOpenConversation: (shopId: string, orderId: string) => void;
}) {
  const { t } = useTranslation();
  const { id, shopId, orderId, hasBuyer, shopFollowUpMode, handlingStatus } = review;
  if (!hasBuyer || !orderId) return <span className="bad-review-muted">{t(`${PREFIX}.noBuyer`)}</span>;
  const canStart =
    shopFollowUpMode === GQL.BadReviewFollowUpMode.Manual &&
    handlingStatus !== GQL.ProductReviewHandlingStatus.InProgress;
  return (
    <span className="bad-review-row-actions">
      {canStart ? (
        <TkButton
          size="sm"
          variant="primary"
          loading={busy}
          onClick={(event) => {
            event.stopPropagation();
            onStart(shopId, id);
          }}
        >
          {t(`${PREFIX}.startFollowUp`)}
        </TkButton>
      ) : null}
      <TkButton
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onOpenConversation(shopId, orderId);
        }}
      >
        {t(`${PREFIX}.openConversation`)}
      </TkButton>
    </span>
  );
});
