// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TkButton } from "./Primitives.js";
import { TkConfirmDialog, TkInfoTip, TkMenu, TkPopover, TkTooltip } from "./Overlays.js";

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("design-system overlays", () => {
  it("renders layered tooltips for keyboard users", () => {
    render(
      <TkTooltip
        label="Product Knowledge"
        placement="right"
        trigger={(props) => <button {...props}>Knowledge</button>}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Knowledge" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip").textContent).toBe("Product Knowledge");
    expect(trigger.getAttribute("aria-describedby")).toBeTruthy();

    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("provides the shared accessible info-tip trigger", () => {
    render(<TkInfoTip label="Daily quota resets at midnight." />);

    const trigger = screen.getByRole("button", { name: "Daily quota resets at midnight." });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip").textContent).toBe("Daily quota resets at midnight.");
  });

  it("connects a popover to its trigger and restores focus on Escape", () => {
    render(
      <TkPopover
        label="Run context"
        trigger={(props) => <TkButton {...props}>Open context</TkButton>}
      >
        <p>Agent run 0841</p>
      </TkPopover>,
    );

    const trigger = screen.getByRole("button", { name: "Open context" });
    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Run context" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Run context" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("supports side-anchored disclosure navigation without menu semantics", () => {
    render(
      <TkPopover
        label="Affiliate navigation"
        placement="right-start"
        role="navigation"
        defaultOpen
        trigger={(props) => <button {...props}>Affiliate</button>}
      >
        <button type="button">Campaigns</button>
      </TkPopover>,
    );

    const trigger = screen.getByRole("button", { name: "Affiliate" });
    expect(trigger.getAttribute("aria-haspopup")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Affiliate navigation" })).toBeTruthy();
  });

  it("supports arrow navigation and selection in menus", () => {
    const onAssign = vi.fn();
    render(
      <TkMenu
        label="Queue actions"
        triggerLabel="Actions"
        items={[
          { id: "open", label: "Open work item", onSelect: () => {} },
          { id: "assign", label: "Assign specialist", onSelect: onAssign },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const items = screen.getAllByRole("menuitem");
    items[0]?.focus();
    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.click(items[1]);
    expect(onAssign).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu", { name: "Queue actions" })).toBeNull();
  });

  it("uses the v1 action contract inside confirmation dialogs", () => {
    const onConfirm = vi.fn();
    render(
      <TkConfirmDialog
        isOpen
        title="Approve proposal?"
        message="The agent will send the collaboration brief."
        confirmLabel="Approve"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={() => {}}
        confirmVariant="primary"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Approve proposal?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
