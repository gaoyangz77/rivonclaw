import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HelpLink } from "./HelpLink.js";

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock("../api/client.js", () => ({
  fetchJson: fetchJsonMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("HelpLink", () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
    fetchJsonMock.mockResolvedValue({ authenticated: true });
  });

  it("asks Desktop to open an authenticated website session", () => {
    render(<HelpLink />);

    const link = screen.getByRole("link", { name: "common.openWebsite" });
    expect(link.getAttribute("data-tooltip")).toBe("common.openWebsite");
    fireEvent.click(link);

    expect(fetchJsonMock).toHaveBeenCalledWith("/auth/web/open", {
      method: "POST",
    });
  });
});
