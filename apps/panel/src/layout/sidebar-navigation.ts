import type { ReactNode } from "react";
import type { TkHierarchicalNavItem } from "../components/design-system/index.js";
import type { RouteEntry } from "../routes.js";

const NAV_GROUP_ID_PREFIX = "nav-group:";

export interface SidebarNavigationOptions {
  translate: (key: string) => string;
  getIcon?: (route: RouteEntry) => ReactNode;
  getGroupIcon?: (groupKey: string, routes: readonly RouteEntry[]) => ReactNode;
  getFlyoutLabel?: (label: string) => string;
}

/**
 * Converts the flat route registry into the two-level navigation contract.
 *
 * - `parentPath` routes become children of their registered parent.
 * - `navGroupKey` routes become children of one generated first-level group.
 * - ungrouped routes remain direct navigation leaves.
 *
 * Keeping this transformation outside Layout prevents route visibility,
 * permissions and presentation from drifting into separate menu definitions.
 */
export function buildSidebarNavigationItems(
  routes: readonly RouteEntry[],
  {
    translate,
    getIcon = (route) => route.icon,
    getGroupIcon,
    getFlyoutLabel,
  }: SidebarNavigationOptions,
): TkHierarchicalNavItem[] {
  const routesByParent = new Map<string, RouteEntry[]>();
  const routesByGroup = new Map<string, RouteEntry[]>();

  for (const route of routes) {
    if (route.parentPath) {
      const siblings = routesByParent.get(route.parentPath) ?? [];
      siblings.push(route);
      routesByParent.set(route.parentPath, siblings);
    }
    if (route.navGroupKey) {
      const groupRoutes = routesByGroup.get(route.navGroupKey) ?? [];
      groupRoutes.push(route);
      routesByGroup.set(route.navGroupKey, groupRoutes);
    }
  }

  const emittedGroups = new Set<string>();
  const items: TkHierarchicalNavItem[] = [];

  for (const route of routes) {
    if (!route.navLabelKey || route.parentPath) continue;

    if (route.navGroupKey) {
      if (emittedGroups.has(route.navGroupKey)) continue;
      emittedGroups.add(route.navGroupKey);

      const groupRoutes = routesByGroup.get(route.navGroupKey) ?? [];
      const label = translate(route.navGroupKey);
      items.push({
        id: `${NAV_GROUP_ID_PREFIX}${route.navGroupKey}`,
        label,
        icon: getGroupIcon?.(route.navGroupKey, groupRoutes) ?? getIcon(route),
        flyoutLabel: getFlyoutLabel?.(label),
        children: groupRoutes.map((child) => ({
          id: child.path,
          label: translate(child.navLabelKey!),
        })),
      });
      continue;
    }

    const childRoutes = routesByParent.get(route.path) ?? [];
    const label = translate(route.navLabelKey);
    if (route.navGroupOnly && childRoutes.length > 0) {
      items.push({
        id: route.path,
        label,
        icon: getIcon(route),
        flyoutLabel: getFlyoutLabel?.(label),
        children: childRoutes.map((child) => ({
          id: child.path,
          label: translate(child.navLabelKey!),
        })),
      });
      continue;
    }

    items.push({
      id: route.path,
      label,
      icon: getIcon(route),
    });
  }

  return items;
}
