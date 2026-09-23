import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { Layout } from "./layout/Layout.js";
import { VALID_PATHS, ROUTE_MAP } from "./routes.js";
import { WhatsNewModal } from "./components/modals/WhatsNewModal.js";
import { TelemetryConsentModal } from "./components/modals/TelemetryConsentModal.js";
import {
  AnnouncementModal,
  type ActiveAnnouncement,
  type ActiveAnnouncementAction,
} from "./components/modals/AnnouncementModal.js";
import { TutorialProvider, TutorialBubble, TutorialOverlay } from "./tutorial/index.js";
import { RecordingHighlightLayer } from "./tutorial/components/RecordingHighlightLayer.js";
import {
  fetchSettings,
  fetchChangelog,
  fetchUpdateInfo,
  trackEvent,
  updateSettings,
} from "./api/index.js";
import type { ChangelogEntry } from "./api/index.js";
import { fetchJson } from "./api/client.js";
import { entityStore } from "./store/entity-store.js";
import { useRuntimeStatus } from "./store/RuntimeStatusProvider.js";
import { getClient } from "./api/apollo-client.js";
import {
  ACTIVE_ANNOUNCEMENTS_QUERY,
  RECORD_ANNOUNCEMENT_EVENT_MUTATION,
} from "./api/announcement-queries.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { normalizeLanguageCode } from "./i18n/languages.js";
import { canSeeRoute } from "./lib/permission-scope.js";
import { useWorkspaceTabs } from "./hooks/useWorkspaceTabs.js";
import { activeWorkspaceTab } from "./lib/workspace-tabs.js";
import { WorkspaceTabProvider } from "./lib/workspace-tab-context.js";
import { PageErrorBoundary } from "./components/PageErrorBoundary.js";
import { TkConfirmDialog } from "./components/design-system/index.js";
import { useToast } from "./components/Toast.js";

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
  // The staged production rollout is opt-in; development exercises the full tab host.
  const workspaceTabsEnabled = import.meta.env.VITE_WORKSPACE_TABS === "1" ||
    (import.meta.env.DEV && import.meta.env.VITE_WORKSPACE_TABS !== "0");
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const runtimeStatus = useRuntimeStatus();

  // Sync <html lang="..."> so CSS :lang() / [lang] selectors work
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.title = t("common.brandName");
  }, [i18n.language, t]);

  useEffect(() => {
    if (!runtimeStatus.snapshotReceived) return;
    const persistedLocale = runtimeStatus.appSettings.locale;
    if (!persistedLocale) return;
    const language = normalizeLanguageCode(persistedLocale);
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [runtimeStatus.snapshotReceived, runtimeStatus.appSettings.locale, i18n]);
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showTelemetryConsent, setShowTelemetryConsent] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<ActiveAnnouncement | null>(null);
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);
  const [currentVersion, setCurrentVersion] = useState("");
  const impressedAnnouncementKeys = useRef(new Set<string>());
  const dirtyTabsRef = useRef<Set<string>>(new Set());
  const lostDraftsRef = useRef(0);
  const voluntaryLogoutRef = useRef(false);

  // Clear auth state when any API call returns 401
  useEffect(() => {
    const handler = () => {
      if (!voluntaryLogoutRef.current) lostDraftsRef.current = dirtyTabsRef.current.size;
      entityStore.clearAuth();
    };
    window.addEventListener("rivonclaw:auth-expired", handler);
    return () => window.removeEventListener("rivonclaw:auth-expired", handler);
  }, []);

  // Primitives, not the MST node: the user node is replaced on every `me`
  // ingestion, and reading these during render is what makes observer() track
  // them. Never hand the node itself to an effect.
  const authBootstrapLoading = (entityStore as any).authBootstrap?.status === "loading";
  const currentUserId = entityStore.currentUser?.userId ?? null;
  const currentUserIsOwner = entityStore.currentUser?.isOwner ?? true;
  const currentUserScopes = entityStore.currentUser?.permissionScopes.join(",") ?? "";
  const workspaceController = useWorkspaceTabs({
    userId: currentUserId,
    isOwner: currentUserIsOwner,
    scopeSignature: currentUserScopes,
    bootstrapReady: showWelcome === false && (!workspaceTabsEnabled ||
      (runtimeStatus.snapshotReceived && !authBootstrapLoading)),
    tabsEnabled: workspaceTabsEnabled,
  });
  const { workspace } = workspaceController;
  const activeTab = activeWorkspaceTab(workspace);
  const currentPath = activeTab.path;
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(() => new Set());
  dirtyTabsRef.current = dirtyTabs;
  const [visitedTabs, setVisitedTabs] = useState<{ userId: string | null; ids: Set<string> }>(
    () => ({ userId: null, ids: new Set() }),
  );
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [pendingLogout, setPendingLogout] = useState(false);
  const [pendingLegacyPath, setPendingLegacyPath] = useState<string | null>(null);
  const [authDestination, setAuthDestination] = useState<string | null>(null);
  const initialProtectedPath = useRef(
    ROUTE_MAP.get(window.location.pathname)?.authRequired ? window.location.pathname : null,
  );

  const navigate = useCallback(
    (path: string) => {
      const route = resolveRoute(path);
      if (!workspaceTabsEnabled && route !== currentPath && dirtyTabs.has(activeTab.id)) {
        setPendingLegacyPath(route);
        return;
      }
      const result = workspaceController.openRoute(route);
      if (result === "limit") {
        showToast(t("workspace.limit"), "warning");
      } else if (result === "forbidden" && ROUTE_MAP.get(route)?.authRequired && !currentUserId) {
        window.dispatchEvent(new CustomEvent("rivonclaw:open-auth", { detail: { path: route } }));
      } else if (result === "opened") {
        trackEvent("panel.page_viewed", { page: pageNameFromRoute(route) });
      }
    },
    [workspaceTabsEnabled, currentPath, dirtyTabs, activeTab.id, workspaceController.openRoute, currentUserId, showToast, t],
  );

  useEffect(() => {
    const onOpenRoute = (event: Event) => {
      navigate((event as CustomEvent<{ path: string }>).detail.path);
    };
    window.addEventListener("rivonclaw:open-route", onOpenRoute);
    return () => window.removeEventListener("rivonclaw:open-route", onOpenRoute);
  }, [navigate]);

  useEffect(() => {
    if (!workspaceController.ready || currentUserId || !initialProtectedPath.current) return;
    const path = initialProtectedPath.current;
    initialProtectedPath.current = null;
    window.dispatchEvent(new CustomEvent("rivonclaw:open-auth", { detail: { path } }));
  }, [workspaceController.ready, currentUserId]);

  useEffect(() => {
    if (!workspaceController.ready || !currentUserId || !authDestination) return;
    navigate(authDestination);
    setAuthDestination(null);
  }, [workspaceController.ready, currentUserId, authDestination, navigate]);

  const markTabDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyTabs((previous) => {
      if (previous.has(id) === dirty) return previous;
      const next = new Set(previous);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    setDirtyTabs(new Set());
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    voluntaryLogoutRef.current = false;
    if (lostDraftsRef.current > 0) {
      lostDraftsRef.current = 0;
      showToast(t("workspace.draftsLost"), "warning");
    }
  }, [currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!workspaceController.ready) return;
    setVisitedTabs((previous) => {
      const ids = previous.userId === currentUserId ? new Set(previous.ids) : new Set<string>();
      if (ids.has(workspace.activeTabId)) return previous;
      ids.add(workspace.activeTabId);
      return { userId: currentUserId, ids };
    });
  }, [workspaceController.ready, workspace.activeTabId, currentUserId]);

  useEffect(() => {
    const getDirtyCount = () => dirtyTabs.size;
    const beforeQuit = async () => {
      let saveFailed = false;
      if (workspaceController.ready) {
        try {
          await workspaceController.flush();
        } catch {
          saveFailed = true;
        }
      }
      return { dirtyCount: getDirtyCount(), saveFailed };
    };
    Object.assign(window, {
      __rivonclawWorkspaceDirtyCount: getDirtyCount,
      __rivonclawWorkspaceBeforeQuit: beforeQuit,
    });
    return () => {
      const globalWindow = window as Window & {
        __rivonclawWorkspaceDirtyCount?: () => number;
        __rivonclawWorkspaceBeforeQuit?: () => Promise<{ dirtyCount: number; saveFailed: boolean }>;
      };
      delete globalWindow.__rivonclawWorkspaceDirtyCount;
      delete globalWindow.__rivonclawWorkspaceBeforeQuit;
    };
  }, [dirtyTabs, workspaceController.ready, workspaceController.flush]);

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

  // Privacy mode masks every node marked `data-tk-private` (see
  // design-system/styles/privacy.css). Mirroring the setting onto the document
  // root keeps the toggle a single attribute write instead of a prop threaded
  // through every masked component.
  const privacyMode = runtimeStatus.appSettings.privacyMode;
  useEffect(() => {
    if (privacyMode) {
      document.documentElement.setAttribute("data-privacy", "on");
    } else {
      document.documentElement.removeAttribute("data-privacy");
    }
  }, [privacyMode]);

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

      const session = await fetchJson<{ authenticated: boolean; tokenPresent?: boolean }>(
        clientPath(API["auth.session"]),
      ).catch(() => null);
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
      .catch(() => {});
  }, [
    showWelcome,
    runtimeStatus.snapshotReceived,
    runtimeStatus.appSettings.whatsNewLastSeenVersion,
  ]);

  // Show telemetry consent dialog on first launch (after the welcome page).
  // Gate on snapshotReceived so we don't flash the modal based on the MST
  // default before the real persisted value arrives via SSE.
  useEffect(() => {
    if (showWelcome !== false) return;
    if (!runtimeStatus.snapshotReceived) return;
    if (!runtimeStatus.appSettings.telemetryConsentShown) {
      setShowTelemetryConsent(true);
    }
  }, [
    showWelcome,
    runtimeStatus.snapshotReceived,
    runtimeStatus.appSettings.telemetryConsentShown,
  ]);

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
  }, [
    showWelcome,
    runtimeStatus.snapshotReceived,
    runtimeStatus.deviceId,
    entityStore.currentUser?.userId,
    i18n.language,
  ]);

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
    if (workspaceController.ready) {
      trackEvent("panel.page_viewed", { page: pageNameFromRoute(currentPath) });
    }
  }, [workspaceController.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleWelcomeComplete() {
    setShowWelcome(false);
    navigate("/");
  }

  async function recordAnnouncementEvent(
    key: string,
    eventType: "DISMISS" | "PRIMARY_CLICK" | "SECONDARY_CLICK",
  ) {
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

  function handleAnnouncementAction(
    action: ActiveAnnouncementAction,
    eventType: "PRIMARY_CLICK" | "SECONDARY_CLICK",
  ) {
    const announcement = activeAnnouncement;
    setActiveAnnouncement(null);
    if (announcement) {
      trackEvent(
        eventType === "PRIMARY_CLICK"
          ? "announcement.primary_click"
          : "announcement.secondary_click",
        {
          key: announcement.key,
          surface: announcement.surface,
          category: announcement.category,
          templateFormat: announcement.template.format,
          actionType: action.type,
          actionRole: action.role,
        },
      );
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
    return <div className="app-loading">{t("common.loading")}</div>;
  }

  if (showWelcome) {
    const WelcomeComponent = ROUTE_MAP.get("/welcome")!.component;
    return <WelcomeComponent onComplete={handleWelcomeComplete} />;
  }

  if (!workspaceController.ready) {
    return <div className="app-loading">{t("common.loading")}</div>;
  }

  const ChatComponent = ROUTE_MAP.get("/")!.component;
  const chatTab = workspace.tabs.find((tab) => tab.path === "/");
  const chatAllowed = canSeeRoute(
    ROUTE_MAP.get("/")!,
    currentUserId
      ? { isOwner: currentUserIsOwner, permissionScopes: currentUserScopes.split(",") }
      : null,
  );
  const tabItems = workspace.tabs.map((tab) => {
    const route = ROUTE_MAP.get(tab.path)!;
    return {
      id: tab.id,
      label: route.navLabelKey ? t(route.navLabelKey) : route.pageKey,
      icon: route.icon,
      dirty: dirtyTabs.has(tab.id),
    };
  });

  function tabSwitchAllowed(): boolean {
    return !document.querySelector('[role="dialog"][aria-modal="true"]');
  }

  function closeTab(id: string) {
    if (!tabSwitchAllowed()) return;
    if (dirtyTabs.has(id)) {
      setPendingCloseId(id);
      return;
    }
    workspaceController.closeTab(id);
  }

  function confirmCloseTab() {
    if (!pendingCloseId) return;
    workspaceController.closeTab(pendingCloseId);
    markTabDirty(pendingCloseId, false);
    setPendingCloseId(null);
  }

  function requestLogout() {
    if (dirtyTabs.size > 0) {
      setPendingLogout(true);
      return;
    }
    voluntaryLogoutRef.current = true;
    void entityStore.logout();
  }

  function confirmLogout() {
    setPendingLogout(false);
    voluntaryLogoutRef.current = true;
    void entityStore.logout();
  }

  return (
    <TutorialProvider currentPath={currentPath}>
      <Layout
        currentPath={currentPath}
        onNavigate={navigate}
        workspaceTabs={tabItems}
        activeTabId={workspace.activeTabId}
        onActivateTab={(id) => {
          if (!tabSwitchAllowed()) return;
          workspaceController.activateTab(id);
          const route = workspace.tabs.find((tab) => tab.id === id);
          if (route) trackEvent("panel.page_viewed", { page: pageNameFromRoute(route.path) });
        }}
        onCloseTab={closeTab}
        onReorderTab={(id, index) => {
          if (tabSwitchAllowed()) workspaceController.reorderTab(id, index);
        }}
        onAuthSuccess={setAuthDestination}
        showWorkspaceTabs={workspaceTabsEnabled}
      >
        {workspaceController.loadError && (
          <div className="workspace-save-error" role="status">
            {t("workspace.loadFailed")}
          </div>
        )}
        {workspaceController.saveError && (
          <div className="workspace-save-error" role="status">
            {t("workspace.saveFailed")}
          </div>
        )}
        {/* Keep ChatPage always mounted so its WebSocket connection and pending
            message state survive navigation to other pages (e.g. ProvidersPage). */}
        <div
          className="workspace-page"
          id={chatTab ? `workspace-panel-${chatTab.id}` : undefined}
          role="tabpanel"
          aria-labelledby={chatTab ? `workspace-tab-${chatTab.id}` : undefined}
          hidden={!chatTab || currentPath !== "/"}
          inert={!chatTab || currentPath !== "/"}
        >
          {chatAllowed && (
            <WorkspaceTabProvider
              value={{
                tabId: chatTab?.id ?? "chat-suspended",
                active: currentPath === "/",
                view: chatTab?.view ?? {},
                setView: (view) => chatTab && workspaceController.setTabView(chatTab.id, view),
                setDirty: (dirty) => chatTab && markTabDirty(chatTab.id, dirty),
              }}
            >
              <PageErrorBoundary
                resetKey={chatTab?.id ?? "chat-suspended"}
                title={t("common.pageErrorTitle", { defaultValue: "This page ran into a problem" })}
                message={t("common.pageErrorMessage", {
                  defaultValue: "The navigation is still available. Retry this page or open another section.",
                })}
                retryLabel={t("common.reload")}
              >
                <ChatComponent />
              </PageErrorBoundary>
            </WorkspaceTabProvider>
          )}
        </div>
        {workspace.tabs
          .filter((tab) => tab.path !== "/")
          .map((tab) => {
            const route = ROUTE_MAP.get(tab.path)!;
            const Page = route.component;
            const active = workspace.activeTabId === tab.id;
            return (
              <div
                className="workspace-page"
                id={`workspace-panel-${tab.id}`}
                role="tabpanel"
                aria-labelledby={`workspace-tab-${tab.id}`}
                hidden={!active}
                inert={!active}
                key={tab.id}
              >
                <WorkspaceTabProvider
                  value={{
                    tabId: tab.id,
                    active,
                    view: tab.view,
                    setView: (view) => workspaceController.setTabView(tab.id, view),
                    setDirty: (dirty) => markTabDirty(tab.id, dirty),
                  }}
                >
                  <PageErrorBoundary
                    resetKey={tab.id}
                    title={t("common.pageErrorTitle", { defaultValue: "This page ran into a problem" })}
                    message={t("common.pageErrorMessage", {
                      defaultValue: "The navigation is still available. Retry this page or open another section.",
                    })}
                    retryLabel={t("common.reload")}
                  >
                    {(active || (visitedTabs.userId === currentUserId && visitedTabs.ids.has(tab.id))) &&
                      (tab.path === "/account/profile" ? (
                        <Page onNavigate={navigate} onRequestLogout={requestLogout} />
                      ) : (
                        <Page />
                      ))}
                  </PageErrorBoundary>
                </WorkspaceTabProvider>
              </div>
            );
          })}
        <TkConfirmDialog
          isOpen={pendingLegacyPath !== null}
          onConfirm={() => {
            const path = pendingLegacyPath;
            setPendingLegacyPath(null);
            if (path) {
              workspaceController.openRoute(path);
              trackEvent("panel.page_viewed", { page: pageNameFromRoute(path) });
            }
          }}
          onCancel={() => setPendingLegacyPath(null)}
          title={t("workspace.closeDirtyTitle")}
          message={t("workspace.closeDirtyBody")}
          confirmLabel={t("workspace.discard")}
          cancelLabel={t("workspace.stay")}
        />
        <TkConfirmDialog
          isOpen={pendingLogout}
          onConfirm={confirmLogout}
          onCancel={() => setPendingLogout(false)}
          title={t("workspace.logoutDirtyTitle")}
          message={t("workspace.logoutDirtyBody")}
          confirmLabel={t("workspace.discardAndLogout")}
          cancelLabel={t("workspace.stay")}
        />
        <TkConfirmDialog
          isOpen={pendingCloseId !== null}
          onConfirm={confirmCloseTab}
          onCancel={() => setPendingCloseId(null)}
          title={t("workspace.closeDirtyTitle")}
          message={t("workspace.closeDirtyBody")}
          confirmLabel={t("workspace.discard")}
          cancelLabel={t("workspace.stay")}
        />
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
