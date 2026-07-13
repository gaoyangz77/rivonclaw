import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackdropClose?: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: number;
  hideCloseButton?: boolean;
  /** When true, clicking the backdrop overlay will not trigger onClose. */
  preventBackdropClose?: boolean;
  className?: string;
  closeLabel?: string;
  /** Render against document.body so the modal is independent of transformed or clipped parents. */
  portal?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  onBackdropClose,
  title,
  children,
  maxWidth = 600,
  hideCloseButton,
  preventBackdropClose,
  className,
  closeLabel = "Close",
  portal = false,
}: ModalProps) {
  const mouseDownOnBackdrop = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const content = contentRef.current;
    const focusable = content?.querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    (focusable ?? content)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
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
      previousFocus?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modal = (
    <div
      className="modal-backdrop"
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
        className={`modal-content${className ? ` ${className}` : ""}`}
        style={{ maxWidth: `${maxWidth}px` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          {!hideCloseButton && (
            <button onClick={onClose} className="modal-close-btn" aria-label={closeLabel}>
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );

  return portal ? createPortal(modal, document.body) : modal;
}
