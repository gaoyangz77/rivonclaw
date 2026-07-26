import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { apolloClient } from "./api/client.js";
import { setAccessToken } from "./api/auth-session.js";
import { REQUEST_CAPTCHA, WEB_LOGIN, WEB_REGISTER } from "./api/operations.js";
import { useExpertStore } from "./store/context.js";
import { errorMessage } from "./error.js";

interface CaptchaData {
  requestCaptcha: { token: string; svg: string };
}

interface WebAuthData {
  webLogin?: { accessToken: string; user: { email: string } };
  webRegister?: { accessToken: string; user: { email: string } };
}

export const AuthScreen = observer(function AuthScreen() {
  const store = useExpertStore();
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
        <div className="brand-mark">R</div>
        <p className="eyebrow">RivonClaw Expert</p>
        <h1>Enter TikTok Shop with a point of view.</h1>
        <p className="auth-lede">
          A living industry expert that turns policy, market signals, and operator experience into
          the next decision for your business.
        </p>
        <div className="proof-row">
          <span>Continuously updated</span>
          <span>Personalized reasoning</span>
          <span>Operator-first advice</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{mode === "login" ? "Welcome back" : "Create your account"}</p>
          <h2>{mode === "login" ? "Continue your work" : "Meet your TikTok Shop expert"}</h2>
          <form onSubmit={submit}>
            {mode === "register" ? (
              <label>
                Name
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
            ) : null}
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
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
              Verification
              <div className="captcha-row">
                <input
                  required
                  value={captchaAnswer}
                  onChange={(event) => setCaptchaAnswer(event.target.value)}
                  aria-label="Captcha answer"
                />
                <button
                  className="captcha-image"
                  type="button"
                  onClick={() => void refreshCaptcha()}
                  aria-label="Load another verification image"
                  dangerouslySetInnerHTML={{ __html: captcha?.svg ?? "" }}
                />
              </div>
            </label>
            {store.error ? <p className="form-error">{store.error}</p> : null}
            <button className="primary-button" disabled={submitting || !captcha} type="submit">
              {submitting ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
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
            {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
});
