// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Modal } from "./Modal.js";

afterEach(cleanup);

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

  return (
    <>
      <Modal isOpen={parentOpen} onClose={() => setParentOpen(false)} title="BD details" portal>
        <button type="button" onClick={() => setChildOpen(true)}>
          Connect WhatsApp
        </button>
      </Modal>
      <Modal
        isOpen={childOpen}
        onClose={() => setChildOpen(false)}
        title="WhatsApp connection"
        portal
      >
        <p>Scan the QR code</p>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("keeps only the title in the fixed header when body lead content is provided", () => {
    render(
      <Modal
        isOpen
        onClose={() => undefined}
        title="Campaign detail"
        bodyLeadContent={<section>Campaign summary</section>}
      >
        <section>Campaign funnel</section>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Campaign detail" });
    const scrollRegion = dialog.querySelector(".modal-scroll-region");
    expect(scrollRegion?.textContent).toContain("Campaign summary");
    expect(scrollRegion?.textContent).toContain("Campaign funnel");
    expect(scrollRegion?.contains(screen.getByRole("heading", { name: "Campaign detail" }))).toBe(
      false,
    );
  });

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

  it("locks page scrolling until the last stacked modal closes", async () => {
    document.documentElement.style.overflow = "scroll";
    document.body.style.overflow = "auto";

    render(<StackedPortalModals />);

    await waitFor(() => {
      expect(document.documentElement.style.overflow).toBe("hidden");
      expect(document.body.style.overflow).toBe("hidden");
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect WhatsApp" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(document.documentElement.style.overflow).toBe("scroll");
      expect(document.body.style.overflow).toBe("auto");
    });
  });
});
