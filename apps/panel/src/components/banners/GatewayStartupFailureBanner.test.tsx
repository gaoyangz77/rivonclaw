import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayStartupFailureBanner } from "./GatewayStartupFailureBanner.js";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe("GatewayStartupFailureBanner", () => {
  it("shows the gateway's own reason for failing to start", () => {
    render(
      <GatewayStartupFailureBanner reason="SQLite integrity check timed out after 30 seconds" />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("common.gatewayStartupFailedTitle");
    expect(alert.textContent).toContain("common.gatewayStartupFailedBody");
    expect(alert.textContent).toContain("SQLite integrity check timed out after 30 seconds");
  });

  it("stays hidden when there is no startup failure", () => {
    render(<GatewayStartupFailureBanner reason="" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
