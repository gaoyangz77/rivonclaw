import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { Modal, type ModalProps } from "../modals/Modal.js";
import { TkButton, type TkButtonSize, type TkButtonVariant } from "./Primitives.js";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function isModalChild(anchor: HTMLElement | null): boolean {
  return Boolean(anchor?.closest('[aria-modal="true"]'));
}

export type TkOverlayPlacement =
  | "bottom-start"
  | "bottom-end"
  | "top-start"
  | "top-end"
  | "right-start"
  | "right-end"
  | "left-start"
  | "left-end";
export type TkTooltipPlacement = "top" | "right" | "bottom" | "left";

export interface TkOverlayTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref: (node: HTMLButtonElement | null) => void;
}

export interface TkPopoverProps {
  trigger: (props: TkOverlayTriggerProps) => ReactNode;
  children: ReactNode;
  label: string;
  placement?: TkOverlayPlacement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  role?: "dialog" | "menu" | "navigation";
  contentRef?: Ref<HTMLDivElement>;
}

function getOverlayPosition(
  anchor: DOMRect,
  panel: DOMRect,
  placement: TkOverlayPlacement,
): Pick<CSSProperties, "top" | "left"> {
  const viewportPadding = 8;
  const gap = 8;
  const placeBeside = placement.startsWith("right") || placement.startsWith("left");
  if (placeBeside) {
    const placeRight = placement.startsWith("right");
    const alignEnd = placement.endsWith("end");
    const preferredLeft = placeRight ? anchor.right + gap : anchor.left - panel.width - gap;
    const alternateLeft = placeRight ? anchor.left - panel.width - gap : anchor.right + gap;
    const fitsPreferred = placeRight
      ? preferredLeft + panel.width <= window.innerWidth - viewportPadding
      : preferredLeft >= viewportPadding;
    const unclampedLeft = fitsPreferred ? preferredLeft : alternateLeft;
    const unclampedTop = alignEnd ? anchor.bottom - panel.height : anchor.top;
    return {
      top: Math.max(
        viewportPadding,
        Math.min(unclampedTop, window.innerHeight - panel.height - viewportPadding),
      ),
      left: Math.max(
        viewportPadding,
        Math.min(unclampedLeft, window.innerWidth - panel.width - viewportPadding),
      ),
    };
  }
  const placeAbove = placement.startsWith("top");
  const alignEnd = placement.endsWith("end");
  const preferredTop = placeAbove ? anchor.top - panel.height - gap : anchor.bottom + gap;
  const alternateTop = placeAbove ? anchor.bottom + gap : anchor.top - panel.height - gap;
  const fitsPreferred = placeAbove
    ? preferredTop >= viewportPadding
    : preferredTop + panel.height <= window.innerHeight - viewportPadding;
  const unclampedTop = fitsPreferred ? preferredTop : alternateTop;
  const unclampedLeft = alignEnd ? anchor.right - panel.width : anchor.left;

  return {
    top: Math.max(
      viewportPadding,
      Math.min(unclampedTop, window.innerHeight - panel.height - viewportPadding),
    ),
    left: Math.max(
      viewportPadding,
      Math.min(unclampedLeft, window.innerWidth - panel.width - viewportPadding),
    ),
  };
}

function getTooltipPosition(
  anchor: DOMRect,
  tooltip: DOMRect,
  placement: TkTooltipPlacement,
): Pick<CSSProperties, "top" | "left"> {
  const viewportPadding = 8;
  const gap = 8;
  const positions = {
    top: {
      top: anchor.top - tooltip.height - gap,
      left: anchor.left + (anchor.width - tooltip.width) / 2,
    },
    right: {
      top: anchor.top + (anchor.height - tooltip.height) / 2,
      left: anchor.right + gap,
    },
    bottom: {
      top: anchor.bottom + gap,
      left: anchor.left + (anchor.width - tooltip.width) / 2,
    },
    left: {
      top: anchor.top + (anchor.height - tooltip.height) / 2,
      left: anchor.left - tooltip.width - gap,
    },
  } as const;
  const preferred = positions[placement];
  return {
    top: Math.max(
      viewportPadding,
      Math.min(preferred.top, window.innerHeight - tooltip.height - viewportPadding),
    ),
    left: Math.max(
      viewportPadding,
      Math.min(preferred.left, window.innerWidth - tooltip.width - viewportPadding),
    ),
  };
}

export interface TkTooltipProps {
  label: string;
  trigger: (props: TkOverlayTriggerProps) => ReactNode;
  placement?: TkTooltipPlacement;
  delay?: number;
  className?: string;
}

