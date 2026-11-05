import type { ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { TkBadge, TkModal, TkPrivate } from "../../../../components/design-system/index.js";
import { shopDisplayLabel } from "../../../../lib/shop-display.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import type { AfterSaleRequestNode } from "../../../../store/models/EcommerceAfterSaleModel.js";
import {
  afterSaleKindLabel,
  afterSaleSellerActionLabel,
  afterSaleSellerDecisionLabel,
  afterSaleStatusLabel,
} from "../../after-sale-labels.js";
import {
  formatCompactDateTime,
  formatOrderMoney,
  humanizePlatformValue,
  platformValueLabel,
} from "../../customer-service-order-utils.js";
import { useNow } from "../../hooks/useNow.js";
import { AfterSaleDeadline } from "./AfterSaleDeadline.js";
import { AfterSaleDecisionPanel } from "./AfterSaleDecisionPanel.js";
import { AfterSaleHistory } from "./AfterSaleHistory.js";

const AfterSaleDetailBody = observer(function AfterSaleDetailBody({
  request,
}: {
  request: AfterSaleRequestNode;
}) {
  const { t, i18n } = useTranslation();
  const entityStore = useEntityStore();
  const nowMs = useNow();
  const alias = entityStore.shops.find((shop) => shop.id === request.shopId)?.alias ?? null;
  const shop = shopDisplayLabel({ id: request.shopId, alias, shopName: request.shopName });
  const prefix = "ecommerce.afterSale";

  const fields: Array<[string, ReactNode]> = [
    [
      t(`${prefix}.detail.fields.requestId`),
      <span className="after-sale-mono">{request.requestId}</span>,
    ],
    [
      t(`${prefix}.detail.fields.order`),
      <span className="after-sale-mono">{request.orderId ?? "-"}</span>,
    ],
    [
      t(`${prefix}.detail.fields.shop`),
      <TkPrivate sensitive={shop.sensitive}>{shop.text}</TkPrivate>,
    ],
    [
      t(`${prefix}.detail.fields.status`),
      <>
        <TkBadge tone="neutral">{afterSaleStatusLabel(t, request.status)}</TkBadge>
        {request.isQuickRefund ? (
          <TkBadge tone="accent">{t(`${prefix}.detail.quickRefund`)}</TkBadge>
        ) : null}
      </>,
    ],
    [
      t(`${prefix}.detail.fields.requestType`),
      request.requestType ? humanizePlatformValue(request.requestType) : "-",
    ],
    [
      t(`${prefix}.detail.fields.role`),
      request.role ? platformValueLabel(t, "recordRole", request.role) : "-",
    ],
    [t(`${prefix}.detail.fields.reason`), request.reasonText ?? request.reason ?? "-"],
    [
      t(`${prefix}.detail.fields.refund`),
      formatOrderMoney(request.refundTotal, request.currency, i18n.language),
    ],
    [t(`${prefix}.detail.fields.action`), afterSaleSellerActionLabel(t, request.sellerNextAction)],
    ...(request.sellerDecision
      ? ([
          [
            t(`${prefix}.detail.fields.sellerDecision`),
            <>
              {afterSaleSellerDecisionLabel(t, request.sellerDecision)}
              {request.sellerDecidedAt
                ? ` · ${formatCompactDateTime(request.sellerDecidedAt)}`
                : null}{" "}
              {request.decisionAwaitingPlatform ? (
                <TkBadge tone="accent">{t(`${prefix}.awaitingPlatform`)}</TkBadge>
              ) : null}
            </>,
          ],
        ] satisfies Array<[string, ReactNode]>)
      : []),
    [
      t(`${prefix}.detail.fields.deadline`),
      request.sellerActionDeadline ? (
        <>
          {formatCompactDateTime(request.sellerActionDeadline)}{" "}
          {request.needsReview ? (
            <AfterSaleDeadline
              sellerActionDeadline={request.sellerActionDeadline}
              createTime={request.createTime}
              nowMs={nowMs}
            />
          ) : null}
        </>
      ) : (
        t(`${prefix}.timeLeft.noDeadline`)
      ),
    ],
    [t(`${prefix}.detail.fields.created`), formatCompactDateTime(request.createTime)],
    [t(`${prefix}.detail.fields.updated`), formatCompactDateTime(request.updateTime)],
  ];

  return (
    <div className="after-sale-detail">
      <section>
        <h3>{t(`${prefix}.detail.requestSection`)}</h3>
        <dl className="after-sale-fields">
          {fields.map(([label, value]) => (
            <div key={label} className="after-sale-field">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {request.lines.length > 0 ? (
        <section>
          <h3>{t(`${prefix}.detail.linesSection`)}</h3>
          <ul className="after-sale-lines">
            {request.lines.map((line) => (
              <li key={line.lineItemId}>
                <span className="after-sale-line-name">
                  <strong>{line.productName ?? "-"}</strong>
                  {line.skuName ? (
                    <small>
                      {t(`${prefix}.detail.lineSku`)}: {line.skuName}
                    </small>
                  ) : null}
                  {line.sellerSku ? (
                    <small>
                      {t(`${prefix}.detail.lineSellerSku`)}:{" "}
                      <span className="after-sale-mono">{line.sellerSku}</span>
                    </small>
                  ) : null}
                </span>
                <span className="after-sale-amount">
                  {formatOrderMoney(
                    line.refundTotal,
                    line.currency ?? request.currency,
                    i18n.language,
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h3>{t(`${prefix}.detail.historySection`)}</h3>
        {request.kind === "CANCELLATION" ? (
          <p className="after-sale-muted">{t(`${prefix}.history.cancellationNone`)}</p>
        ) : (
          <AfterSaleHistory />
        )}
      </section>
      <AfterSaleDecisionPanel request={request} />
    </div>
  );
});

export const AfterSaleDetailModal = observer(function AfterSaleDetailModal() {
  const { t } = useTranslation();
  const afterSale = useEntityStore().ecommerceAfterSale;
  const request = afterSale.selectedRequest;
  return (
    <TkModal
      isOpen={request != null}
      onClose={() => afterSale.closeDetail()}
      title={
        request
          ? t("ecommerce.afterSale.detail.title", { kind: afterSaleKindLabel(t, request.kind) })
          : ""
      }
      closeLabel={t("common.close")}
      maxWidth={760}
    >
      {request ? <AfterSaleDetailBody request={request} /> : null}
    </TkModal>
  );
});
