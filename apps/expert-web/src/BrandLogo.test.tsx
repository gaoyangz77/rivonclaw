import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo.js";

describe("BrandLogo", () => {
  it("uses the canonical website brand asset", () => {
    render(<BrandLogo />);

    expect(screen.getByAltText("TK Copilot").getAttribute("src")).toBe(
      "/assets/LOGO_EN.png?v=2",
    );
  });
});
