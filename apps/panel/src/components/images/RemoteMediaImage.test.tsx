// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { applySnapshot } from "mobx-state-tree";
import { runtimeStatusStore } from "../../store/runtime-status-store.js";
import { RemoteMediaImage } from "./RemoteMediaImage.js";

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock("../../api/client.js", () => ({
  fetchJson: fetchJsonMock,
}));

function setPrivacyMode(enabled: boolean) {
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: enabled });
}

describe("RemoteMediaImage", () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    setPrivacyMode(false);
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

  it("renders first-party object-storage URLs directly without resolving again", () => {
    const sourceUrl = "https://minio.rivonclaw.com/rivonclaw-assets/media-cache/2026-06/avatar.jpg";

    render(<RemoteMediaImage alt="cached avatar" cachePolicy="force" sourceUrl={sourceUrl} />);

    expect(screen.getByAltText("cached avatar").getAttribute("src")).toBe(sourceUrl);
    expect(fetchJsonMock).not.toHaveBeenCalled();
  });

  it("resolves and paints a sensitive image while privacy mode is off", async () => {
    const sourceUrl = "https://p16-oec-general-useast5.ttcdn-us.com/product.jpeg";
    const proxyUrl = "https://media-cache.example.com/product.jpeg";

    fetchJsonMock.mockResolvedValueOnce({
      sourceUrl,
      url: proxyUrl,
      proxied: true,
      route: "cn-relay",
    });

    render(<RemoteMediaImage alt="product photo" sensitive sourceUrl={sourceUrl} />);

    await waitFor(() => {
      expect(screen.getByAltText("product photo").getAttribute("src")).toBe(proxyUrl);
    });
    expect(document.querySelector("[data-tk-private='media']")).toBeNull();
  });

  it("neither resolves nor paints a sensitive image while privacy mode is on", () => {
    setPrivacyMode(true);
    const sourceUrl = "https://p16-oec-general-useast5.ttcdn-us.com/masked-product.jpeg";

    render(
      <RemoteMediaImage
        alt="masked product photo"
        className="product-thumb"
        sensitive
        sourceUrl={sourceUrl}
      />,
    );

    const masked = document.querySelector<HTMLImageElement>("[data-tk-private='media']");
    expect(masked?.tagName).toBe("IMG");
    expect(masked?.classList.contains("product-thumb")).toBe(true);
    expect(masked?.getAttribute("alt")).toBe("");
    expect(masked?.getAttribute("src")?.startsWith("data:image/gif;base64,")).toBe(true);
    expect(masked?.getAttribute("src")).not.toContain(sourceUrl);
    expect(fetchJsonMock).not.toHaveBeenCalled();
  });

  it("leaves images alone that did not opt in to masking", () => {
    setPrivacyMode(true);
    const sourceUrl = "https://minio.rivonclaw.com/rivonclaw-assets/media-cache/creator.jpg";

    render(<RemoteMediaImage alt="creator avatar" sourceUrl={sourceUrl} />);

    expect(screen.getByAltText("creator avatar").getAttribute("src")).toBe(sourceUrl);
    expect(document.querySelector("[data-tk-private='media']")).toBeNull();
  });

  it("resolves a sensitive image only once privacy mode is turned off", async () => {
    setPrivacyMode(true);
    const sourceUrl = "https://p16-oec-general-useast5.ttcdn-us.com/late-product.jpeg";
    const proxyUrl = "https://media-cache.example.com/late-product.jpeg";

    fetchJsonMock.mockResolvedValueOnce({
      sourceUrl,
      url: proxyUrl,
      proxied: true,
      route: "cn-relay",
    });

    render(<RemoteMediaImage alt="late product photo" sensitive sourceUrl={sourceUrl} />);
    expect(fetchJsonMock).not.toHaveBeenCalled();

    setPrivacyMode(false);

    await waitFor(() => {
      expect(screen.getByAltText("late product photo").getAttribute("src")).toBe(proxyUrl);
    });
    expect(document.querySelector("[data-tk-private='media']")).toBeNull();
  });
});
