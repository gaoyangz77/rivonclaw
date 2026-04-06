import { useState, useEffect, useCallback } from "react";
import type { ReactNode, ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "./layout/Layout.js";
import { ChatPage } from "./pages/ChatPage.js";
import { RulesPage } from "./pages/RulesPage.js";
import { ProvidersPage } from "./pages/ProvidersPage.js";
import { ChannelsPage } from "./pages/ChannelsPage.js";
import { PermissionsPage } from "./pages/PermissionsPage.js";
import { ExtrasPage } from "./pages/ExtrasPage.js";
import { KeyUsagePage } from "./pages/KeyUsagePage.js";
import { SkillsPage } from "./pages/SkillsPage.js";
import { CronsPage } from "./pages/CronsPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { OnboardingPage } from "./pages/OnboardingPage.js";
import { AccountPage } from "./pages/AccountPage.js";
import { BrowserProfilesPage } from "./pages/BrowserProfilesPage.js";
import { TikTokShopsPage } from "./pages/TikTokShopsPage.js";
import { EcommercePage } from "./pages/EcommercePage.js";
import { WhatsNewModal } from "./components/modals/WhatsNewModal.js";
import { TelemetryConsentModal } from "./components/modals/TelemetryConsentModal.js";
import { TutorialProvider, TutorialBubble, TutorialOverlay } from "./tutorial/index.js";
import { fetchSettings, fetchChangelog, trackEvent } from "./api/index.js";
import type { ChangelogEntry } from "./api/index.js";
import { entityStore } from "./store/entity-store.js";

const PAGES: Record<string, ComponentType | (() => ReactNode)> = {
  "/": () => null, // ChatPage is always rendered directly (not via PAGES) to keep its WS alive
  "/rules": RulesPage,
  "/providers": ProvidersPage,
  "/channels": ChannelsPage,
  "/permissions": PermissionsPage,
  "/extras": ExtrasPage,
  "/usage": KeyUsagePage,
  "/skills": SkillsPage,
  "/crons": CronsPage,
  "/tiktok-shops": () => null, // Rendered separately below (auth-gated)
  "/ecommerce": () => null, // Rendered separately below (auth-gated)
  "/browser-profiles": () => null, // Rendered separately below (needs onNavigate prop)
  "/settings": SettingsPage,
  "/account": () => null, // Rendered separately below (needs onNavigate prop)
};

/** Normalise a browser pathname to one of our known routes, defaulting to "/" */
function resolveRoute(pathname: string): string {
  return pathname in PAGES ? pathname : "/";
}

function pageNameFromRoute(route: string): string {
  return route === "/" ? "chat" : route.slice(1);
}

/** Hydrate localStorage from backend settings so UI preferences survive port changes. */
function hydrateLocalStorage(settings: Record<string, string>) {
  const mapping: Record<string, string> = {
    whats_new_last_seen_version: "whatsNew.lastSeenVersion",
    telemetry_consent_shown: "telemetry.consentShown",
    sidebar_collapsed: "sidebar-collapsed",
    show_agent_name: "showAgentName",
    panel_theme: "theme",
    panel_accent: "accentColor",
    tutorial_enabled: "tutorial.enabled",
    chat_examples_collapsed: "chat-examples-collapsed",
    chat_tab_order: "chat-tab-order",
  };
  for (const [backendKey, localKey] of Object.entries(mapping)) {
    const val = settings[backendKey];
    if (val !== undefined) {
      localStorage.setItem(localKey, val);
    }
  }
}

export function App() {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState(() => resolveRoute(window.location.pathname));
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
      hydrateLocalStorage(settings);

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

  // Check for "What's New" after onboarding is resolved
  useEffect(() => {
    if (showOnboarding !== false) return;
    fetchChangelog()
      .then((data) => {
        if (!data.currentVersion || data.entries.length === 0) return;
        const lastSeen = localStorage.getItem("whatsNew.lastSeenVersion");
        if (lastSeen !== data.currentVersion) {
          setChangelogEntries(data.entries);
          setCurrentVersion(data.currentVersion);
          setShowWhatsNew(true);
        }
      })
      .catch(() => { });
  }, [showOnboarding]);

  // Show telemetry consent dialog on first launch (after onboarding)
  useEffect(() => {
    if (showOnboarding !== false) return;
    if (!localStorage.getItem("telemetry.consentShown")) {
      setShowTelemetryConsent(true);
    }
  }, [showOnboarding]);

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
    return <OnboardingPage onComplete={handleOnboardingComplete} />;
  }

  const skipPages = new Set(["/", "/channels", "/tiktok-shops", "/ecommerce", "/account"]);
  const OtherPage = !skipPages.has(currentPath) ? PAGES[currentPath] : null;
  return (
    <TutorialProvider currentPath={currentPath}>
      <Layout currentPath={currentPath} onNavigate={navigate} agentName={agentName}>
        {/* Keep ChatPage always mounted so its WebSocket connection and pending
            message state survive navigation to other pages (e.g. ProvidersPage). */}
        <div className={currentPath === "/" ? "contents-toggle" : "hidden-toggle"}>
          <ChatPage onAgentNameChange={setAgentName} />
        </div>
        {/* Keep ChannelsPage mounted to avoid re-fetching channel status on every visit. */}
        <div className={currentPath === "/channels" ? "contents-toggle" : "hidden-toggle"}>
          <ChannelsPage />
        </div>
        {currentPath === "/tiktok-shops" && <TikTokShopsPage />}
        {currentPath === "/ecommerce" && <EcommercePage />}
        {currentPath === "/browser-profiles" && <BrowserProfilesPage />}
        {currentPath === "/account" && <AccountPage onNavigate={navigate} />}
        {OtherPage && <OtherPage />}
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
}
