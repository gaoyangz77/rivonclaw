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
  const restriction = tiktokRestriction(message);
  const key = "ecommerce.affiliateWorkspace.messageSendError";
  return (
    <TkAlert
      tone="danger"
      className="affiliate-message-send-error"
      title={t(`${key}.${restriction ? `${restriction}Title` : "title"}`)}
      actions={
        <TkButton size="sm" variant="ghost" onClick={onDismiss}>
          {t("common.close")}
        </TkButton>
      }
    >
      {restriction ? (
        <>
          <div>{t(`${key}.${restriction}Reason`)}</div>
          <div>{t(`${key}.${restriction}Action`)}</div>
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

type TikTokRestriction = "tiktokRestriction" | "unconnectedCreator";

// Match the Provider's actual error code, never a number inside a request ID
// or an unrelated authorization error. 16032001 is TikTok's generic
// precondition code (invalid creator status, region mismatch, ...), so the
// unconnected-creator limit is recognized only together with its own wording.
function tiktokRestriction(message: string): TikTokRestriction | null {
  if (/\bTikTok API error 16030101\s*:/.test(message)) return "tiktokRestriction";
  if (/\bTikTok API error 16032001\s*:.*\bunconnected creator\b/s.test(message)) {
    return "unconnectedCreator";
  }
  return null;
}
