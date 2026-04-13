import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchUpdateInfo,
  startUpdateDownload,
  cancelUpdateDownload,
  fetchUpdateDownloadStatus,
  triggerUpdateInstall,
  updateSettings,
} from "../api/index.js";
import { DEFAULTS } from "@rivonclaw/core";
import { formatError } from "@rivonclaw/core";
import { SSE } from "@rivonclaw/core/api-contract";
import type { UpdateInfo, UpdateDownloadStatus } from "../api/index.js";
import { BottomActions } from "../components/BottomActions.js";
import { MenuIcon } from "../components/icons.js";
import { ROUTES } from "../routes.js";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../store/EntityStoreProvider.js";
import { useRuntimeStatus } from "../store/RuntimeStatusProvider.js";
import { useToast } from "../components/Toast.js";
import { AuthModal } from "../components/modals/AuthModal.js";

const SIDEBAR_MIN = 140;
const SIDEBAR_MAX = 360;
const SIDEBAR_DEFAULT = 200;

export const Layout = observer(function Layout({
  children,
  currentPath,
  onNavigate,
  agentName,
}: {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  agentName?: string | null;
}) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const runtimeStatus = useRuntimeStatus();
  const { showToast } = useToast();
  const user = entityStore.currentUser;
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAuthPath, setPendingAuthPath] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<UpdateDownloadStatus>({
    status: "idle",
  });
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true",
  );
  const [showAgentName, setShowAgentName] = useState(() => {
    const stored = localStorage.getItem("showAgentName");
    if (stored === null) return DEFAULTS.settings.showAgentName;
    return stored === "true";
  });
  const isDragging = useRef(false);

  // Check for updates after 5s + retry once at 20s to handle startup race.
  // Also re-check when the window becomes visible (e.g. tray click triggers
  // showMainWindow + performUpdateDownload — without this the panel stays
  // unaware and shows no banner/progress).
  // Additionally, listen for SSE "update-available" events pushed from the
  // server subscription so the banner appears immediately without polling.
  useEffect(() => {
    function check() {
      fetchUpdateInfo()
        .then((info) => {
          if (info.currentVersion) setCurrentVersion(info.currentVersion);
          if (info.updateAvailable) setUpdateInfo(info);
        })
        .catch(() => { });
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") check();
    }
    const firstTimer = setTimeout(check, 5_000);
    const retryTimer = setTimeout(check, 20_000);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const sse = new EventSource(SSE["chat.events"].path);
    sse.addEventListener("update-available", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as UpdateInfo & { currentVersion?: string };
        if (data.currentVersion) setCurrentVersion(data.currentVersion);
        if (data.updateAvailable) {
          setUpdateInfo(data);
        } else {
          setUpdateInfo(null);
        }
      } catch {
        // Ignore malformed SSE data
      }
    });

    sse.addEventListener("shop-updated", (e: MessageEvent) => {
      try {
        const { shopName } = JSON.parse(e.data) as { shopId: string; shopName: string };
        showToast(t("ecommerce.shopUpdatedToast", { shopName }), "success");
      } catch {
        // Ignore malformed SSE data
      }
    });

    return () => {
      clearTimeout(firstTimer);
      clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sse.close();
    };
  }, [showToast, t]);

  useEffect(() => {
    function onBrandDisplayChanged() {
      const stored = localStorage.getItem("showAgentName");
      setShowAgentName(stored === null ? true : stored === "true");
    }
    window.addEventListener("brand-display-changed", onBrandDisplayChanged);
    return () => window.removeEventListener("brand-display-changed", onBrandDisplayChanged);
  }, []);

  // Poll download status: fast (500ms) when actively downloading, slow (3s) when banner is visible.
  // Also fetch immediately when the window becomes visible so progress appears instantly
  // after a tray-triggered download.
  useEffect(() => {
    if (!updateInfo) return;
    function poll() {
      fetchUpdateDownloadStatus()
        .then((s) => {
          setDownloadStatus(s);
        })
        .catch(() => { });
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") poll();
    }
    const active =
      downloadStatus.status === "downloading" ||
      downloadStatus.status === "verifying" ||
      downloadStatus.status === "installing";
    const interval = active ? 500 : 3000;
    const id = setInterval(poll, interval);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [downloadStatus.status, updateInfo]);

  function handleDownload() {
    setDownloadStatus({ status: "downloading", percent: 0 });
    startUpdateDownload().catch((err) => {
      setDownloadStatus({
        status: "error",
        message: formatError(err),
      });
    });
  }

  function handleCancel() {
    cancelUpdateDownload().catch(() => { });
    setDownloadStatus({ status: "idle" });
  }

  function handleInstall() {
    setDownloadStatus({ status: "installing" });
    triggerUpdateInstall().catch((err) => {
      setDownloadStatus({
        status: "error",
        message: formatError(err),
      });
    });
  }

  function handleToggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
    updateSettings({ sidebar_collapsed: String(next) }).catch(() => {});
  }

  const handleMouseDown = useCallback(() => {
    if (collapsed) return;
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [collapsed]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setSidebarWidth(newWidth);
    }
    function onMouseUp() {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const navRoutes = ROUTES.filter(r =>
    r.navLabelKey &&
    !r.navHidden &&
    (!r.moduleGate || entityStore.isModuleEnrolled(r.moduleGate))
  );

  const showBanner = !!updateInfo;
  const ds = downloadStatus;

  // CS bridge warning: show when shops need CS on this device but bridge isn't connected.
  // Derived from entity store + device identity — mirrors CS bridge's syncFromCache() filter.
  const csBridgeState = runtimeStatus.csBridge.state;
  const showCsBridgeBanner =
    csBridgeState !== "connected" &&
    runtimeStatus.deviceId !== "" &&
    entityStore.shops.some((s) => {
      const cs = s.services?.customerService;
      return cs?.enabled && cs.csDeviceId === runtimeStatus.deviceId && cs.assembledPrompt;
    });

  return (
    <div className="layout-root">
      {showBanner && (
        <div className="update-banner">
          <span className="update-banner-content">
            {ds.status === "idle" && (
              <>
                {t("update.bannerText", { version: updateInfo.latestVersion })}
                <button
                  className="update-banner-action"
                  onClick={handleDownload}
                >
                  {t("update.download")}
                </button>
              </>
            )}
            {ds.status === "downloading" && (
              <>
                {t("update.downloading", { percent: ds.percent ?? 0 })}
                <span className="update-progress-bar">
                  <span
                    className="update-progress-fill"
                    style={{ width: `${ds.percent ?? 0}%` }}
                  />
                </span>
                <button className="update-banner-action" onClick={handleCancel}>
                  {t("update.cancel")}
                </button>
              </>
            )}
            {ds.status === "verifying" && t("update.verifying")}
            {ds.status === "ready" && (
              <>
                {t("update.ready")}{" "}
                <button
                  className="update-banner-action update-banner-action-primary"
                  onClick={handleInstall}
                >
                  {t("update.installRestart")}
                </button>
              </>
            )}
            {ds.status === "installing" && t("update.installing")}
            {ds.status === "error" && (
              <>
                {t("update.error", { message: ds.message ?? "" })}{" "}
                <button
                  className="update-banner-action"
                  onClick={handleDownload}
                >
                  {t("update.retry")}
                </button>
              </>
            )}
          </span>
        </div>
      )}
      {showCsBridgeBanner && (
        <div className="warning-banner">
          {csBridgeState === "reconnecting" && <span className="spinner" />}
          {csBridgeState === "reconnecting"
            ? t("ecommerce.shopDrawer.aiCS.bridgeReconnecting", { attempt: runtimeStatus.csBridge.reconnectAttempt })
            : t("ecommerce.shopDrawer.aiCS.bridgeDisconnected")}
        </div>
      )}
      <div className="layout-body">
        <nav
          className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}
          style={
            collapsed
              ? undefined
              : { width: sidebarWidth, minWidth: sidebarWidth }
          }
        >
          <button
            className="sidebar-collapse-toggle"
            onClick={handleToggleCollapse}
            title={collapsed ? t("nav.expand") : t("nav.collapse")}
          >
            <MenuIcon />
          </button>
          <h2 className="sidebar-brand">
            <img src="/icon.png" alt="" className="sidebar-brand-logo" />
            {!collapsed && (
              <>
                <span className="sidebar-brand-text">
                  {showAgentName && agentName && agentName !== "Assistant"
                    ? agentName
                    : t("common.brandName")}
                </span>
                {currentVersion && (
                  <span className="sidebar-version">v{currentVersion}</span>
                )}
              </>
            )}
          </h2>
          <ul className="nav-list">
            {navRoutes.map((route) => {
              const active = currentPath === route.path;
              return (
                <li key={route.path}>
                  <button
                    className={`nav-btn ${active ? "nav-active" : "nav-item"}`}
                    onClick={() => {
                      if (route.authRequired && !user) {
                        setPendingAuthPath(route.path);
                        setAuthModalOpen(true);
                      } else {
                        onNavigate(route.path);
                      }
                    }}
                    title={collapsed ? t(route.navLabelKey!) : undefined}
                  >
                    <span className="nav-icon">{route.icon}</span>
                    {!collapsed && (
                      <span className="nav-label">{t(route.navLabelKey!)}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <BottomActions collapsed={collapsed} onNavigate={onNavigate} />
          {!collapsed && (
            <div
              className="sidebar-resize-handle"
              onMouseDown={handleMouseDown}
            />
          )}
        </nav>
        <div className="main-content">
          <main>{children}</main>
        </div>
      </div>
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => { setAuthModalOpen(false); setPendingAuthPath(null); }}
        onSuccess={() => { if (pendingAuthPath) onNavigate(pendingAuthPath); }}
      />
    </div>
  );
});
