import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apolloClient } from "./api/client.js";
import { setAccessToken } from "./api/auth-session.js";
import {
  CLAIM_PENDING_TIKTOK_SHOPS,
  COMPLETE_TIKTOK_OAUTH,
  WEB_REFRESH,
} from "./api/operations.js";
import { AuthScreen } from "./AuthScreen.js";
import { BrandLogo } from "./BrandLogo.js";
import { useExpertStore } from "./store/context.js";

interface OAuthShop {
  shopId: string;
  shopName: string;
}

type ClaimStatus =
  | "CLAIMED"
  | "ALREADY_CLAIMED"
  | "REVOKED"
  | "EXPIRED"
  | "OWNERSHIP_CONFLICT";

export function TikTokOAuthCallbackPage() {
  const { serviceId = "" } = useParams();
  const store = useExpertStore();
  const [callback] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      code: params.get("code") ?? "",
      state: params.get("state"),
    };
  });
  const [shops, setShops] = useState<OAuthShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [webSessionEstablished, setWebSessionEstablished] = useState(false);
  const [mode, setMode] = useState<"DESKTOP_OAUTH" | "DIRECT_CLAIM">();
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>();
  const [needsAuthentication, setNeedsAuthentication] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string>();
  const completionStarted = useRef(false);

  async function claimPending() {
    setClaiming(true);
    setError(undefined);
    try {
      const claimed = await apolloClient.mutate<{
        claimPendingTikTokShops?: { status: ClaimStatus; shops: OAuthShop[] };
      }>({ mutation: CLAIM_PENDING_TIKTOK_SHOPS });
      const result = claimed.data?.claimPendingTikTokShops;
      if (!result) throw new Error("Shop claim returned no result");
      setClaimStatus(result.status);
      if (result.shops.length > 0) setShops(result.shops);
      setNeedsAuthentication(false);
    } catch {
      setError("We could not claim your shop yet. Check your connection and try again.");
    } finally {
      setClaiming(false);
    }
  }

  useEffect(() => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    void (async () => {
      if (!callback.code || !serviceId) {
        setError("This TikTok Shop callback is incomplete.");
        setLoading(false);
        return;
      }
      try {
        const completed = await apolloClient.mutate<{
          completeTikTokOAuth?: {
            mode: string;
            webSessionEstablished: boolean;
            claimStatus?: string;
            shops: OAuthShop[];
          };
        }>({
          mutation: COMPLETE_TIKTOK_OAUTH,
          variables: {
            code: callback.code,
            state: callback.state,
            serviceId,
          },
        });
        const result = completed.data?.completeTikTokOAuth;
        if (!result) throw new Error("TikTok OAuth completion returned no result");
        setShops(result.shops);
        setWebSessionEstablished(result.webSessionEstablished);
        setMode(result.mode as "DESKTOP_OAUTH" | "DIRECT_CLAIM");

        if (result.mode === "DIRECT_CLAIM") {
          if (result.claimStatus === "REVOKED") {
            setClaimStatus("REVOKED");
            return;
          }
          try {
            const refreshed = await apolloClient.mutate<{
              webRefresh?: { accessToken: string; user: { email: string } };
            }>({ mutation: WEB_REFRESH });
            const session = refreshed.data?.webRefresh;
            if (!session) throw new Error("No browser session");
            setAccessToken(session.accessToken);
            store.finishBoot(true, session.user.email);
            await claimPending();
          } catch {
            setAccessToken(null);
            store.finishBoot(false);
            setNeedsAuthentication(true);
          }
        } else if (result.webSessionEstablished) {
          const refreshed = await apolloClient.mutate<{
            webRefresh?: { accessToken: string; user: { email: string } };
          }>({ mutation: WEB_REFRESH });
          const session = refreshed.data?.webRefresh;
          if (!session) throw new Error("Web session could not be restored");
          setAccessToken(session.accessToken);
          store.finishBoot(true, session.user.email);
        }
      } catch {
        setError(
          "We could not finish this TikTok Shop authorization. The link may have expired or already been used.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [callback.code, callback.state, serviceId, store]);

  if (!loading && mode === "DIRECT_CLAIM" && needsAuthentication) {
    return (
      <main className="claim-auth-layout">
        <section className="claim-auth-intro">
          <BrandLogo />
          <p className="eyebrow">TikTok Shop connected</p>
          <h1>Create your TK Copilot account</h1>
          <p>
            Sign up or use an existing account. Your newly authorized shop will be added
            automatically—there is no second confirmation step.
          </p>
          <ul className="connected-shop-list">
            {shops.map((shop) => (
              <li key={shop.shopId}>{shop.shopName}</li>
            ))}
          </ul>
        </section>
        <AuthScreen
          initialMode="register"
          onAuthenticated={() => {
            setNeedsAuthentication(false);
            void claimPending();
          }}
        />
      </main>
    );
  }

  const claimSucceeded =
    claimStatus === "CLAIMED" || claimStatus === "ALREADY_CLAIMED";
  const directFailureMessage =
    claimStatus === "REVOKED"
      ? "This TikTok Shop authorization was revoked before it could be claimed."
      : claimStatus === "EXPIRED"
        ? "This shop claim has expired. Authorize TK Copilot again from TikTok Shop."
        : claimStatus === "OWNERSHIP_CONFLICT"
          ? "This shop already belongs to another TK Copilot account. Contact support for help."
          : undefined;

  return (
    <main className="handoff-layout">
      <section className="handoff-card handoff-card--wide">
        <BrandLogo />
        <p className="eyebrow">TikTok Shop</p>
        <h1>
          {loading
            ? "Finishing authorization…"
            : error || directFailureMessage
              ? "Authorization could not be completed"
              : mode === "DIRECT_CLAIM" && !claimSucceeded
                ? "Adding your shop…"
                : "Your shop is connected"}
        </h1>
        {loading && (
          <p className="handoff-copy">Securely exchanging your one-time TikTok code.</p>
        )}
        {error && (
          <p className="handoff-copy" role="alert">
            {error}
          </p>
        )}
        {!loading && directFailureMessage && (
          <p className="handoff-copy" role="alert">
            {directFailureMessage}
          </p>
        )}
        {!loading && !error && !directFailureMessage && (
          <>
            <ul className="connected-shop-list">
              {shops.map((shop) => (
                <li key={shop.shopId}>{shop.shopName}</li>
              ))}
            </ul>
            {mode === "DIRECT_CLAIM" && claimSucceeded ? (
              <>
                <p className="handoff-detail">
                  Connected to <strong>{store.userEmail}</strong>. Install TK Copilot and sign
                  in with the same account at any time.
                </p>
                <div className="download-actions">
                  <a className="primary-button handoff-primary-link" href="/#download">
                    Download for macOS
                  </a>
                  <a className="text-button handoff-link" href="/#download">
                    Download for Windows
                  </a>
                </div>
              </>
            ) : mode === "DIRECT_CLAIM" ? (
              <button
                className="primary-button"
                type="button"
                disabled={claiming}
                onClick={() => void claimPending()}
              >
                {claiming ? "Adding shop…" : "Try again"}
              </button>
            ) : webSessionEstablished ? (
              <a className="primary-button handoff-primary-link" href="/expert">
                Continue to TK Copilot
              </a>
            ) : (
              <>
                <p className="handoff-detail">
                  The shop is connected to your Desktop account. Sign in to continue in this
                  browser.
                </p>
                <a className="primary-button handoff-primary-link" href="/account/login">
                  Sign in
                </a>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
