import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import {
  TkBadge,
  TkButton,
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
import { formatOrderMoney } from "../../customer-service-order-utils.js";
import { useNow } from "../../hooks/useNow.js";
import { AfterSaleDeadline } from "./AfterSaleDeadline.js";

const AfterSaleRow = observer(function AfterSaleRow({
  request,
  shopAlias,
  nowMs,
  onOpen,
}: {
  request: AfterSaleRequestNode;
  shopAlias: string | null;
  nowMs: number;
  onOpen: (key: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const shop = shopDisplayLabel({
    id: request.shopId,
    alias: shopAlias,
    shopName: request.shopName,
  });
  const firstLine = request.lines[0];
  const productName = firstLine?.productName ?? firstLine?.skuName ?? "-";
  const extraLines = request.lines.length - 1;
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
        <span className="after-sale-mono">{request.orderId ?? "-"}</span>
      </td>
      <td>
        <span className="after-sale-product">
          <span className="tk-v1-table-truncate" title={productName}>
            {productName}
          </span>
          {extraLines > 0 ? (
            <small>{t("ecommerce.afterSale.moreProducts", { count: extraLines })}</small>
          ) : null}
        </span>
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
  const headers = ["kind", "timeLeft", "shop", "order", "product", "refund", "status", "action"];
  return (
    <TkPanel padding="none" className="after-sale-table-panel" data-tutorial-id="after-sale-table">
      <TkTableFrame variant="embedded">
        <table className="after-sale-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} className={header === "refund" ? "after-sale-amount" : undefined}>
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
                onOpen={(key) => afterSale.openDetail(key).catch(() => {})}
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
  );
});
