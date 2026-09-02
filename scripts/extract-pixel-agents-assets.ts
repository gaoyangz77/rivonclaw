/**
 * Decodes the Pixel Agents sprite assets into the JSON bundle our host sends
 * over the transport, and writes it next to the built office SPA.
 *
 * Why this exists: a production Pixel Agents webview does not load its own
 * assets. `webview-ui/src/main.tsx` gates `initBrowserMock()` behind
 * `import.meta.env.DEV`, so the browser-side PNG decoder is tree-shaken out of
 * the build and the host is expected to deliver every sprite. Upstream's own
 * host is a Node server we are not running, so we call the same decoders it
 * calls -- `core/src/assets/{build,loader}.ts` -- once at build time.
 *
 * Runs under the vendor's own `tsx`, because those decoders are TypeScript
 * sources in a workspace that is never published.
 *
 * The bundle also carries furniture that is ours rather than upstream's -- the
 * calligraphy plaques in `assets/office/furniture/` -- kept outside `vendor/`
 * because that checkout is replaced wholesale on every engine upgrade. The
 * directory is in the shape upstream's loaders walk, so it is decoded by a
 * second pass of the same two functions and merged into the one catalog the
 * renderer builds its furniture from.
 *
 * Usage (from the repo root, via scripts/setup-pixel-agents.sh):
 *   cd vendor/pixel-agents && npx tsx ../../scripts/extract-pixel-agents-assets.ts
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const VENDOR_ROOT = path.join(REPO_ROOT, "vendor", "pixel-agents");
const ASSETS_DIR = path.join(VENDOR_ROOT, "webview-ui", "public", "assets");
/**
 * Our own assets, in the same `<dir>/furniture/<ID>/` shape, so the vendor's
 * walkers read them unchanged. Only furniture lives here today; the rest of the
 * bundle is still upstream's.
 */
const OUR_ASSETS_DIR = path.join(REPO_ROOT, "assets", "office");
const OUT_DIR = path.join(REPO_ROOT, "apps", "desktop", "build", "office");
const OUT_FILE = path.join(OUT_DIR, "scene-assets.json");

if (!existsSync(ASSETS_DIR)) {
  throw new Error(`Pixel Agents assets not found at ${ASSETS_DIR}; run setup-pixel-agents.sh first`);
}

const { buildAssetIndex, buildFurnitureCatalog } = await import(
  pathToFileURL(path.join(VENDOR_ROOT, "core", "src", "assets", "build.ts")).href,
);
const { decodeAllCarpets, decodeAllCharacters, decodeAllFloors, decodeAllFurniture, decodeAllWalls } =
  await import(pathToFileURL(path.join(VENDOR_ROOT, "core", "src", "assets", "loader.ts")).href);
const { decodePetPng } = await import(
  pathToFileURL(path.join(VENDOR_ROOT, "core", "src", "assets", "pngDecoder.ts")).href,
);

// ── Pets ────────────────────────────────────────────────────────────────────
//
// `core/src/assets/loader.ts` decodes characters, floors, walls, carpets and
// furniture by walking their directories, but it has no pet equivalent: the
// per-file `decodePetPng` lives in `pngDecoder.ts` and the only walker upstream
// ships is inside its Node server (`server/src/assetLoader.ts`), which we do not
// run. So the walk lives here, following the same conventions as that server's.

type PetSpriteFrameSet = {
  walkDown: string[][][];
  idleDown: string[][][];
  walkUp: string[][][];
  idleUp: string[][][];
  walkRight: string[][][];
};

/** Every facing the spritesheet authors; the rest are derived by the renderer. */
const PET_DIRECTIONS = ["walkDown", "idleDown", "walkUp", "idleUp", "walkRight"] as const;
const PET_FRAMES_PER_DIRECTION = 3;

/**
 * `decodePetPng` swallows its own decode failures and returns correctly-shaped
 * frames of fully transparent pixels. The renderer accepts those and draws
 * nothing, so a broken spritesheet would ship as an invisible pet. Only the
 * pixels tell the two apart.
 */
