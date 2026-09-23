import { describe, expect, it } from "vitest";
import type { WorkspaceDescriptor } from "@rivonclaw/core/api-contract";
import {
  activeWorkspaceTab,
  closeWorkspaceTab,
  createWorkspace,
  openWorkspaceRoute,
  restoreWorkspace,
  setWorkspaceTabView,
} from "./workspace-tabs.js";

describe("workspace tabs", () => {
  it("opens a route once, activates it, and closes to the adjacent tab", () => {
    const first = createWorkspace("/", "chat");
    const second = openWorkspaceRoute(first, "/providers", "providers")!;
    const again = openWorkspaceRoute(second, "/", "unused")!;
    expect(again.tabs).toHaveLength(2);
    expect(activeWorkspaceTab(again).id).toBe("chat");
    expect(activeWorkspaceTab(closeWorkspaceTab(again, "chat", "/"))).toMatchObject({
      id: "providers",
    });
  });

  it("preserves only authorized unique routes and declared view params on restore", () => {
    const saved: WorkspaceDescriptor = {
      version: 1,
      activeTabId: "blocked",
      tabs: [
        { id: "team", path: "/commerce/affiliate/team", view: { view: "safety", token: "secret" } },
        { id: "duplicate", path: "/commerce/affiliate/team", view: {} },
        { id: "blocked", path: "/billing", view: {} },
      ],
    };
    const restored = restoreWorkspace(
      saved,
      "/",
      (path) => path === "/commerce/affiliate/team",
      () => ["view"],
    );
    expect(restored.tabs).toEqual([
      { id: "team", path: "/commerce/affiliate/team", view: { view: "safety" } },
    ]);
    expect(restored.activeTabId).toBe("team");
  });

  it("enforces the eight-tab limit and recreates a landing tab after the last close", () => {
    let workspace = createWorkspace("/", "0");
    for (let index = 1; index < 8; index++) {
      workspace = openWorkspaceRoute(workspace, `/${index}`, String(index))!;
    }
    expect(openWorkspaceRoute(workspace, "/8", "8")).toBeNull();
    expect(closeWorkspaceTab(createWorkspace("/", "only"), "only", "/providers", "new")).toEqual({
      version: 1,
      tabs: [{ id: "new", path: "/providers", view: {} }],
      activeTabId: "new",
    });
  });

  it("keeps view state with its own tab", () => {
    const workspace = openWorkspaceRoute(createWorkspace("/", "chat"), "/team", "team")!;
    const updated = setWorkspaceTabView(workspace, "team", { view: "assignments" });
    expect(updated.tabs[0]?.view).toEqual({});
    expect(updated.tabs[1]?.view).toEqual({ view: "assignments" });
  });

  it("uses a stable fallback tab when every restored route is denied", () => {
    const raw = createWorkspace("/billing", "denied");
    const restore = () => restoreWorkspace(raw, "/", () => false, () => []);
    expect(restore()).toEqual(restore());
  });
});
