import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { apolloClient } from "./api/client.js";
import { setAccessToken } from "./api/auth-session.js";
import { REQUEST_CAPTCHA, WEB_LOGIN, WEB_REGISTER } from "./api/operations.js";
import { useExpertStore } from "./store/context.js";
import { errorMessage } from "./error.js";
import { BrandLogo } from "./BrandLogo.js";
import { LanguageSwitcher, useI18n } from "./i18n.js";

interface CaptchaData {
  requestCaptcha: { token: string; svg: string };
}

interface WebAuthData {
  webLogin?: { accessToken: string; user: { email: string } };
  webRegister?: { accessToken: string; user: { email: string } };
}

export const AuthScreen = observer(function AuthScreen() {
  const store = useExpertStore();
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [captcha, setCaptcha] = useState<CaptchaData["requestCaptcha"]>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!captcha) return;
    setSubmitting(true);
    store.setError(undefined);
    try {
      const input = {
        email: email.trim(),
        password,
        captchaToken: captcha.token,
        captchaAnswer: captchaAnswer.trim(),
        ...(mode === "register" && name.trim() ? { name: name.trim() } : {}),
      };
      const result = await apolloClient.mutate<WebAuthData>({
        mutation: mode === "login" ? WEB_LOGIN : WEB_REGISTER,
        variables: { input },
      });
      const payload = result.data?.webLogin ?? result.data?.webRegister;
      if (!payload) throw new Error("Authentication did not return a session");
      setAccessToken(payload.accessToken);
      store.signIn(payload.user.email);
    } catch (error) {
      store.setError(errorMessage(error));
      setCaptchaAnswer("");
      await refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="auth-brand-row">
          <BrandLogo />
          <LanguageSwitcher compact />
        </div>
        <p className="eyebrow">{t("auth.kicker")}</p>
        <h1>{t("auth.title")}</h1>
        <p className="auth-lede">{t("auth.lede")}</p>
        <div className="proof-row">
          <span>{t("auth.proof.updated")}</span>
          <span>{t("auth.proof.personal")}</span>
          <span>{t("auth.proof.operator")}</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">
            {mode === "login" ? t("auth.welcome") : t("auth.createKicker")}
          </p>
          <h2>{mode === "login" ? t("auth.continue") : t("auth.meet")}</h2>
          <form onSubmit={submit}>
            {mode === "register" ? (
              <label>
                {t("auth.name")}
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
            ) : null}
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
            <label>
              {t("auth.password")}
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
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
                : mode === "login"
                  ? t("auth.signIn")
                  : t("auth.create")}
            </button>
          </form>
          <button
            className="text-button"
            type="button"
            onClick={() => {
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
