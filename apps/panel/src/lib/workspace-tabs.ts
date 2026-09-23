import {
  MAX_WORKSPACE_TABS,
  type WorkspaceDescriptor,
} from "@rivonclaw/core/api-contract";

export type WorkspaceTab = WorkspaceDescriptor["tabs"][number];
const RESTORED_FALLBACK_TAB_ID = "workspace-fallback";

export function createWorkspace(path: string, id: string = crypto.randomUUID()): WorkspaceDescriptor {
  return { version: 1, tabs: [{ id, path, view: {} }], activeTabId: id };
}

export function activeWorkspaceTab(workspace: WorkspaceDescriptor): WorkspaceTab {
  return workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ?? workspace.tabs[0]!;
}

export function openWorkspaceRoute(
  workspace: WorkspaceDescriptor,
  path: string,
  id: string = crypto.randomUUID(),
): WorkspaceDescriptor | null {
  const existing = workspace.tabs.find((tab) => tab.path === path);
  if (existing) return { ...workspace, activeTabId: existing.id };
  if (workspace.tabs.length >= MAX_WORKSPACE_TABS) return null;
  return {
    ...workspace,
    tabs: [...workspace.tabs, { id, path, view: {} }],
    activeTabId: id,
  };
}

export function activateWorkspaceTab(
  workspace: WorkspaceDescriptor,
  id: string,
): WorkspaceDescriptor {
  return workspace.tabs.some((tab) => tab.id === id)
    ? { ...workspace, activeTabId: id }
    : workspace;
}

export function closeWorkspaceTab(
  workspace: WorkspaceDescriptor,
  id: string,
  fallbackPath: string,
  newId: string = crypto.randomUUID(),
): WorkspaceDescriptor {
  const index = workspace.tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return workspace;
  const tabs = workspace.tabs.filter((tab) => tab.id !== id);
  if (tabs.length === 0) return createWorkspace(fallbackPath, newId);
  const activeTabId =
    workspace.activeTabId === id
      ? tabs[Math.min(index, tabs.length - 1)]!.id
      : workspace.activeTabId;
  return { ...workspace, tabs, activeTabId };
}

export function setWorkspaceTabView(
  workspace: WorkspaceDescriptor,
  id: string,
  view: Record<string, string>,
): WorkspaceDescriptor {
  return {
    ...workspace,
    tabs: workspace.tabs.map((tab) => (tab.id === id ? { ...tab, view } : tab)),
  };
}

export function restoreWorkspace(
  raw: WorkspaceDescriptor | null,
  fallbackPath: string,
  allowed: (path: string) => boolean,
  allowedViewKeys: (path: string) => readonly string[],
): WorkspaceDescriptor {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.tabs)) {
    return createWorkspace(fallbackPath, RESTORED_FALLBACK_TAB_ID);
  }
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();
  const tabs: WorkspaceTab[] = [];
  for (const candidate of raw.tabs) {
    if (
      !candidate ||
      typeof candidate.id !== "string" ||
      typeof candidate.path !== "string" ||
      !allowed(candidate.path) ||
      seenPaths.has(candidate.path) ||
      seenIds.has(candidate.id)
    ) {
      continue;
    }
    const keys = new Set(allowedViewKeys(candidate.path));
    const view = Object.fromEntries(
      Object.entries(candidate.view ?? {}).filter(
        ([key, value]) => keys.has(key) && typeof value === "string",
      ),
    );
    tabs.push({ id: candidate.id, path: candidate.path, view });
    seenPaths.add(candidate.path);
    seenIds.add(candidate.id);
    if (tabs.length === MAX_WORKSPACE_TABS) break;
  }
  if (tabs.length === 0) return createWorkspace(fallbackPath, RESTORED_FALLBACK_TAB_ID);
  return {
    version: 1,
    tabs,
    activeTabId: tabs.some((tab) => tab.id === raw.activeTabId) ? raw.activeTabId : tabs[0]!.id,
  };
}
