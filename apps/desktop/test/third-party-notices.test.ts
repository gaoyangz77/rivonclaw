import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The pixel-art office ships three third-party assets whose licences oblige us
 * to distribute notices with the app. The SIL Open Font License is the strict
 * one: clause 2 lets us bundle the font only if "each copy contains the above
 * copyright notice and this license". A build that drops the notices file is
 * therefore not merely untidy, it is undistributable — so this test guards both
 * halves: that the notices exist and say what they must, and that every
 * electron-builder configuration still packages them.
 */

const DESKTOP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const NOTICES_PATH = join(DESKTOP_DIR, "THIRD_PARTY_NOTICES.md");

/**
 * Reproduced from name ID 0 of FSPixelSansUnicode-Regular.ttf, byte for byte —
 * including the line break and the unmatched opening quotation mark the font's
 * author left in it. OFL clause 2 requires "the above copyright notice", not a
 * tidied paraphrase of it, so the oddities are load-bearing.
 */
const FONT_COPYRIGHT_NOTICE = 'Copyright NZWStudios2024 2025\n“FS Pixel Classic Regular';

/**
 * Sentences from the licence body rather than its title. A notices file that
 * kept the heading "SIL Open Font License" while losing the text would satisfy
 * a title-only check and still fail the licence.
 */
const OFL_BODY_MARKERS = [
  "SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007",
  "Neither the Font Software nor any of its individual components,\nin Original or Modified Versions, may be sold by itself.",
  "provided that each copy\ncontains the above copyright notice and this license",
  "THE FONT SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND",
];

const BASE_CONFIG = "electron-builder.yml";
const DERIVED_CONFIGS = [
  "electron-builder.win.yml",
  "electron-builder.win.unsigned.yml",
  "electron-builder.linux.yml",
];

const readDesktopFile = (name: string): string => readFileSync(join(DESKTOP_DIR, name), "utf-8");

describe("THIRD_PARTY_NOTICES.md", () => {
  const notices = readFileSync(NOTICES_PATH, "utf-8");

  it("carries the font's copyright notice exactly as the font declares it", () => {
    expect(notices).toContain(FONT_COPYRIGHT_NOTICE);
  });

  it("carries the SIL Open Font License, not just a reference to it", () => {
    expect(notices).toContain("SIL Open Font License");
    for (const marker of OFL_BODY_MARKERS) {
      expect(notices).toContain(marker);
    }
  });

  it("carries the MIT licence of the Pixel Agents renderer", () => {
    expect(notices).toContain("Pixel Agents");
    expect(notices).toContain("MIT License");
    expect(notices).toContain("Copyright (c) 2026 Pablo De Lucca");
    expect(notices).toContain(
      "The above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.",
    );
  });

  it("records the MetroCity character art with its source and licence evidence", () => {
    expect(notices).toContain("MetroCity");
    expect(notices).toContain("https://jik-a-4.itch.io/metrocity-free-topdown-character-pack");
    expect(notices).toContain("Creative Commons Zero v1.0 Universal");
    // The retrieval date is what makes the quoted page evidence checkable later.
    expect(notices).toContain("2026-09-01");
  });
});

describe("electron-builder packaging of the notices", () => {
  it("copies the notices into the packaged resources root", () => {
    const base = readDesktopFile(BASE_CONFIG);
    const extraResources = base.slice(base.indexOf("extraResources:"));

    expect(base).toContain("extraResources:");
    expect(extraResources).toContain('- from: "THIRD_PARTY_NOTICES.md"');
    expect(extraResources).toContain('to: "THIRD_PARTY_NOTICES.md"');
  });

  it.each(DERIVED_CONFIGS)("%s inherits the notices entry from the base config", (configName) => {
    const config = readDesktopFile(configName);

    // The platform configs declare no extraResources of their own; they get the
    // whole list — vendor runtime, extensions, panel-dist, and these notices —
    // through `extends`. Re-declaring extraResources here would append a second
    // copy of every entry rather than replace them, so the inheritance is the
    // mechanism under test.
    expect(config).toMatch(/^extends:\s*electron-builder\.yml\s*$/m);
    expect(config).not.toContain("extraResources:");
  });
});