function assertPetDecoded(dirName: string, frames: PetSpriteFrameSet): void {
  for (const direction of PET_DIRECTIONS) {
    const animation = frames[direction];
    if (!Array.isArray(animation) || animation.length !== PET_FRAMES_PER_DIRECTION) {
      throw new Error(
        `Pet ${dirName} decoded ${animation?.length ?? 0} ${direction} frames, ` +
          `expected ${PET_FRAMES_PER_DIRECTION}`,
      );
    }
    if (!animation.some((frame) => frame.some((row) => row.some((pixel) => pixel !== "")))) {
      throw new Error(`Pet ${dirName} decoded ${direction} as fully transparent; pet.png is unreadable`);
    }
  }
}

/**
 * Decode `assets/pets/<id>/{manifest.json,pet.png}`.
 *
 * Directory names are sorted, and the sort is load-bearing: the layout places a
 * pet by `petType`, which is an index into the array returned here, so the order
 * is a contract with `scripts/generate-office-layout.ts` (which asserts against
 * the same directory listing).
 */
function decodeAllPets(assetsDir: string): { pets: PetSpriteFrameSet[]; petNames: string[] } {
  const petsDir = path.join(assetsDir, "pets");
  if (!existsSync(petsDir)) throw new Error(`No pets directory at ${petsDir}`);

  const dirNames = readdirSync(petsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const pets: PetSpriteFrameSet[] = [];
  const petNames: string[] = [];
  for (const dirName of dirNames) {
    const manifestPath = path.join(petsDir, dirName, "manifest.json");
    const pngPath = path.join(petsDir, dirName, "pet.png");
    if (!existsSync(manifestPath) || !existsSync(pngPath)) {
      throw new Error(`Pet ${dirName} is missing manifest.json or pet.png`);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { id?: string; name?: string };
    if (!manifest.id || !manifest.name) {
      throw new Error(`Pet ${dirName} has a manifest without an id or a name`);
    }
    const frames = decodePetPng(readFileSync(pngPath)) as PetSpriteFrameSet;
    assertPetDecoded(dirName, frames);
    pets.push(frames);
    petNames.push(manifest.name);
  }
  return { pets, petNames };
}

// ────────────────────────────────────────────────────────────────────────────

const assetIndex = buildAssetIndex(ASSETS_DIR);

// ── Furniture ───────────────────────────────────────────────────────────────
//
// Two directories, one catalog. `buildFurnitureCatalog` and `decodeAllFurniture`
// take the assets root as an argument and resolve every sprite relative to it,
// so pointing them at ours a second time needs nothing beyond the call: the
// entries come back with the same shape and `furniturePath` relative to their
// own root, which is why the decode has to be paired with the root it was built
// from. `furnitureCatalog` is what the host sends as `furnitureAssetsLoaded`,
// and the renderer builds its entire catalog from that message, so a merged
// entry is indistinguishable from a vendor one and needs no renderer change.
//
// Both upstream functions are quiet on failure -- `buildFurnitureCatalog` skips
// a manifest it cannot parse, `decodeAllFurniture` skips a PNG that is not
// there -- which is survivable for the vendor's own assets, where a missing
// piece means upstream shipped a broken folder, and not for ours, where it
// means a plaque the layout places has no sprite. `buildDynamicCatalog` drops a
// catalog entry with no sprite with a console warning, so the office would
// render with a hole in a wall and nothing in the build to say why. Ours are
// therefore checked rather than trusted.
const ourFurnitureDir = path.join(OUR_ASSETS_DIR, "furniture");
if (!existsSync(ourFurnitureDir)) {
  throw new Error(`No furniture at ${ourFurnitureDir}; the office layout places pieces from it`);
}

const vendorFurnitureCatalog = buildFurnitureCatalog(ASSETS_DIR);
const ourFurnitureCatalog = buildFurnitureCatalog(OUR_ASSETS_DIR);

const ourFolders = readdirSync(ourFurnitureDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
for (const folderName of ourFolders) {
  const prefix = `furniture/${folderName}/`;
  if (!ourFurnitureCatalog.some((entry) => entry.furniturePath.startsWith(prefix))) {
    throw new Error(
      `${path.join(ourFurnitureDir, folderName)} produced no catalog entry; its manifest.json is ` +
        `missing or malformed`,
    );
  }
}

const vendorIds = new Set(vendorFurnitureCatalog.map((entry) => entry.id));
for (const entry of ourFurnitureCatalog) {
  if (vendorIds.has(entry.id)) {
    throw new Error(
      `Our furniture declares ${entry.id}, which the vendor's catalog already has; one would ` +
        `silently shadow the other in the merged catalog`,
    );
  }
}

const furnitureCatalog = [...vendorFurnitureCatalog, ...ourFurnitureCatalog];
const furnitureSprites = {
  ...decodeAllFurniture(ASSETS_DIR, vendorFurnitureCatalog),
  ...decodeAllFurniture(OUR_ASSETS_DIR, ourFurnitureCatalog),
};
for (const entry of ourFurnitureCatalog) {
  if (!furnitureSprites[entry.id]) {
    throw new Error(
      `${entry.id} decoded no sprite from ${path.join(OUR_ASSETS_DIR, entry.furniturePath)}`,
    );
  }
}

// The office layout is the map: tiles, walls, furniture, and the Areas that
// become department rooms.
//
// Ours is preferred; upstream's default is the fallback so the pipeline still
// produces a renderable office before a layout has been authored. The two are
// not interchangeable in behaviour: upstream's default defines no Areas, so
// every character lands in the unzoned seat pool and departments disappear.
const OUR_LAYOUT = path.join(REPO_ROOT, "assets", "office", "office-layout.json");
let layout: Record<string, unknown> | null = null;
if (existsSync(OUR_LAYOUT)) {
  layout = JSON.parse(readFileSync(OUR_LAYOUT, "utf8"));
  const areas = (layout as { areas?: unknown[] }).areas ?? [];
  console.log(`Using ${OUR_LAYOUT} (${areas.length} areas)`);
} else if (assetIndex.defaultLayout) {
  layout = JSON.parse(readFileSync(path.join(ASSETS_DIR, assetIndex.defaultLayout), "utf8"));
  console.warn(`No layout at ${OUR_LAYOUT}; falling back to upstream default (no departments)`);
}

const { pets, petNames } = decodeAllPets(ASSETS_DIR);

const bundle = {
  characters: decodeAllCharacters(ASSETS_DIR),
  pets,
  petNames,
  floors: decodeAllFloors(ASSETS_DIR),
  walls: decodeAllWalls(ASSETS_DIR),
  carpets: decodeAllCarpets(ASSETS_DIR),
  furnitureCatalog,
  furnitureSprites,
  layout,
};

// Fail loudly on an empty decode: a silently empty bundle renders as a blank
// office, which looks like a rendering bug rather than a broken build step.
if (bundle.characters.length === 0) throw new Error("Decoded zero character sprite sets");
if (bundle.pets.length === 0) throw new Error("Decoded zero pet sprite sets");
if (bundle.floors.length === 0) throw new Error("Decoded zero floor tiles");
if (Object.keys(bundle.furnitureSprites).length === 0) throw new Error("Decoded zero furniture sprites");

mkdirSync(OUT_DIR, { recursive: true });
const json = JSON.stringify(bundle);
writeFileSync(OUT_FILE, json);

const mb = (json.length / 1024 / 1024).toFixed(1);
console.log(
  `Wrote ${OUT_FILE} (${mb} MB): ` +
    `${bundle.characters.length} characters, ${bundle.pets.length} pets ` +
    `(${bundle.petNames.join(", ")}), ${bundle.floors.length} floors, ` +
    `${bundle.walls.length} wall sets, ${bundle.carpets.length} carpet sets, ` +
    `${furnitureCatalog.length} furniture items (${ourFurnitureCatalog.length} ours)`,
);
