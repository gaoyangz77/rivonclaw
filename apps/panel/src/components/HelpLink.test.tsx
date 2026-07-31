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

    fireEvent.click(screen.getByTitle("common.website"));

    expect(fetchJsonMock).toHaveBeenCalledWith("/auth/web/open", {
      method: "POST",
    });
  });
});
