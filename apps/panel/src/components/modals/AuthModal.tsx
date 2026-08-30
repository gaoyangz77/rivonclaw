import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { formatError } from "@rivonclaw/core";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { TkModal as Modal } from "../design-system/Overlays.js";
import { useToast } from "../Toast.js";
import { EyeIcon, EyeOffIcon, RefreshIcon } from "../icons.js";
import { EXTERNAL_LINKS } from "../../lib/external-links.js";
import { fetchJson } from "../../api/client.js";
import { TkAlert, TkTabs } from "../design-system/index.js";

/** Map known backend error messages to i18n keys. */
const AUTH_ERROR_MAP: Record<string, string> = {
  "Email already registered": "auth.errorEmailTaken",
  "Invalid email or password": "auth.errorInvalidCredentials",
  "Login failed": "auth.errorLoginFailed",
  "Registration failed": "auth.errorRegisterFailed",
  "Captcha expired or invalid": "auth.captchaExpired",
  "Incorrect captcha": "auth.captchaError",
  "Too many captcha attempts": "auth.captchaExpired",
  "Email not registered": "auth.errorEmailNotRegistered",
  "Invalid invite code": "auth.errorInvalidInviteCode",
};

/** Error messages that indicate the email is not registered — triggers auto-register. */
const AUTO_REGISTER_ERRORS = new Set([
  "Email not registered",
]);

function translateAuthError(err: unknown, t: TFunction): string {
  const raw = formatError(err);
  const key = AUTH_ERROR_MAP[raw];
  return key ? t(key) : t("auth.errorGeneric");
}

type GoogleAuthStatus =
  | "pending"
  | "link_required"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

interface GoogleAuthFlow {
  flowId: string;
  status: GoogleAuthStatus;
  errorCode?: string;
}

interface BrowserAuthFlow {
  flowId: string;
  status: "pending" | "completed" | "failed" | "cancelled" | "expired";
  errorCode?: string;
}

function translateGoogleError(error: unknown, t: TFunction): string {
  const code = (error as { code?: string; errorCode?: string } | null)?.code
    ?? (error as { errorCode?: string } | null)?.errorCode
    ?? formatError(error);
  if (code === "GOOGLE_AUTH_TIMEOUT") return t("auth.googleTimeout");
  if (code === "GOOGLE_AUTH_UNAVAILABLE") return t("auth.googleUnavailable");
  return t("auth.googleError");
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.91-2.258c-.805.54-1.835.86-3.046.86-2.344 0-4.328-1.585-5.037-3.714H.955v2.332A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.963 10.707A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.707V4.961H.955A9 9 0 0 0 0 9c0 1.452.347 2.827.955 4.039l3.008-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.322 0 2.508.454 3.441 1.346l2.582-2.582C13.463.892 11.426 0 9 0A9 9 0 0 0 .955 4.961l3.008 2.332C4.672 5.164 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

function BrowserMark() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.8 9h16.4M3.8 15h16.4M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "login" | "register";
  modeSwitch?: "tabs" | "inlineLink";
  /** Called after successful login/register (e.g. to navigate to a gated page). */
  onSuccess?: () => void;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "passwordTooShort";
  if (!/[A-Z]/.test(password)) return "passwordNeedsUpper";
  if (!/[a-z]/.test(password)) return "passwordNeedsLower";
  if (!/[0-9]/.test(password)) return "passwordNeedsNumber";
  return null;
}

/** Compute password strength checks for the strength indicator. */
function getPasswordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
  };
}

