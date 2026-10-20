import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TkBadge, TkButton } from "../../../components/design-system/index.js";
import { formatShortDateTime } from "../../../lib/format-datetime.js";
import { sampleShipmentWarning, type SampleShipment } from "../affiliate-sample-shipment.js";
import "./AffiliateSampleShipment.css";

const prefix = "ecommerce.affiliateWorkspace.workbench.";

export function AffiliateSampleShipmentWarning({
  sample,
  nowMs,
}: {
  sample: SampleShipment;
  nowMs?: number;
}) {
  const { t } = useTranslation();
  const warning = sampleShipmentWarning(sample, nowMs);
  return warning ? (
    <span className="affiliate-sample-shipment-warning">
      <TkBadge tone="warning">
        <span className="affiliate-sample-shipment-warning-text">{t(`${prefix}${warning}`)}</span>
      </TkBadge>
    </span>
  ) : null;
}

export function AffiliateSampleShipment({ sample }: { sample: SampleShipment }) {
  const { t, i18n } = useTranslation();
  const [showEvents, setShowEvents] = useState(false);
  const order = sample.order;
  if (!order?.trackingSyncedAt) return null;
  const events = [...(order.trackingEvents ?? [])].sort(
    (a, b) => (b.updateTimeMillis ?? 0) - (a.updateTimeMillis ?? 0),
  );
  const status =
    order.status === "CANCELED" || order.status === "CANCEL" ? "CANCELLED" : order.status;
  return (
    <section className="affiliate-sample-shipment" aria-label={t(`${prefix}shipmentStatus`)}>
      <dl>
        <div>
          <dt>{t(`${prefix}shipmentStatus`)}</dt>
          <dd>
            {status
              ? t(`${prefix}shipmentStatusLabels.${status}`, {
                  defaultValue: status.replaceAll("_", " "),
                })
              : t(`${prefix}shipmentUnknown`)}
          </dd>
        </div>
        <div>
          <dt>{t(`${prefix}shipmentCheckedAt`)}</dt>
          <dd>{formatShortDateTime(order.trackingSyncedAt, i18n.language)}</dd>
        </div>
        <div>
          <dt>{t(`${prefix}shipmentLatestEvent`)}</dt>
          <dd>
            {order.latestTrackingEventDescription || t(`${prefix}shipmentNoEvents`)}
            {order.latestTrackingEventAt ? (
              <small>{formatShortDateTime(order.latestTrackingEventAt, i18n.language)}</small>
            ) : null}
          </dd>
        </div>
      </dl>
      <AffiliateSampleShipmentWarning sample={sample} />
      {events.length ? (
        <TkButton
          variant="ghost"
          size="sm"
          aria-expanded={showEvents}
          onClick={() => setShowEvents((v) => !v)}
        >
          {t(`${prefix}${showEvents ? "shipmentHideEvents" : "shipmentShowEvents"}`)}
        </TkButton>
      ) : null}
      {showEvents ? (
        <ol>
          {events.map((event, i) => (
            <li key={`${event.updateTimeMillis}:${event.actionCode}:${i}`}>
              <span>{event.description || event.actionCode || "—"}</span>
              <small>
                {event.updateTimeMillis
                  ? formatShortDateTime(
                      new Date(event.updateTimeMillis).toISOString(),
                      i18n.language,
                    )
                  : "—"}
              </small>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
