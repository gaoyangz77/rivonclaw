import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BottomActions } from "../components/BottomActions.js";
import { GlobalBannerStack } from "../components/banners/GlobalBannerStack.js";
import { MenuIcon, OfficeIcon, UserPlusIcon } from "../components/icons.js";
import { ROUTES, type RouteEntry } from "../routes.js";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../store/EntityStoreProvider.js";
import { useRuntimeStatus } from "../store/RuntimeStatusProvider.js";
import { AuthModal } from "../components/modals/AuthModal.js";
import { getUserInitial } from "../lib/user-manager.js";
import { canSeeRoute } from "../lib/permission-scope.js";
import { TkHierarchicalNav } from "../components/design-system/index.js";
import { PageErrorBoundary } from "../components/PageErrorBoundary.js";
import { buildSidebarNavigationItems } from "./sidebar-navigation.js";
import { OfficeShutter } from "../components/office/OfficeShutter.js";
import { useOfficeShutter } from "../components/office/useOfficeShutter.js";

const SIDEBAR_MIN = 140;
const SIDEBAR_MAX = 360;
const SIDEBAR_DEFAULT = 200;

export const Layout = observer(function Layout({
  children,
  currentPath,
  onNavigate,
}: {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const runtimeStatus = useRuntimeStatus();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAuthPath, setPendingAuthPath] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  // Sidebar collapse is MST-backed (SSE-synced); observer() handles re-renders.
  const collapsed = runtimeStatus.appSettings.sidebarCollapsed;
  const isDragging = useRef(false);

  function handleToggleCollapse() {
    // MST action -> Desktop -> SQLite -> SSE patch back; observer re-renders.
    runtimeStatus.appSettings.setSidebarCollapsed(!collapsed).catch(() => {});
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

  const shutter = useOfficeShutter();

  const navRoutes = ROUTES.filter(
    (r) => r.navLabelKey && !r.navHidden && (!r.navAuthOnly || !!user) && canSeeRoute(r, user),
  );

  function renderNavIcon(route: RouteEntry) {
    if (route.pageKey !== "account") return route.icon;
    if (user) {
      return <span className="nav-account-avatar">{getUserInitial(user)}</span>;
    }
    if (authChecking) {
      return <span className="nav-account-avatar nav-account-avatar-loading">...</span>;
    }
    return <UserPlusIcon />;
  }

  const navigationItems = buildSidebarNavigationItems(navRoutes, {
    translate: (key) => t(key),
    getIcon: renderNavIcon,
    getGroupIcon: (_groupKey, groupRoutes) =>
      renderNavIcon(groupRoutes.find((route) => route.pageKey === "account") ?? groupRoutes[0]!),
    getFlyoutLabel: (label) => t("nav.secondaryNavigation", { label }),
  });

  function handleNavigationSelect(path: string) {
    const route = navRoutes.find((candidate) => candidate.path === path);
    if (!route) return;
    if (route.authRequired && authChecking) return;
    if (route.authRequired && !user) {
      setPendingAuthPath(route.path);
      setAuthModalOpen(true);
      return;
    }
    onNavigate(route.path);
  }

  return (
    <div className="layout-root">
      {/* The whole app is a roller shutter door with the pixel office behind
          it. Down (the normal state) the door is just the app plus a grab strip
          along its lower edge; the office is not mounted until something lifts
          the door, so the canvas renderer costs nothing while people work. */}
      <OfficeShutter shutter={shutter}>
      <GlobalBannerStack onNavigate={onNavigate} onCurrentVersionChange={setCurrentVersion} />
      <div className="layout-body">
        <aside
          className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}
          style={collapsed ? undefined : { width: sidebarWidth, minWidth: sidebarWidth }}
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
                <span className="sidebar-brand-text">{t("common.brandName")}</span>
                {currentVersion && <span className="sidebar-version">v{currentVersion}</span>}
              </>
            )}
          </h2>
          <TkHierarchicalNav
            items={navigationItems}
            value={currentPath}
            onChange={handleNavigationSelect}
            label={t("nav.mainNavigation")}
            collapsed={collapsed}
            className="sidebar-hierarchical-nav"
          />
          <BottomActions collapsed={collapsed} />
          <button
            type="button"
            className="office-screensaver-trigger"
            onClick={shutter.open}
            title={t("office.openHint")}
          >
            {collapsed ? <OfficeIcon /> : t("office.open")}
          </button>
          {!collapsed && <div className="sidebar-resize-handle" onMouseDown={handleMouseDown} />}
        </aside>
        <div className="main-content">
          <main>
            <PageErrorBoundary
              resetKey={currentPath}
              title={t("common.pageErrorTitle", { defaultValue: "This page ran into a problem" })}
              message={t("common.pageErrorMessage", {
                defaultValue:
                  "The navigation is still available. Reload this page, or open another section and come back.",
              })}
              retryLabel={t("common.reload", { defaultValue: "Reload page" })}
            >
              {children}
            </PageErrorBoundary>
          </main>
        </div>
      </div>
      </OfficeShutter>
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingAuthPath(null);
        }}
        onSuccess={() => {
          if (pendingAuthPath) onNavigate(pendingAuthPath);
        }}
      />
    </div>
  );
});
