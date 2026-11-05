import { useState, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import {
  TkBadge,
  TkButton,
  TkLoadingState,
  TkPrivate,
} from "../../../../components/design-system/index.js";
import { ModuleIcon } from "../../../../components/icons.js";
import { RemoteMediaImage } from "../../../../components/images/RemoteMediaImage.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import { orderTrackingNumbers } from "../../../../store/models/EcommerceAfterSaleModel.js";
import {
  formatCompactDateTime,
  formatOrderMoney,
  platformValueLabel,
} from "../../customer-service-order-utils.js";
import { AfterSaleCopyValue } from "./AfterSaleCopyValue.js";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="after-sale-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Carrier events, newest first; collapsed to the latest one. */
const AfterSaleTrackingEvents = observer(function AfterSaleTrackingEvents() {
  const { t } = useTranslation();
  const detail = useEntityStore().ecommerceAfterSale.detail;
  const [expanded, setExpanded] = useState(false);
  const prefix = "ecommerce.afterSale.order";
  if (detail.trackingStatus === "loading") {
    return <TkLoadingState size="inline" label={t(`${prefix}.trackingLoading`)} />;
  }
  if (detail.trackingStatus === "error") {
    return <p className="after-sale-muted">{t(`${prefix}.trackingFailed`)}</p>;
  }
  if (detail.trackingStatus !== "loaded") return null;
  const events = [...(detail.tracking?.events ?? [])]
    .filter((event) => event.description)
    .sort((a, b) => (b.updateTimeMillis ?? 0) - (a.updateTimeMillis ?? 0));
  if (events.length === 0) return <p className="after-sale-muted">{t(`${prefix}.noEvents`)}</p>;
  const shown = expanded ? events : events.slice(0, 1);
  return (
    <div className="after-sale-tracking">
      <ol className="after-sale-tracking-events">
        {shown.map((event, index) => (
          <li key={`${event.updateTimeMillis ?? 0}:${index}`}>
            <span>{event.description}</span>
            <time>
              {event.updateTimeMillis
                ? formatCompactDateTime(new Date(event.updateTimeMillis).toISOString())
                : "-"}
            </time>
          </li>
        ))}
      </ol>
      {events.length > 1 ? (
        <TkButton variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
          {expanded
            ? t(`${prefix}.hideEvents`)
            : t(`${prefix}.showEvents`, { count: events.length })}
        </TkButton>
      ) : null}
    </div>
  );
});

/**
 * The order behind the open request, read live from TikTok (ADR-099 Decision 10): its status and
 * money, timeline, shipping with the latest carrier events, recipient and items.
 */
export const AfterSaleOrderSection = observer(function AfterSaleOrderSection() {
  const { t, i18n } = useTranslation();
  const afterSale = useEntityStore().ecommerceAfterSale;
  const detail = afterSale.detail;
  const prefix = "ecommerce.afterSale.order";

  if (detail.orderStatus === "idle") return null;
  if (detail.orderStatus === "loading") {
    return (
      <section className="after-sale-order">
        <h3>{t(`${prefix}.title`)}</h3>
        <TkLoadingState size="inline" label={t(`${prefix}.loading`)} />
      </section>
    );
  }
  if (detail.orderStatus === "error") {
    return (
      <section className="after-sale-order">
        <h3>{t(`${prefix}.title`)}</h3>
        <p className="after-sale-muted">{t(`${prefix}.failed`)}</p>
        <TkButton
          variant="secondary"
          size="sm"
          onClick={() => afterSale.retryOrder().catch(() => {})}
        >
          {t(`${prefix}.retry`)}
        </TkButton>
      </section>
    );
  }
  const order = detail.order;
  if (!order) {
    return (
      <section className="after-sale-order">
        <h3>{t(`${prefix}.title`)}</h3>
        <p className="after-sale-muted">{t(`${prefix}.unavailable`)}</p>
      </section>
    );
  }

  const trackingNumber = detail.tracking?.trackingNumber ?? orderTrackingNumbers(order)[0] ?? null;
  const carrier = detail.tracking?.shippingProvider ?? order.shippingProvider ?? null;
  const recipient = order.recipientAddress;
  const items = order.lineItems ?? [];

  return (
    <section className="after-sale-order">
      <h3>{t(`${prefix}.title`)}</h3>
      <div className="after-sale-order-head">
        <TkBadge tone="info">
          {platformValueLabel(t, "orderStatus", order.status) || t(`${prefix}.unknownStatus`)}
        </TkBadge>
        <strong className="after-sale-order-total">
          {formatOrderMoney(order.totalAmount, order.currency, i18n.language)}
        </strong>
      </div>
      <dl className="after-sale-facts">
        <Fact label={t(`${prefix}.orderedAt`)}>{formatCompactDateTime(order.createTime)}</Fact>
        <Fact label={t(`${prefix}.paidAt`)}>{formatCompactDateTime(order.paidTime)}</Fact>
        <Fact label={t(`${prefix}.deliveredAt`)}>{formatCompactDateTime(order.deliveryTime)}</Fact>
        <Fact label={t(`${prefix}.paymentMethod`)}>{order.paymentMethodName || "-"}</Fact>
      </dl>

      <h4>{t(`${prefix}.shipping`)}</h4>
      <dl className="after-sale-facts after-sale-facts-stacked">
        <Fact label={t(`${prefix}.carrier`)}>{carrier || "-"}</Fact>
        <Fact label={t(`${prefix}.trackingNumber`)}>
          {trackingNumber ? (
            <AfterSaleCopyValue value={trackingNumber} label={t(`${prefix}.copyTrackingNumber`)} />
          ) : (
            "-"
          )}
        </Fact>
      </dl>
      <AfterSaleTrackingEvents />

      {recipient ? (
        <>
          <h4>{t(`${prefix}.recipient`)}</h4>
          <dl className="after-sale-facts after-sale-facts-stacked">
            <Fact label={t(`${prefix}.recipientName`)}>
              <TkPrivate sensitive>{recipient.name || "-"}</TkPrivate>
            </Fact>
            <Fact label={t(`${prefix}.phone`)}>
              <TkPrivate sensitive>{recipient.phone || "-"}</TkPrivate>
            </Fact>
            <Fact label={t(`${prefix}.address`)}>
              <TkPrivate sensitive>{recipient.fullAddress || "-"}</TkPrivate>
            </Fact>
          </dl>
        </>
      ) : null}

      {items.length > 0 ? (
        <>
          <h4>{t(`${prefix}.items`, { count: items.length })}</h4>
          <ul className="after-sale-order-items">
            {items.map((item, index) => {
              const name = item.productName ?? item.skuName ?? null;
              return (
                <li key={item.orderLineItemId ?? `${index}`}>
                  <span className="after-sale-thumb after-sale-thumb-sm" aria-hidden="true">
                    {item.skuImage ? (
                      <RemoteMediaImage alt="" loading="lazy" sensitive sourceUrl={item.skuImage} />
                    ) : (
                      <ModuleIcon size={14} />
                    )}
                  </span>
                  <span className="after-sale-order-item-copy">
                    <TkPrivate as="strong" sensitive={name !== null} title={name ?? undefined}>
                      {name ?? "-"}
                    </TkPrivate>
                    {item.sellerSku || item.skuName ? (
                      <TkPrivate as="small">{item.sellerSku || item.skuName}</TkPrivate>
                    ) : null}
                  </span>
                  <span className="after-sale-order-item-price">
                    {formatOrderMoney(
                      item.salePrice,
                      item.currency ?? order.currency,
                      i18n.language,
                    )}
                    {item.quantity ? <small>×{item.quantity}</small> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
});
