import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import {
  TkChoiceSelect,
  TkField,
  TkToolbar,
} from "../../../../components/design-system/index.js";
import {
  BAD_REVIEW_HANDLING_STATUSES,
  type BadReviewHandlingStatus,
} from "../../../../lib/bad-review.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import type { AffiliateAnalyticsShop } from "../../affiliate-analytics-scope.js";
import {
  badReviewReplyLabel,
  badReviewSourceLabel,
  badReviewStatusLabel,
} from "../../bad-review-labels.js";
import { AffiliateShopScopeControl } from "../AffiliateShopScopeControl.js";

const PREFIX = "ecommerce.badReview.filters";
const RATINGS = [1, 2, 3, 4, 5];
/** Nothing ends a follow-up by itself, so the page must be able to find the forgotten ones. */
const STALE_DAYS = [3, 7, 14, 30];

export const BadReviewFilters = observer(function BadReviewFilters() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const badReview = entityStore.ecommerceBadReview;

  // Plain DTOs projected during render; MST shop nodes never reach the scope control's state.
  const shops: AffiliateAnalyticsShop[] = entityStore.shops.map((shop) => ({
    id: shop.id,
    shopName: shop.shopName,
    alias: shop.alias,
    region: shop.region,
  }));
  const selectedShopIds = badReview.allShops ? shops.map((shop) => shop.id) : [...badReview.shopIds];

  return (
    <TkToolbar className="bad-review-filters" data-tutorial-id="bad-review-filters">
      <AffiliateShopScopeControl
        shops={shops}
        selected={selectedShopIds}
        label={t(`${PREFIX}.shops`)}
        onChange={(next) => badReview.setShopScope(next, shops.length)}
      />
      <TkChoiceSelect
        label={t(`${PREFIX}.rating`)}
        value={badReview.rating == null ? "" : String(badReview.rating)}
        options={[
          { value: "", label: t(`${PREFIX}.allRatings`) },
          ...RATINGS.map((rating) => ({
            value: String(rating),
            label: t(`${PREFIX}.ratingValue`, { count: rating }),
          })),
        ]}
        onChange={(value) => badReview.setRating(value ? Number(value) : null)}
      />
      <TkChoiceSelect
        label={t(`${PREFIX}.status`)}
        value={badReview.handlingStatus ?? ""}
        options={[
          { value: "", label: t(`${PREFIX}.allStatuses`) },
          ...BAD_REVIEW_HANDLING_STATUSES.map((status) => ({
            value: status,
            label: badReviewStatusLabel(t, status),
          })),
        ]}
        onChange={(value) =>
          badReview.setHandlingStatus(value ? (value as BadReviewHandlingStatus) : null)
        }
      />
      <TkChoiceSelect
        label={t(`${PREFIX}.reply`)}
        value={badReview.replyState ?? ""}
        options={[
          { value: "", label: t(`${PREFIX}.allReplies`) },
          ...Object.values(GQL.ProductReviewReplyState).map((replyState) => ({
            value: replyState,
            label: badReviewReplyLabel(t, replyState),
          })),
        ]}
        onChange={(value) =>
          badReview.setReplyState(value ? (value as GQL.ProductReviewReplyState) : null)
        }
      />
      <TkChoiceSelect
        label={t(`${PREFIX}.source`)}
        value={badReview.source ?? ""}
        options={[
          { value: "", label: t(`${PREFIX}.allSources`) },
          ...Object.values(GQL.ProductReviewSource).map((source) => ({
            value: source,
            label: badReviewSourceLabel(t, source),
          })),
        ]}
        onChange={(value) => badReview.setSource(value ? (value as GQL.ProductReviewSource) : null)}
      />
      <TkChoiceSelect
        label={t(`${PREFIX}.stale`)}
        value={badReview.inProgressOverDays == null ? "" : String(badReview.inProgressOverDays)}
        options={[
          { value: "", label: t(`${PREFIX}.staleAny`) },
          ...STALE_DAYS.map((days) => ({
            value: String(days),
            label: t(`${PREFIX}.staleDays`, { count: days }),
          })),
        ]}
        onChange={(value) => badReview.setInProgressOverDays(value ? Number(value) : null)}
      />
      <TkField
        type="date"
        label={t(`${PREFIX}.reviewFrom`)}
        value={badReview.reviewFrom}
        onChange={(event) => badReview.setReviewFrom(event.target.value)}
      />
      <TkField
        type="date"
        label={t(`${PREFIX}.reviewTo`)}
        value={badReview.reviewTo}
        onChange={(event) => badReview.setReviewTo(event.target.value)}
      />
    </TkToolbar>
  );
});
