import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AffiliateMetricLabel } from "./AffiliateMetricLabel.js";

describe("AffiliateMetricLabel", () => {
  it("exposes the metric explanation to pointer and keyboard users", () => {
    render(
      <AffiliateMetricLabel
        label="80% reference range"
        tooltip="The range where the estimated lift is more likely to fall."
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "80% reference range: The range where the estimated lift is more likely to fall.",
    });
    const tooltip = screen.getByRole("tooltip");

    expect(trigger.getAttribute("type")).toBe("button");
    expect(tooltip.textContent).toBe("The range where the estimated lift is more likely to fall.");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });
});
