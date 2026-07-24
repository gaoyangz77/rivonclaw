import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Layout } from "./Layout.js";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "common.brandName" ? "TK Copilot" : key),
  }),
}));

vi.mock("../components/BottomActions.js", () => ({
  BottomActions: () => null,
}));

vi.mock("../components/banners/GlobalBannerStack.js", () => ({
  GlobalBannerStack: () => null,
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
      agentName?: string;
      children: React.ReactNode;
    }>;
    render(
      React.createElement(LegacyLayout, {
        currentPath: "/",
        onNavigate: () => {},
        agentName: "Customer Named Agent",
        children: <div>content</div>,
      }),
    );

    expect(screen.getByText("TK Copilot")).toBeTruthy();
    expect(screen.queryByText("Customer Named Agent")).toBeNull();
  });
});
