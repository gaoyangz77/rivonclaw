import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apolloClient } from "./api/client.js";
import { setAccessToken } from "./api/auth-session.js";
import { CONSUME_DESKTOP_TO_WEB_LOGIN } from "./api/operations.js";
import { AuthScreen } from "./AuthScreen.js";
import { useExpertStore } from "./store/context.js";

const SAFE_RETURN_PATH = /^\/(?:expert(?:\/.*)?|account\/(?:login|register|desktop-login)(?:\/.*)?|oauth\/tiktok\/(?:start|callback(?:\/.*)?)(?:\/.*)?|shops\/claim(?:\/.*)?)$/;

export function AccountLoginPage({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const store = useExpertStore();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [ticket] = useState(() => params.get("handoff") ?? "");
  const [returnPath] = useState(() => {
    const requested = params.get("returnPath") ?? "/expert";
    return SAFE_RETURN_PATH.test(requested) ? requested : "/expert";
  });
  const [consuming, setConsuming] = useState(Boolean(ticket));
  const consumeStarted = useRef(false);

  useEffect(() => {
    if (consumeStarted.current) return;
    consumeStarted.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    if (!ticket) return;
    void apolloClient
      .mutate<{
        consumeDesktopToWebLogin?: { accessToken: string; user: { email: string } };
      }>({
        mutation: CONSUME_DESKTOP_TO_WEB_LOGIN,
        variables: { ticket },
      })
      .then((result) => {
        const payload = result.data?.consumeDesktopToWebLogin;
        if (!payload) throw new Error("Browser login did not return a session");
        setAccessToken(payload.accessToken);
        store.signIn(payload.user.email);
        navigate(returnPath, { replace: true });
      })
      .catch(() => {
        store.setError("This browser login link has expired. Sign in to continue.");
        setConsuming(false);
      });
  }, [navigate, returnPath, store, ticket]);

  if (consuming) {
    return (
      <main className="boot-screen">
        <p>Opening your secure browser session…</p>
      </main>
    );
  }
  return (
    <AuthScreen
      initialMode={register ? "register" : "login"}
      onAuthenticated={() => navigate(returnPath, { replace: true })}
    />
  );
}
