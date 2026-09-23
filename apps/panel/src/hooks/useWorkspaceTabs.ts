import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceDescriptor } from "@rivonclaw/core/api-contract";
import { fetchWorkspace, saveWorkspace } from "../api/workspace.js";
import { getClient } from "../api/apollo-client.js";
import { ROUTE_MAP, resolveLandingPath } from "../routes.js";
import { canSeeRoute } from "../lib/permission-scope.js";
import {
  activateWorkspaceTab,
  activeWorkspaceTab,
  closeWorkspaceTab,
  createWorkspace,
  openWorkspaceRoute,
  restoreWorkspace,
  setWorkspaceTabView,
} from "../lib/workspace-tabs.js";

function viewFromSearch(path: string, search: string): Record<string, string> {
  const allowed = new Set(ROUTE_MAP.get(path)?.viewParams ?? []);
  return Object.fromEntries(
    [...new URLSearchParams(search)].filter(([key]) => allowed.has(key)),
  );
}

export function useWorkspaceTabs({
  userId,
  isOwner,
  scopeSignature,
  bootstrapReady,
  tabsEnabled,
}: {
  userId: string | null;
  isOwner: boolean;
  scopeSignature: string;
  bootstrapReady: boolean;
  tabsEnabled: boolean;
}) {
  const [workspace, setWorkspace] = useState<WorkspaceDescriptor>(() => createWorkspace("/"));
  const workspaceRef = useRef(workspace);
  const [loadedAccountKey, setLoadedAccountKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [persistableAccountKey, setPersistableAccountKey] = useState<string | null>(null);
  const loadedAccountKeyRef = useRef<string | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const previousUserId = useRef<string | null | undefined>(undefined);
  const initialUrl = useRef(new URL(window.location.href));
  const initialLoad = useRef(true);
  const accountKey = userId === null ? "guest" : `user:${userId}`;
  const scopes = scopeSignature ? scopeSignature.split(",") : [];
  const fallbackPath = userId ? resolveLandingPath(scopes) : "/";

  const allowed = useCallback(
    (path: string) => {
      const route = ROUTE_MAP.get(path);
      if (!route || route.internal) return false;
      if (route.authRequired && !userId) return false;
      return canSeeRoute(
        route,
        userId ? { isOwner, permissionScopes: scopes } : null,
      );
    },
    [userId, isOwner, scopeSignature], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const allowedRef = useRef(allowed);
  const fallbackPathRef = useRef(fallbackPath);
  allowedRef.current = allowed;
  fallbackPathRef.current = fallbackPath;

  // Scope changes filter the live workspace without remounting the authorized tabs.
  const visibleWorkspace = useMemo(
    () => restoreWorkspace(workspace, fallbackPath, allowed, (path) => ROUTE_MAP.get(path)?.viewParams ?? []),
    [workspace, fallbackPath, allowed],
  );

  const commit = useCallback((next: WorkspaceDescriptor) => {
    workspaceRef.current = next;
    setWorkspace(next);
  }, []);

  const persist = useCallback((accountId: string | null, snapshot: WorkspaceDescriptor) => {
    const task = saveQueue.current.catch(() => {}).then(async () => {
      if (userIdRef.current !== accountId) return;
      try {
        await saveWorkspace(accountId, snapshot);
        if (userIdRef.current === accountId) setSaveError(null);
      } catch (error) {
        if (userIdRef.current === accountId) {
          setSaveError(error instanceof Error ? error : new Error(String(error)));
        }
        throw error;
      }
    });
    saveQueue.current = task;
    return task;
  }, []);

  useEffect(() => {
    if (!bootstrapReady || loadedAccountKeyRef.current === accountKey) return;
    let cancelled = false;
    setLoadError(null);
    setPersistableAccountKey(null);
    void (async () => {
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        await getClient().clearStore();
      }
      previousUserId.current = userId;
      if (!tabsEnabled) {
        const requestedPath = initialLoad.current
          ? initialUrl.current.pathname : workspaceRef.current.tabs[0]?.path;
        const initialPath = requestedPath && allowedRef.current(requestedPath)
          ? requestedPath : fallbackPathRef.current;
        const single = createWorkspace(initialPath);
        commit(single);
        initialLoad.current = false;
        loadedAccountKeyRef.current = accountKey;
        setLoadedAccountKey(accountKey);
        return;
      }
      const stored = await fetchWorkspace(userId);
      if (cancelled) return;
      let restored = restoreWorkspace(
        stored,
        fallbackPathRef.current,
        allowedRef.current,
        (path) => ROUTE_MAP.get(path)?.viewParams ?? [],
      );
      if (initialLoad.current) {
        const path = initialUrl.current.pathname;
        if (path !== "/" && allowedRef.current(path)) {
          const opened = openWorkspaceRoute(restored, path);
          if (opened) {
            const active = activeWorkspaceTab(opened);
            restored = setWorkspaceTabView(
              opened,
              active.id,
              viewFromSearch(path, initialUrl.current.search),
            );
          }
        }
        initialLoad.current = false;
      }
      commit(restored);
      loadedAccountKeyRef.current = accountKey;
      setLoadedAccountKey(accountKey);
      setPersistableAccountKey(accountKey);
    })().catch((error: unknown) => {
      if (cancelled) return;
      setLoadError(error instanceof Error ? error : new Error(String(error)));
      // Local pages remain usable while Desktop account validation or storage is unavailable.
      commit(createWorkspace(fallbackPathRef.current));
      loadedAccountKeyRef.current = accountKey;
      setLoadedAccountKey(accountKey);
    });
    return () => {
      cancelled = true;
    };
  }, [bootstrapReady, accountKey, userId, tabsEnabled, commit]);

  const ready = loadedAccountKey === accountKey;

  useEffect(() => {
    if (!ready || visibleWorkspace === workspace) return;
    const changed = visibleWorkspace.activeTabId !== workspace.activeTabId ||
      visibleWorkspace.tabs.length !== workspace.tabs.length ||
      visibleWorkspace.tabs.some((tab, index) => tab.id !== workspace.tabs[index]?.id);
    if (changed) commit(visibleWorkspace);
  }, [ready, visibleWorkspace, workspace, commit]);

  useEffect(() => {
    if (!tabsEnabled || !ready || persistableAccountKey !== accountKey) return;
    const timeout = window.setTimeout(() => {
      void persist(userId, workspace).catch(() => {});
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [tabsEnabled, ready, persistableAccountKey, accountKey, userId, workspace, persist]);

  useEffect(() => {
    if (!ready) return;
    const active = activeWorkspaceTab(visibleWorkspace);
    const query = new URLSearchParams(active.view).toString();
    const url = `${active.path}${query ? `?${query}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.replaceState({ workspaceTabId: active.id }, "", url);
    }
  }, [ready, visibleWorkspace]);

  const openRoute = useCallback(
    (path: string, view?: Record<string, string>): "opened" | "limit" | "forbidden" => {
      if (!allowed(path)) return "forbidden";
      if (!tabsEnabled) {
        if (workspaceRef.current.tabs[0]?.path !== path) {
          const single = createWorkspace(path);
          commit(view ? setWorkspaceTabView(single, single.activeTabId, view) : single);
        } else if (view) {
          commit(setWorkspaceTabView(workspaceRef.current, workspaceRef.current.activeTabId, view));
        }
        return "opened";
      }
      const current = restoreWorkspace(
        workspaceRef.current, fallbackPathRef.current, allowedRef.current,
        (routePath) => ROUTE_MAP.get(routePath)?.viewParams ?? [],
      );
      const opened = openWorkspaceRoute(current, path);
      if (!opened) return "limit";
      const active = activeWorkspaceTab(opened);
      const next = view
        ? setWorkspaceTabView(opened, active.id, viewFromSearch(path, new URLSearchParams(view).toString()))
        : opened;
      if (next.activeTabId !== current.activeTabId ||
          next.tabs.length !== current.tabs.length || view) commit(next);
      return "opened";
    },
    [allowed, tabsEnabled, commit],
  );

  useEffect(() => {
    if (!ready) return;
    const onPopState = () => {
      const path = window.location.pathname;
      if (openRoute(path, viewFromSearch(path, window.location.search)) !== "opened") {
        const active = activeWorkspaceTab(workspaceRef.current);
        const query = new URLSearchParams(active.view).toString();
        window.history.replaceState(
          { workspaceTabId: active.id }, "", `${active.path}${query ? `?${query}` : ""}`,
        );
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [ready, openRoute]);

  return {
    workspace: visibleWorkspace,
    ready,
    loadError,
    saveError,
    flush: () => tabsEnabled && persistableAccountKey === accountKey
      ? persist(userId, workspaceRef.current)
      : Promise.resolve(),
    openRoute,
    activateTab: (id: string) => {
      if (id !== workspaceRef.current.activeTabId)
        commit(activateWorkspaceTab(workspaceRef.current, id));
    },
    closeTab: (id: string) => commit(closeWorkspaceTab(workspaceRef.current, id, fallbackPath)),
    reorderTab: (id: string, targetIndex: number) => {
      const current = workspaceRef.current;
      const from = current.tabs.findIndex((tab) => tab.id === id);
      if (from < 0 || from === targetIndex || targetIndex < 0 || targetIndex >= current.tabs.length)
        return;
      const tabs = [...current.tabs];
      const [tab] = tabs.splice(from, 1);
      tabs.splice(targetIndex, 0, tab!);
      commit({ ...current, tabs });
    },
    setTabView: (id: string, view: Record<string, string>) => {
      const tab = workspaceRef.current.tabs.find((candidate) => candidate.id === id);
      if (!tab) return;
      const filtered = viewFromSearch(tab.path, new URLSearchParams(view).toString());
      if (JSON.stringify(tab.view) === JSON.stringify(filtered)) return;
      commit(setWorkspaceTabView(workspaceRef.current, id, filtered));
    },
  };
}
