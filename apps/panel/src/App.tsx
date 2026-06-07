import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { Layout } from "./layout/Layout.js";
import { VALID_PATHS, ROUTE_MAP } from "./routes.js";
import { WhatsNewModal } from "./components/modals/WhatsNewModal.js";
import { TelemetryConsentModal } from "./components/modals/TelemetryConsentModal.js";
import { AnnouncementModal, type ActiveAnnouncement, type ActiveAnnouncementAction } from "./components/modals/AnnouncementModal.js";
import { TutorialProvider, TutorialBubble, TutorialOverlay } from "./tutorial/index.js";
import { RecordingHighlightLayer } from "./tutorial/components/RecordingHighlightLayer.js";
import { fetchSettings, fetchChangelog, fetchUpdateInfo, trackEvent, updateSettings } from "./api/index.js";
import type { ChangelogEntry } from "./api/index.js";
import { fetchJson } from "./api/client.js";
import { entityStore } from "./store/entity-store.js";
import { useRuntimeStatus } from "./store/RuntimeStatusProvider.js";
import { getClient } from "./api/apollo-client.js";
import { ACTIVE_ANNOUNCEMENTS_QUERY, RECORD_ANNOUNCEMENT_EVENT_MUTATION } from "./api/announcement-queries.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";

/** Normalise a browser pathname to one of our known routes, defaulting to "/" */
function resolveRoute(pathname: string): string {
  return VALID_PATHS.has(pathname) ? pathname : "/";
}

function pageNameFromRoute(path: string): string {
  return ROUTE_MAP.get(path)?.pageKey ?? "chat";
}

const WELCOME_PAGE_COMPLETED_KEY = "welcome_page_completed";
const LEGACY_ONBOARDING_ACCOUNT_ENTRY_COMPLETED_KEY = "onboarding_account_entry_completed";

