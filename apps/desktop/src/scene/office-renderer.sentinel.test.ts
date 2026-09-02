/**
 * Sentinel over the staged office renderer in `apps/desktop/build/office/`.
 *
 * That directory is gitignored build output: it is produced by
 * `scripts/setup-pixel-agents.sh`, which applies the carried patches in
 * `vendor-patches/pixel-agents/` and copies the resulting bundle into the
 * Panel's Vite publicDir. Nothing else re-runs when a patch is added, so a new
 * patch can sit in the repo, look applied, and never reach the served build.
 * This test reads the staged bundle and fails when a patch's effect is not in
 * it — including when a fifth patch is added without a marker to check.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = resolve(__dirname, "../../../..");
const STAGE_DIR = resolve(REPO_ROOT, "apps/desktop/build/office");
const PATCH_DIR = resolve(REPO_ROOT, "vendor-patches/pixel-agents");
const SETUP_SCRIPT = "scripts/setup-pixel-agents.sh";

/**
 * One entry per carried patch, keyed by the patch file's numeric prefix.
 *
 * The staged bundle is minified, so a marker has to be a literal the minifier
 * cannot rename: a global it reads off `window`, or a constant baked into an
 * expression. Identifiers of our own choosing are the reliable kind; where a
 * patch introduces none, a numeric constant or a string key stands in.
 */
const PATCH_MARKERS: Record<string, readonly string[]> = {
  // Host-translated character labels.
  "0001": ["__OFFICE_LABELS__"],
  // Kiosk mode and host-chosen initial zoom.
  "0002": ["__OFFICE_KIOSK__", "__OFFICE_ZOOM__"],
  // Several phrasings per label, spread across characters by a Knuth hash.
  "0003": ["2654435761"],
  // Host-supplied display names for folder routing keys.
  "0004": ["folder.${"],
};

/** The calligraphy plaques the layout hangs on each department's wall. */
const OUR_FURNITURE_IDS = [
  "PLAQUE_AIPIN",
  "PLAQUE_NINGJING",
  "PLAQUE_SHANGSHAN",
  "PLAQUE_TIANDAO",
];

function requireStaged(relativePath: string): string {
  const absolute = join(STAGE_DIR, relativePath);
  if (!existsSync(absolute)) {
    throw new Error(
      `No staged office renderer at ${absolute}. Run ${SETUP_SCRIPT} to build and stage it.`,
    );
  }
  return absolute;
}

function readStagedBundle(): string {
  const assetsDir = requireStaged("assets");
  const bundles = readdirSync(assetsDir).filter((name) => /^index-.*\.js$/.test(name));
  if (bundles.length !== 1) {
    throw new Error(
      `Expected exactly one index-*.js in ${assetsDir}, found ${bundles.length}. Re-run ${SETUP_SCRIPT}.`,
    );
  }
  return readFileSync(join(assetsDir, bundles[0]), "utf8");
}

interface SceneAssets {
  furnitureCatalog: { id: string }[];
}

describe("staged office renderer", () => {
  const bundle = readStagedBundle();

  for (const [patch, markers] of Object.entries(PATCH_MARKERS)) {
    it(`carries vendor patch ${patch}`, () => {
      for (const marker of markers) {
        expect(
          bundle.includes(marker),
          `${marker} is missing from the staged bundle: patch ${patch} changed without re-running ${SETUP_SCRIPT}`,
        ).toBe(true);
      }
    });
  }

  it("checks a marker for every carried patch", () => {
    const prefixes = readdirSync(PATCH_DIR)
      .filter((name) => name.endsWith(".patch"))
      .map((name) => name.slice(0, 4))
      .sort();

    // A patch with no marker here would be staged unverified, which is the
    // failure this file exists to catch — so adding one must fail until its
    // marker is added above.
    expect(prefixes).toEqual(Object.keys(PATCH_MARKERS).sort());
  });

  it("injects the host shim into the staged index.html", () => {
    const indexHtml = readFileSync(requireStaged("index.html"), "utf8");
    expect(indexHtml).toContain("office-host-shim.js");
    expect(existsSync(join(STAGE_DIR, "office-host-shim.js"))).toBe(true);
  });

  it("bakes our own furniture into the scene bundle", () => {
    const scene = JSON.parse(readFileSync(requireStaged("scene-assets.json"), "utf8")) as SceneAssets;
    const ids = scene.furnitureCatalog.map((entry) => entry.id);
    for (const id of OUR_FURNITURE_IDS) {
      expect(ids).toContain(id);
    }
  });
});
