import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type AffiliateMetricTone = "default" | "warning" | "muted" | "projection";

/** One number in a section's metric strip. No period comparison exists on this page. */
export function AffiliateMetric({ label, value, hint, basis, tone = "default" }: {
  label: string;
  value: string;
  hint?: string;
  /**
   * What the figure was computed over — shop count and coverage start.
   *
   * Server-side figures span the whole window and the whole selected scope, and
   * the boundary layer only changes what is PLOTTED. A rate shown next to a
   * truncated chart would otherwise read as if it shared the chart's basis.
   */
  basis?: string;
  tone?: AffiliateMetricTone;
}) {
  return (
    <div className="affiliate-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
      {basis ? <small className="affiliate-metric-basis">{basis}</small> : null}
    </div>
  );
}

/**
 * The header of a numbered Overview section. Every section states its own
 * cohort time axis here, because the three axes are not interchangeable and a
 * reader who assumes one axis for all three will misread two of them.
 */
export function AffiliateSectionHeader({ index, title, axis }: {
  index: string;
  title: string;
  axis: string;
}) {
  return (
    <header className="affiliate-section-header">
      <div className="affiliate-section-heading">
        <b className="affiliate-section-index" aria-hidden="true">{index}</b>
        <div>
          <h2>{title}</h2>
          <p className="affiliate-section-axis">{axis}</p>
        </div>
      </div>
    </header>
  );
}

/** A chart with its own title, an optional coverage strip, and a reading note. */
export function AffiliateChartCard({ title, note, band, height = "medium", children }: {
  title: string;
  note?: string;
  /**
   * Coverage strip, rendered directly beneath a date-axis chart so its
   * staircase lines up with the x-axis it qualifies. Charts on a non-date axis
   * (age buckets, lag days, horizons) carry none — coverage is a statement
   * about calendar days.
   */
  band?: ReactNode;
  height?: "medium" | "tall";
  children: ReactNode;
}) {
  return (
    <article className="affiliate-chart-card">
      <h3>{title}</h3>
      <div className={height === "tall" ? "affiliate-chart-large" : "affiliate-chart-medium"}>{children}</div>
      {band}
      {note ? <p className="affiliate-chart-note">{note}</p> : null}
    </article>
  );
}

/**
 * Non-content state for a single section. Each cohort section is its own root
 * query, so one failing or absent section must not blank the other two.
 */
export function AffiliateSectionState({ loading, error, onRetry }: {
  loading: boolean;
  error?: Error;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  if (error) {
    return (
      <div className="affiliate-section-unavailable is-error">
        <strong>{t("ecommerce.affiliateAnalytics.sectionErrorTitle")}</strong>
        <p>{error.message}</p>
        <button className="btn btn-secondary" type="button" onClick={onRetry}>
          {t("ecommerce.affiliateAnalytics.retry")}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="affiliate-section-loading" aria-label={t("ecommerce.affiliateAnalytics.loading")}>
        <i />
        <i />
      </div>
    );
  }

  return (
    <div className="affiliate-section-unavailable">
      <strong>{t("ecommerce.affiliateAnalytics.sectionUnavailableTitle")}</strong>
      <p>{t("ecommerce.affiliateAnalytics.sectionUnavailableBody")}</p>
    </div>
  );
}
