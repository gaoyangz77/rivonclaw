export interface TutorialStep {
  /** Stable identifier used by tests and future analytics. Unique within a route. */
  id?: string
  /** CSS selector to highlight. If element not found, skip step. */
  target: string
  /** i18n key for the tooltip title */
  titleKey: string
  /** i18n key for the tooltip body */
  bodyKey: string
  /** Tooltip placement relative to target */
  placement?: "top" | "bottom" | "left" | "right"
  /** One-shot setup performed when entering the step. */
  prepare?: () => void | Promise<void>
  /** One-shot cleanup performed when leaving the step or tutorial. */
  cleanup?: () => void | Promise<void>
  /** Keep prepare/cleanup active across adjacent steps that share this lifecycle group. */
  lifecycleGroup?: string
  /** Time to wait for an async or conditionally-rendered target. */
  targetTimeoutMs?: number
}
