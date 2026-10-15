import { useTranslation } from "react-i18next";
import { TkAlert, TkButton } from "../../../components/design-system/index.js";
import "./AffiliateMessageSendError.css";

export function AffiliateMessageSendError({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  // Match the Provider's actual error code, never a number inside a request ID
  // or an unrelated authorization error.
  const platformRestriction = /\bTikTok API error 16030101\s*:/.test(message);
  const key = "ecommerce.affiliateWorkspace.messageSendError";
  return (
    <TkAlert
      tone="danger"
      className="affiliate-message-send-error"
      title={t(`${key}.${platformRestriction ? "tiktokRestrictionTitle" : "title"}`)}
      actions={
        <TkButton size="sm" variant="ghost" onClick={onDismiss}>
          {t("common.close")}
        </TkButton>
      }
    >
      {platformRestriction ? (
        <>
          <div>{t(`${key}.tiktokRestrictionReason`)}</div>
          <div>{t(`${key}.tiktokRestrictionAction`)}</div>
          <details className="error-details">
            <summary>{t(`${key}.details`)}</summary>
            <code>{message}</code>
          </details>
        </>
      ) : (
        message
      )}
    </TkAlert>
  );
}
