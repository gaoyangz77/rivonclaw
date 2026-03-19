export interface TutorialStep {
  /** CSS selector to highlight. If element not found, skip step. */
  target: string
  /** i18n key for the tooltip title */
  titleKey: string
  /** i18n key for the tooltip body */
  bodyKey: string
  /** Tooltip placement relative to target */
  placement?: "top" | "bottom" | "left" | "right"
  /** Optional action to perform before showing this step (e.g., click a button to expand a form) */
  beforeAction?: () => void
}
