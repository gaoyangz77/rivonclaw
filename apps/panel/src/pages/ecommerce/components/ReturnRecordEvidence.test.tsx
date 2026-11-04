import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { applySnapshot } from "mobx-state-tree";
import i18n from "../../../i18n/index.js";
import { runtimeStatusStore } from "../../../store/runtime-status-store.js";
import { ReturnRecordEvidence } from "./ReturnRecordEvidence.js";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: false });
});

const image = { url: "https://p16-oec-sg.ibyteimg.com/a.jpeg", width: 200, height: 200 };
const video = {
  url: "https://v16m-default.tiktokcdn-eu.com/v.mp4",
  coverUrl: "https://p16-common-sign.tiktokcdn-eu.com/c.jpeg",
  durationMillis: 9660,
  width: 1080,
  height: 1920,
};

describe("ReturnRecordEvidence", () => {
  it("renders nothing for a record without evidence", () => {
    const { container } = render(<ReturnRecordEvidence images={[]} videos={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a lazy image thumbnail that opens the full image externally", () => {
    render(<ReturnRecordEvidence images={[image]} videos={[]} />);
    const img = screen.getByRole("img", { name: "Evidence image" });
    expect(img.getAttribute("loading")).toBe("lazy");
    const link = screen.getByRole("link", { name: "Evidence image" });
    expect(link.getAttribute("href")).toBe(image.url);
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("renders a video thumbnail with duration that opens a player", () => {
    render(<ReturnRecordEvidence images={[]} videos={[video]} />);
    const button = screen.getByRole("button", { name: "Evidence video (0:10)" });
    expect(document.querySelector("video")).toBeNull();
    fireEvent.click(button);
    const player = document.querySelector("video");
    expect(player?.getAttribute("src")).toBe(video.url);
    expect(player?.hasAttribute("controls")).toBe(true);
  });

  it("shows a neutral placeholder when an image fails to load", () => {
    render(<ReturnRecordEvidence images={[image]} videos={[]} />);
    fireEvent.error(screen.getByAltText("Evidence image"));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("img", { name: "Media unavailable" })).toBeTruthy();
  });

  it("does not paint buyer media in privacy mode", () => {
    applySnapshot(runtimeStatusStore.appSettings, { privacyMode: true });
    render(<ReturnRecordEvidence images={[image]} videos={[video]} />);
    expect(document.querySelector("img[src]")).toBeNull();
    expect(screen.getAllByRole("img", { name: "Media unavailable" })).toHaveLength(2);
  });
});
