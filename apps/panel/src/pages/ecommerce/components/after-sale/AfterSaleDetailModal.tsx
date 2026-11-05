import type { ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { TkBadge, TkModal, TkPrivate } from "../../../../components/design-system/index.js";
import { ModuleIcon } from "../../../../components/icons.js";
import { RemoteMediaImage } from "../../../../components/images/RemoteMediaImage.js";
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
import { AfterSaleCopyValue } from "./AfterSaleCopyValue.js";
import { AfterSaleDeadline } from "./AfterSaleDeadline.js";
import { AfterSaleDecisionPanel } from "./AfterSaleDecisionPanel.js";
import { AfterSaleHistory } from "./AfterSaleHistory.js";
import { AfterSaleOrderSection } from "./AfterSaleOrderSection.js";

const PREFIX = "ecommerce.afterSale";

/** Status, refund, deadline and the ids of the request: what the seller decides on, at a glance. */
const AfterSaleDetailSummary = observer(function AfterSaleDetailSummary({
  request,
}: {
  request: AfterSaleRequestNode;
}) {
  const { t, i18n } = useTranslation();
  const entityStore = useEntityStore();
  const nowMs = useNow();
  const alias = entityStore.shops.find((shop) => shop.id === request.shopId)?.alias ?? null;
  const shop = shopDisplayLabel({ id: request.shopId, alias, shopName: request.shopName });
  return (
    <header className="after-sale-summary">
      <div className="after-sale-summary-badges">
        <TkBadge tone={request.kind === "CANCELLATION" ? "neutral" : "info"}>
          {afterSaleKindLabel(t, request.kind)}
        </TkBadge>
        <TkBadge tone="neutral">{afterSaleStatusLabel(t, request.status)}</TkBadge>
        {request.isQuickRefund ? (
          <TkBadge tone="accent">{t(`${PREFIX}.detail.quickRefund`)}</TkBadge>
        ) : null}
        {request.decisionAwaitingPlatform ? (
          <TkBadge tone="accent">{t(`${PREFIX}.awaitingPlatform`)}</TkBadge>
        ) : null}
      </div>
      <div className="after-sale-summary-main">
        <div className="after-sale-summary-figure">
          <span>{t(`${PREFIX}.detail.fields.refund`)}</span>
          <strong>{formatOrderMoney(request.refundTotal, request.currency, i18n.language)}</strong>
        </div>
        {request.needsReview ? (
          <div className="after-sale-summary-figure">
            <span>{t(`${PREFIX}.columns.timeLeft`)}</span>
            <strong>
              <AfterSaleDeadline
                sellerActionDeadline={request.sellerActionDeadline}
                createTime={request.createTime}
                nowMs={nowMs}
              />
            </strong>
          </div>
        ) : null}
        <dl className="after-sale-summary-ids">
          <div>
            <dt>{t(`${PREFIX}.detail.fields.requestId`)}</dt>
            <dd>
              <AfterSaleCopyValue value={request.requestId} label={t(`${PREFIX}.copyRequestId`)} />
            </dd>
          </div>
          <div>
            <dt>{t(`${PREFIX}.detail.fields.order`)}</dt>
            <dd>
              {request.orderId ? (
                <AfterSaleCopyValue value={request.orderId} label={t(`${PREFIX}.copyOrderId`)} />
              ) : (
                "-"
              )}
            </dd>
          </div>
          <div>
            <dt>{t(`${PREFIX}.detail.fields.shop`)}</dt>
            <dd>
              <TkPrivate sensitive={shop.sensitive}>{shop.text}</TkPrivate>
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
});

/** The request's own lines: what the buyer wants refunded, returned or replaced. */
const AfterSaleDetailLines = observer(function AfterSaleDetailLines({
  request,
}: {
  request: AfterSaleRequestNode;
}) {
  const { t, i18n } = useTranslation();
  if (request.lines.length === 0) return null;
  return (
    <section>
      <h3>{t(`${PREFIX}.detail.linesSection`)}</h3>
      <ul className="after-sale-lines">
        {request.lines.map((line) => {
          const name = line.productName ?? line.skuName ?? null;
          return (
            <li key={line.lineItemId}>
              <span className="after-sale-thumb" aria-hidden="true">
                {line.productImageUrl ? (
                  <RemoteMediaImage
                    alt=""
                    loading="lazy"
                    sensitive
                    sourceUrl={line.productImageUrl}
                  />
                ) : (
                  <ModuleIcon size={18} />
                )}
              </span>
              <span className="after-sale-line-copy">
                <TkPrivate as="strong" sensitive={name !== null} title={name ?? undefined}>
                  {name ?? "-"}
                </TkPrivate>
                {line.skuName ? (
                  <small>
                    {t(`${PREFIX}.detail.lineSku`)}: <TkPrivate>{line.skuName}</TkPrivate>
                  </small>
                ) : null}
                {line.sellerSku ? (
                  <small>
                    {t(`${PREFIX}.detail.lineSellerSku`)}:{" "}
                    <TkPrivate className="after-sale-mono">{line.sellerSku}</TkPrivate>
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
          );
        })}
      </ul>
    </section>
  );
});

const AfterSaleDetailBody = observer(function AfterSaleDetailBody({
  request,
}: {
  request: AfterSaleRequestNode;
}) {
  const { t } = useTranslation();
  const facts: Array<[string, ReactNode]> = [
    [t(`${PREFIX}.detail.fields.reason`), request.reasonText ?? request.reason ?? "-"],
    [
      t(`${PREFIX}.detail.fields.requestType`),
      request.requestType ? humanizePlatformValue(request.requestType) : "-",
    ],
    [
      t(`${PREFIX}.detail.fields.role`),
      request.role ? platformValueLabel(t, "recordRole", request.role) : "-",
    ],
    [t(`${PREFIX}.detail.fields.action`), afterSaleSellerActionLabel(t, request.sellerNextAction)],
    [
      t(`${PREFIX}.detail.fields.deadline`),
      request.sellerActionDeadline
        ? formatCompactDateTime(request.sellerActionDeadline)
        : t(`${PREFIX}.timeLeft.noDeadline`),
    ],
    [t(`${PREFIX}.detail.fields.created`), formatCompactDateTime(request.createTime)],
    [t(`${PREFIX}.detail.fields.updated`), formatCompactDateTime(request.updateTime)],
  ];
  if (request.sellerDecision) {
    facts.push([
      t(`${PREFIX}.detail.fields.sellerDecision`),
      <>
        {afterSaleSellerDecisionLabel(t, request.sellerDecision)}
        {request.sellerDecidedAt ? ` · ${formatCompactDateTime(request.sellerDecidedAt)}` : null}
      </>,
    ]);
  }

  return (
    <div className="after-sale-detail">
      <div className="after-sale-detail-scroll">
        <AfterSaleDetailSummary request={request} />
        <div className="after-sale-detail-grid">
          <div className="after-sale-detail-main">
            <AfterSaleDetailLines request={request} />
            <section>
              <h3>{t(`${PREFIX}.detail.requestSection`)}</h3>
              <dl className="after-sale-facts">
                {facts.map(([label, value]) => (
                  <div key={label} className="after-sale-fact">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section>
              <h3>{t(`${PREFIX}.detail.historySection`)}</h3>
              {request.kind === "CANCELLATION" ? (
                <p className="after-sale-muted">{t(`${PREFIX}.history.cancellationNone`)}</p>
              ) : (
                <AfterSaleHistory />
              )}
            </section>
          </div>
          <aside className="after-sale-detail-aside">
            <AfterSaleOrderSection />
          </aside>
        </div>
      </div>
      {/* The action area stays pinned under the scrolling preview; a rejection expands in it. */}
      <footer className="after-sale-action-bar">
        <AfterSaleDecisionPanel request={request} />
      </footer>
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
        request ? t(`${PREFIX}.detail.title`, { kind: afterSaleKindLabel(t, request.kind) }) : ""
      }
      closeLabel={t("common.close")}
      maxWidth={1040}
      padding="none"
      className="after-sale-detail-modal"
    >
      {request ? <AfterSaleDetailBody request={request} /> : null}
    </TkModal>
  );
});
