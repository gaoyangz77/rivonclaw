import { useTranslation } from "react-i18next";
import { TkAlert, TkBadge, TkButton, TkModal } from "../design-system/index.js";
import type { useMessageTranslation } from "../../hooks/useMessageTranslation.js";
import "./MessageTranslationPreview.css";

export function MessageTranslationPreview({
  controller,
}: {
  controller: ReturnType<typeof useMessageTranslation>;
}) {
  const { t, i18n } = useTranslation();
  const preview = controller.preview;
  if (!preview) return null;
  const language = preview.language
    ? (new Intl.DisplayNames([i18n.language], { type: "language" }).of(preview.language) ??
      preview.language)
    : null;
  return (
    <TkModal
      isOpen
      title={t("messageTranslation.title")}
      onClose={controller.close}
      closeLabel={t("common.close")}
      hideCloseButton={preview.sending}
      preventBackdropClose={preview.sending}
      maxWidth={640}
    >
      <div className="message-translation-preview" aria-busy={preview.loading || preview.sending}>
        {language ? (
          <div className="message-translation-language">
            <strong>{t("messageTranslation.target", { language })}</strong>
            <TkBadge tone="neutral">{t(`messageTranslation.source.${preview.source}`)}</TkBadge>
          </div>
        ) : null}
        <label className="message-translation-field">
          <span>{t("messageTranslation.original")}</span>
          <textarea className="form-input" value={preview.original} readOnly rows={3} />
        </label>
        {preview.loading ? <p role="status">{t("messageTranslation.generating")}</p> : null}
        {preview.language ? (
          <label className="message-translation-field">
            <span>{t("messageTranslation.translated")}</span>
            <textarea
              className="form-input"
              value={preview.text}
              rows={5}
              dir="auto"
              disabled={preview.sending || preview.textSent || preview.freezeText}
              onChange={(event) => controller.edit(event.target.value)}
            />
          </label>
        ) : null}
        {preview.textSent ? <p className="form-hint">{t("messageTranslation.textSent")}</p> : null}
        {preview.freezeText ? (
          <p className="form-hint">{t("messageTranslation.deliveryUncertain")}</p>
        ) : null}
        {preview.error ? (
          <TkAlert tone="danger" title={t("messageTranslation.failed")}>
            {preview.error}
          </TkAlert>
        ) : null}
        <div className="tk-v1-modal-actions">
          <TkButton disabled={preview.sending} variant="secondary" onClick={controller.close}>
            {t("common.cancel")}
          </TkButton>
          {!preview.loading && !preview.language ? (
            <TkButton variant="secondary" onClick={() => void controller.generate()}>
              {t("messageTranslation.retry")}
            </TkButton>
          ) : null}
          <TkButton
            variant="primary"
            disabled={preview.loading || !preview.text.trim()}
            loading={preview.sending}
            onClick={() => void controller.confirm()}
          >
            {t(preview.textSent ? "messageTranslation.retryRemaining" : "messageTranslation.send")}
          </TkButton>
        </div>
      </div>
    </TkModal>
  );
}
