import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { apolloClient } from "./api/client.js";
import { setAccessToken } from "./api/auth-session.js";
import {
  REQUEST_CAPTCHA,
  WEB_GOOGLE_LOGIN,
  WEB_LOGIN,
  WEB_REGISTER,
} from "./api/operations.js";
import { useExpertStore } from "./store/context.js";
import { errorMessage } from "./error.js";
import { BrandLogo } from "./BrandLogo.js";
import { LanguageSwitcher, useI18n } from "./i18n.js";
import { GoogleSignInButton } from "./GoogleSignInButton.js";

interface CaptchaData {
  requestCaptcha: { token: string; svg: string };
}

interface WebAuthData {
  webLogin?: { accessToken: string; user: { email: string } };
  webRegister?: { accessToken: string; user: { email: string } };
  webGoogleLogin?: { accessToken: string; user: { email: string } };
}

export interface GoogleAuthConfig {
  enabled: boolean;
  clientId: string;
}

interface AuthScreenProps {
  googleConfig?: GoogleAuthConfig;
  initialMode?: "login" | "register";
  onAuthenticated?: (payload: { accessToken: string; user: { email: string } }) => void;
}

function runtimeGoogleConfig(): GoogleAuthConfig {
  return {
    enabled: import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === "true",
    clientId: import.meta.env.VITE_GOOGLE_OAUTH_WEB_CLIENT_ID?.trim() ?? "",
  };
}

function graphQLErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    extensions?: { code?: unknown };
    errors?: unknown[];
    graphQLErrors?: unknown[];
  };
  if (typeof candidate.extensions?.code === "string") return candidate.extensions.code;
  for (const nested of candidate.errors ?? candidate.graphQLErrors ?? []) {
    const code = graphQLErrorCode(nested);
    if (code) return code;
  }
  return undefined;
}

