// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { RemoteMediaImage } from "./RemoteMediaImage.js";

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock("../../api/client.js", () => ({
  fetchJson: fetchJsonMock,
}));

describe("RemoteMediaImage", () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it("waits for the resolver before assigning src to avoid eager upstream requests", async () => {
    const sourceUrl = "https://p16-oec-general-useast5.ttcdn-us.com/no-eager.jpeg";
    const proxyUrl = "https://media-cache.example.com/no-eager.jpeg";

    fetchJsonMock.mockResolvedValueOnce({
      sourceUrl,
      url: proxyUrl,
      proxied: true,
      route: "cn-relay",
    });

    render(<RemoteMediaImage alt="remote media eager guard" sourceUrl={sourceUrl} />);

    expect(screen.getByAltText("remote media eager guard").getAttribute("src")).toBeNull();

    await waitFor(() => {
      expect(screen.getByAltText("remote media eager guard").getAttribute("src")).toBe(proxyUrl);
    });
  });

  it("does not cache global-route original URLs so later CN relay resolves can replace them", async () => {
    const sourceUrl = "https://p16-oec-general-useast5.ttcdn-us.com/image.jpeg";
    const proxyUrl = "https://media-cache.example.com/image.jpeg";

    fetchJsonMock.mockResolvedValueOnce({
      sourceUrl,
      url: sourceUrl,
      proxied: false,
      route: "global",
    });

    const first = render(<RemoteMediaImage alt="remote media" sourceUrl={sourceUrl} />);

    await waitFor(() => expect(fetchJsonMock).toHaveBeenCalledTimes(1));
    expect(screen.getByAltText("remote media").getAttribute("src")).toBe(sourceUrl);

    first.unmount();

    fetchJsonMock.mockResolvedValueOnce({
      sourceUrl,
      url: proxyUrl,
      proxied: true,
      route: "cn-relay",
    });

    render(<RemoteMediaImage alt="remote media" sourceUrl={sourceUrl} />);

    await waitFor(() => {
      expect(screen.getByAltText("remote media").getAttribute("src")).toBe(proxyUrl);
    });
    expect(fetchJsonMock).toHaveBeenCalledTimes(2);
  });

  it("requests forced proxy resolution when cachePolicy is force", async () => {
    const sourceUrl = "https://p16-oec-general-useast5.ttcdn-us.com/avatar.jpeg";
    const proxyUrl = "https://media-cache.example.com/avatar.jpeg";

    fetchJsonMock.mockResolvedValueOnce({
      sourceUrl,
      url: proxyUrl,
      proxied: true,
      route: "global",
    });

    render(<RemoteMediaImage alt="remote avatar" cachePolicy="force" sourceUrl={sourceUrl} />);

    await waitFor(() => {
      expect(screen.getByAltText("remote avatar").getAttribute("src")).toBe(proxyUrl);
    });
    expect(fetchJsonMock).toHaveBeenCalledWith(expect.any(String), {
      method: "POST",
      body: JSON.stringify({ sourceUrl, forceProxy: true }),
    });
  });
});
