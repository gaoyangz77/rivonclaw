import { InfoIcon } from "../../../components/icons.js";
import { TkTooltip } from "../../../components/design-system/index.js";

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
      <TkTooltip
        label={tooltip}
        trigger={(props) => (
          <button
            {...props}
            className="affiliate-metric-tooltip-trigger"
            aria-label={`${label}: ${tooltip}`}
          >
            <InfoIcon aria-hidden="true" />
          </button>
        )}
      />
    </span>
  );
}
