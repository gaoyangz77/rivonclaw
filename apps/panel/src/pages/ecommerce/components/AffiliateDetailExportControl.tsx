import { useTranslation } from "react-i18next";
import { TkAlert, TkButton } from "../../../components/design-system/index.js";
import { DownloadIcon } from "../../../components/icons.js";
import {
  AFFILIATE_DETAIL_EXPORT_MAX_ROWS,
  AffiliateDetailExportChangedError,
  AffiliateDetailExportTooLargeError,
} from "../affiliate-detail-export.js";

type ExportState = {
  exporting: boolean;
  progress: { done: number; total: number | null } | null;
  cancel: () => void;
};

/**
 * "Download all N rows" or, while it runs, its progress and a Cancel action.
 * Results above the export cap disable the button and ask the user to split.
 */
export function AffiliateDetailExportControl({
  totalRows,
  exporter,
  disabled,
  onStart,
}: {
  totalRows: number;
  exporter: ExportState;
  disabled?: boolean;
  onStart: () => void;
}) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);

  if (exporter.progress) {
    return (
      <div className="affiliate-detail-export-progress">
        <span role="status" aria-live="polite">
          {t("ecommerce.affiliateAnalytics.details.exportPreparing", {
            done: number.format(exporter.progress.done),
            total: number.format(exporter.progress.total ?? totalRows),
          })}
        </span>
        <TkButton variant="ghost" size="sm" onClick={exporter.cancel}>
          {t("common.cancel")}
        </TkButton>
      </div>
    );
  }
  const tooLarge = totalRows > AFFILIATE_DETAIL_EXPORT_MAX_ROWS;
  const button = (
    <TkButton
      variant="secondary"
      size="sm"
      leadingIcon={<DownloadIcon />}
      disabled={disabled || tooLarge}
      onClick={onStart}
    >
      {t("ecommerce.affiliateAnalytics.details.exportAll", { total: number.format(totalRows) })}
    </TkButton>
  );
  if (!tooLarge) return button;
  return (
    <div className="affiliate-detail-export-limit">
      {button}
      <span className="affiliate-detail-note">
        {t("ecommerce.affiliateAnalytics.details.exportTooLarge", {
          max: number.format(AFFILIATE_DETAIL_EXPORT_MAX_ROWS),
        })}
      </span>
    </div>
  );
}

/** Export failure surfaced as a danger alert; the drift case gets its own guidance. */
export function AffiliateDetailExportAlert({ error }: { error: unknown }) {
  const { t, i18n } = useTranslation();
  if (!error) return null;
  return (
    <TkAlert tone="danger" title={t("ecommerce.affiliateAnalytics.details.exportFailed")}>
      {error instanceof AffiliateDetailExportChangedError
        ? t("ecommerce.affiliateAnalytics.details.exportChanged")
        : error instanceof AffiliateDetailExportTooLargeError
          ? t("ecommerce.affiliateAnalytics.details.exportTooLarge", {
              max: new Intl.NumberFormat(i18n.language).format(AFFILIATE_DETAIL_EXPORT_MAX_ROWS),
            })
        : error instanceof Error
          ? error.message
          : String(error)}
    </TkAlert>
  );
}
