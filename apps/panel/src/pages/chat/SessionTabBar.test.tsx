import { fireEvent, render, screen } from "@testing-library/react";
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
  it("renders sessions in a sidebar list with header and archive actions separated", () => {
    const { container } = render(
      <SessionTabBar
        sessions={[
          { key: "agent:main:main" },
          { key: "agent:panel:first", isLocal: true, panelTitle: "First" },
          { key: "agent:panel:second", isLocal: true, panelTitle: "Second" },
        ]}
        activeSessionKey="agent:panel:first"
        unreadKeys={new Set()}
        onSwitchSession={() => {}}
        onNewChat={() => {}}
        onArchiveSession={() => {}}
        onRenameSession={() => {}}
        onRestoreSession={() => {}}
        onReorderSession={() => {}}
      />,
    );

    const sidebar = container.querySelector(".chat-session-tabs");
    const header = container.querySelector(".chat-session-tabs-header");
    const list = container.querySelector(".chat-session-tabs-scroll");
    const actions = container.querySelector(".chat-session-tabs-actions");

    expect(sidebar).toBeTruthy();
    expect(header?.contains(screen.getByText("chat.newSession"))).toBe(true);
    expect(list?.querySelectorAll(".chat-session-tab")).toHaveLength(3);
    expect(actions?.textContent).toContain("chat.archivedSessions");
    expect(sidebar?.children[0]).toBe(header);
    expect(sidebar?.children[1]).toBe(list);
    expect(sidebar?.children[2]).toBe(actions);
    expect(container.querySelector(".chat-session-resize-handle")).toBeTruthy();
  });

  it("lets users resize the chat session sidebar horizontally", () => {
    const { container } = render(
      <SessionTabBar
        sessions={[
          { key: "agent:main:main" },
          { key: "agent:panel:first", isLocal: true, panelTitle: "First" },
        ]}
        activeSessionKey="agent:panel:first"
        unreadKeys={new Set()}
        onSwitchSession={() => {}}
        onNewChat={() => {}}
        onArchiveSession={() => {}}
        onRenameSession={() => {}}
        onRestoreSession={() => {}}
        onReorderSession={() => {}}
      />,
    );

    const sidebar = container.querySelector(".chat-session-tabs") as HTMLElement;
    const handle = container.querySelector(".chat-session-resize-handle") as HTMLElement;
    expect(sidebar.style.width).toBe("260px");

    fireEvent.mouseDown(handle, { clientX: 260 });
    fireEvent.mouseMove(document, { clientX: 320 });
    expect(sidebar.style.width).toBe("320px");
    expect(document.body.style.cursor).toBe("col-resize");

    fireEvent.mouseUp(document);
    expect(document.body.style.cursor).toBe("");
  });

  it("shows a local session's title as soon as one exists", () => {
    render(
      <SessionTabBar
        sessions={[
          { key: "agent:main:main" },
          { key: "agent:panel:test", isLocal: true, panelTitle: "First prompt title" },
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

  it("prefers a panel title over a gateway derived title for panel sessions", () => {
    render(
      <SessionTabBar
        sessions={[
          { key: "agent:main:main" },
          { key: "agent:main:panel-9137969f", panelTitle: "我的首条消息", derivedTitle: "panel-9137969f" },
        ]}
        activeSessionKey="agent:main:panel-9137969f"
        unreadKeys={new Set()}
        onSwitchSession={() => {}}
        onNewChat={() => {}}
        onArchiveSession={() => {}}
        onRenameSession={() => {}}
        onRestoreSession={() => {}}
        onReorderSession={() => {}}
      />,
    );

    expect(screen.getByText("我的首条消息")).toBeTruthy();
    expect(screen.queryByText("panel-9137969f")).toBeNull();
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

  it("keeps row archive and inline rename actions working in the sidebar", () => {
    const onArchiveSession = vi.fn();
    const onRenameSession = vi.fn();
    const { container } = render(
      <SessionTabBar
        sessions={[
          { key: "agent:main:main" },
          { key: "agent:panel:first", isLocal: true, panelTitle: "First" },
        ]}
        activeSessionKey="agent:panel:first"
        unreadKeys={new Set()}
        onSwitchSession={() => {}}
        onNewChat={() => {}}
        onArchiveSession={onArchiveSession}
        onRenameSession={onRenameSession}
        onRestoreSession={() => {}}
        onReorderSession={() => {}}
      />,
    );

    fireEvent.click(container.querySelector(".chat-session-tab-close")!);
    expect(onArchiveSession).toHaveBeenCalledWith("agent:panel:first");

    const activeRow = container.querySelector(".chat-session-tab-active")!;
    fireEvent.doubleClick(activeRow);
    const input = container.querySelector(".chat-tab-rename-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Renamed chat" } });
    fireEvent.blur(input);
    expect(onRenameSession).toHaveBeenCalledWith("agent:panel:first", "Renamed chat");
  });
});
