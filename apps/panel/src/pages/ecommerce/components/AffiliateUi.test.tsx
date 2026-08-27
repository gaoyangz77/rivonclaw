// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AffiliateContextInspector,
  AffiliateDetailModal,
  AffiliateMetric,
  AffiliateMetricGrid,
  AffiliatePageFrame,
  AffiliatePageHeader,
  affiliateEntityCardClassName,
} from "./AffiliateUi.js";

afterEach(cleanup);

describe("Affiliate UI primitives", () => {
  it("renders the shared full-width page and compact header contract", () => {
    const { container } = render(
      <AffiliatePageFrame className="test-page">
        <AffiliatePageHeader title="Creators" subtitle="Relationship workspace" />
      </AffiliatePageFrame>,
    );

    expect(container.firstElementChild?.classList.contains("affiliate-page-shell")).toBe(true);
    expect(container.firstElementChild?.classList.contains("affiliate-page-frame")).toBe(true);
    expect(container.firstElementChild?.classList.contains("test-page")).toBe(true);
    expect(screen.getByRole("heading", { name: "Creators" })).not.toBeNull();
  });

  it("keeps metrics and entity-card variants stable across listing contexts", () => {
    render(
      <AffiliateMetricGrid compact>
        <AffiliateMetric label="Followers" value="12.6K" />
      </AffiliateMetricGrid>,
    );

    expect(screen.getByText("12.6K").closest(".affiliate-metric")).not.toBeNull();
    expect(affiliateEntityCardClassName("embedded", true, "sample-card")).toContain(
      "affiliate-entity-card-embedded",
    );
    expect(affiliateEntityCardClassName("embedded", true, "sample-card")).toContain(
      "is-interactive",
    );
  });

  it("exposes a closable contextual inspector without unmounting its content", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AffiliateContextInspector open title="Relationship information" onClose={onClose}>
        <span>Contacts</span>
      </AffiliateContextInspector>,
    );

    expect(screen.getByText("Contacts")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();

    rerender(
      <AffiliateContextInspector open={false} title="Relationship information" onClose={onClose}>
        <span>Contacts</span>
      </AffiliateContextInspector>,
    );
    expect(screen.getByText("Contacts").closest("aside")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("isolates shared detail-modal content clicks from the backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(
      <AffiliateDetailModal ariaLabel="Creator detail" onClose={onClose}>
        <button type="button">Inspect</button>
      </AffiliateDetailModal>,
    );

    fireEvent.click(container.querySelector("[role='dialog']") as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector("[role='presentation']") as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
