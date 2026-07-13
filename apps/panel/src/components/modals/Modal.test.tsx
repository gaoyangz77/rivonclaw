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
});