export const AuthScreen = observer(function AuthScreen({
  googleConfig = runtimeGoogleConfig(),
  initialMode = "login",
  onAuthenticated,
}: AuthScreenProps) {
  const store = useExpertStore();
  const { language, t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [captcha, setCaptcha] = useState<CaptchaData["requestCaptcha"]>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingGoogleIdToken, setPendingGoogleIdToken] = useState<string>();
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const googleCredentialHandled = useRef(false);
  const googleEnabled = googleConfig.enabled && Boolean(googleConfig.clientId);
  const linkingGoogle = Boolean(pendingGoogleIdToken);

  const refreshCaptcha = useCallback(async () => {
    try {
      const result = await apolloClient.mutate<CaptchaData>({ mutation: REQUEST_CAPTCHA });
      if (result.data?.requestCaptcha) {
        setCaptcha(result.data.requestCaptcha);
        store.setError(undefined);
      }
    } catch (error) {
      setCaptcha(undefined);
      store.setError(`Unable to reach the Expert service. ${errorMessage(error)}`);
    }
  }, [store]);

  useEffect(() => {
    void refreshCaptcha();
  }, [refreshCaptcha]);

  const completeSignIn = useCallback(
    (payload: { accessToken: string; user: { email: string } }) => {
      setPendingGoogleIdToken(undefined);
      setAccessToken(payload.accessToken);
      store.signIn(payload.user.email);
      onAuthenticated?.(payload);
    },
    [onAuthenticated, store],
  );

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      if (googleCredentialHandled.current) return;
      googleCredentialHandled.current = true;
      setGoogleSubmitting(true);
      store.setError(undefined);
      try {
        const result = await apolloClient.mutate<WebAuthData>({
          mutation: WEB_GOOGLE_LOGIN,
          variables: { input: { idToken } },
        });
        const payload = result.data?.webGoogleLogin;
        if (!payload) throw new Error("Authentication did not return a session");
        completeSignIn(payload);
      } catch (error) {
        if (graphQLErrorCode(error) === "GOOGLE_ACCOUNT_LINK_REQUIRED") {
          setMode("login");
          setPendingGoogleIdToken(idToken);
          setPassword("");
          setCaptchaAnswer("");
          store.setError(undefined);
        } else {
          googleCredentialHandled.current = false;
          store.setError(t("auth.googleFailed"));
        }
      } finally {
        setGoogleSubmitting(false);
      }
    },
    [completeSignIn, store, t],
  );

  function clearPendingGoogleLink() {
    googleCredentialHandled.current = false;
    setPendingGoogleIdToken(undefined);
    setPassword("");
    setCaptchaAnswer("");
    store.setError(undefined);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!captcha) return;
    setSubmitting(true);
    store.setError(undefined);
    try {
      const input = linkingGoogle
        ? {
            idToken: pendingGoogleIdToken,
            link: {
              password,
              captchaToken: captcha.token,
              captchaAnswer: captchaAnswer.trim(),
            },
          }
        : {
            email: email.trim(),
            password,
            captchaToken: captcha.token,
            captchaAnswer: captchaAnswer.trim(),
            ...(mode === "register" && name.trim() ? { name: name.trim() } : {}),
          };
      const result = await apolloClient.mutate<WebAuthData>({
        mutation: linkingGoogle ? WEB_GOOGLE_LOGIN : mode === "login" ? WEB_LOGIN : WEB_REGISTER,
        variables: { input },
      });
      const payload =
        result.data?.webGoogleLogin ?? result.data?.webLogin ?? result.data?.webRegister;
      if (!payload) throw new Error("Authentication did not return a session");
      completeSignIn(payload);
    } catch (error) {
      const message = linkingGoogle ? t("auth.googleLinkFailed") : errorMessage(error);
      setCaptchaAnswer("");
      await refreshCaptcha();
      store.setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="auth-story-grid" aria-hidden="true" />
        <div className="auth-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="auth-brand-row">
          <BrandLogo />
          <span>{t("brand.expert")}</span>
        </div>
        <div className="auth-story-copy">
          <p className="eyebrow">{t("auth.kicker")}</p>
          <h1>{t("auth.title")}</h1>
          <p className="auth-lede">{t("auth.lede")}</p>
        </div>
        <div className="proof-row">
          {[
            t("auth.proof.updated"),
            t("auth.proof.personal"),
            t("auth.proof.operator"),
          ].map((label, index) => (
            <span key={label}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-toolbar">
          <span>{t("auth.kicker")}</span>
          <LanguageSwitcher />
        </div>
        <div className="auth-card">
          <header className="auth-card-header">
            <p className="eyebrow">
              {mode === "login" ? t("auth.welcome") : t("auth.createKicker")}
            </p>
            <h2>{mode === "login" ? t("auth.continue") : t("auth.meet")}</h2>
          </header>
          {googleEnabled && !linkingGoogle ? (
            <div className="google-auth-entry">
              <GoogleSignInButton
                clientId={googleConfig.clientId}
                language={language}
                disabled={googleSubmitting}
                loadingLabel={t("auth.googleLoading")}
                onCredential={(credential) => void handleGoogleCredential(credential)}
                onError={() => store.setError(t("auth.googleUnavailable"))}
              />
              <div className="auth-divider">
                <span>{t("auth.googleDivider")}</span>
              </div>
            </div>
          ) : null}
          {linkingGoogle ? (
            <div className="google-link-notice" role="status">
              <strong>{t("auth.googleLinkTitle")}</strong>
              <p>{t("auth.googleLinkBody")}</p>
              <button
                className="google-link-cancel"
                type="button"
                onClick={clearPendingGoogleLink}
              >
                {t("auth.googleLinkCancel")}
              </button>
            </div>
          ) : null}
          <form onSubmit={submit}>
            {mode === "register" && !linkingGoogle ? (
              <label>
                {t("auth.name")}
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
            ) : null}
            {!linkingGoogle ? (
              <label>
                {t("auth.email")}
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            ) : null}
            <label>
              {t("auth.password")}
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === "login" || linkingGoogle ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              {t("auth.verification")}
              <div className="captcha-row">
                <input
                  required
                  value={captchaAnswer}
                  onChange={(event) => setCaptchaAnswer(event.target.value)}
                  aria-label={t("auth.captcha")}
                />
                <button
                  className="captcha-image"
                  type="button"
                  onClick={() => void refreshCaptcha()}
                  aria-label={t("auth.captchaRefresh")}
                  dangerouslySetInnerHTML={{ __html: captcha?.svg ?? "" }}
                />
              </div>
            </label>
            {store.error ? <p className="form-error">{store.error}</p> : null}
            <button className="primary-button" disabled={submitting || !captcha} type="submit">
              {submitting
                ? t("auth.working")
                : linkingGoogle
                  ? t("auth.googleLinkSubmit")
                  : mode === "login"
                  ? t("auth.signIn")
                  : t("auth.create")}
            </button>
          </form>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              clearPendingGoogleLink();
              setMode(mode === "login" ? "register" : "login");
              store.setError(undefined);
            }}
          >
            {mode === "login" ? t("auth.toRegister") : t("auth.toLogin")}
          </button>
        </div>
      </section>
    </main>
  );
});
