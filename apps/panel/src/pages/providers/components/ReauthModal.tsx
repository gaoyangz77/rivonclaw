import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { Modal } from "../../../components/modals/Modal.js";
import { useEntityStore } from "../../../store/index.js";
import { useToast } from "../../../components/Toast.js";

/**
 * Re-authenticate an existing OAuth subscription key (Codex / Gemini).
 *
 * Reuses the panel's existing OAuth flow primitives on `entityStore`:
 *   1. `startOAuthFlow(provider)` — opens the browser, returns `{ flowId, authUrl }`
 *      and registers a pending flow on Desktop.
 *   2. Either the auto-callback completes (polled via `pollOAuthStatus`) OR the
 *      user pastes the redirect URL and we call `completeManualOAuth`.
 *   3. When a token is ready, the user clicks "Confirm" which calls the key's
 *      `reauth()` MST action → Desktop rotates the stored credential in place
 *      and pushes the updated row back via SSE.
 *
 * Unlike the initial-setup OAuthProviderForm, this modal intentionally omits
 * label/model/proxy inputs — those are preserved from the existing row.
 */
interface ReauthModalProps {
  keyId: string | null;
  onClose: () => void;
}

export const ReauthModal = observer(function ReauthModal({ keyId, onClose }: ReauthModalProps) {
  const { t } = useTranslation();
  const store = useEntityStore();
  const { showToast } = useToast();
  const key = keyId ? store.providerKeys.find((k) => k.id === keyId) : null;

  const [starting, setStarting] = useState(false);
  const [authUrl, setAuthUrl] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [tokenReady, setTokenReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset all local state on open/close or key change
  useEffect(() => {
    if (!keyId) return;
    setStarting(false);
    setAuthUrl("");
    setCallbackUrl("");
    setTokenReady(false);
    setSubmitting(false);
    setManualLoading(false);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function handleStartOAuth() {
    if (!key) return;
    setStarting(true);
    try {
      const result = await store.startOAuthFlow(key.provider);
      setAuthUrl(result.authUrl || "");
      if (result.flowId) {
        // Poll for auto-callback completion (browser auto-callback server may
        // succeed before the user pastes the URL back)
        pollRef.current = setInterval(async () => {
          try {
            const status = await store.pollOAuthStatus(result.flowId!);
            if (status.status === "completed") {
              stopPolling();
              setTokenReady(true);
            } else if (status.status === "failed") {
              stopPolling();
              // Manual path still works — leave tokenReady false
            }
          } catch {
            // Transient poll error — keep trying
          }
        }, 2000);
      }
    } catch (err) {
      showToast(t("providers.oauthFailed") + String(err), "error");
    } finally {
      setStarting(false);
    }
  }

  async function handleManualComplete() {
    if (!key || !callbackUrl.trim()) return;
    stopPolling();
    setManualLoading(true);
    try {
      await store.completeManualOAuth(key.provider, callbackUrl.trim());
      setTokenReady(true);
    } catch (err) {
      showToast(t("providers.oauthFailed") + String(err), "error");
    } finally {
      setManualLoading(false);
    }
  }

  async function handleConfirm() {
    if (!key) return;
    setSubmitting(true);
    try {
      const result = await key.reauth();
      showToast(t("common.saved"), "success");
      // Narrow warning: the id_token capture step failed, so OAuth state MAY
      // be server-side-rotated past our last successful read. The key likely
      // still works, but if the next LLM call 401s, the user should Re-auth
      // again. We surface this with a longer-duration warning toast so they
      // actually read it.
      if (result?.idTokenCaptureFailed) {
        showToast(t("providers.reauthModal.captureWarning"), "warning");
      }
      onClose();
    } catch (err) {
      showToast(t("providers.failedToSave") + String(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    stopPolling();
    onClose();
  }

  const isOpen = keyId !== null && !!key;

  // Tolerate missing i18n keys for unexpected providers (TypeScript doesn't
  // enforce provider ∈ {codex, gemini} here; the endpoint does).
  const signInLabel = key
    ? t(`providers.reauthModal.signIn_${key.provider}`, { defaultValue: t("providers.reauthenticate") })
    : "";
  const callbackHelp = key
    ? t(`providers.reauthModal.callbackHelp_${key.provider}`, { defaultValue: "" })
    : "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("providers.reauthModal.title", { label: key?.label ?? "" })}
      maxWidth={520}
    >
      <div className="form-help-sm mb-sm">{t("providers.reauthModal.intro")}</div>

      {!authUrl && !tokenReady && (
        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleStartOAuth}
            disabled={starting}
          >
            {starting ? t("providers.reauthModal.starting") : signInLabel}
          </button>
          <button className="btn btn-secondary" onClick={handleClose}>
            {t("providers.reauthModal.cancel")}
          </button>
        </div>
      )}

      {authUrl && !tokenReady && (
        <div className="mb-sm">
          <p className="form-help oauth-waiting">
            {t("providers.reauthModal.waitingForBrowser")}
          </p>
          <div className="mb-sm">
            <div className="form-label text-secondary">
              {t("providers.reauthModal.authUrlLabel")}
            </div>
            <div className="oauth-manual-url-row">
              <input
                type="text"
                readOnly
                value={authUrl}
                className="input-full input-mono input-readonly"
              />
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => navigator.clipboard.writeText(authUrl)}
              >
                {t("common.copy")}
              </button>
            </div>
          </div>
          <div className="mb-sm">
            <div className="form-label text-secondary">
              {t("providers.reauthModal.callbackLabel")}
            </div>
            <input
              type="text"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder={t("providers.reauthModal.callbackPlaceholder")}
              className="input-full input-mono"
            />
            {callbackHelp && (
              <small className="form-help-sm">{callbackHelp}</small>
            )}
          </div>
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleManualComplete}
              disabled={manualLoading || !callbackUrl.trim()}
            >
              {manualLoading ? t("providers.oauthLoading") : t("providers.reauthModal.completeSignIn")}
            </button>
            <button className="btn btn-secondary" onClick={handleClose}>
              {t("providers.reauthModal.cancel")}
            </button>
          </div>
        </div>
      )}

      {tokenReady && (
        <div className="mb-sm">
          <div className="info-box info-box-green">
            {t("providers.reauthModal.tokenReady")}
          </div>
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? t("providers.reauthModal.rotating") : t("providers.reauthModal.confirm")}
            </button>
            <button className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
              {t("providers.reauthModal.cancel")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
});
