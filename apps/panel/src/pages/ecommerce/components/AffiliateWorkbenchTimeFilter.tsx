import { useTranslation } from "react-i18next";
import { TkChoiceSelect, TkField } from "../../../components/design-system/index.js";
import {
  AFFILIATE_WORKBENCH_TIME_PRESETS,
  type AffiliateWorkbenchTimeFilter as TimeFilterValue,
  type AffiliateWorkbenchTimePreset,
  type AffiliateWorkbenchTimeSelection,
} from "../affiliate-workbench-time-filter.js";
import "./AffiliateWorkbenchTimeFilter.css";

const PRESET_LABEL_KEY: Record<AffiliateWorkbenchTimePreset, string> = {
  ALL: "ecommerce.affiliateWorkspace.workbench.timeAll",
  TODAY: "ecommerce.affiliateWorkspace.workbench.timeToday",
  LAST_7_DAYS: "ecommerce.affiliateWorkspace.workbench.timeLast7Days",
  LAST_30_DAYS: "ecommerce.affiliateWorkspace.workbench.timeLast30Days",
  CUSTOM: "ecommerce.affiliateWorkspace.workbench.timeCustom",
};

interface Props {
  value: TimeFilterValue;
  onChange: (next: TimeFilterValue) => void;
  /**
   * Resolved by the caller, which needs it for the query variables anyway.
   * Passing it in keeps one resolution per render: two independent `new Date()`
   * calls could straddle local midnight and disagree about what is displayed
   * versus what was queried.
   */
  selection: AffiliateWorkbenchTimeSelection;
  className?: string;
}

/**
 * Preset-first time range for the workbench queues.
 *
 * A preset covers the ordinary case in one click and keeps the already crowded
 * filter rows to a single extra control; the two date inputs appear only for
 * `CUSTOM`. The default is "all time", which sends no bound at all.
 */
export function AffiliateWorkbenchTimeFilter({ value, onChange, selection, className }: Props) {
  const { t } = useTranslation();
  const custom = value.preset === "CUSTOM";

  return (
    <div
      className={`affiliate-workbench-time-filter${className ? ` ${className}` : ""}`}
      data-tutorial-id="affiliate-workbench-time"
    >
      <TkChoiceSelect
        label={t("ecommerce.affiliateWorkspace.workbench.timeFilter")}
        value={value.preset}
        onChange={(next) =>
          onChange({ ...value, preset: next as AffiliateWorkbenchTimePreset })
        }
        options={AFFILIATE_WORKBENCH_TIME_PRESETS.map((preset) => ({
          value: preset,
          label: t(PRESET_LABEL_KEY[preset]),
        }))}
        className="affiliate-workbench-time-preset"
      />
      {custom ? (
        <>
          <TkField
            type="date"
            label={t("ecommerce.affiliateWorkspace.workbench.timeFrom")}
            className="affiliate-workbench-time-date"
            value={value.customStartDate}
            onChange={(event) => onChange({ ...value, customStartDate: event.target.value })}
          />
          <TkField
            type="date"
            label={t("ecommerce.affiliateWorkspace.workbench.timeTo")}
            className="affiliate-workbench-time-date"
            value={value.customEndDate}
            onChange={(event) => onChange({ ...value, customEndDate: event.target.value })}
            hint={
              selection.state === "INCOMPLETE"
                ? t("ecommerce.affiliateWorkspace.workbench.timeCustomHint")
                : undefined
            }
            error={
              selection.state === "INVALID_ORDER"
                ? t("ecommerce.affiliateWorkspace.workbench.timeCustomInvalid")
                : undefined
            }
          />
        </>
      ) : null}
    </div>
  );
}
