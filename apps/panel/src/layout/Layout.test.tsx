import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Layout } from "./Layout.js";

vi.mock("../tutorial/TutorialProvider.js", () => ({
  useTutorial: () => ({ isPlaying: false }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "common.brandName" ? "TK Copilot" : key),
  }),
}));

vi.mock("../components/BottomActions.js", () => ({
  BottomActions: () => null,
}));

vi.mock("../components/banners/GlobalBannerStack.js", () => ({
  GlobalBannerStack: () => (
    <>
      <div role="status">First warning</div>
      <div role="status">Second warning</div>
    </>
  ),
}));

vi.mock("../components/icons.js", () => ({
  ChevronRightIcon: () => null,
  MenuIcon: () => null,
  UserPlusIcon: () => null,
}));

vi.mock("../routes.js", () => ({
  ROUTES: [],
}));

vi.mock("../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({
    currentUser: null,
    authBootstrap: { status: "ready" },
  }),
}));

vi.mock("../store/RuntimeStatusProvider.js", () => ({
  useRuntimeStatus: () => ({
    appSettings: {
      sidebarCollapsed: false,
      showAgentName: true,
      setSidebarCollapsed: vi.fn(),
    },
  }),
}));

vi.mock("../components/modals/AuthModal.js", () => ({
  AuthModal: () => null,
}));

vi.mock("../lib/user-manager.js", () => ({
  getUserInitial: () => "U",
}));

describe("Layout branding", () => {
  it("keeps the localized product name even when a legacy agent-name preference is enabled", () => {
    const LegacyLayout = Layout as unknown as React.ComponentType<{
      currentPath: string;
      onNavigate: (path: string) => void;
      workspaceTabs: Array<{ id: string; label: string }>;
      activeTabId: string;
      onActivateTab: (id: string) => void;
      onCloseTab: (id: string) => void;
      onReorderTab: (id: string, index: number) => void;
      onAuthSuccess: (path: string) => void;
      showWorkspaceTabs: boolean;
      agentName?: string;
      children: React.ReactNode;
    }>;
    render(
      React.createElement(LegacyLayout, {
        currentPath: "/",
        onNavigate: () => {},
        workspaceTabs: [{ id: "chat", label: "Chat" }],
        activeTabId: "chat",
        onActivateTab: () => {},
        onCloseTab: () => {},
        onReorderTab: () => {},
        onAuthSuccess: () => {},
        showWorkspaceTabs: true,
        agentName: "Customer Named Agent",
        children: <div>content</div>,
      }),
    );

    expect(screen.getByText("TK Copilot")).toBeTruthy();
    expect(screen.queryByText("Customer Named Agent")).toBeNull();
  });
});

describe("Layout workspace tabs", () => {
  it("renders the tab strip between stacked banners and the page", () => {
    const { container } = render(
      <Layout
        currentPath="/"
        onNavigate={() => {}}
        workspaceTabs={[{ id: "chat", label: "Chat" }]}
        activeTabId="chat"
        onActivateTab={() => {}}
        onCloseTab={() => {}}
        onReorderTab={() => {}}
        onAuthSuccess={() => {}}
        showWorkspaceTabs
      >
        <div data-testid="page-content">Page content</div>
      </Layout>,
    );

    const banners = screen.getAllByRole("status");
    const tablist = screen.getByRole("tablist", { name: "workspace.tabs" });
    const page = screen.getByTestId("page-content");
    expect(banners).toHaveLength(2);
    expect(container.contains(tablist)).toBe(true);
    expect(banners[1]!.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tablist.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
