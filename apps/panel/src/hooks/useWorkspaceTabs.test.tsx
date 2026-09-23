import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWorkspaceTabs } from "./useWorkspaceTabs.js";

const mocks = vi.hoisted(() => ({
  fetchWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
  clearStore: vi.fn(),
}));

vi.mock("../api/workspace.js", () => ({
  fetchWorkspace: mocks.fetchWorkspace,
  saveWorkspace: mocks.saveWorkspace,
}));
vi.mock("../api/apollo-client.js", () => ({
  getClient: () => ({ clearStore: mocks.clearStore }),
}));

describe("useWorkspaceTabs", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/account/settings");
    mocks.fetchWorkspace.mockReset().mockResolvedValue(null);
    mocks.saveWorkspace.mockReset().mockResolvedValue(undefined);
    mocks.clearStore.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("keeps an authorized route after account change when tabs are disabled", async () => {
    const { result, rerender } = renderHook(
      ({ userId }) => useWorkspaceTabs({
        userId,
        isOwner: true,
        scopeSignature: "",
        bootstrapReady: true,
        tabsEnabled: false,
      }),
      { initialProps: { userId: null as string | null } },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.workspace.tabs[0]?.path).toBe("/account/settings");

    rerender({ userId: "user-1" });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.workspace.tabs[0]?.path).toBe("/account/settings");
    expect(mocks.fetchWorkspace).not.toHaveBeenCalled();
    expect(mocks.clearStore).toHaveBeenCalledOnce();
  });

  it("keeps loaded tabs ready during a same-account auth refresh", async () => {
    const { result, rerender } = renderHook(
      ({ bootstrapReady }) => useWorkspaceTabs({
        userId: "user-1",
        isOwner: true,
        scopeSignature: "",
        bootstrapReady,
        tabsEnabled: true,
      }),
      { initialProps: { bootstrapReady: true } },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    const activeTabId = result.current.workspace.activeTabId;

    rerender({ bootstrapReady: false });
    expect(result.current.ready).toBe(true);
    expect(result.current.workspace.activeTabId).toBe(activeTabId);
    expect(mocks.fetchWorkspace).toHaveBeenCalledOnce();
  });

  it("opens a usable in-memory workspace if Desktop restoration fails", async () => {
    mocks.fetchWorkspace.mockRejectedValueOnce(new Error("unavailable"));
    const { result } = renderHook(() => useWorkspaceTabs({
      userId: "user-1",
      isOwner: true,
      scopeSignature: "",
      bootstrapReady: true,
      tabsEnabled: true,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.loadError?.message).toBe("unavailable");
    expect(result.current.workspace.tabs[0]?.path).toBe("/automation/skills");
    expect(mocks.saveWorkspace).not.toHaveBeenCalled();
  });
});
