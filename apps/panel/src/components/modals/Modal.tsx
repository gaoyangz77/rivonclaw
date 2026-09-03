import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
// Imported from the module rather than the design-system barrel: the barrel
// re-exports `Overlays`, which imports this file, and that cycle would bite at
// module-init time.
import { TkPrivate } from "../design-system/Privacy.js";

const openModalStack: string[] = [];
let documentOverflowBeforeModal = "";
let bodyOverflowBeforeModal = "";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackdropClose?: () => void;
  title: string;
  /**
   * Whether the visible title is sensitive text that privacy mode must mask.
   *
   * Only the rendered `<h2>` is marked. `title` stays a plain string because it
   * doubles as the dialog's accessible label, which a screen reader speaks to
   * its own operator and no onlooker can read — masking that would cost a blind
   * operator the name and buy no privacy.
   */
  titleSensitive?: boolean;
  headerContent?: ReactNode;
  /** Optional content that shares one scroll region with the modal body while the title stays fixed. */
  bodyLeadContent?: ReactNode;
  children: ReactNode;
  maxWidth?: number;
  /** Omit the visible title bar while retaining the title as the dialog's accessible label. */
  hideHeader?: boolean;
  hideCloseButton?: boolean;
  /** When true, clicking the backdrop overlay will not trigger onClose. */
  preventBackdropClose?: boolean;
  className?: string;
  backdropClassName?: string;
  closeLabel?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  "data-tutorial-id"?: string;
  padding?: "default" | "none";
  /** Render against document.body so the modal is independent of transformed or clipped parents. */
  portal?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  onBackdropClose,
  title,
  titleSensitive = false,
  headerContent,
  bodyLeadContent,
  children,
  maxWidth,
  hideHeader = false,
  hideCloseButton,
  preventBackdropClose,
  className,
  backdropClassName,
  closeLabel = "Close",
  ariaLabel,
  ariaLabelledBy,
  "data-tutorial-id": dataTutorialId,
  padding = "default",
  portal = true,
}: ModalProps) {
  const mouseDownOnBackdrop = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    openModalStack.push(titleId);
    if (openModalStack.length === 1) {
      documentOverflowBeforeModal = document.documentElement.style.overflow;
      bodyOverflowBeforeModal = document.body.style.overflow;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const content = contentRef.current;
    const focusable = content?.querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    (focusable ?? content)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (openModalStack.at(-1) !== titleId) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !content) return;
      const items = Array.from(
        content.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const stackIndex = openModalStack.lastIndexOf(titleId);
      if (stackIndex >= 0) openModalStack.splice(stackIndex, 1);
      if (openModalStack.length === 0) {
        document.documentElement.style.overflow = documentOverflowBeforeModal;
        document.body.style.overflow = bodyOverflowBeforeModal;
      }
      previousFocus?.focus();
    };
  }, [isOpen, titleId]);

  if (!isOpen) return null;

  const modal = (
    <div
      className={`modal-backdrop${backdropClassName ? ` ${backdropClassName}` : ""}`}
      role="presentation"
      onMouseDown={(e) => {
        mouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (!preventBackdropClose && e.target === e.currentTarget && mouseDownOnBackdrop.current) {
          (onBackdropClose ?? onClose)();
        }
        mouseDownOnBackdrop.current = false;
      }}
    >
      <div
        ref={contentRef}
        className={`modal-content tk-v1-modal tk-v1-modal-padding-${padding}${className ? ` ${className}` : ""}`}
        style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (hideHeader ? title : undefined)}
        aria-labelledby={ariaLabelledBy ?? (hideHeader ? undefined : titleId)}
        data-tutorial-id={dataTutorialId}
        tabIndex={-1}
      >
        {!hideHeader && (
          <div className="modal-header">
            <div className="modal-header-main">
              <h2 id={titleId} className="modal-title">
                {titleSensitive ? <TkPrivate>{title}</TkPrivate> : title}
              </h2>
              {headerContent}
            </div>
            {!hideCloseButton && (
              <button onClick={onClose} className="modal-close-btn" aria-label={closeLabel}>
                ×
              </button>
            )}
          </div>
        )}
        {bodyLeadContent ? (
          <div className="modal-scroll-region">
            {bodyLeadContent}
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );

  return portal ? createPortal(modal, document.body) : modal;
}