export const App = observer(function App() {
  const { t, i18n } = useTranslation();
  const runtimeStatus = useRuntimeStatus();
  const [currentPath, setCurrentPath] = useState(() => resolveRoute(window.location.pathname));

  // Sync <html lang="..."> so CSS :lang() / [lang] selectors work
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showTelemetryConsent, setShowTelemetryConsent] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<ActiveAnnouncement | null>(null);
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);
  const [currentVersion, setCurrentVersion] = useState("");
  const [agentName, setAgentName] = useState<string | null>(null);
  const impressedAnnouncementKeys = useRef(new Set<string>());

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
    if (import.meta.env.VITE_FORCE_WELCOME === "1") {
      setShowWelcome(true);
      return;
    }
    checkWelcome();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.rivonclawAppReady = showWelcome === null ? "0" : "1";
    document.documentElement.dataset.rivonclawAppSurface = showWelcome ? "welcome" : "shell";
  }, [showWelcome]);

  async function checkWelcome() {
    try {
      const settings = await fetchSettings();
      if (
        settings[WELCOME_PAGE_COMPLETED_KEY] === "1" ||
        settings[LEGACY_ONBOARDING_ACCOUNT_ENTRY_COMPLETED_KEY] === "1"
      ) {
        setShowWelcome(false);
        return;
      }

      const session = await fetchJson<{ authenticated: boolean; tokenPresent?: boolean }>(clientPath(API["auth.session"])).catch(() => null);
      if (session?.authenticated || session?.tokenPresent) {
        updateSettings({ [WELCOME_PAGE_COMPLETED_KEY]: "1" }).catch(() => {});
        setShowWelcome(false);
        return;
      }

      setShowWelcome(true);
    } catch {
      setShowWelcome(false);
    }
  }

  // Check for "What's New" after the welcome page is resolved.
  // Wait for the SSE snapshot so we compare against the persisted MST value,
  // not the empty default (which would show "What's New" on every launch).
  useEffect(() => {
    if (showWelcome !== false) return;
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
  }, [showWelcome, runtimeStatus.snapshotReceived, runtimeStatus.appSettings.whatsNewLastSeenVersion]);

  // Show telemetry consent dialog on first launch (after the welcome page).
  // Gate on snapshotReceived so we don't flash the modal based on the MST
  // default before the real persisted value arrives via SSE.
  useEffect(() => {
    if (showWelcome !== false) return;
    if (!runtimeStatus.snapshotReceived) return;
    if (!runtimeStatus.appSettings.telemetryConsentShown) {
      setShowTelemetryConsent(true);
    }
  }, [showWelcome, runtimeStatus.snapshotReceived, runtimeStatus.appSettings.telemetryConsentShown]);

  useEffect(() => {
    if (showWelcome !== false) return;
    if (!runtimeStatus.snapshotReceived) return;

    let cancelled = false;
    async function loadAnnouncements() {
      try {
        const updateInfo = await fetchUpdateInfo().catch(() => ({ currentVersion: null }));
        const result = await getClient().query<{ activeAnnouncements: ActiveAnnouncement[] }>({
          query: ACTIVE_ANNOUNCEMENTS_QUERY,
          variables: {
            surface: "DESKTOP_MODAL",
            appVersion: updateInfo.currentVersion,
            locale: i18n.language,
            deviceId: runtimeStatus.deviceId || null,
          },
          fetchPolicy: "network-only",
        });
        if (!cancelled) {
          setActiveAnnouncement(result.data?.activeAnnouncements?.[0] ?? null);
        }
      } catch {
        if (!cancelled) setActiveAnnouncement(null);
      }
    }

    loadAnnouncements();
    return () => {
      cancelled = true;
    };
  }, [showWelcome, runtimeStatus.snapshotReceived, runtimeStatus.deviceId, entityStore.currentUser?.userId, i18n.language]);

  useEffect(() => {
    if (!activeAnnouncement) return;
    if (showWhatsNew || showTelemetryConsent) return;
    if (impressedAnnouncementKeys.current.has(activeAnnouncement.key)) return;
    impressedAnnouncementKeys.current.add(activeAnnouncement.key);
    trackEvent("announcement.impression", {
      key: activeAnnouncement.key,
      surface: activeAnnouncement.surface,
      category: activeAnnouncement.category,
      templateFormat: activeAnnouncement.template.format,
    });
  }, [activeAnnouncement, showWhatsNew, showTelemetryConsent]);

  // Track initial page view when main app mounts (not during the welcome page)
  useEffect(() => {
    if (showWelcome === false) {
      trackEvent("panel.page_viewed", { page: pageNameFromRoute(currentPath) });
    }
  }, [showWelcome === false]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleWelcomeComplete() {
    setShowWelcome(false);
    navigate("/");
  }

  async function recordAnnouncementEvent(key: string, eventType: "DISMISS" | "PRIMARY_CLICK" | "SECONDARY_CLICK") {
    const updateInfo = await fetchUpdateInfo().catch(() => ({ currentVersion: null }));
    await getClient().mutate({
      mutation: RECORD_ANNOUNCEMENT_EVENT_MUTATION,
      variables: {
        input: {
          key,
          eventType,
          surface: "DESKTOP_MODAL",
          appVersion: updateInfo.currentVersion,
          locale: i18n.language,
          deviceId: runtimeStatus.deviceId || null,
        },
      },
    });
  }

  function dismissActiveAnnouncement() {
    const announcement = activeAnnouncement;
    setActiveAnnouncement(null);
    if (announcement) {
      trackEvent("announcement.dismiss", {
        key: announcement.key,
        surface: announcement.surface,
        category: announcement.category,
        templateFormat: announcement.template.format,
      });
      if (entityStore.currentUser || runtimeStatus.deviceId) {
        recordAnnouncementEvent(announcement.key, "DISMISS").catch(() => {});
      }
    }
  }

  function temporarilyHideActiveAnnouncement() {
    const announcement = activeAnnouncement;
    setActiveAnnouncement(null);
    if (announcement) {
      trackEvent("announcement.backdrop_close", {
        key: announcement.key,
        surface: announcement.surface,
        category: announcement.category,
        templateFormat: announcement.template.format,
      });
    }
  }

  function handleAnnouncementAction(action: ActiveAnnouncementAction, eventType: "PRIMARY_CLICK" | "SECONDARY_CLICK") {
    const announcement = activeAnnouncement;
    setActiveAnnouncement(null);
    if (announcement) {
      trackEvent(eventType === "PRIMARY_CLICK" ? "announcement.primary_click" : "announcement.secondary_click", {
        key: announcement.key,
        surface: announcement.surface,
        category: announcement.category,
        templateFormat: announcement.template.format,
        actionType: action.type,
        actionRole: action.role,
      });
      if (entityStore.currentUser || runtimeStatus.deviceId) {
        recordAnnouncementEvent(announcement.key, eventType).catch(() => {});
      }
    }
    if (action.type === "NAVIGATE" && action.path) {
      navigate(action.path);
    } else if (action.type === "EXTERNAL_URL" && action.url) {
      window.open(action.url, "_blank", "noopener,noreferrer");
    }
  }

  if (showWelcome === null) {
    return (
      <div className="app-loading">
        {t("common.loading")}
      </div>
    );
  }

  if (showWelcome) {
    const WelcomeComponent = ROUTE_MAP.get("/welcome")!.component;
    return <WelcomeComponent onComplete={handleWelcomeComplete} />;
  }

  const ChatComponent = ROUTE_MAP.get("/")!.component;
  const ChannelsComponent = ROUTE_MAP.get("/connections/channels")!.component;
  const currentRoute = ROUTE_MAP.get(currentPath);
  const isKeepMounted = currentRoute?.keepMounted;
  const isAccount = currentPath === "/account/profile";
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
        <div className={currentPath === "/connections/channels" ? "contents-toggle" : "hidden-toggle"}>
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
        <AnnouncementModal
          announcement={activeAnnouncement}
          isOpen={!!activeAnnouncement && !showWhatsNew && !showTelemetryConsent}
          onClose={dismissActiveAnnouncement}
          onBackdropClose={temporarilyHideActiveAnnouncement}
          onAction={handleAnnouncementAction}
        />
      </Layout>
      <TutorialOverlay />
      <TutorialBubble />
      <RecordingHighlightLayer />
    </TutorialProvider>
  );
});
