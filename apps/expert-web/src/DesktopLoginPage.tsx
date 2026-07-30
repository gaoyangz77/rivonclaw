import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { apolloClient } from "./api/client.js";
import { setAccessToken } from "./api/auth-session.js";
import {
  APPROVE_BROWSER_TO_DESKTOP_LOGIN,
  BROWSER_TO_DESKTOP_LOGIN_ATTEMPT,
  WEB_REFRESH,
} from "./api/operations.js";
import { AuthScreen } from "./AuthScreen.js";
import { BrandLogo } from "./BrandLogo.js";
import { useExpertStore } from "./store/context.js";

interface Attempt {
  status: string;
  deviceName: string;
  expiresAt: string;
}

export const DesktopLoginPage = observer(function DesktopLoginPage() {
  const store = useExpertStore();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [ticket] = useState(() => params.get("ticket") ?? "");
  const [attempt, setAttempt] = useState<Attempt>();
  const [ready, setReady] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    window.history.replaceState({}, "", window.location.pathname);
    void (async () => {
      if (!ticket) {
        setError("This desktop login link is incomplete.");
        setReady(true);
        return;
      }
      try {
        const attemptResult = await apolloClient.query<{
          browserToDesktopLoginAttempt: Attempt;
        }>({
          query: BROWSER_TO_DESKTOP_LOGIN_ATTEMPT,
          variables: { ticket },
          fetchPolicy: "network-only",
        });
        setAttempt(attemptResult.data?.browserToDesktopLoginAttempt);
      } catch {
        setError("This desktop login request has expired or was already used.");
        setReady(true);
        return;
      }
      try {
        const refresh = await apolloClient.mutate<{
          webRefresh?: { accessToken: string; user: { email: string } };
        }>({ mutation: WEB_REFRESH });
        const payload = refresh.data?.webRefresh;
        if (!payload) throw new Error("No browser session");
        setAccessToken(payload.accessToken);
        store.finishBoot(true, payload.user.email);
      } catch {
        setAccessToken(null);
        store.finishBoot(false);
      } finally {
        setReady(true);
      }
    })();
  }, [store, ticket]);

  async function approve() {
    setApproving(true);
    setError(undefined);
    try {
      const result = await apolloClient.mutate<{
        approveBrowserToDesktopLogin?: { redirectUrl: string };
      }>({
        mutation: APPROVE_BROWSER_TO_DESKTOP_LOGIN,
        variables: { ticket },
      });
      const redirectUrl = result.data?.approveBrowserToDesktopLogin?.redirectUrl;
      if (!redirectUrl) throw new Error("Desktop approval did not return a callback");
      window.location.assign(redirectUrl);
    } catch {
      setError("We could not approve this desktop login. Start again from TK Copilot Desktop.");
      setApproving(false);
    }
  }

  if (!ready) {
    return (
      <main className="boot-screen">
        <p>Checking this desktop login request…</p>
      </main>
    );
  }
  if (!store.authenticated && !error) {
    return (
      <AuthScreen
        onAuthenticated={(payload) => store.finishBoot(true, payload.user.email)}
      />
    );
  }

  return (
    <main className="handoff-layout">
      <section className="handoff-card">
        <BrandLogo />
        <p className="eyebrow">Secure handoff</p>
        <h1>{error ? "Desktop login unavailable" : "Continue on this desktop?"}</h1>
        {error ? (
          <p className="handoff-copy" role="alert">
            {error}
          </p>
        ) : (
          <>
            <p className="handoff-copy">
              <strong>{attempt?.deviceName}</strong> is requesting a TK Copilot session for{" "}
              <strong>{store.userEmail}</strong>.
            </p>
            <p className="handoff-detail">
              Only approve if you started this request in the desktop app. No password is sent to
              the app.
            </p>
            <button
              className="primary-button"
              type="button"
              disabled={approving}
              onClick={() => void approve()}
            >
              {approving ? "Connecting…" : "Allow TK Copilot Desktop"}
            </button>
          </>
        )}
        <a className="text-button handoff-link" href="/expert">
          Return to Expert
        </a>
      </section>
    </main>
  );
});
