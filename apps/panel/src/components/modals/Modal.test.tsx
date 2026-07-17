// @vitest-environment jsdom

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Modal } from "./Modal.js";

function NestedPortalModal() {
  const [open, setOpen] = useState(false);

  return (
    <div data-testid="shop-modal">
      <button type="button" onClick={() => setOpen(true)}>
        Experiment settings
      </button>
      <div data-testid="clipped-parent">
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Unpaid order experiment" portal>
          <p>Experiment workspace</p>
        </Modal>
      </div>
    </div>
  );
}

function StackedPortalModals() {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(false);

  return <>
    <Modal isOpen={parentOpen} onClose={() => setParentOpen(false)} title="BD details" portal>
      <button type="button" onClick={() => setChildOpen(true)}>Connect WhatsApp</button>
    </Modal>
    <Modal isOpen={childOpen} onClose={() => setChildOpen(false)} title="WhatsApp connection" portal>
      <p>Scan the QR code</p>
    </Modal>
  </>;
}

describe("Modal", () => {
  it("renders a portal modal outside a clipped parent and leaves the parent open when closed", () => {
    render(<NestedPortalModal />);
    const trigger = screen.getByRole("button", { name: "Experiment settings" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Unpaid order experiment" });
    const backdrop = dialog.parentElement;
    expect(backdrop?.parentElement).toBe(document.body);
    expect(screen.getByTestId("clipped-parent").contains(dialog)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog", { name: "Unpaid order experiment" })).toBeNull();
    expect(screen.getByTestId("shop-modal")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Experiment settings" }),
    );
  });

  it("closes only the topmost portal modal when dialogs are stacked", () => {
    render(<StackedPortalModals />);
    fireEvent.click(screen.getByRole("button", { name: "Connect WhatsApp" }));

    expect(screen.getByRole("dialog", { name: "BD details" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "WhatsApp connection" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "WhatsApp connection" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "BD details" })).toBeTruthy();
  });
});
