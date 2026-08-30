import type { ReactNode } from "react";
import {
  TkModal,
  TkPageFrame,
  TkPageHeader,
  TkToolbar,
} from "../../../components/design-system/index.js";

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function AffiliatePageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <TkPageFrame
      className={classes(
        "affiliate-page-shell",
        "affiliate-page-frame",
        "tk-v1-business-page",
        className,
      )}
    >
      {children}
    </TkPageFrame>
  );
}

export function AffiliatePageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
  tutorialId,
  "data-tutorial-id": dataTutorialId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
  tutorialId?: string;
  "data-tutorial-id"?: string;
}) {
  return (
    <TkPageHeader
      className={classes("affiliate-page-hero", "affiliate-page-header", className)}
      data-tutorial-id={dataTutorialId ?? tutorialId}
      title={title}
      description={subtitle}
      eyebrow={eyebrow}
      actions={actions}
      copyClassName="affiliate-page-header-copy"
      eyebrowClassName="affiliate-page-header-eyebrow"
      descriptionClassName="ecommerce-page-subtitle"
      actionsClassName="affiliate-page-header-actions"
    />
  );
}

export function AffiliateToolbar({
  children,
  className,
  tutorialId,
  "data-tutorial-id": dataTutorialId,
}: {
  children: ReactNode;
  className?: string;
  tutorialId?: string;
  "data-tutorial-id"?: string;
}) {
  return (
    <TkToolbar
      variant="open"
      className={classes("affiliate-toolbar", className)}
      data-tutorial-id={dataTutorialId ?? tutorialId}
    >
      {children}
    </TkToolbar>
  );
}

export function AffiliateDetailModal({
  children,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  className,
  backdropClassName,
  tutorialId,
}: {
  children: ReactNode;
  onClose: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  backdropClassName?: string;
  tutorialId?: string;
}) {
  return (
    <TkModal
      isOpen
      onClose={onClose}
      title={ariaLabel ?? "Affiliate detail"}
      hideHeader
      padding="none"
      className={classes("affiliate-detail-modal", className)}
      backdropClassName={classes("affiliate-detail-modal-backdrop", backdropClassName)}
      ariaLabel={ariaLabel}
      ariaLabelledBy={ariaLabelledBy}
      data-tutorial-id={tutorialId}
    >
      {children}
    </TkModal>
  );
}

export function AffiliateMetricGrid({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={classes(
        "affiliate-metric-grid",
        compact && "affiliate-metric-grid-compact",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AffiliateMetric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
}) {
  return (
    <div className={classes("affiliate-metric", `is-${tone}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function AffiliateStatusPill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  return (
    <span className={classes("affiliate-status-pill", `is-${tone}`, className)}>{children}</span>
  );
}

export function AffiliateContextInspector({
  children,
  open,
  title,
  headerContent,
  onClose,
  className,
}: {
  children: ReactNode;
  open: boolean;
  title?: ReactNode;
  headerContent?: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const hasTitle = title !== null && title !== undefined && title !== false;
  const hasHeaderContent =
    headerContent !== null && headerContent !== undefined && headerContent !== false;
  return (
    <aside
      className={classes("affiliate-context-inspector", open && "is-open", className)}
      aria-hidden={!open}
    >
      <div
        className={classes(
          "affiliate-context-inspector-header",
          !hasTitle && hasHeaderContent && "is-navigation-only",
        )}
      >
        <div className="affiliate-context-inspector-header-main">
          {hasTitle ? <strong>{title}</strong> : null}
          {headerContent}
        </div>
        <button
          className="affiliate-context-inspector-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="affiliate-context-inspector-body">{children}</div>
    </aside>
  );
}

export type AffiliateEntityCardVariant = "listing" | "embedded" | "compact";

export function affiliateEntityCardClassName(
  variant: AffiliateEntityCardVariant,
  interactive = false,
  className?: string,
): string {
  return classes(
    "affiliate-entity-card",
    `affiliate-entity-card-${variant}`,
    interactive && "is-interactive",
    className,
  );
}
