import { InfoIcon } from "../../../components/icons.js";

export function AffiliateMetricLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <span className="affiliate-metric-label">
      <span>{label}</span>
      <span className="affiliate-metric-tooltip">
        <button
          type="button"
          className="affiliate-metric-tooltip-trigger"
          aria-label={`${label}: ${tooltip}`}
        >
          <InfoIcon aria-hidden="true" />
        </button>
        <span className="affiliate-metric-tooltip-content" role="tooltip">
          {tooltip}
        </span>
      </span>
    </span>
  );
}