/** Portal tooltip for clipped, scrollable, or layered navigation surfaces. */
export function TkTooltip({
  label,
  trigger,
  placement = "top",
  delay = 450,
  className,
}: TkTooltipProps) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({
    top: 0,
    left: 0,
    visibility: "hidden",
  });

  const close = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
    setOpen(false);
  }, []);

  const openAfterDelay = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current || !tooltipRef.current) return;
    setPosition({
      ...getTooltipPosition(
        anchorRef.current.getBoundingClientRect(),
        tooltipRef.current.getBoundingClientRect(),
        placement,
      ),
      visibility: "visible",
    });
  }, [placement]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => close, [close]);

  const triggerNode = trigger({
    ref: (node) => {
      anchorRef.current = node;
    },
    type: "button",
    "aria-describedby": open ? tooltipId : undefined,
    onPointerEnter: openAfterDelay,
    onPointerLeave: close,
    onFocus: () => setOpen(true),
    onBlur: close,
  });

  return (
    <>
      {triggerNode}
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            className={cx(
              "tk-v1-tooltip",
              isModalChild(anchorRef.current) && "tk-v1-overlay-modal-child",
              className,
            )}
            style={position}
            role="tooltip"
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Accessible help affordance backed by the shared portal tooltip. */
export function TkInfoTip({
  label,
  placement = "top",
  className,
}: {
  label: string;
  placement?: TkTooltipPlacement;
  className?: string;
}) {
  return (
    <TkTooltip
      label={label}
      placement={placement}
      trigger={(props) => (
        <button
          {...props}
          className={cx("tk-v1-info-tip", className)}
          aria-label={label}
        >
          ?
        </button>
      )}
    />
  );
}

export function TkPopover({
  trigger,
  children,
  label,
  placement = "bottom-start",
  open,
  defaultOpen = false,
  onOpenChange,
  className,
  role = "dialog",
  contentRef,
}: TkPopoverProps) {
  const panelId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [position, setPosition] = useState<CSSProperties>({
    top: 0,
    left: 0,
    visibility: "hidden",
  });
  const isOpen = open ?? internalOpen;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, open],
  );

  const updatePosition = useCallback(() => {
    if (!anchorRef.current || !panelRef.current) return;
    const nextPosition = getOverlayPosition(
      anchorRef.current.getBoundingClientRect(),
      panelRef.current.getBoundingClientRect(),
      placement,
    );
    setPosition({ ...nextPosition, visibility: "visible" });
  }, [placement]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      anchorRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setOpen]);

  const triggerNode = trigger({
    ref: (node) => {
      anchorRef.current = node;
    },
    type: "button",
    "aria-haspopup": role === "menu" ? "menu" : role === "dialog" ? "dialog" : undefined,
    "aria-expanded": isOpen,
    "aria-controls": isOpen ? panelId : undefined,
    onClick: () => setOpen(!isOpen),
  });

  return (
    <>
      {triggerNode}
      {isOpen &&
        createPortal(
          <div
            ref={(node) => {
              panelRef.current = node;
              assignRef(contentRef, node);
            }}
            id={panelId}
            className={cx(
              "tk-v1-popover",
              isModalChild(anchorRef.current) && "tk-v1-overlay-modal-child",
              className,
            )}
            style={position}
            role={role}
            aria-label={label}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

export interface TkMenuActionItem {
  type?: "item";
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  leadingIcon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
}

export interface TkMenuSeparator {
  type: "separator";
  id: string;
}

export type TkMenuItem = TkMenuActionItem | TkMenuSeparator;

export function TkMenu({
  label,
  triggerLabel,
  items,
  placement = "bottom-start",
  triggerVariant = "secondary",
  triggerSize = "md",
}: {
  label: string;
  triggerLabel: string;
  items: TkMenuItem[];
  placement?: TkOverlayPlacement;
  triggerVariant?: TkButtonVariant;
  triggerSize?: TkButtonSize;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>("[role='menuitem']:not(:disabled)")
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const menuItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)") ??
        [],
    );
    if (!menuItems.length) return;
    const currentIndex = Math.max(
      0,
      menuItems.indexOf(document.activeElement as HTMLButtonElement),
    );
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % menuItems.length;
    if (event.key === "ArrowUp")
      nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = menuItems.length - 1;
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    menuItems[nextIndex]?.focus();
  }

  return (
    <TkPopover
      label={label}
      placement={placement}
      open={open}
      onOpenChange={setOpen}
      role="menu"
      className="tk-v1-menu"
      contentRef={menuRef}
      trigger={(props) => (
        <TkButton
          {...props}
          ref={(node) => {
            props.ref(node);
            triggerRef.current = node;
          }}
          variant={triggerVariant}
          size={triggerSize}
        >
          {triggerLabel}
        </TkButton>
      )}
    >
      <div onKeyDown={handleMenuKeyDown}>
        {items.map((item) => {
          if (item.type === "separator") {
            return <div key={item.id} className="tk-v1-menu-separator" role="separator" />;
          }
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={cx("tk-v1-menu-item", item.tone === "danger" && "is-danger")}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                setOpen(false);
                requestAnimationFrame(() => triggerRef.current?.focus());
              }}
            >
              {item.leadingIcon && <span className="tk-v1-menu-icon">{item.leadingIcon}</span>}
              <span className="tk-v1-menu-copy">
                <strong>{item.label}</strong>
                {item.description && <small>{item.description}</small>}
              </span>
              {item.shortcut && <kbd>{item.shortcut}</kbd>}
            </button>
          );
        })}
      </div>
    </TkPopover>
  );
}

export interface TkModalProps extends Omit<ModalProps, "className" | "portal"> {
  className?: string;
  /** Compatibility-only: design-system modals always render in the document portal. */
  portal?: true;
}

export function TkModal({ className, portal: _portal, ...props }: TkModalProps) {
  return <Modal {...props} portal className={className} />;
}

export interface TkConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
}

export function TkConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
}: TkConfirmDialogProps) {
  return (
    <TkModal isOpen={isOpen} onClose={onCancel} title={title} maxWidth={440}>
      <p className="tk-v1-confirm-message">{message}</p>
      <div className="tk-v1-modal-actions">
        <TkButton variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </TkButton>
        <TkButton variant={confirmVariant} onClick={onConfirm}>
          {confirmLabel}
        </TkButton>
      </div>
    </TkModal>
  );
}
