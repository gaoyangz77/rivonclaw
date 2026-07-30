import { useEffect, useRef, useState } from "react";
import { apolloClient } from "./api/client.js";
import { CONSUME_TIKTOK_OAUTH_BROWSER_START } from "./api/operations.js";
import { BrandLogo } from "./BrandLogo.js";
import { navigateBrowser } from "./browser-navigation.js";

export function TikTokOAuthStartPage() {
  const [ticket] = useState(
    () => new URLSearchParams(window.location.search).get("ticket") ?? "",
  );
  const [error, setError] = useState<string>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    if (!ticket) {
      setError("This TikTok Shop authorization link is incomplete.");
      return;
    }
    void apolloClient
      .mutate<{
        consumeTikTokOAuthBrowserStart?: { authUrl: string };
      }>({
        mutation: CONSUME_TIKTOK_OAUTH_BROWSER_START,
        variables: { ticket },
      })
      .then((result) => {
        const authUrl = result.data?.consumeTikTokOAuthBrowserStart?.authUrl;
        if (!authUrl) throw new Error("TikTok authorization URL is missing");
        navigateBrowser(authUrl);
      })
      .catch(() => {
        setError("This TikTok Shop authorization link has expired or was already used.");
      });
  }, [ticket]);

  return (
    <main className="handoff-layout">
      <section className="handoff-card">
        <BrandLogo />
        <p className="eyebrow">TikTok Shop</p>
        <h1>{error ? "Authorization unavailable" : "Opening TikTok Shop…"}</h1>
        <p className="handoff-copy" role={error ? "alert" : "status"}>
          {error ?? "Your secure authorization session is being prepared."}
        </p>
        {error && (
          <a className="text-button handoff-link" href="/expert">
            Return to Expert
          </a>
        )}
      </section>
    </main>
  );
}
