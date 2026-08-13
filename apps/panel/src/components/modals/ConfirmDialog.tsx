import { Modal } from "./Modal.js";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidth={440} portal>
      <p className="confirm-dialog-message">{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={`btn btn-${confirmVariant}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
