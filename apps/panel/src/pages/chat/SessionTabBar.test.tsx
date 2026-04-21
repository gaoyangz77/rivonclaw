import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionTabBar } from "./SessionTabBar.js";

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: vi.fn(),
  writable: true,
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

describe("SessionTabBar", () => {
  it("shows a local session's title as soon as one exists", () => {
    render(
      <SessionTabBar
        sessions={[
          { key: "agent:main:main" },
          { key: "agent:panel:test", isLocal: true, derivedTitle: "First prompt title" },
        ]}
        activeSessionKey="agent:panel:test"
        unreadKeys={new Set()}
        onSwitchSession={() => {}}
        onNewChat={() => {}}
        onArchiveSession={() => {}}
        onRenameSession={() => {}}
        onRestoreSession={() => {}}
        onReorderSession={() => {}}
      />,
    );

    expect(screen.getByText("First prompt title")).toBeTruthy();
    expect(screen.queryByText("chat.newSessionTitle")).toBeNull();
  });

  it("keeps the default label for a blank local session", () => {
    render(
      <SessionTabBar
        sessions={[
          { key: "agent:main:main" },
          { key: "agent:panel:test", isLocal: true },
        ]}
        activeSessionKey="agent:panel:test"
        unreadKeys={new Set()}
        onSwitchSession={() => {}}
        onNewChat={() => {}}
        onArchiveSession={() => {}}
        onRenameSession={() => {}}
        onRestoreSession={() => {}}
        onReorderSession={() => {}}
      />,
    );

    expect(screen.getByText("chat.newSessionTitle")).toBeTruthy();
  });
});
