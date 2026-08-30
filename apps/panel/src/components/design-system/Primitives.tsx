import {
  forwardRef,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
} from "react";
import { Select, type SelectOption } from "../inputs/Select.js";
import "./tk-v1.css";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export interface TkPageFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const TkPageFrame = forwardRef<HTMLDivElement, TkPageFrameProps>(function TkPageFrame(
  { children, className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx("page-enter", "tk-v1-page", className)} {...props}>
      {children}
    </div>
  );
});

export interface TkPageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  copyClassName?: string;
  actionsClassName?: string;
  actionsProps?: HTMLAttributes<HTMLDivElement> & { "data-tutorial-id"?: string };
  eyebrowClassName?: string;
  descriptionClassName?: string;
}

export function TkPageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  copyClassName,
  actionsClassName,
  actionsProps,
  eyebrowClassName,
  descriptionClassName,
  ...props
}: TkPageHeaderProps) {
  const { className: actionsPropsClassName, ...restActionsProps } = actionsProps ?? {};

  return (
    <header className={cx("tk-v1-page-header", className)} {...props}>
      <div className={cx("tk-v1-page-header-copy", copyClassName)}>
        {eyebrow ? (
          <span className={cx("tk-v1-page-eyebrow", eyebrowClassName)}>{eyebrow}</span>
        ) : null}
        <h1>{title}</h1>
        {description ? (
          <p className={cx("tk-v1-page-description", descriptionClassName)}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div
          className={cx("tk-v1-page-actions", actionsClassName, actionsPropsClassName)}
          {...restActionsProps}
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export type TkPanelVariant = "open" | "subtle" | "framed" | "raised";
export type TkPanelPadding = "none" | "sm" | "md" | "lg";

export interface TkPanelProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article";
  variant?: TkPanelVariant;
  padding?: TkPanelPadding;
  clip?: boolean;
  innerRef?: Ref<HTMLElement>;
}

export function TkPanel({
  as: Element = "div",
  variant = "framed",
  padding = "md",
  clip = false,
  innerRef,
  className,
  children,
  ...props
}: TkPanelProps) {
  return (
    <Element
      ref={innerRef as never}
      className={cx(
        "tk-v1-panel",
        `tk-v1-panel-${variant}`,
        `tk-v1-panel-padding-${padding}`,
        clip && "tk-v1-panel-clip",
        className,
      )}
      {...props}
    >
      {children}
    </Element>
  );
}

export interface TkPanelHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3 | 4;
}

export function TkPanelHeader({
  title,
  description,
  eyebrow,
  actions,
  headingLevel = 3,
  className,
  ...props
}: TkPanelHeaderProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <header className={cx("tk-v1-panel-header", className)} {...props}>
      <div className="tk-v1-panel-header-copy">
        {eyebrow ? <span className="tk-v1-panel-eyebrow">{eyebrow}</span> : null}
        <Heading>{title}</Heading>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="tk-v1-panel-actions">{actions}</div> : null}
    </header>
  );
}

export interface TkPanelBodyProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Exclude<TkPanelPadding, "none">;
}

export function TkPanelBody({ padding = "md", className, children, ...props }: TkPanelBodyProps) {
  return (
    <div className={cx("tk-v1-panel-body", `tk-v1-panel-body-${padding}`, className)} {...props}>
      {children}
    </div>
  );
}

export function TkPanelFooter({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <footer className={cx("tk-v1-panel-footer", className)} {...props}>
      {children}
    </footer>
  );
}

export interface TkToolbarProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "open" | "framed";
}

export const TkToolbar = forwardRef<HTMLDivElement, TkToolbarProps>(function TkToolbar(
  { variant = "framed", className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx("tk-v1-toolbar", `tk-v1-toolbar-${variant}`, className)}
      {...props}
    >
      {children}
    </div>
  );
});

export interface TkTableFrameProps extends HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
  variant?: "standalone" | "embedded";
}

