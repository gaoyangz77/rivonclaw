import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modals/Modal.js";
import { formatTokenCount } from "../chat-utils.js";

export interface ChatContextOverflowModalProps {
  isOpen: boolean;
  pendingModelSwitch: {
    provider: string;
    model: string;
    currentTokens: number;
    newContextWindow: number;
  } | null;
  onClose: () => void;
  onContinue: () => void;
  onClear: () => void;
}

export function ChatContextOverflowModal({
  isOpen,
  pendingModelSwitch,
  onClose,
  onContinue,
  onClear,
}: ChatContextOverflowModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("chat.contextOverflowTitle")}
      maxWidth={480}
    >
      {pendingModelSwitch && (
        <>
          <p>{t("chat.contextOverflowBody", {
            current: formatTokenCount(pendingModelSwitch.currentTokens),
            max: formatTokenCount(pendingModelSwitch.newContextWindow),
          })}</p>
          <div className="chat-overflow-actions">
            <button
              className="chat-overflow-card chat-overflow-card-primary"
              onClick={onContinue}
            >
              <span className="chat-overflow-card-label">{t("chat.contextOverflowContinue")}</span>
              <span className="chat-overflow-card-hint">{t("chat.contextOverflowContinueHint")}</span>
            </button>
            <button
              className="chat-overflow-card"
              onClick={onClear}
            >
              <span className="chat-overflow-card-label">{t("chat.contextOverflowClear")}</span>
              <span className="chat-overflow-card-hint">{t("chat.contextOverflowClearHint")}</span>
            </button>
            <button
              className="chat-overflow-cancel"
              onClick={onClose}
            >
              {t("common.cancel")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
