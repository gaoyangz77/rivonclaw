import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { Layout } from "./layout/Layout.js";
import { VALID_PATHS, ROUTE_MAP } from "./routes.js";
import { WhatsNewModal } from "./components/modals/WhatsNewModal.js";
import { TelemetryConsentModal } from "./components/modals/TelemetryConsentModal.js";
import { TutorialProvider, TutorialBubble, TutorialOverlay } from "./tutorial/index.js";
import { fetchSettings, fetchChangelog, trackEvent } from "./api/index.js";
import type { ChangelogEntry } from "./api/index.js";
import { entityStore } from "./store/entity-store.js";
import { useRuntimeStatus } from "./store/RuntimeStatusProvider.js";

/** Normalise a browser pathname to one of our known routes, defaulting to "/" */
function resolveRoute(pathname: string): string {
  return VALID_PATHS.has(pathname) ? pathname : "/";
}

function pageNameFromRoute(path: string): string {
  return ROUTE_MAP.get(path)?.pageKey ?? "chat";
}

export const App = observer(function App() {
  const { t, i18n } = useTranslation();
  const runtimeStatus = useRuntimeStatus();
  const [currentPath, setCurrentPath] = useState(() => resolveRoute(window.location.pathname));

  // Sync <html lang="..."> so CSS :lang() / [lang] selectors work
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showTelemetryConsent, setShowTelemetryConsent] = useState(false);
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);
  const [currentVersion, setCurrentVersion] = useState("");
  const [agentName, setAgentName] = useState<string | null>(null);

  // Keep state in sync when user presses browser Back / Forward
  useEffect(() => {
    function onPopState() {
      setCurrentPath(resolveRoute(window.location.pathname));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Clear auth state when any API call returns 401
  useEffect(() => {
    const handler = () => entityStore.clearAuth();
    window.addEventListener("rivonclaw:auth-expired", handler);
    return () => window.removeEventListener("rivonclaw:auth-expired", handler);
  }, []);

  const navigate = useCallback((path: string) => {
    const route = resolveRoute(path);
    if (route !== window.location.pathname) {
      window.history.pushState(null, "", route);
    }
    setCurrentPath(route);
    trackEvent("panel.page_viewed", { page: pageNameFromRoute(route) });
  }, []);

  useEffect(() => {
    if (import.meta.env.VITE_FORCE_ONBOARDING === "1") {
      setShowOnboarding(true);
      return;
    }
    checkOnboarding();
  }, []);

  async function checkOnboarding() {
    try {
      const settings = await fetchSettings();

      const provider = settings["llm-provider"];
      // API keys are masked to "configured" by the server when present
      const hasApiKey = provider
        ? settings[`${provider}-api-key`] === "configured"
        : false;

      // Show onboarding until a provider with a valid API key is configured
      setShowOnboarding(!hasApiKey);
    } catch {
      setShowOnboarding(false);
    }
  }

  // Check for "What's New" after onboarding is resolved.
  // Wait for the SSE snapshot so we compare against the persisted MST value,
  // not the empty default (which would show "What's New" on every launch).
  useEffect(() => {
    if (showOnboarding !== false) return;
    if (!runtimeStatus.snapshotReceived) return;
    fetchChangelog()
      .then((data) => {
        if (!data.currentVersion || data.entries.length === 0) return;
        const lastSeen = runtimeStatus.appSettings.whatsNewLastSeenVersion;
        if (lastSeen !== data.currentVersion) {
          setChangelogEntries(data.entries);
          setCurrentVersion(data.currentVersion);
          setShowWhatsNew(true);
        }
      })
      .catch(() => { });
  }, [showOnboarding, runtimeStatus.snapshotReceived, runtimeStatus.appSettings.whatsNewLastSeenVersion]);

  // Show telemetry consent dialog on first launch (after onboarding).
  // Gate on snapshotReceived so we don't flash the modal based on the MST
  // default before the real persisted value arrives via SSE.
  useEffect(() => {
    if (showOnboarding !== false) return;
    if (!runtimeStatus.snapshotReceived) return;
    if (!runtimeStatus.appSettings.telemetryConsentShown) {
      setShowTelemetryConsent(true);
    }
  }, [showOnboarding, runtimeStatus.snapshotReceived, runtimeStatus.appSettings.telemetryConsentShown]);

  // Track initial page view when main app mounts (not during onboarding)
  useEffect(() => {
    if (showOnboarding === false) {
      trackEvent("panel.page_viewed", { page: pageNameFromRoute(currentPath) });
    }
  }, [showOnboarding === false]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOnboardingComplete() {
    setShowOnboarding(false);
    navigate("/");
  }

  if (showOnboarding === null) {
    return (
      <div className="app-loading">
        {t("common.loading")}
      </div>
    );
  }

  if (showOnboarding) {
    const OnboardingComponent = ROUTE_MAP.get("/onboarding")!.component;
    return <OnboardingComponent onComplete={handleOnboardingComplete} />;
  }

  const ChatComponent = ROUTE_MAP.get("/")!.component;
  const ChannelsComponent = ROUTE_MAP.get("/channels")!.component;
  const currentRoute = ROUTE_MAP.get(currentPath);
  const isKeepMounted = currentRoute?.keepMounted;
  const isAccount = currentPath === "/account";
  const StandardPage = currentRoute?.component && !isKeepMounted && !isAccount
    ? currentRoute.component
    : null;

  return (
    <TutorialProvider currentPath={currentPath}>
      <Layout currentPath={currentPath} onNavigate={navigate} agentName={agentName}>
        {/* Keep ChatPage always mounted so its WebSocket connection and pending
            message state survive navigation to other pages (e.g. ProvidersPage). */}
        <div className={currentPath === "/" ? "contents-toggle" : "hidden-toggle"}>
          <ChatComponent onAgentNameChange={setAgentName} />
        </div>
        {/* Keep ChannelsPage mounted to avoid re-fetching channel status on every visit. */}
        <div className={currentPath === "/channels" ? "contents-toggle" : "hidden-toggle"}>
          <ChannelsComponent />
        </div>
        {isAccount && (() => {
          const AccountComponent = currentRoute!.component;
          return <AccountComponent onNavigate={navigate} />;
        })()}
        {StandardPage && <StandardPage />}
        <WhatsNewModal
          isOpen={showWhatsNew}
          onClose={() => setShowWhatsNew(false)}
          entries={changelogEntries}
          currentVersion={currentVersion}
        />
        <TelemetryConsentModal
          isOpen={showTelemetryConsent && !showWhatsNew}
          onClose={() => setShowTelemetryConsent(false)}
        />
      </Layout>
      <TutorialOverlay />
      <TutorialBubble />
    </TutorialProvider>
  );
});
