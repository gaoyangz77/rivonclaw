// @vitest-environment jsdom

import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import type { RouteEntry } from "../routes.js";
import { buildSidebarNavigationItems, selectSidebarRoutes } from "./sidebar-navigation.js";

const Page = (() => null) as ComponentType;

function route(overrides: Partial<RouteEntry> & Pick<RouteEntry, "path" | "pageKey">): RouteEntry {
  return {
    component: Page,
    navLabelKey: `label.${overrides.pageKey}`,
    ...overrides,
  };
}

describe("buildSidebarNavigationItems", () => {
  it("keeps parentPath routes out of the default level and places them in the parent flyout", () => {
    const items = buildSidebarNavigationItems(
      [
        route({ path: "/", pageKey: "chat" }),
        route({
          path: "/customer-service",
          pageKey: "customer-service",
          navGroupOnly: true,
        }),
        route({
          path: "/customer-service/conversations",
          pageKey: "conversations",
          parentPath: "/customer-service",
        }),
        route({
          path: "/customer-service/escalations",
          pageKey: "escalations",
          parentPath: "/customer-service",
        }),
      ],
      {
        translate: (key) => key,
        getFlyoutLabel: (label) => `${label}.submenu`,
      },
    );

    expect(items.map((item) => item.id)).toEqual(["/", "/customer-service"]);
    expect(items[1]).toMatchObject({
      flyoutLabel: "label.customer-service.submenu",
      children: [
        { id: "/customer-service/conversations", label: "label.conversations" },
        { id: "/customer-service/escalations", label: "label.escalations" },
      ],
    });
  });

  it("turns each navGroupKey into one first-level disclosure in registry order", () => {
    const extensionIcon = "extension-icon";
    const items = buildSidebarNavigationItems(
      [
        route({
          path: "/automation/skills",
          pageKey: "skills",
          navGroupKey: "nav.group.automation",
          navGroupIcon: extensionIcon,
        }),
        route({
          path: "/automation/crons",
          pageKey: "crons",
          navGroupKey: "nav.group.automation",
        }),
        route({ path: "/inventory", pageKey: "inventory" }),
      ],
      { translate: (key) => key },
    );

    expect(items.map((item) => item.id)).toEqual(["nav-group:nav.group.automation", "/inventory"]);
    expect(items[0]?.children?.map((child) => child.id)).toEqual([
      "/automation/skills",
      "/automation/crons",
    ]);
    expect(items[0]?.icon).toBe(extensionIcon);
  });
});

describe("selectSidebarRoutes", () => {
  const routes = [
    route({ path: "/", pageKey: "chat" }),
    route({ path: "/affiliate", pageKey: "affiliate", navGroupOnly: true }),
    route({ path: "/affiliate/team", pageKey: "team", parentPath: "/affiliate" }),
    route({ path: "/affiliate/attention", pageKey: "attention", parentPath: "/affiliate" }),
    route({ path: "/cs", pageKey: "cs", navGroupOnly: true }),
    route({ path: "/cs/conversations", pageKey: "conversations", parentPath: "/cs" }),
  ];

  it("keeps a group-only parent whose own page is hidden when one of its children is visible", () => {
    const visible = new Set(["/", "/affiliate/attention"]);
    const selected = selectSidebarRoutes(routes, (entry) => visible.has(entry.path)).map(
      (entry) => entry.path,
    );

    expect(selected).toEqual(["/", "/affiliate", "/affiliate/attention"]);
  });

  it("does not add a hidden group-only parent none of whose children are visible", () => {
    const selected = selectSidebarRoutes(routes, (entry) => entry.path === "/").map(
      (entry) => entry.path,
    );

    expect(selected).toEqual(["/"]);
  });
});
