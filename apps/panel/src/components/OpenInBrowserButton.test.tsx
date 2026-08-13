import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenInBrowserButton } from "./OpenInBrowserButton.js";

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock("../api/client.js", () => ({
  fetchJson: fetchJsonMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("OpenInBrowserButton", () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
    fetchJsonMock.mockResolvedValue({ ok: true });
  });

  it("asks Desktop to open the app in the system browser", () => {
    render(<OpenInBrowserButton />);

    const button = screen.getByRole("button", { name: "common.openInBrowser" });
    expect(button.getAttribute("data-tooltip")).toBe("common.openInBrowser");
    fireEvent.click(button);

    expect(fetchJsonMock).toHaveBeenCalledWith("/app/open-in-browser", {
      method: "POST",
    });
  });
});
