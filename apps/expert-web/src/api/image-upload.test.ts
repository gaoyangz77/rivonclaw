import { describe, expect, it } from "vitest";
import { fitImageDimensions, getClipboardImageFiles } from "./image-upload.js";

describe("getClipboardImageFiles", () => {
  it("keeps clipboard images and ignores pasted text files", () => {
    const image = { name: "screenshot.png", type: "image/png" } as File;
    const text = { name: "notes.txt", type: "text/plain" } as File;

    expect(getClipboardImageFiles([text, image])).toEqual([image]);
  });

  it("does not intercept a text-only clipboard", () => {
    const text = { name: "notes.txt", type: "text/plain" } as File;

    expect(getClipboardImageFiles([text])).toEqual([]);
  });
});

describe("fitImageDimensions", () => {
  it("keeps small images at their original size", () => {
    expect(fitImageDimensions(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it("caps the longest edge while preserving aspect ratio", () => {
    expect(fitImageDimensions(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitImageDimensions(900, 1800)).toEqual({ width: 640, height: 1280 });
  });
});
