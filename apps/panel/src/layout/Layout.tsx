import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BottomActions } from "../components/BottomActions.js";
import { GlobalBannerStack } from "../components/banners/GlobalBannerStack.js";
import { ChevronRightIcon, MenuIcon, UserPlusIcon } from "../components/icons.js";
import { ROUTES, type RouteEntry } from "../routes.js";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../store/EntityStoreProvider.js";
import { useRuntimeStatus } from "../store/RuntimeStatusProvider.js";
import { AuthModal } from "../components/modals/AuthModal.js";
import { getUserInitial } from "../lib/user-manager.js";

const SIDEBAR_MIN = 140;
const SIDEBAR_MAX = 360;
const SIDEBAR_DEFAULT = 200;
const COLLAPSIBLE_NAV_GROUP_KEYS = new Set([
  "nav.group.automation",
  "nav.group.connections",
]);

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
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAuthPath, setPendingAuthPath] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [collapsedNavGroups, setCollapsedNavGroups] = useState<Set<string>>(
    () => new Set(COLLAPSIBLE_NAV_GROUP_KEYS),
  );
  const [collapsedNavParents, setCollapsedNavParents] = useState<Set<string>>(() => new Set());
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  // Sidebar-collapsed and show-agent-name are MST-backed (SSE-synced) —
  // read reactively; the `observer()` wrapper below handles re-renders.
  const collapsed = runtimeStatus.appSettings.sidebarCollapsed;
  const showAgentName = runtimeStatus.appSettings.showAgentName;
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

  const navRoutes = ROUTES.filter(r =>
    r.navLabelKey &&
    !r.navHidden &&
    (!r.navAuthOnly || !!user)
  );

  useEffect(() => {
    const activeRoute = navRoutes.find((route) => (
      currentPath === route.path ||
      (route.navGroupOnly ? currentPath.startsWith(`${route.path}/`) : false)
    ));
    const activeGroupKey = activeRoute?.navGroupKey;
    if (!activeGroupKey || !COLLAPSIBLE_NAV_GROUP_KEYS.has(activeGroupKey)) return;
    setCollapsedNavGroups((current) => {
      if (!current.has(activeGroupKey)) return current;
      const next = new Set(current);
      next.delete(activeGroupKey);
      return next;
    });
  }, [currentPath, navRoutes]);

  useEffect(() => {
    const activeParentPath = navRoutes.find((route) => (
      route.navGroupOnly && (
        currentPath === route.path ||
        currentPath.startsWith(`${route.path}/`)
      )
    ))?.path;
    if (!activeParentPath) return;
    setCollapsedNavParents((current) => {
      if (!current.has(activeParentPath)) return current;
      const next = new Set(current);
      next.delete(activeParentPath);
      return next;
    });
  }, [currentPath, navRoutes]);

  function toggleNavGroup(groupKey: string) {
    setCollapsedNavGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  function toggleNavParent(parentPath: string) {
    setCollapsedNavParents((current) => {
      const next = new Set(current);
      if (next.has(parentPath)) {
        next.delete(parentPath);
      } else {
        next.add(parentPath);
      }
      return next;
    });
  }

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

  function getNavTitle(route: RouteEntry) {
    if (route.pageKey === "account") {
      if (user) return user.email ?? t(route.navLabelKey!);
      if (authChecking) return t("common.loading");
      return t("auth.login");
    }
    return collapsed ? t(route.navLabelKey!) : undefined;
  }

  let currentNavGroupKey: string | undefined;

  return (
    <div className="layout-root">
      <GlobalBannerStack
        onNavigate={onNavigate}
        onCurrentVersionChange={setCurrentVersion}
      />
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
              const isGroupCollapsed = !collapsed && Boolean(
                route.navGroupKey && collapsedNavGroups.has(route.navGroupKey),
              );
              const isParentCollapsed = !collapsed && Boolean(
                route.parentPath && collapsedNavParents.has(route.parentPath),
              );
              if (isParentCollapsed) return null;
              if (collapsed && route.navGroupOnly) return null;
              const active = currentPath === route.path || (
                route.navGroupOnly
                  ? currentPath.startsWith(`${route.path}/`)
                  : false
              );
              const isSubItem = Boolean(route.parentPath);
              const startsGroup = !collapsed && route.navGroupKey && route.navGroupKey !== currentNavGroupKey;
              currentNavGroupKey = route.navGroupKey;
              return (
                <Fragment key={route.path}>
                  {startsGroup && (
                    <li>
                      {route.navGroupKey && COLLAPSIBLE_NAV_GROUP_KEYS.has(route.navGroupKey) ? (
                        <button
                          className="nav-group-heading nav-group-toggle"
                          type="button"
                          onClick={() => toggleNavGroup(route.navGroupKey!)}
                          aria-expanded={!collapsedNavGroups.has(route.navGroupKey)}
                        >
                          <span>{t(route.navGroupKey!)}</span>
                          <ChevronRightIcon
                            className={`nav-group-chevron${collapsedNavGroups.has(route.navGroupKey) ? "" : " nav-group-chevron-open"}`}
                          />
                        </button>
                      ) : (
                        <div className="nav-group-heading">{t(route.navGroupKey!)}</div>
                      )}
                    </li>
                  )}
                  {isGroupCollapsed ? null : <li>
                    {route.navGroupOnly ? (
                      collapsed ? null : (
                        <button
                          className={`nav-section-toggle${active ? " nav-section-active" : ""}`}
                          type="button"
                          onClick={() => toggleNavParent(route.path)}
                          aria-expanded={!collapsedNavParents.has(route.path)}
                          title={getNavTitle(route)}
                        >
                          <span className="nav-section-label">{t(route.navLabelKey!)}</span>
                          <ChevronRightIcon
                            className={`nav-section-chevron${collapsedNavParents.has(route.path) ? "" : " nav-section-chevron-open"}`}
                          />
                        </button>
                      )
                    ) : (
                      <button
                        className={`nav-btn ${isSubItem ? "nav-subitem" : ""} ${active ? "nav-active" : "nav-item"}`}
                        onClick={() => {
                          if (route.authRequired && authChecking) return;
                          if (route.authRequired && !user) {
                            setPendingAuthPath(route.path);
                            setAuthModalOpen(true);
                          } else {
                            onNavigate(route.path);
                          }
                        }}
                        title={getNavTitle(route)}
                      >
                        <span className="nav-icon">{renderNavIcon(route)}</span>
                        {!collapsed && (
                          <span className="nav-label">{t(route.navLabelKey!)}</span>
                        )}
                      </button>
                    )}
                  </li>}
                </Fragment>
              );
            })}
          </ul>
          <BottomActions collapsed={collapsed} />
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
