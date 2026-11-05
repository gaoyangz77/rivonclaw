import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { CompactProductField } from "../../../../components/ecommerce/CompactProductField.js";
import {
  TkAlert,
  TkBadge,
  TkButton,
  TkConfirmDialog,
  TkEmptyState,
  TkInteractiveTableRow,
  TkLoadingState,
  TkPanel,
  TkPanelFooter,
  TkPrivate,
  TkTableFrame,
} from "../../../../components/design-system/index.js";
import { shopDisplayLabel } from "../../../../lib/shop-display.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import {
  AFTER_SALE_MAX_WINDOW_DAYS,
  type AfterSaleRequestNode,
} from "../../../../store/models/EcommerceAfterSaleModel.js";
import {
  afterSaleKindLabel,
  afterSaleSellerActionLabel,
  afterSaleStatusLabel,
} from "../../after-sale-labels.js";
import { afterSaleActionLabels } from "../../../../lib/after-sale.js";
import { AfterSaleCopyValue } from "./AfterSaleCopyValue.js";
import { formatOrderMoney } from "../../customer-service-order-utils.js";
import { useNow } from "../../hooks/useNow.js";
import { AfterSaleDeadline } from "./AfterSaleDeadline.js";

/** The suggested decision of a row as buttons; a request the workspace cannot decide shows none. */
const AfterSaleRowActions = observer(function AfterSaleRowActions({
  request,
  deciding,
  busy,
  onApprove,
  onReject,
}: {
  request: AfterSaleRequestNode;
  /** This row's approval is running. */
  deciding: boolean;
  /** Another approval from the list is running. */
  busy: boolean;
  onApprove: (key: string) => void;
  onReject: (key: string) => void;
}) {
  const { t } = useTranslation();
  const decision = request.decision;
  if (!decision) return <span className="after-sale-muted">-</span>;
  const labels = afterSaleActionLabels(decision);
  const key = request.key;
  return (
    <span className="after-sale-row-actions">
      <TkButton
        size="sm"
        variant="primary"
        loading={deciding}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onApprove(key);
        }}
      >
        {t(`ecommerce.afterSale.actions.${labels.approve}`)}
      </TkButton>
      <TkButton
        size="sm"
        variant="secondary"
        disabled={busy || deciding}
        onClick={(event) => {
          event.stopPropagation();
          onReject(key);
        }}
      >
        {t(`ecommerce.afterSale.actions.${labels.reject}`)}
      </TkButton>
    </span>
  );
});

