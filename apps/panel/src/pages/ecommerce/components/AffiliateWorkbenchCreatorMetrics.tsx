import type { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import { formatShortDateTime } from "../../../lib/format-datetime.js";
import "./AffiliateWorkbenchCreatorMetrics.css";

type Metrics = Pick<
  GQL.AffiliateWorkbenchSampleRow,
  | "creatorGmv"
  | "creatorPostRate"
  | "creatorAverageVideoViews"
  | "creatorUnitsSold"
  | "creatorPerformanceMarket"
  | "creatorPerformanceObservedAt"
>;

export function AffiliateWorkbenchCreatorMetrics({ row }: { row: Metrics }) {
  const { t, i18n } = useTranslation();
  const key = "ecommerce.affiliateWorkspace.workbench.";
  const count = (value: number | null | undefined) =>
    value == null
      ? "—"
      : new Intl.NumberFormat(i18n.language, {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(value);
  const money = (value: number) =>
    new Intl.NumberFormat(
      i18n.language,
      row.creatorGmv?.currency
        ? { style: "currency", currency: row.creatorGmv.currency, maximumFractionDigits: 0 }
        : { notation: "compact", maximumFractionDigits: 1 },
    ).format(value);
  const gmv = row.creatorGmv;
  const amount =
    gmv?.amount != null
      ? money(gmv.amount)
      : gmv?.minimumAmount != null && gmv.maximumAmount != null
        ? `${money(gmv.minimumAmount)}–${money(gmv.maximumAmount)}`
        : "—";
  const windowKey =
    gmv?.window === "LAST_30_DAYS"
      ? "metricWindow30"
      : gmv?.window === "LAST_90_DAYS"
        ? "metricWindow90"
        : gmv?.window === "LIFETIME"
          ? "metricWindowLifetime"
          : "metricWindowUnknown";
  const values = [
    ["metricGmv", amount],
    [
      "metricPostRate",
      row.creatorPostRate == null
        ? "—"
        : new Intl.NumberFormat(i18n.language, {
            style: "percent",
            maximumFractionDigits: 1,
          }).format(row.creatorPostRate),
    ],
    ["metricViews", count(row.creatorAverageVideoViews)],
    ["metricUnits", count(row.creatorUnitsSold)],
  ];
  return (
    <div className="affiliate-workbench-creator-metrics">
      <dl aria-label={t(`${key}colCreatorMetrics`)}>
        {values.map(([label, value]) => (
          <div key={label}>
            <dt>
              {t(`${key}${label}`)}
              {label === "metricGmv" && gmv ? <small> · {t(`${key}${windowKey}`)}</small> : null}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {row.creatorPerformanceObservedAt ? (
        <small className="affiliate-workbench-creator-metrics-source">
          {row.creatorPerformanceMarket} ·{" "}
          {formatShortDateTime(row.creatorPerformanceObservedAt, i18n.language)}
        </small>
      ) : null}
    </div>
  );
}
