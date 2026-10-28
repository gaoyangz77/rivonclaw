import { useId, useState } from "react";
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
  const eventsId = useId();
  const order = sample.order;
  if (!order?.trackingSyncedAt) return null;
  const events = [...(order.trackingEvents ?? [])].sort(
    (a, b) => (b.updateTimeMillis ?? 0) - (a.updateTimeMillis ?? 0),
  );
  const status =
    order.status === "CANCELED" || order.status === "CANCEL" ? "CANCELLED" : order.status;
  return (
    <section className="affiliate-sample-shipment" aria-label={t(`${prefix}shipmentStatus`)}>
      <dl className="affiliate-sample-shipment-summary">
        <div className="affiliate-entity-fact">
          <dt>{t(`${prefix}shipmentStatus`)}</dt>
          <dd>
            {status
              ? t(`${prefix}shipmentStatusLabels.${status}`, {
                  defaultValue: status.replaceAll("_", " "),
                })
              : t(`${prefix}shipmentUnknown`)}
          </dd>
        </div>
        <div className="affiliate-entity-fact">
          <dt>{t(`${prefix}shipmentCheckedAt`)}</dt>
          <dd>{formatShortDateTime(order.trackingSyncedAt, i18n.language)}</dd>
        </div>
        <div className="affiliate-entity-fact affiliate-sample-shipment-latest">
          <dt>{t(`${prefix}shipmentLatestEvent`)}</dt>
          <dd>
            <div className="affiliate-sample-shipment-latest-summary">
              <div className="affiliate-sample-shipment-latest-copy">
                <p>{order.latestTrackingEventDescription || t(`${prefix}shipmentNoEvents`)}</p>
                {order.latestTrackingEventAt ? (
                  <small>{formatShortDateTime(order.latestTrackingEventAt, i18n.language)}</small>
                ) : null}
              </div>
              {events.length ? (
                <TkButton
                  variant="secondary"
                  size="sm"
                  aria-expanded={showEvents}
                  aria-controls={eventsId}
                  onClick={() => setShowEvents((v) => !v)}
                >
                  {t(`${prefix}${showEvents ? "shipmentHideEvents" : "shipmentShowEvents"}`)}
                </TkButton>
              ) : null}
            </div>
            <AffiliateSampleShipmentWarning sample={sample} />
            {showEvents ? (
              <ol id={eventsId} className="affiliate-sample-shipment-events">
                {events.map((event, i) => (
                  <li
                    className="affiliate-entity-fact"
                    key={`${event.updateTimeMillis}:${event.actionCode}:${i}`}
                  >
                    <p>{event.description || event.actionCode || "—"}</p>
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
          </dd>
        </div>
      </dl>
    </section>
  );
}
