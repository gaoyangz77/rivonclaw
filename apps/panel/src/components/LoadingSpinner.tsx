import { useTranslation } from "react-i18next";

export type LoadingSpinnerVariant = "page" | "inline";

interface LoadingSpinnerProps {
  /**
   * `page` is the prominent centered indicator for a whole page or a primary panel body.
   * `inline` is the smaller, denser variant for a sub-panel inside an existing surface.
   */
  variant?: LoadingSpinnerVariant;
  /** Overrides the default `common.loading` label. */
  label?: string;
}

/**
 * The single page-level / panel-level loading indicator for the panel.
 *
 * Renders a centered circling spinner plus an accessible label. Prefer this over
 * bare `t("common.loading")` text for any async load that owns a page or a panel body.
 */
export function LoadingSpinner({ variant = "page", label }: LoadingSpinnerProps) {
  const { t } = useTranslation();
  const text = label ?? t("common.loading");
  return (
    <div className={`loading-spinner loading-spinner-${variant}`} role="status" aria-live="polite">
      <span className="loading-spinner-ring" aria-hidden="true" />
      <span className="loading-spinner-label">{text}</span>
    </div>
  );
}
