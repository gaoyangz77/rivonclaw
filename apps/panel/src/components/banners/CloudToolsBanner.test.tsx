import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudToolsBanner } from "./CloudToolsBanner.js";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe("CloudToolsBanner", () => {
  it("shows a global alert when cloud tools are unavailable", () => {
    render(<CloudToolsBanner state="unavailable" />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("common.cloudToolsUnavailableTitle");
    expect(alert.textContent).toContain("common.cloudToolsUnavailableBody");
  });

  it.each(["checking", "ready"] as const)("stays hidden while state is %s", (state) => {
    render(<CloudToolsBanner state={state} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
