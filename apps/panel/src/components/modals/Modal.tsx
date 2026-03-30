import { useRef, type ReactNode } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: number;
  hideCloseButton?: boolean;
  /** When true, clicking the backdrop overlay will not trigger onClose. */
  preventBackdropClose?: boolean;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 600, hideCloseButton, preventBackdropClose }: ModalProps) {
  const mouseDownOnBackdrop = useRef(false);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (!preventBackdropClose && e.target === e.currentTarget && mouseDownOnBackdrop.current) {
          onClose();
        }
        mouseDownOnBackdrop.current = false;
      }}
    >
      <div
        className="modal-content"
        style={{ maxWidth: `${maxWidth}px` }}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {!hideCloseButton && (
            <button
              onClick={onClose}
              className="modal-close-btn"
            >
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