export const TkTableFrame = forwardRef<HTMLDivElement, TkTableFrameProps>(function TkTableFrame(
  { compact = false, variant = "standalone", className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(
        "tk-v1-table-frame",
        `tk-v1-table-frame-${variant}`,
        compact && "tk-v1-table-compact",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export type TkButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type TkButtonSize = "sm" | "md" | "lg";

export interface TkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TkButtonVariant;
  size?: TkButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
}

export const TkButton = forwardRef<HTMLButtonElement, TkButtonProps>(function TkButton(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    leadingIcon,
    className,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx("tk-v1-button", `tk-v1-button-${variant}`, `tk-v1-button-${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={type}
      {...props}
    >
      {loading ? <span className="tk-v1-spinner" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
    </button>
  );
});

export type TkBadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export function TkBadge({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: TkBadgeTone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={cx("tk-v1-badge", `tk-v1-badge-${tone}`)}>
      {dot && <span className="tk-v1-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export interface TkFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "prefix" | "size"
> {
  label: string;
  hint?: string;
  error?: string;
  prefix?: ReactNode;
}

export function TkField({ label, hint, error, prefix, className, id, ...props }: TkFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const supportId = `${inputId}-support`;

  return (
    <div className={cx("tk-v1-field", error && "tk-v1-field-error", className)}>
      <label className="tk-v1-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="tk-v1-input-shell">
        {prefix && <span className="tk-v1-input-prefix">{prefix}</span>}
        <input
          id={inputId}
          className="tk-v1-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? supportId : undefined}
          {...props}
        />
      </div>
      {(error || hint) && (
        <div id={supportId} className="tk-v1-field-support">
          {error ?? hint}
        </div>
      )}
    </div>
  );
}

export interface TkSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function TkSelect({ label, hint, className, id, children, ...props }: TkSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;

  return (
    <div className={cx("tk-v1-field", className)}>
      <label className="tk-v1-label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className="tk-v1-select"
        aria-describedby={hint ? hintId : undefined}
        {...props}
      >
        {children}
      </select>
      {hint && (
        <div id={hintId} className="tk-v1-field-support">
          {hint}
        </div>
      )}
    </div>
  );
}

export interface TkChoiceSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

export function TkChoiceSelect({
  label,
  value,
  onChange,
  options,
  hint,
  disabled,
  placeholder,
  searchable,
  searchPlaceholder,
  className,
}: TkChoiceSelectProps) {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;

  return (
    <div className={cx("tk-v1-field", className)}>
      <span className="tk-v1-label">{label}</span>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        ariaLabel={label}
        ariaDescribedBy={hint ? hintId : undefined}
        disabled={disabled}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        className="tk-v1-choice-select-control"
      />
      {hint && (
        <div id={hintId} className="tk-v1-field-support">
          {hint}
        </div>
      )}
    </div>
  );
}

export interface TkTabItem {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  count?: number;
  tone?: "default" | "success" | "warning";
  buttonProps?: Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "children" | "onClick" | "onKeyDown" | "role"
  > & { "data-tutorial-id"?: string };
}

export interface TkTabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: TkTabItem[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  variant?: "line" | "rail";
  descriptionLines?: 1 | 2 | 3;
  idPrefix?: string;
}

export function TkTabs({
  items,
  value,
  onChange,
  label,
  variant = "line",
  descriptionLines = 1,
  idPrefix,
  className,
  ...props
}: TkTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    const next = items[nextIndex];
    onChange(next.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      className={cx(
        "tk-v1-tabs",
        `tk-v1-tabs-${variant}`,
        `tk-v1-tabs-description-lines-${descriptionLines}`,
        className,
      )}
      role="tablist"
      aria-label={label}
      {...props}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            {...item.buttonProps}
            key={item.id}
            id={item.buttonProps?.id ?? (idPrefix ? `${idPrefix}-${item.id.toLowerCase()}` : undefined)}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            className={cx(
              "tk-v1-tab",
              selected && "tk-v1-tab-active",
              item.tone && item.tone !== "default" && `tk-v1-tab-${item.tone}`,
              item.buttonProps?.className,
            )}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.icon ? <span className="tk-v1-tab-icon">{item.icon}</span> : null}
            {item.description ? (
              <span className="tk-v1-tab-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            ) : (
              item.label
            )}
            {item.count !== undefined && <span className="tk-v1-tab-count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export interface TkSegmentedItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface TkSegmentedProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: TkSegmentedItem[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  size?: "sm" | "md";
}

export function TkSegmented({
  items,
  value,
  onChange,
  label,
  size = "md",
  className,
  ...props
}: TkSegmentedProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const enabledIndexes = items
      .map((item, itemIndex) => (item.disabled ? -1 : itemIndex))
      .filter((itemIndex) => itemIndex >= 0);
    if (!enabledIndexes.length) return;
    const currentEnabledIndex = Math.max(0, enabledIndexes.indexOf(index));
    let nextEnabledIndex = currentEnabledIndex;
    if (event.key === "ArrowLeft") {
      nextEnabledIndex = (currentEnabledIndex - 1 + enabledIndexes.length) % enabledIndexes.length;
    }
    if (event.key === "ArrowRight") {
      nextEnabledIndex = (currentEnabledIndex + 1) % enabledIndexes.length;
    }
    if (event.key === "Home") nextEnabledIndex = 0;
    if (event.key === "End") nextEnabledIndex = enabledIndexes.length - 1;
    const nextIndex = enabledIndexes[nextEnabledIndex];
    const nextItem = items[nextIndex];
    onChange(nextItem.id);
    itemRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      className={cx("tk-v1-segmented", `tk-v1-segmented-${size}`, className)}
      role="radiogroup"
      aria-label={label}
      {...props}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cx("tk-v1-segmented-item", selected && "tk-v1-segmented-item-active")}
            disabled={item.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export type TkSectionVariant = "open" | "framed" | "raised";

export interface TkSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: TkSectionVariant;
  headingLevel?: 2 | 3;
  children: ReactNode;
}

export function TkSection({
  title,
  description,
  action,
  variant = "open",
  headingLevel = 3,
  children,
  className,
  ...props
}: TkSectionProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section className={cx("tk-v1-section", `tk-v1-section-${variant}`, className)} {...props}>
      <header className="tk-v1-section-header">
        <div>
          <Heading>{title}</Heading>
          {description && <p>{description}</p>}
        </div>
        {action && <div className="tk-v1-section-action">{action}</div>}
      </header>
      <div className="tk-v1-section-body">{children}</div>
    </section>
  );
}

export function TkSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cx("tk-v1-switch-row", disabled && "is-disabled", className)}>
      <span>
        <span className="tk-v1-switch-label">{label}</span>
        {description && <span className="tk-v1-switch-description">{description}</span>}
      </span>
      <input
        className="tk-v1-switch-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="tk-v1-switch-track" aria-hidden="true">
        <span className="tk-v1-switch-thumb" />
      </span>
    </label>
  );
}

export interface TkSwitchControlProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked" | "onChange"> {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Compact switch for tables and composite cards that already render their own visible label. */
export function TkSwitchControl({
  label,
  checked,
  onChange,
  disabled = false,
  className,
  ...props
}: TkSwitchControlProps) {
  return (
    <label className={cx("tk-v1-switch-control", disabled && "is-disabled", className)}>
      <input
        {...props}
        className="tk-v1-switch-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        aria-label={label}
      />
      <span className="tk-v1-switch-track" aria-hidden="true">
        <span className="tk-v1-switch-thumb" />
      </span>
    </label>
  );
}

export function TkStatus({
  tone = "neutral",
  live = false,
  label,
  detail,
}: {
  tone?: TkBadgeTone;
  live?: boolean;
  label: string;
  detail?: string;
}) {
  return (
    <div className={cx("tk-v1-status", `tk-v1-status-${tone}`, live && "tk-v1-status-live")}>
      <span className="tk-v1-status-signal" aria-hidden="true" />
      <span className="tk-v1-status-copy">
        <strong>{label}</strong>
        {detail && <span>{detail}</span>}
      </span>
    </div>
  );
}

export function TkAlert({
  tone = "info",
  title,
  children,
  actions,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "info" | "success" | "warning" | "danger";
  title?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cx("tk-v1-alert", `tk-v1-alert-${tone}`, className)}
      role={tone === "danger" ? "alert" : "status"}
      {...props}
    >
      <span className="tk-v1-alert-signal" aria-hidden="true" />
      <div className="tk-v1-alert-copy">
        {title ? <strong>{title}</strong> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {actions ? <div className="tk-v1-alert-actions">{actions}</div> : null}
    </div>
  );
}

export function TkMetric({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="tk-v1-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {delta && <small>{delta}</small>}
    </div>
  );
}

export function TkEmptyState({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("tk-v1-empty-state", className)}>
      <span className="tk-v1-empty-mark" aria-hidden="true" />
      {eyebrow ? <span className="tk-v1-micro-label">{eyebrow}</span> : null}
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
      {action && <div className="tk-v1-empty-action">{action}</div>}
    </div>
  );
}

export function TkLoadingState({
  label,
  size = "page",
  className,
}: {
  label: string;
  size?: "page" | "inline";
  className?: string;
}) {
  return (
    <div
      className={cx("tk-v1-loading-state", `tk-v1-loading-state-${size}`, className)}
      role="status"
      aria-live="polite"
    >
      <span className="tk-v1-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
