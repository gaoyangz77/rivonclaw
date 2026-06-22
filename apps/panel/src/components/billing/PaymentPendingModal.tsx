import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { Modal } from "../modals/Modal.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { billingEnumLabel } from "./billing-labels.js";

interface PaymentPendingModalProps {
  paymentId: string | null;
  onClose: () => void;
  onSuccessComplete?: () => void;
}

function paymentBadgeClass(status: string): string {
  if (status === "SUCCEEDED") return "badge badge-success";
  if (status === "PENDING" || status === "REQUIRES_PAYMENT") return "badge badge-warning";
  if (status === "FAILED" || status === "CANCELED") return "badge badge-danger";
  return "badge badge-muted";
}

export const PaymentPendingModal = observer(function PaymentPendingModal({
  paymentId,
  onClose,
  onSuccessComplete,
}: PaymentPendingModalProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [autoCloseSeconds, setAutoCloseSeconds] = useState<number | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);
  const finalizedPaymentIdRef = useRef<string | null>(null);
  const successClosedPaymentIdRef = useRef<string | null>(null);
  const autoCloseTimerRef = useRef<number | null>(null);
  const autoCloseIntervalRef = useRef<number | null>(null);

  const payment = paymentId && entityStore.activeCheckout?.id === paymentId
    ? entityStore.activeCheckout
    : null;
  const qrSource = payment?.qrCode ?? null;
  const billingScopeId = payment?.billingScopeId ?? null;
  const provider = payment?.provider ?? null;
  const status = payment?.status ?? null;
  const subject = payment?.subject ?? "";
  const isLakala = provider === "LAKALA";
  const isStripe = provider === "STRIPE";
  const succeeded = status === "SUCCEEDED";
  const pollable = status === "PENDING" || status === "REQUIRES_PAYMENT";
  const checkoutError = entityStore.checkoutError;

  useEffect(() => {
    if (autoCloseTimerRef.current !== null) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    pollStartedAtRef.current = paymentId ? Date.now() : null;
    finalizedPaymentIdRef.current = null;
    successClosedPaymentIdRef.current = null;
    setFinalizing(false);
    setAutoCloseSeconds(null);
  }, [paymentId]);

  useEffect(() => () => {
    if (autoCloseTimerRef.current !== null) {
      window.clearTimeout(autoCloseTimerRef.current);
    }
    if (autoCloseIntervalRef.current !== null) {
      window.clearInterval(autoCloseIntervalRef.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(null);
    if (!isLakala || !qrSource) return;
    QRCode.toDataURL(qrSource, { width: 260, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isLakala, qrSource]);

  const closeModal = useCallback(() => {
    if (autoCloseTimerRef.current !== null) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    if (autoCloseIntervalRef.current !== null) {
      window.clearInterval(autoCloseIntervalRef.current);
      autoCloseIntervalRef.current = null;
    }
    setFinalizing(false);
    setAutoCloseSeconds(null);
    onClose();
    if (succeeded && paymentId && successClosedPaymentIdRef.current !== paymentId) {
      successClosedPaymentIdRef.current = paymentId;
      onSuccessComplete?.();
    }
  }, [onClose, onSuccessComplete, paymentId, succeeded]);

  const finalizeSuccess = useCallback(async () => {
    if (!paymentId || finalizedPaymentIdRef.current === paymentId) return;
    finalizedPaymentIdRef.current = paymentId;
    setFinalizing(true);
    setAutoCloseSeconds(5);
    if (autoCloseIntervalRef.current !== null) {
      window.clearInterval(autoCloseIntervalRef.current);
    }
    autoCloseIntervalRef.current = window.setInterval(() => {
      setAutoCloseSeconds((seconds) => {
        if (seconds === null) return seconds;
        return Math.max(0, seconds - 1);
      });
    }, 1000);
    try {
      await entityStore.refreshBillingAfterPayment();
    } finally {
      autoCloseTimerRef.current = window.setTimeout(() => {
        closeModal();
      }, 5000);
    }
  }, [closeModal, entityStore, paymentId]);

  useEffect(() => {
    if (succeeded) {
      finalizeSuccess().catch(() => {});
    }
  }, [finalizeSuccess, succeeded]);

  useEffect(() => {
    if (!paymentId || (!isLakala && !isStripe) || !pollable || succeeded) return;
    if (!pollStartedAtRef.current) pollStartedAtRef.current = Date.now();
    const timer = window.setInterval(() => {
      const startedAt = pollStartedAtRef.current ?? Date.now();
      if (Date.now() - startedAt > 5 * 60 * 1000) {
        window.clearInterval(timer);
        entityStore.setCheckoutError(t("billing.errors.pollingExpired"), billingScopeId);
        return;
      }
      entityStore.refreshPayment(paymentId)
        .then((updated) => {
          if (updated?.status === "SUCCEEDED") {
            return finalizeSuccess();
          }
          return undefined;
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(timer);
  }, [billingScopeId, entityStore, finalizeSuccess, isLakala, isStripe, paymentId, pollable, succeeded, t]);

  return (
    <Modal
      isOpen={payment !== null}
      onClose={closeModal}
      title={t("billing.paymentPending.title")}
      maxWidth={520}
    >
      {payment && (
        <div className="payment-pending-body">
          <div className="payment-pending-summary">
            <span className={paymentBadgeClass(status ?? "")}>
              {billingEnumLabel(t, "paymentStatus", status)}
            </span>
            <span>{subject}</span>
          </div>

          {isStripe && (
            <div className="payment-pending-copy">
              {t("billing.paymentPending.stripeHelp")}
            </div>
          )}

          {isLakala && (
            <div className="payment-qr-wrap">
              {qrDataUrl ? (
                <img className="payment-qr-image" src={qrDataUrl} alt={t("billing.paymentPending.qrAlt")} />
              ) : qrSource ? (
                <div className="payment-qr-placeholder">{t("common.loading")}</div>
              ) : (
                <div className="payment-qr-placeholder">{t("billing.paymentPending.qrUnavailable")}</div>
              )}
              {!qrSource && (
                <div className="modal-error-box">{t("billing.errors.missingQrCode")}</div>
              )}
              <div className="payment-pending-copy">{t("billing.paymentPending.lakalaHelp")}</div>
            </div>
          )}

          {checkoutError && (
            <div className="modal-error-box">{t("billing.errors.checkoutFailed", { message: checkoutError })}</div>
          )}

          {succeeded && (
            <div className="payment-success-box">
              <strong>{t("billing.paymentPending.success")}</strong>
              <span>
                {finalizing
                  ? t("billing.paymentPending.successCountdown", { count: autoCloseSeconds ?? 5 })
                  : t("billing.paymentPending.successClosing")}
              </span>
            </div>
          )}

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={closeModal}>
              {t("common.close")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
});
