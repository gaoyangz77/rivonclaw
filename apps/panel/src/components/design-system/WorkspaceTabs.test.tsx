import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TkWorkspaceTabs } from "./WorkspaceTabs.js";

const items = [
  { id: "chat", label: "Chat" },
  { id: "team", label: "Team", dirty: true },
];

describe("TkWorkspaceTabs", () => {
  it("exposes accessible selection, dirty state, keyboard navigation, and close", () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    const onReorder = vi.fn();
    render(
      <TkWorkspaceTabs
        items={items}
        value="chat"
        label="Open pages"
        closeLabel="Close page"
        dirtyLabel="Unsaved changes"
        onChange={onChange}
        onClose={onClose}
        onReorder={onReorder}
      />,
    );
    expect(screen.getByRole("tablist", { name: "Open pages" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Chat" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText("Unsaved changes")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Chat" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("team");
    fireEvent.keyDown(screen.getByRole("tab", { name: /Team/ }), { key: "ArrowLeft", altKey: true });
    expect(onReorder).toHaveBeenCalledWith("team", 0);
    fireEvent.click(screen.getByRole("button", { name: "Close page: Team" }));
    expect(onClose).toHaveBeenCalledWith("team");
  });
});