const AfterSaleRow = observer(function AfterSaleRow({
  request,
  shopAlias,
  nowMs,
  decidingKey,
  onOpen,
  onApprove,
  onReject,
}: {
  request: AfterSaleRequestNode;
  shopAlias: string | null;
  nowMs: number;
  /** The request being approved from the list, if any. */
  decidingKey: string | null;
  onOpen: (key: string) => void;
  onApprove: (key: string) => void;
  onReject: (key: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const shop = shopDisplayLabel({
    id: request.shopId,
    alias: shopAlias,
    shopName: request.shopName,
  });
  const firstLine = request.lines[0];
  const productImage = request.lines.find((line) => line.productImageUrl)?.productImageUrl ?? null;
  const key = request.key;
  return (
    <TkInteractiveTableRow onActivate={() => onOpen(key)}>
      <td>
        <TkBadge tone={request.kind === "CANCELLATION" ? "neutral" : "info"}>
          {afterSaleKindLabel(t, request.kind)}
        </TkBadge>
      </td>
      <td>
        {request.needsReview ? (
          <AfterSaleDeadline
            sellerActionDeadline={request.sellerActionDeadline}
            createTime={request.createTime}
            nowMs={nowMs}
          />
        ) : (
          "-"
        )}
      </td>
      <td>
        <TkPrivate sensitive={shop.sensitive} className="tk-v1-table-truncate" title={shop.text}>
          {shop.text}
        </TkPrivate>
      </td>
      <td>
        {request.orderId ? (
          <AfterSaleCopyValue
            value={request.orderId}
            label={t("ecommerce.afterSale.copyOrderId")}
          />
        ) : (
          "-"
        )}
      </td>
      <td className="after-sale-product-cell">
        <CompactProductField
          title={firstLine?.productName ?? firstLine?.skuName}
          imageUrl={productImage}
          skus={request.lines.map((line) => line.sellerSku)}
          extraSkuCount={Math.max(0, request.lines.length - 1)}
          skuLabel={t("ecommerce.afterSale.detail.lineSellerSku")}
        />
      </td>
      <td className="after-sale-amount">
        {formatOrderMoney(request.refundTotal, request.currency, i18n.language)}
      </td>
      <td>
        <TkBadge tone="neutral">{afterSaleStatusLabel(t, request.status)}</TkBadge>
        {request.decisionAwaitingPlatform ? (
          <TkBadge tone="accent">{t("ecommerce.afterSale.awaitingPlatform")}</TkBadge>
        ) : null}
      </td>
      <td>{afterSaleSellerActionLabel(t, request.sellerNextAction)}</td>
      <td>
        <AfterSaleRowActions
          request={request}
          deciding={decidingKey === key}
          busy={decidingKey !== null && decidingKey !== key}
          onApprove={onApprove}
          onReject={onReject}
        />
      </td>
    </TkInteractiveTableRow>
  );
});

export const AfterSaleTable = observer(function AfterSaleTable() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const afterSale = entityStore.ecommerceAfterSale;
  const nowMs = useNow();

  if (afterSale.loading && !afterSale.loaded) {
    return <TkLoadingState label={t("common.loading")} />;
  }
  if (!afterSale.allShops && afterSale.shopIds.length === 0) {
    return (
      <TkEmptyState title={t("ecommerce.afterSale.shopsRequired")} className="after-sale-empty" />
    );
  }
  if (afterSale.windowIssue) {
    return (
      <TkEmptyState
        title={t(`ecommerce.afterSale.windowIssue.${afterSale.windowIssue}`, {
          days: AFTER_SALE_MAX_WINDOW_DAYS,
        })}
        className="after-sale-empty"
      />
    );
  }
  if (afterSale.loaded && afterSale.requests.length === 0) {
    const toReview = afterSale.view === "TO_REVIEW";
    return (
      <TkEmptyState
        title={t(
          toReview
            ? "ecommerce.afterSale.empty.toReviewTitle"
            : "ecommerce.afterSale.empty.allTitle",
        )}
        description={t(
          toReview ? "ecommerce.afterSale.empty.toReviewBody" : "ecommerce.afterSale.empty.allBody",
        )}
        className="after-sale-empty"
      />
    );
  }

  const aliasByShopId = new Map(entityStore.shops.map((shop) => [shop.id, shop.alias ?? null]));
  // Time left is the decision the view is ordered by, so it sits next to the kind and is never
  // pushed out of a narrow pane.
  const headers = [
    "kind",
    "timeLeft",
    "shop",
    "order",
    "product",
    "refund",
    "status",
    "action",
    "actions",
  ];
  const approveRequest = afterSale.rowApproveRequest;
  const approveDecision = approveRequest?.decision;
  const rowError = afterSale.rowDecisionError;
  return (
    <>
      {rowError ? (
        <TkAlert
          tone="danger"
          title={t("ecommerce.afterSale.rowDecisionFailed", { requestId: rowError.requestId })}
          actions={
            <TkButton variant="ghost" size="sm" onClick={() => afterSale.dismissRowDecisionError()}>
              {t("ecommerce.afterSale.notice.dismiss")}
            </TkButton>
          }
        >
          {rowError.message}
        </TkAlert>
      ) : null}
      <TkPanel
        padding="none"
        className="after-sale-table-panel"
        data-tutorial-id="after-sale-table"
      >
        <TkTableFrame variant="embedded">
          <table className="after-sale-table">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    className={header === "refund" ? "after-sale-amount" : undefined}
                  >
                    {t(`ecommerce.afterSale.columns.${header}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {afterSale.requests.map((request) => (
                <AfterSaleRow
                  key={request.key}
                  request={request}
                  shopAlias={aliasByShopId.get(request.shopId) ?? null}
                  nowMs={nowMs}
                  decidingKey={afterSale.rowDecidingKey}
                  onOpen={(key) => afterSale.openDetail(key).catch(() => {})}
                  onApprove={(key) => afterSale.beginRowApprove(key)}
                  onReject={(key) => afterSale.openDetailForReject(key).catch(() => {})}
                />
              ))}
            </tbody>
          </table>
        </TkTableFrame>
        {afterSale.hasMore ? (
          <TkPanelFooter>
            <TkButton
              variant="secondary"
              disabled={afterSale.loadingMore}
              aria-busy={afterSale.loadingMore || undefined}
              onClick={() => afterSale.fetchMore().catch(() => {})}
            >
              {afterSale.loadingMore ? t("common.loading") : t("ecommerce.afterSale.loadMore")}
            </TkButton>
          </TkPanelFooter>
        ) : null}
      </TkPanel>
      <TkConfirmDialog
        isOpen={approveDecision != null}
        title={
          approveDecision
            ? t("ecommerce.afterSale.decision.confirmActionTitle", {
                action: t(
                  `ecommerce.afterSale.actions.${afterSaleActionLabels(approveDecision).approve}`,
                ),
              })
            : ""
        }
        message={
          approveRequest
            ? t("ecommerce.afterSale.decision.confirmActionBody", {
                kind: afterSaleKindLabel(t, approveRequest.kind),
                requestId: approveRequest.requestId,
              })
            : ""
        }
        confirmLabel={t("ecommerce.afterSale.decision.confirmApprove")}
        cancelLabel={t("common.cancel")}
        confirmVariant="primary"
        onCancel={() => afterSale.cancelRowApprove()}
        onConfirm={() => afterSale.approveFromList().catch(() => {})}
      />
    </>
  );
});
