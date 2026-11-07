import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import {
  TkBadge,
  TkButton,
  TkChoiceSelect,
  TkEmptyState,
  TkInteractiveTableRow,
  TkLoadingState,
  TkPanel,
  TkPanelFooter,
  TkPrivate,
  TkTableFrame,
} from "../../../../components/design-system/index.js";
import { canBulkSendReview, wholeDaysBetween } from "../../../../lib/bad-review.js";
import { shopDisplayLabel } from "../../../../lib/shop-display.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import {
  BAD_REVIEW_PAGE_SIZES,
  type BadReviewRowNode,
} from "../../../../store/models/EcommerceBadReviewModel.js";
import {
  badReviewAiProgressLabel,
  badReviewReplyLabel,
  badReviewSourceLabel,
  badReviewStatusLabel,
} from "../../bad-review-labels.js";
import { formatCompactDateTime } from "../../customer-service-order-utils.js";
import { useNow } from "../../hooks/useNow.js";
import { AfterSaleCopyValue } from "../after-sale/AfterSaleCopyValue.js";
import { BadReviewActions } from "./BadReviewActions.js";

const PREFIX = "ecommerce.badReview";
const HEADERS = ["shop", "order", "rating", "review", "reviewTime", "source", "status", "ai", "actions"];

const BadReviewRow = observer(function BadReviewRow({
  review,
  shopAlias,
  nowMs,
  busy,
  selected,
  onToggle,
  onOpen,
  onStart,
  onOpenConversation,
}: {
  review: BadReviewRowNode;
  shopAlias: string | null;
  nowMs: number;
  busy: boolean;
  selected: boolean;
  onToggle: (reviewId: string) => void;
  onOpen: (reviewId: string) => void;
  onStart: (shopId: string, reviewId: string) => void;
  onOpenConversation: (orderId: string) => void;
}) {
  const { t } = useTranslation();
  const inProgress = review.handlingStatus === GQL.ProductReviewHandlingStatus.InProgress;
  const id = review.id;
  const shop = shopDisplayLabel({ id: review.shopId, alias: shopAlias, shopName: review.shopName });
  return (
    <TkInteractiveTableRow
      onActivate={() => onOpen(id)}
      aria-label={t(`${PREFIX}.detail.title`)}
    >
      <td>
        {canBulkSendReview(review) ? (
          <input
            type="checkbox"
            aria-label={t(`${PREFIX}.bulk.selectRow`, { order: review.orderId })}
            checked={selected}
            onChange={() => onToggle(id)}
          />
        ) : null}
      </td>
      <td className="bad-review-shop-cell">
        {shop.sensitive ? <TkPrivate>{shop.text}</TkPrivate> : shop.text}
      </td>
      <td>
        {review.orderId ? (
          <AfterSaleCopyValue value={review.orderId} label={t(`${PREFIX}.columns.order`)} />
        ) : (
          "-"
        )}
      </td>
      <td>{review.rating ?? "-"}</td>
      <td className="bad-review-content-cell">
        <TkPrivate>{review.content || review.title || t(`${PREFIX}.detail.noContent`)}</TkPrivate>
      </td>
      <td>{review.reviewTime ? formatCompactDateTime(review.reviewTime) : "-"}</td>
      <td>{badReviewSourceLabel(t, review.source)}</td>
      <td>
        <span className="bad-review-status-cell">
          <TkBadge tone={inProgress ? "warning" : "neutral"}>
            {badReviewStatusLabel(t, review.handlingStatus)}
          </TkBadge>
          {inProgress && review.replyState ? (
            <TkBadge
              tone={
                review.replyState === GQL.ProductReviewReplyState.AwaitingSeller
                  ? "danger"
                  : "neutral"
              }
            >
              {badReviewReplyLabel(t, review.replyState)}
            </TkBadge>
          ) : null}
          {inProgress && review.handlingChangedAt ? (
            <span className="bad-review-muted">
              {t(`${PREFIX}.inProgressAge`, {
                count: wholeDaysBetween(review.handlingChangedAt, nowMs),
              })}
            </span>
          ) : null}
        </span>
      </td>
      <td>{badReviewAiProgressLabel(t, review)}</td>
      <td>
        <BadReviewActions
          review={review}
          busy={busy}
          onStart={onStart}
          onOpenConversation={onOpenConversation}
        />
      </td>
    </TkInteractiveTableRow>
  );
});

