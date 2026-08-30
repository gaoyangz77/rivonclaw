import { useTranslation } from "react-i18next";
import { TkLoadingState } from "./design-system/index.js";

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
  return <TkLoadingState label={text} size={variant} />;
}