export function AuthModal({ isOpen, onClose, initialTab = "login", modeSwitch = "tabs", onSuccess }: AuthModalProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const login = entityStore.login;
  const register = entityStore.register;
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedUserAgreement, setAcceptedUserAgreement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleStarting, setGoogleStarting] = useState(false);
  const [googleFlow, setGoogleFlow] = useState<GoogleAuthFlow | null>(null);
  const [browserStarting, setBrowserStarting] = useState(false);
  const [browserFlow, setBrowserFlow] = useState<BrowserAuthFlow | null>(null);
  const googleFinishedRef = useRef(false);
  const googleStartInFlightRef = useRef(false);

  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [captchaError, setCaptchaError] = useState(false);

  const pwChecks = useMemo(() => getPasswordChecks(password), [password]);
  const pwStrength = useMemo(() => {
    const passed = Object.values(pwChecks).filter(Boolean).length;
    return passed; // 0-4
  }, [pwChecks]);
  const compactModeSwitch = modeSwitch === "inlineLink";
  const googlePending = googleFlow?.status === "pending";
  const browserPending = browserFlow?.status === "pending";
  const googleLinkRequired = googleFlow?.status === "link_required";
  const modalTitle = compactModeSwitch
    ? activeTab === "login"
      ? t("auth.loginAction")
      : t("auth.registerAction")
    : t("auth.title");

  const refreshCaptcha = useCallback(async () => {
    setCaptchaAnswer("");
    setCaptchaError(false);
    try {
      const data = await fetchJson<{ token: string; svg: string }>(clientPath(API["auth.requestCaptcha"]), {
        method: "POST",
      });
      if (data) {
        setCaptchaToken(data.token);
        setCaptchaSvg(data.svg);
      } else {
        setCaptchaError(true);
      }
    } catch {
      setCaptchaError(true);
    }
  }, []);

  const finishGoogleSuccess = useCallback(() => {
    if (googleFinishedRef.current) return;
    googleFinishedRef.current = true;
    showToast(t("auth.googleSuccess"));
    onClose();
    onSuccess?.();
  }, [onClose, onSuccess, showToast, t]);

  const cancelGoogleFlow = useCallback(async (flowId?: string) => {
    if (!flowId) return;
    await fetchJson<GoogleAuthFlow>(clientPath(API["auth.googleCancel"]), {
      method: "POST",
      body: JSON.stringify({ flowId }),
    }).catch(() => {});
  }, []);

  const startGoogleFlow = useCallback(async () => {
    if (googleStartInFlightRef.current) return;
    googleStartInFlightRef.current = true;
    setError(null);
    setGoogleStarting(true);
    googleFinishedRef.current = false;
    try {
      const flow = await fetchJson<GoogleAuthFlow>(clientPath(API["auth.googleStart"]), {
        method: "POST",
        body: JSON.stringify({
          inviteCode: activeTab === "register"
            ? inviteCode.trim().toUpperCase() || null
            : null,
        }),
      });
      setGoogleFlow(flow);
    } catch (googleError) {
      setGoogleFlow(null);
      setError(translateGoogleError(googleError, t));
    } finally {
      googleStartInFlightRef.current = false;
      setGoogleStarting(false);
    }
  }, [activeTab, inviteCode, t]);

  const retryGoogleFlow = useCallback(async () => {
    const previousFlowId = googleFlow?.flowId;
    setGoogleFlow(null);
    await cancelGoogleFlow(previousFlowId);
    await startGoogleFlow();
  }, [cancelGoogleFlow, googleFlow?.flowId, startGoogleFlow]);

  const cancelBrowserFlow = useCallback(async (flowId?: string) => {
    if (!flowId) return;
    await fetchJson<BrowserAuthFlow>(clientPath(API["auth.browserCancel"]), {
      method: "POST",
      body: JSON.stringify({ flowId }),
    }).catch(() => {});
  }, []);

  const startBrowserFlow = useCallback(async () => {
    setError(null);
    setBrowserStarting(true);
    try {
      const flow = await fetchJson<BrowserAuthFlow>(clientPath(API["auth.browserStart"]), {
        method: "POST",
        body: JSON.stringify({
          intent: activeTab === "register" ? "REGISTER" : "LOGIN",
        }),
      });
      setBrowserFlow(flow);
    } catch {
      setBrowserFlow(null);
      setError(t("auth.browserLoginError"));
    } finally {
      setBrowserStarting(false);
    }
  }, [activeTab, t]);

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      googleFinishedRef.current = false;
      refreshCaptcha();
      fetchJson<{ enabled: boolean }>(clientPath(API["auth.googleConfig"]))
        .then((config) => setGoogleEnabled(config.enabled))
        .catch(() => setGoogleEnabled(false));
    } else {
      setActiveTab("login");
      setEmail("");
      setPassword("");
      setInviteCode("");
      setShowPassword(false);
      setAcceptedUserAgreement(false);
      setError(null);
      setSubmitting(false);
      setCaptchaToken("");
      setCaptchaAnswer("");
      setCaptchaSvg("");
      setCaptchaError(false);
      setGoogleEnabled(false);
      setGoogleStarting(false);
      googleStartInFlightRef.current = false;
      setGoogleFlow(null);
      setBrowserStarting(false);
      setBrowserFlow(null);
    }
  }, [isOpen, initialTab, refreshCaptcha]);

  useEffect(() => {
    if (!isOpen || googleFlow?.status !== "pending") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const status = await fetchJson<GoogleAuthFlow>(
          `${clientPath(API["auth.googleStatus"])}?flowId=${encodeURIComponent(googleFlow.flowId)}`,
        );
        if (stopped) return;
        setGoogleFlow(status);
        if (status.status === "completed") {
          finishGoogleSuccess();
          return;
        }
        if (status.status === "link_required") {
          setPassword("");
          setShowPassword(false);
          await refreshCaptcha();
          return;
        }
        if (status.status === "failed" || status.status === "expired") {
          setError(translateGoogleError(status, t));
          return;
        }
      } catch (pollError) {
        if (!stopped) setError(translateGoogleError(pollError, t));
        return;
      }
      if (!stopped) timer = setTimeout(poll, 650);
    };
    timer = setTimeout(poll, 350);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [finishGoogleSuccess, googleFlow?.flowId, googleFlow?.status, isOpen, refreshCaptcha, t]);

  useEffect(() => {
    if (!isOpen || browserFlow?.status !== "pending") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const status = await fetchJson<BrowserAuthFlow>(
          `${clientPath(API["auth.browserStatus"])}?flowId=${encodeURIComponent(browserFlow.flowId)}`,
        );
        if (stopped) return;
        setBrowserFlow(status);
        if (status.status === "completed") {
          showToast(t("auth.browserLoginSuccess"));
          onClose();
          onSuccess?.();
          return;
        }
        if (status.status === "failed" || status.status === "expired") {
          setError(
            status.status === "expired"
              ? t("auth.browserLoginTimeout")
              : t("auth.browserLoginError"),
          );
          return;
        }
      } catch {
        if (!stopped) setError(t("auth.browserLoginError"));
        return;
      }
      if (!stopped) timer = setTimeout(poll, 650);
    };
    timer = setTimeout(poll, 350);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [browserFlow?.flowId, browserFlow?.status, isOpen, onClose, onSuccess, showToast, t]);

  // Clear errors when switching tabs, reset password visibility
  function switchTab(tab: "login" | "register") {
    setActiveTab(tab);
    setError(null);
    setShowPassword(false);
    setAcceptedUserAgreement(false);
  }

  function handleClose() {
    void cancelGoogleFlow(googleFlow?.flowId);
    void cancelBrowserFlow(browserFlow?.flowId);
    onClose();
  }

  async function handleGoogleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!googleFlow || googleFlow.status !== "link_required") return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await fetchJson<GoogleAuthFlow>(clientPath(API["auth.googleLink"]), {
        method: "POST",
        body: JSON.stringify({
          flowId: googleFlow.flowId,
          password,
          captchaToken,
          captchaAnswer,
        }),
      });
      setGoogleFlow(result);
      if (result.status === "completed") finishGoogleSuccess();
    } catch (linkError) {
      setError(translateGoogleError(linkError, t));
      await refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (activeTab === "register") {
      if (!acceptedUserAgreement) {
        setError(t("auth.errorUserAgreementRequired"));
        return;
      }
      const pwError = validatePassword(password);
      if (pwError) {
        setError(t(`auth.${pwError}`));
        return;
      }
    }

    setSubmitting(true);
    try {
      if (activeTab === "login") {
        try {
          await login({ email, password, captchaToken, captchaAnswer });
          showToast(t("auth.loginSuccess"));
        } catch (loginErr) {
          const raw = formatError(loginErr);
          // Auto-register: if login fails because account doesn't exist,
          // switch to register tab and prompt user to submit again
          if (AUTO_REGISTER_ERRORS.has(raw)) {
            setActiveTab("register");
            setError(t("auth.autoRegisterNotice"));
            refreshCaptcha();
            setSubmitting(false);
            return;
          }
          throw loginErr;
        }
      } else {
        const normalizedInviteCode = inviteCode.trim().toUpperCase();
        await register({
          email,
          password,
          name: null,
          captchaToken,
          captchaAnswer,
          inviteCode: normalizedInviteCode || null,
        });
        showToast(t("auth.registerSuccess"));
      }
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(translateAuthError(err, t));
      refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} maxWidth={400}>
      <div className="auth-modal-form">
        <p className="auth-subtitle">
          {googleLinkRequired
            ? t("auth.googleLinkDescription")
            : activeTab === "login"
              ? t("auth.subtitle")
              : t("auth.subtitleRegister")}
        </p>

        {!googlePending && !browserPending && !googleLinkRequired && (compactModeSwitch ? (
          <p className="auth-inline-switch">
            <span>
              {activeTab === "login" ? t("auth.switchToRegisterPrompt") : t("auth.switchToLoginPrompt")}
            </span>
            <button
              type="button"
              className="auth-inline-switch-btn"
              onClick={() => switchTab(activeTab === "login" ? "register" : "login")}
            >
              {activeTab === "login" ? t("auth.register") : t("auth.login")}
            </button>
          </p>
        ) : (
          <TkTabs
            items={[
              { id: "login", label: t("auth.login") },
              { id: "register", label: t("auth.register") },
            ]}
            value={activeTab}
            onChange={(value) => switchTab(value as "login" | "register")}
            label={modalTitle}
          />
        ))}

        {error && <TkAlert tone="danger">{error}</TkAlert>}

        {browserPending ? (
          <div className="google-auth-waiting" role="status" aria-live="polite">
            <div className="google-auth-orbit">
              <BrowserMark />
            </div>
            <strong>{t("auth.browserLoginWaiting")}</strong>
            <p>{t("auth.browserLoginWaitingHint")}</p>
            <div className="google-auth-waiting-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  void cancelBrowserFlow(browserFlow.flowId).then(() => setBrowserFlow(null))
                }
              >
                {t("auth.googleCancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  void cancelBrowserFlow(browserFlow.flowId).then(() => {
                    setBrowserFlow(null);
                    void startBrowserFlow();
                  })
                }
              >
                {t("auth.googleRetry")}
              </button>
            </div>
          </div>
        ) : googlePending ? (
          <div className="google-auth-waiting" role="status" aria-live="polite">
            <div className="google-auth-orbit">
              <GoogleMark />
            </div>
            <strong>{t("auth.googleWaiting")}</strong>
            <p>{t("auth.googleWaitingHint")}</p>
            <div className="google-auth-waiting-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void cancelGoogleFlow(googleFlow.flowId).then(() => setGoogleFlow(null))}>
                {t("auth.googleCancel")}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void retryGoogleFlow()}>
                {t("auth.googleRetry")}
              </button>
            </div>
          </div>
        ) : googleLinkRequired ? (
          <form onSubmit={handleGoogleLink} className="auth-form google-link-form">
            <div className="google-link-heading">
              <GoogleMark />
              <strong>{t("auth.googleLinkTitle")}</strong>
            </div>
            <div className="auth-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={72}
                autoComplete="current-password"
                className="auth-input auth-input--has-toggle"
                aria-label={t("auth.password")}
                placeholder={t("auth.password")}
              />
              <button
                type="button"
                className="auth-pw-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={t("auth.showPassword")}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <div className="captcha-row">
              <div className="captcha-row-input">
                <input
                  type="text"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  required
                  maxLength={4}
                  placeholder={t("auth.captchaPlaceholder")}
                  className="auth-input"
                  autoComplete="off"
                />
              </div>
              <div className="captcha-row-image">
                {captchaSvg ? (
                  <div className="captcha-svg" dangerouslySetInnerHTML={{ __html: captchaSvg }} />
                ) : (
                  <div className="captcha-svg captcha-placeholder" onClick={refreshCaptcha}>
                    {captchaError ? "!" : "..."}
                  </div>
                )}
                <button type="button" className="captcha-row-refresh" onClick={refreshCaptcha} aria-label={t("auth.captchaRefresh")}>
                  <RefreshIcon />
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={submitting}>
              {submitting ? t("common.loading") : t("auth.googleLinkAction")}
            </button>
            <button type="button" className="google-link-cancel" onClick={() => void cancelGoogleFlow(googleFlow.flowId).then(() => setGoogleFlow(null))}>
              {t("auth.googleCancel")}
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              className="google-auth-button"
              onClick={() => void startBrowserFlow()}
              disabled={browserStarting}
            >
              <span className="google-auth-mark"><BrowserMark /></span>
              <span>
                {browserStarting
                  ? t("auth.browserLoginOpening")
                  : activeTab === "register"
                    ? t("auth.browserRegisterContinue")
                    : t("auth.browserLoginContinue")}
              </span>
            </button>
            <div className="google-auth-divider">
              <span>{t("auth.browserLoginDivider")}</span>
            </div>
            {googleEnabled && (
              <>
                <button
                  type="button"
                  className="google-auth-button"
                  onClick={() => void startGoogleFlow()}
                  disabled={googleStarting}
                >
                  <span className="google-auth-mark"><GoogleMark /></span>
                  <span>{googleStarting ? t("auth.googleOpeningBrowser") : t("auth.googleContinue")}</span>
                </button>
                <div className="google-auth-divider">
                  <span>{t("auth.googleDivider")}</span>
                </div>
              </>
            )}
            <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-label-block">
            {t("auth.email")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              autoComplete="email"
              className="auth-input"
            />
          </label>

          <div className="auth-password-field">
            <div className="auth-password-header">
              <span className="form-label-block">{t("auth.password")}</span>
              {activeTab === "login" && (
                <button type="button" className="auth-forgot-link" tabIndex={-1} onClick={() => showToast(t("auth.forgotPasswordHint"))}>
                  {t("auth.forgotPassword")}
                </button>
              )}
            </div>
            <div className="auth-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={72}
                autoComplete={activeTab === "login" ? "current-password" : "new-password"}
                className="auth-input auth-input--has-toggle"
              />
              <button
                type="button"
                className="auth-pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={t("auth.showPassword")}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {activeTab === "register" && password.length > 0 && (
              <div className="auth-strength">
                <div className="auth-strength-bar">
                  <div
                    className={`auth-strength-fill auth-strength--${pwStrength <= 1 ? "weak" : pwStrength <= 2 ? "fair" : pwStrength <= 3 ? "good" : "strong"}`}
                    style={{ width: `${(pwStrength / 4) * 100}%` }}
                  />
                </div>
                <span className={`auth-strength-label auth-strength--${pwStrength <= 1 ? "weak" : pwStrength <= 2 ? "fair" : pwStrength <= 3 ? "good" : "strong"}`}>
                  {t(`auth.strength${pwStrength <= 1 ? "Weak" : pwStrength <= 2 ? "Fair" : pwStrength <= 3 ? "Good" : "Strong"}`)}
                </span>
              </div>
            )}
          </div>

          {activeTab === "register" && (
            <label className="form-label-block">
              {t("auth.inviteCode")}
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                maxLength={6}
                autoComplete="off"
                placeholder={t("auth.inviteCodePlaceholder")}
                className="auth-input auth-input-code"
              />
              <span className="form-hint">{t("auth.inviteCodeHint")}</span>
            </label>
          )}

          <div className="captcha-row">
            <div className="captcha-row-input">
              <input
                type="text"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                required
                maxLength={4}
                placeholder={t("auth.captchaPlaceholder")}
                className="auth-input"
                autoComplete="off"
              />
            </div>
            <div className="captcha-row-image">
              {captchaSvg ? (
                <div className="captcha-svg" dangerouslySetInnerHTML={{ __html: captchaSvg }} />
              ) : (
                <div className="captcha-svg captcha-placeholder" onClick={refreshCaptcha}>
                  {captchaError ? "!" : "..."}
                </div>
              )}
              <button type="button" className="captcha-row-refresh" onClick={refreshCaptcha} aria-label={t("auth.captchaRefresh")}>
                <RefreshIcon />
              </button>
            </div>
          </div>

          {activeTab === "register" && (
            <label className="auth-agreement-checkbox">
              <input
                type="checkbox"
                checked={acceptedUserAgreement}
                onChange={(e) => setAcceptedUserAgreement(e.target.checked)}
                required
              />
              <span>
                {t("auth.agreeUserAgreementPrefix")}
                <a href={EXTERNAL_LINKS.termsOfService} target="_blank" rel="noopener noreferrer" className="auth-terms-link">
                  {t("auth.userAgreement")}
                </a>
                {t("auth.agreeUserAgreementSuffix")}
              </span>
            </label>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : activeTab === "login"
                ? t("auth.loginAction")
                : t("auth.registerAction")}
          </button>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}
