import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modals/Modal.js";

export interface ChatResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ChatResetModal({ isOpen, onClose, onConfirm }: ChatResetModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("chat.resetCommand")}
      maxWidth={400}
    >
      <p>{t("chat.resetConfirm")}</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className="btn btn-danger" onClick={onConfirm}>
          {t("chat.resetCommand")}
        </button>
      </div>
    </Modal>
  );
}
