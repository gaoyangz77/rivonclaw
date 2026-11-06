import { useTranslation } from "react-i18next";
import { TkBadge } from "../../../components/design-system/index.js";
import { formatLocalizedDateTime } from "../../../lib/format-datetime.js";
import {
  formatCreatorPerformanceCount,
  formatCreatorPerformanceDate,
  formatCreatorPerformanceGmv,
  resolveCreatorPerformance,
  type CreatorPerformanceSource,
  type CreatorPerformanceView,
} from "../creator-performance-snapshot.js";
import { useCreatorPerformanceFreshness } from "../hooks/useCreatorPerformanceFreshness.js";
import "./AffiliateCreatorPerformanceSnapshot.css";

const KEY = "ecommerce.affiliateWorkspace.creatorSnapshot.";

/** The seven fields in display order. Every value is "—" until the projection reaches the Creator. */
function useSnapshotFields(view: CreatorPerformanceView | null) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const date = (value: string | null | undefined) =>
    formatCreatorPerformanceDate(value ?? null, locale);
  const count = (value: number | undefined) =>
    value == null ? "—" : formatCreatorPerformanceCount(value, locale);
  return [
    {
      id: "lastContentDate",
      label: t(`${KEY}lastContentDate`),
      value: date(view?.lastContentDate),
    },
    { id: "lastOrderDate", label: t(`${KEY}lastOrderDate`), value: date(view?.lastOrderDate) },
    {
      id: "lastSampleShippedDate",
      label: t(`${KEY}lastSampleShippedDate`),
      value: date(view?.lastSampleShippedDate),
    },
    {
      id: "shippedSampleCount",
      label: t(`${KEY}shippedSampleCount`),
      value: count(view?.shippedSampleCount),
    },
    {
      id: "contentCount90d",
      label: t(`${KEY}contentCount90d`),
      value: count(view?.contentCount90d),
    },
    { id: "orderCount90d", label: t(`${KEY}orderCount90d`), value: count(view?.orderCount90d) },
    {
      id: "gmv90d",
      label: t(`${KEY}gmv90d`),
      value: view ? formatCreatorPerformanceGmv(view.gmv, locale) : "—",
      hint: t(`${KEY}gmvHint`),
    },
  ];
}

/** "Data as of <time>" for the shops in scope; renders nothing until the answer arrives. */
export function CreatorPerformanceCaption({
  scopeShopId,
  className,
}: {
  scopeShopId: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const { freshness, loaded } = useCreatorPerformanceFreshness(scopeShopId);
  if (!loaded) return null;
  return (
    <span
      className={`affiliate-creator-snapshot-caption ${className ?? ""}`.trim()}
      title={t(`${KEY}limits`)}
    >
      {freshness
        ? t(`${KEY}asOf`, { time: formatLocalizedDateTime(freshness.cutoffAt, i18n.language) })
        : t(`${KEY}notSynced`)}
    </span>
  );
}

/** One row of the Creator list: the seven fields, compact. The list header carries the caption. */
export function CreatorPerformanceCompactRow({
  source,
  scopeShopId,
}: {
  source: CreatorPerformanceSource | null | undefined;
  scopeShopId: string;
}) {
  const view = resolveCreatorPerformance(source, scopeShopId);
  const fields = useSnapshotFields(view);
  return (
    <dl className="affiliate-creator-compact-performance">
      {fields.map((field) => (
        <div key={field.id}>
          <dt>{field.label}</dt>
          <dd title={"hint" in field ? field.hint : undefined}>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Creator detail card: the shop's snapshot at a shop scope, the seller-wide rollup otherwise. */
export function CreatorPerformanceSnapshotCard({
  source,
  scopeShopId,
}: {
  source: CreatorPerformanceSource | null | undefined;
  scopeShopId: string;
}) {
  const { t } = useTranslation();
  const view = resolveCreatorPerformance(source, scopeShopId);
  const fields = useSnapshotFields(view);
  return (
    <section className="affiliate-relationship-work-side-card affiliate-creator-snapshot-card">
      <div className="affiliate-relationship-work-side-card-head">
        <span>{t(`${KEY}title`)}</span>
        <TkBadge>
          {scopeShopId
            ? t(`${KEY}scopeShop`)
            : view?.shopCount
              ? t(`${KEY}scopeRollup`, { count: view.shopCount })
              : t(`${KEY}scopeAllShops`)}
        </TkBadge>
      </div>
      <CreatorPerformanceCaption scopeShopId={scopeShopId} />
      <dl className="affiliate-creator-snapshot-fields">
        {fields.map((field) => (
          <div key={field.id}>
            <dt>{field.label}</dt>
            <dd title={"hint" in field ? field.hint : undefined}>{field.value}</dd>
          </div>
        ))}
      </dl>
      <small className="affiliate-creator-snapshot-limits">{t(`${KEY}limits`)}</small>
    </section>
  );
}
