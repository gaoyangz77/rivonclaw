import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { startQrLogin, waitQrLogin, updateChannelAccount } from "../../api/channels.js";
import { Modal } from "./Modal.js";

type QrLoginPhase = "loading" | "scanning" | "success" | "error";

/** Per-poll server-side timeout. The desktop route sets RPC timeout = this + 15s headroom. */
const POLL_TIMEOUT_MS = 60_000;
/** Total QR session lifetime. After this the QR is considered expired. */
const SESSION_TIMEOUT_MS = 5 * 60_000;

interface QrLoginModalProps {
  channelId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function QrLoginModal({ channelId, onClose, onSuccess }: QrLoginModalProps) {
  const { t } = useTranslation();

  const [phase, setPhase] = useState<QrLoginPhase>("loading");
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const startLogin = useCallback(async () => {
    abortRef.current = false;
    setPhase("loading");
    setErrorMessage(null);
    setQrImageUrl(null);

    try {
      const res = await startQrLogin();
      if (abortRef.current) return;

      if (!res.qrDataUrl) {
        setErrorMessage(res.message || t("qrLogin.gatewayUnavailable"));
        setPhase("error");
        return;
      }

      const qrData = await QRCode.toDataURL(res.qrDataUrl, {
        margin: 1,
        width: 250,
        color: { dark: "#000000FF", light: "#FFFFFFFF" },
      });
      if (abortRef.current) return;

      setQrImageUrl(qrData);
      setPhase("scanning");

      // Start long-polling for scan confirmation with session timeout
      const deadline = Date.now() + SESSION_TIMEOUT_MS;
      while (!abortRef.current && Date.now() < deadline) {
        try {
          const result = await waitQrLogin(undefined, POLL_TIMEOUT_MS);
          if (abortRef.current) break;

          if (result.connected) {
            // Set accountId as initial display name so the row isn't blank
            if (result.accountId) {
              updateChannelAccount(channelId, result.accountId, {
                name: result.accountId,
                config: {},
              }).catch(() => { /* best-effort */ });
            }
            setPhase("success");
            // Brief delay so user sees the success message
            setTimeout(() => {
              if (!abortRef.current) {
                onSuccessRef.current();
                onCloseRef.current();
              }
            }, 1200);
            return;
          }
          // Not connected yet -- continue polling
        } catch {
          // Poll timeout or transient error -- continue polling until session deadline
        }
      }
      // Session timed out — QR expired
      if (!abortRef.current) {
        setErrorMessage(t("qrLogin.expired"));
        setPhase("error");
      }
    } catch (err: any) {
      if (!abortRef.current) {
        setErrorMessage(err.message || t("qrLogin.failed"));
        setPhase("error");
      }
    }
  }, [t]);

  useEffect(() => {
    startLogin();
    return () => {
      abortRef.current = true;
    };
  }, [startLogin]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("qrLogin.title")}
      maxWidth={420}
    >
      <div className="modal-form-col">
        {errorMessage && <div className="modal-error-box">{errorMessage}</div>}

        <div className="qr-login-body">
          {phase === "loading" && (
            <p className="centered-muted">{t("qrLogin.generating")}</p>
          )}

          {phase === "scanning" && qrImageUrl && (
            <div className="qr-login-scan-view">
              <div className="badge badge-warning">{t("qrLogin.waiting")}</div>
              <p className="qr-login-hint">{t("qrLogin.scanPrompt")}</p>
              <div className="mobile-qr-container">
                <img src={qrImageUrl} alt="WeChat QR Code" width={250} height={250} />
              </div>
            </div>
          )}

          {phase === "success" && (
            <div className="qr-login-scan-view">
              <div className="badge badge-success">{t("qrLogin.success")}</div>
            </div>
          )}

          {phase === "error" && (
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={startLogin}>
                {t("qrLogin.retry")}
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                {t("common.close")}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