export const BadReviewTable = observer(function BadReviewTable({
  onStart,
  onOpenConversation,
}: {
  onStart: (shopId: string, reviewId: string) => void;
  onOpenConversation: (orderId: string) => void;
}) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const badReview = entityStore.ecommerceBadReview;
  const nowMs = useNow();

  if (badReview.loading && !badReview.loaded) return <TkLoadingState label={t("common.loading")} />;
  if (badReview.loaded && badReview.rows.length === 0) {
    return (
      <TkEmptyState
        title={t(`${PREFIX}.empty.title`)}
        description={t(`${PREFIX}.empty.body`)}
        className="bad-review-empty"
      />
    );
  }

  const selectableCount = badReview.bulkSelectableIds.length;
  const aliasByShopId = new Map(entityStore.shops.map((shop) => [shop.id, shop.alias ?? null]));
  return (
    <TkPanel padding="none" data-tutorial-id="bad-review-table">
      <TkTableFrame variant="embedded">
        <table className="bad-review-table">
          <thead>
            <tr>
              <th>
                {selectableCount > 0 ? (
                  <input
                    type="checkbox"
                    aria-label={t(`${PREFIX}.bulk.selectPage`)}
                    checked={badReview.bulkSelectedIds.length === selectableCount}
                    onChange={() => badReview.toggleBulkSelectionOfPage()}
                  />
                ) : null}
              </th>
              {HEADERS.map((header) => (
                <th key={header}>{t(`${PREFIX}.columns.${header}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {badReview.rows.map((review) => (
              <BadReviewRow
                key={review.id}
                review={review}
                shopAlias={aliasByShopId.get(review.shopId) ?? null}
                nowMs={nowMs}
                busy={badReview.busyReviewIds.includes(review.id)}
                selected={badReview.bulkSelectedIds.includes(review.id)}
                onToggle={(reviewId) => badReview.toggleBulkSelection(reviewId)}
                onOpen={(reviewId) => badReview.selectReview(reviewId)}
                onStart={onStart}
                onOpenConversation={onOpenConversation}
              />
            ))}
          </tbody>
        </table>
      </TkTableFrame>
      <TkPanelFooter>
        <span className="bad-review-muted">
          {t(`${PREFIX}.pagination.position`, {
            page: badReview.page,
            pages: badReview.pageCount,
            total: badReview.totalCount,
          })}
        </span>
        <span className="bad-review-pagination-controls">
          <TkChoiceSelect
            label={t(`${PREFIX}.pagination.pageSize`)}
            value={String(badReview.pageSize)}
            options={BAD_REVIEW_PAGE_SIZES.map((size) => ({
              value: String(size),
              label: t(`${PREFIX}.pagination.pageSizeOption`, { count: size }),
            }))}
            disabled={badReview.loading}
            onChange={(size) => badReview.setPageSize(Number(size))}
          />
          <TkButton
            variant="secondary"
            size="sm"
            disabled={badReview.loading || badReview.page <= 1}
            onClick={() => badReview.setPage(badReview.page - 1)}
          >
            {t(`${PREFIX}.pagination.previous`)}
          </TkButton>
          <TkButton
            variant="secondary"
            size="sm"
            disabled={badReview.loading || badReview.page >= badReview.pageCount}
            onClick={() => badReview.setPage(badReview.page + 1)}
          >
            {t(`${PREFIX}.pagination.next`)}
          </TkButton>
        </span>
      </TkPanelFooter>
    </TkPanel>
  );
});
