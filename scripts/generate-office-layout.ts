/**
 * Generates the office map used by the pixel renderer.
 *
 * Written as a generator rather than hand-authored JSON because the interesting
 * parts are rules, not a picture: every department owns an Area, every Area has
 * at least as many seats as that department's concurrency, and every walkable
 * tile stays reachable once the furniture is in. A generator keeps those
 * checkable (see the assertions at the bottom); the JSON it emits is still an
 * ordinary layout that can be opened, rearranged and re-exported in the
 * renderer's own editor, which then simply replaces this file.
 *
 *   cd vendor/pixel-agents && npx tsx ../../scripts/generate-office-layout.ts
 *
 * Output: assets/office/office-layout.json
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  AFFILIATE_MAX_CONCURRENT_ENV,
  CS_MAX_CONCURRENT_ENV,
  DEFAULT_AFFILIATE_MAX_CONCURRENT,
  DEFAULT_CS_MAX_CONCURRENT,
  DEFAULT_SHOP_OPERATIONS_MAX_CONCURRENT,
  SHOP_OPERATIONS_MAX_CONCURRENT_ENV,
  resolveConcurrency,
} from "../packages/core/src/node-utils/agent-concurrency.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const OUT_FILE = path.join(REPO_ROOT, "assets", "office", "office-layout.json");
/**
 * The renderer's own flattened furniture catalog, written by its vite build.
 *
 * Read rather than restated: footprints and background rows decide which tiles
 * a piece blocks, and a stale copy of them here would wall off a corridor or
 * overlap a desk with no error. Taken from the vendor build rather than our
 * extractor's output, which reads the layout this script produces.
 */
const CATALOG_FILE = path.join(
  REPO_ROOT, "vendor", "pixel-agents", "dist", "webview", "assets", "furniture-catalog.json",
);
/**
 * Furniture that is ours rather than upstream's, in the directory layout
 * upstream's own loaders walk: `<dir>/furniture/<ID>/{manifest.json,<ID>.png}`.
 *
 * Outside `vendor/` on purpose. That checkout is pristine and gets replaced
 * wholesale on every engine upgrade, so art dropped into its asset folder would
 * disappear the next time the engine moves - silently, because a missing sprite
 * is dropped by the renderer with a warning nobody reads at build time. Keeping
 * it here makes it ours to version, and costs only a second read: this script
 * adds these pieces to the catalog it places from, and
 * `scripts/extract-pixel-agents-assets.ts` decodes the same directory into the
 * bundle the host ships.
 */
const OUR_FURNITURE_DIR = path.join(REPO_ROOT, "assets", "office", "furniture");
/**
 * The pet spritesheets, in the directory `scripts/extract-pixel-agents-assets.ts`
 * decodes them from.
 *
 * Read rather than counted here because `petType` below is an index into the
 * array that extractor produces, and the two scripts are the only things that
 * agree on it. A `petType` past the end of that array is dropped by the
 * renderer without a word (`OfficeState.addPet`), so the count is asserted
 * against the real folders instead of assumed.
 */
const PETS_DIR = path.join(
  REPO_ROOT, "vendor", "pixel-agents", "webview-ui", "public", "assets", "pets",
);

// Renderer TileType: 0 = WALL, 1..9 = FLOOR_1..9, 255 = VOID.
const WALL = 0;
const VOID = 255;

const COLS = 31;
/**
 * No bottom wall row, and no trailing void.
 *
 * Wall sprites are 16x32 - two tiles tall - and rise a tile above the row they
 * sit on. That works for the top and the sides; a wall on the bottom row draws
 * its face down past the floor and reads as a dead grey band, which then pushes
 * the whole office up and crops its top edge off the screen. Upstream's own
 * layout ends the same way: side walls run to the last floor row and stop.
 */
const ROWS = 18;
/**
 * Row 0 is VOID, not wall.
 *
 * Wall-mounted pieces hang one row ABOVE the wall they belong to and span down
 * into it, which is how upstream's own layout places its paintings and shelves.
 * Without a void band there is nowhere to put them and the rooms read as bare
 * boxes.
 */
const WALL_ROW = 1;
const FLOOR_TOP = 2;
const FLOOR_BOTTOM = ROWS - 1;

const ROOM_WIDTH = 9;
/**
 * The floor sprite every room stands on, as a tile value: 1..9 index
 * `assets/floors/floor_0.png` .. `floor_8.png`.
 *
 * Picked by reading the pixels, because the filenames say nothing about the
 * pattern. floor_0 is one flat colour with no joint at all; floor_5..floor_8
 * are running-bond and checker patterns; only floor_1 and floor_2 draw a single
 * grid line per tile, and those two differ solely in the grout's luminance -
 * floor_1 lightens it (#EDEDED over #A7A7A7), floor_2 darkens it (#6A7173).
 * A darker joint still reads as a seam once the tile is tinted, where a lighter
 * one turns into a near-white stripe.
 *
 * All three rooms share it. Giving each room its own sprite is exactly what
 * left one room with no grid at all; rooms are told apart by tint, below.
 */
const ROOM_FLOOR = 3;
/** The doorways keep a different pattern so a threshold still reads as one. */
const CORRIDOR_FLOOR = 4;
/** Rows left open in each dividing wall so every room reaches every other. */
const DOOR_ROWS = [9, 10];

/**
 * Floor tint - and why the layout has to carry one at all.
 *
 * `tileColors` is optional in the format, but omitting it is not neutral. The
 * renderer's `migrateLayout` fills a missing array from a LEGACY tile-value
 * table written for layouts that predate floor patterns: FLOOR_1 beige, FLOOR_2
 * brown, FLOOR_3 `{h:280,s:40}` purple, FLOOR_4 tan. That table, not a decision
 * made here, is where the saturated purple room came from. Emitting a
 * full-length array is what turns it off.
 *
 * Floors are always drawn in Colorize mode - `getColorizedFloorSprite` forces
 * the flag regardless of what the layout says - so `h` and `s` are the absolute
 * hue and saturation the whole tile is mapped onto, and the sprite's own pixels
 * survive only as lightness. Saturation, brightness and contrast are therefore
 * shared by all three rooms, which is what makes them read as one office; only
 * the hue moves, and it is taken from the room's own identity colour so the
 * floor agrees with the Area overlay drawn over it. The negative contrast pulls
 * the grout back toward the tile, leaving a seam rather than a stripe.
 */
const FLOOR_TINT = { saturation: 14, brightness: 4, contrast: -18 };
const tintFor = (hue) => ({
  h: hue,
  s: FLOOR_TINT.saturation,
  b: FLOOR_TINT.brightness,
  c: FLOOR_TINT.contrast,
});
/** A doorway sits between departments, so its tint belongs to none of them. */
const CORRIDOR_TINT = { h: 40, s: 5, b: FLOOR_TINT.brightness, c: FLOOR_TINT.contrast };

/**
 * One room per department, listed left to right.
 *
 * Array order is screen order: the first entry is the leftmost room, and the
 * doorway pass relies on it, since every room but the first opens through the
 * wall on its left. Changing which department sits where therefore means moving
 * a whole entry, never renaming one. `label` is an identifier, not display
 * copy: it is the foreign key between `areaTiles` here and the `areaMappings`
 * the host sends, matched verbatim, and the seat count and colour travel with
 * it. Department names shown to a user are resolved in the Panel, which owns
 * translations - this file stays language-free.
 *
 * `tintHue` is the hue of `color`, so floor and Area overlay agree.
 */
const ROOMS = [
  {
    label: "cs",
    originCol: 1,
    color: "#3b82f6",
    tintHue: 217,
    seats: resolveConcurrency(CS_MAX_CONCURRENT_ENV, DEFAULT_CS_MAX_CONCURRENT),
  },
  {
    label: "ops",
    originCol: 11,
    color: "#10b981",
    tintHue: 160,
    seats: resolveConcurrency(
      SHOP_OPERATIONS_MAX_CONCURRENT_ENV,
      DEFAULT_SHOP_OPERATIONS_MAX_CONCURRENT,
    ),
  },
  {
    label: "bd",
    originCol: 21,
    color: "#f59e0b",
    tintHue: 38,
    // The runtime resolver has a third tier this one deliberately skips: when a
    // live-test cohort is pinned it clamps concurrency to that cohort's size.
    // The office should have the product's chairs, not a test run's.
    seats: resolveConcurrency(AFFILIATE_MAX_CONCURRENT_ENV, DEFAULT_AFFILIATE_MAX_CONCURRENT),
  },
];

const rangeInclusive = (from, to) => Array.from({ length: to - from + 1 }, (_u, i) => from + i);
/** Every floor row of a room, and every column of one, for whole-room patches. */
const ROOM_ROWS = rangeInclusive(FLOOR_TOP, FLOOR_BOTTOM);
const ROOM_COLS = rangeInclusive(0, ROOM_WIDTH - 1);

/**
 * How each department's room is furnished, and where its walkways run.
 *
 * One plan per room rather than one shared list of slots. The rooms hold
 * different numbers of people and are entered from different sides, so an
 * arrangement that suits all three at once suits none of them: ops works one
 * shop between several people and is built around a shared table, bd's middle
 * band has to start a column further right because the doorway from ops opens
 * onto its column 0, and cs has four desks and the room to space them out.
 *
 * `workstations` are laid in order until the room's seat count is met, so a
 * plan is a ceiling rather than a fixed picture: an env override that lowers a
 * department (see ROOMS above) leaves the last workstations out. Both ends fail
 * loudly instead of drawing the wrong office - a count the plan cannot reach,
 * and a count no prefix of it hits exactly, which is what a four-seat table
 * makes possible. `kind` is either a pod facing (POD_LAYOUTS) or `table4`
 * (TABLE4_LAYOUT); `col` is an offset from the room's origin column and `row`
 * is a grid row.
 *
 * Seat counts come from the same constants the admission controllers use
 * (`packages/core/src/node-utils/agent-concurrency.ts`), which is what makes
 * "one desk per admissible run" true by construction rather than by discipline.
 * Getting it wrong is silent: the renderer prefers free seats inside a
 * department's Area and then falls through to any free seat anywhere, so a room
 * short of chairs scatters its workers into other departments.
 *
 * `circulation` is the set of tiles a character actually walks, written as
 * col x row patches relative to the room. Reachability cannot express this. It
 * proves a tile CAN be reached, which stays true with a plant standing in the
 * middle of the aisle - the office is still connected, it is just badly laid
 * out. Naming the routes turns "sensible" into something the build checks, and
 * the invariants below also prove the routes are real: on the floor, in one
 * piece, opening onto every doorway and reaching up to every seat. Without that
 * second half the set could quietly drift into an arbitrary mask that any decor
 * list satisfies.
 *
 * Doorways are cut at DOOR_ROWS in the wall to a room's left, so every room but
 * the first is walked into at its column 0 and every room but the last is left
 * through its column 8. Those tiles have to be walkway and nothing may stand on
 * them, which is what shapes the middle band of all three rooms.
 */
const ROOM_PLANS = {
  cs: {
    // Two bands facing each other across the room's width: the top pair with
    // their backs to the camera, the lower pair looking into it. Four desks
    // leave the whole lower third of the room clear.
    workstations: [
      { kind: "up", col: 0, row: 3 },
      { kind: "up", col: 5, row: 3 },
      { kind: "down", col: 0, row: 8 },
      { kind: "down", col: 5, row: 8 },
    ],
    circulation: [
      // The north-south aisle between the two desk banks, running the room's
      // height.
      { cols: [3, 4], rows: ROOM_ROWS },
      // The gaps between desk bands: how the aisle reaches a desk.
      { cols: ROOM_COLS, rows: [6, 7, 11, 12] },
      // cs is only ever entered from the right, so its lower band needs one
      // lane past the desks - column 8, which the doorway to ops opens onto.
      { cols: [8], rows: [8, 9, 10] },
    ],
  },
  ops: {
    // Two desks under the top wall, and one four-person table below them. Shop
    // operations works a single shop between several people, so its room reads
    // as one shared table rather than six separate pods.
    workstations: [
      { kind: "up", col: 0, row: 3 },
      { kind: "up", col: 5, row: 3 },
      // The cell spans columns 2-6: the table itself on 3-5 with its chairs off
      // either side, on 2 and 6. That is what keeps columns 0-1 and 7-8 clear
      // at the doorway rows.
      { kind: "table4", col: 2, row: 9 },
    ],
    circulation: [
      // Between the two top desks, down to the corridor under them.
      { cols: [3, 4], rows: rangeInclusive(FLOOR_TOP, 7) },
      // ops is entered from both sides and its table stands in the middle of
      // the room, so the walkway is a ring around it: a corridor above the
      // table, one below it, and a lane down each edge carrying a doorway.
      { cols: ROOM_COLS, rows: [6, 7, 13] },
      // Those lanes are two columns wide because the table is worked from its
      // sides: the chairs stand on columns 2 and 6, so 1 and 7 are the tiles a
      // character walks up to a seat on, and 0 and 8 the ones the doorways
      // open onto.
      { cols: [0, 1, 7, 8], rows: rangeInclusive(8, 12) },
    ],
  },
  bd: {
    // Three bands of two: backs to the camera at the top, facing it in the
    // middle, backs to it again at the bottom. The middle band starts a column
    // further right than the other two because the doorway from ops opens onto
    // column 0, and a desk parked there is a desk in the doorway.
    workstations: [
      { kind: "up", col: 0, row: 3 },
      { kind: "up", col: 5, row: 3 },
      { kind: "down", col: 1, row: 8 },
      { kind: "down", col: 6, row: 8 },
      { kind: "up", col: 0, row: 13 },
      { kind: "up", col: 5, row: 13 },
    ],
    circulation: [
      // Column 4 is the only column left free the full height of the room once
      // the middle band shifts right, so it is the aisle.
      { cols: [4], rows: ROOM_ROWS },
      // The gaps between bands, plus one under the last band: its chairs sit on
      // row 15 with their desks above them, so row 16 is the tile a character
      // walks up to reach those seats.
      { cols: ROOM_COLS, rows: [6, 7, 11, 12, 16] },
      // The middle band: column 0 is the doorway lane the desks were moved off,
      // column 5 the width the shifted band leaves beside the aisle.
      { cols: [0, 5], rows: [8, 9, 10] },
    ],
  },
};

/** The plan a room is furnished from, refusing to fall back on a default. */
function planFor(room) {
  const plan = ROOM_PLANS[room.label];
  if (!plan) {
    throw new Error(
      `Room ${room.label} has no entry in ROOM_PLANS, so it would be drawn as an empty box`,
    );
  }
  return plan;
}
for (const label of Object.keys(ROOM_PLANS)) {
  if (!ROOMS.some((room) => room.label === label)) {
    throw new Error(`ROOM_PLANS holds a plan for ${label}, which is not one of the rooms`);
  }
}

/**
 * The renderer mints a virtual `<id>:left` entry for every `side` piece marked
 * `mirrorSide`: same sprite and footprint, orientation `left`, drawn mirrored
 * (`buildDynamicCatalog` in webview-ui/src/office/layout/furnitureCatalog.ts).
 * It is a real persisted type id - upstream's own default-layout-1.json places
 * `PC_SIDE:left` and `WOODEN_CHAIR_SIDE:left` - but it is minted while building
 * the catalog, so the flat catalog file this script reads never lists it.
 * `entryFor` resolves it below rather than letting a footprint be hardcoded.
 */
const MIRROR_SUFFIX = ":left";

/**
 * One workstation, expressed as offsets inside a 3x3 cell.
 *
 * Facing is not decoration. `layoutToSeats` takes a chair's own orientation over
 * any adjacency guess, and the engine then scans AUTO_ON_FACING_DEPTH tiles
 * along that facing for an electronics tile before it will seat an agent there
 * by preference and animate typing. A pod is therefore only coherent when the
 * chair variant, the desk it faces and the monitor standing on that desk all
 * agree; the invariants at the bottom check that on the emitted layout rather
 * than trusting this table.
 *
 * Monitor variants follow upstream's own pairing: a chair reading as RIGHT gets
 * `PC_SIDE` and one reading as LEFT gets `PC_SIDE:left`, while the seat facing
 * UP gets the front-on monitor, because the screen has to point back at whoever
 * is sitting there.
 *
 * All four facings are kept even though no room's plan currently builds the
 * side-on pods: their chair-and-monitor pairing is the one the four-person
 * table below seats from, and they are checked against the catalog whether or
 * not they are placed, so they stay a working part of the vocabulary a plan is
 * written in rather than something to be re-derived the next time a room
 * changes shape.
 */
const POD_LAYOUTS = {
  up: {
    facing: [0, -1],
    desk: { type: "DESK_FRONT", dc: 0, dr: 0 },
    pc: { type: "PC_FRONT_OFF", dc: 1, dr: 0 },
    chair: { type: "CUSHIONED_CHAIR_BACK", dc: 1, dr: 2 },
  },
  // Facing the camera, the sitter has to be BEHIND the desk, and the desk's top
  // footprint row is exactly that: it is the desk's far edge, a background row
  // the renderer draws behind whoever stands on it. So the chair shares the
  // desk's first row rather than sitting a tile above it - one tile up and the
  // sitter is visibly out of arm's reach of their own desk. The monitor stands
  // centred on the desk, in the sitter's column: drawn after the desk, its back
  // covers the sitter's lap the way a monitor on a desk in front of someone
  // facing you does, and the head and shoulders show above it.
  down: {
    facing: [0, 1],
    height: 2,
    desk: { type: "DESK_FRONT", dc: 0, dr: 0 },
    pc: { type: "PC_BACK", dc: 1, dr: 0 },
    chair: { type: "CUSHIONED_CHAIR_FRONT", dc: 1, dr: 0 },
  },
  right: {
    facing: [1, 0],
    desk: { type: "SMALL_TABLE_SIDE", dc: 2, dr: 0 },
    pc: { type: "PC_SIDE", dc: 2, dr: 0 },
    chair: { type: "CUSHIONED_CHAIR_SIDE", dc: 1, dr: 1 },
  },
  left: {
    facing: [-1, 0],
    desk: { type: "SMALL_TABLE_SIDE", dc: 0, dr: 0 },
    pc: { type: `PC_SIDE${MIRROR_SUFFIX}`, dc: 0, dr: 0 },
    chair: { type: `CUSHIONED_CHAIR_SIDE${MIRROR_SUFFIX}`, dc: 1, dr: 1 },
  },
};

/**
 * A four-person table, expressed as offsets inside a 5x4 cell.
 *
 * Same rule as a pod - a seat only reads as a workstation when the tile it
 * looks at carries both a desk and a monitor - but four seats share one 3x4
 * piece here, so the monitors have to be positioned rather than paired off with
 * a facing.
 *
 * The table is worked from its long SIDES: two people down its left looking
 * right, two down its right looking left, nobody at either end. TABLE_FRONT
 * stands at column 1 of the cell and covers rows 0-3; the chairs stand off its
 * sides, on columns 0 and 4, at rows 1 and 3.
 *
 * A monitor is two tiles tall and it is its LOWER tile a seat looks at, so each
 * screen starts a row above its sitter: the pair serving the row-1 seats stands
 * on row 0 and covers rows 0-1, the pair serving the row-3 seats stands on row
 * 2 and covers rows 2-3. Nothing shares a tile with another monitor and the
 * table's middle column stays bare.
 *
 * The variants are the pairing the side-on pods already use: a sitter reading
 * as RIGHT gets `PC_SIDE` and one reading as LEFT gets the mirrored
 * `PC_SIDE:left`, so every screen points back out at the person in front of it.
 */
const TABLE4_LAYOUT = {
  width: 5,
  height: 4,
  table: { type: "TABLE_FRONT", dc: 1, dr: 0 },
  places: [
    // Down the table's left side, looking right across it.
    {
      chair: { type: "CUSHIONED_CHAIR_SIDE", dc: 0, dr: 1 },
      pc: { type: "PC_SIDE", dc: 1, dr: 0 },
    },
    {
      chair: { type: "CUSHIONED_CHAIR_SIDE", dc: 0, dr: 3 },
      pc: { type: "PC_SIDE", dc: 1, dr: 2 },
    },
    // And down its right side, looking left.
    {
      chair: { type: `CUSHIONED_CHAIR_SIDE${MIRROR_SUFFIX}`, dc: 4, dr: 1 },
      pc: { type: `PC_SIDE${MIRROR_SUFFIX}`, dc: 3, dr: 0 },
    },
    {
      chair: { type: `CUSHIONED_CHAIR_SIDE${MIRROR_SUFFIX}`, dc: 4, dr: 3 },
      pc: { type: `PC_SIDE${MIRROR_SUFFIX}`, dc: 3, dr: 2 },
    },
  ],
};

/**
 * One workstation's pieces and the rug they stand on, in cell-local offsets.
 *
 * Pods and the table go through here together so a room's plan can mix them
 * without the placement pass knowing which is which: it asks for the pieces and
 * the size of the cell to carpet, and gets the same shape back either way.
 */
function expandWorkstation(station) {
  if (station.kind === "table4") {
    return {
      seats: TABLE4_LAYOUT.places.length,
      width: TABLE4_LAYOUT.width,
      height: TABLE4_LAYOUT.height,
      pieces: [TABLE4_LAYOUT.table, ...TABLE4_LAYOUT.places.flatMap((p) => [p.pc, p.chair])],
    };
  }
  const pod = POD_LAYOUTS[station.kind];
  if (!pod) {
    throw new Error(
      `Workstation asks for kind ${station.kind}, which is neither a pod facing nor a table`,
    );
  }
  // Pods are three wide; a pod says how tall its cell is (the camera-facing
  // one folds its chair onto the desk's background row and is a row shorter).
  return {
    seats: 1,
    width: 3,
    height: pod.height ?? 3,
    pieces: [pod.desk, pod.pc, pod.chair],
  };
}

/**
 * Decor candidates, offset from each room's origin column.
 *
 * Placed opportunistically: a candidate that would collide with a workstation
 * or another piece is skipped, so a room with fewer desks simply gets more
 * greenery in the space that frees up instead of needing its own hand-tuned
 * list. A floor is required to end up with at least MIN_DECOR_PER_ROOM pieces,
 * so silent skipping can never quietly return the office to bare boxes.
 *
 * No `chairs` pieces here on purpose - sofas and benches would each add a real
 * seat, and a seat that is not a workstation breaks the one thing the office
 * has to tell the truth about: how many runs a department can hold at once.
 * The catalog check below enforces that rather than trusting this comment.
 *
 * Wall decor is the one pass that places unconditionally - `place`, not
 * `tryPlaceDecor` - because a room's wall is meant to read as composed rather
 * than as whatever happened to fit. Each room's wall is therefore laid out to
 * the tile below, and the overlap invariant at the bottom is what keeps it that
 * way: two pieces sharing a column would otherwise draw over each other in
 * silence, since nothing walks on row 0.
 *
 * Each room now hangs a calligraphy plaque, ours rather than upstream's (see
 * OUR_FURNITURE_DIR). The plaques are 4 tiles wide - AIPIN is 5 - against a
 * 9-wide wall, so they are the piece each wall is composed around and the
 * vendor pieces they displaced are simply dropped (`.` is a blank column):
 *
 *   cs   PAINTING 0-1 . SHANGSHAN 3-6 | CLOCK 7 | PLANT 8   filled to the right edge
 *   ops  PLANT 0 . TIANDAO 2-5 . BOOKSHELF 7-8              one blank column each side
 *   bd   PAINTING 0 . AIPIN 2-6 . PAINTING_2 8              symmetric about column 4
 *
 * ops is the wall the columns run out on, and arithmetic rather than taste is
 * what picked the pieces flanking its plaque. A 4-wide plaque with a blank
 * column on either side takes six of the nine, so the three left over split 1
 * and 2 and never 2 and 2; the plaque therefore hangs off centre, at 2-5, which
 * puts the wider remainder on the right where the bookshelf goes. That leaves
 * one column on the left, which the two-wide whiteboard this wall used to open
 * with cannot fit into, so a hanging plant takes column 0 and the whiteboard
 * joins PLAQUE_NINGJING - still in the catalog, just not hung anywhere.
 */
// One plaque per room, flanked by ordinary office decor. Two plaques on one
// wall read as a shop selling them. Only two-tall wall pieces are used:
// everything is hung from row 0 so its bottom row lands on the wall, and a
// one-tall piece hung the same way - BOOKSHELF is the catalog's only one -
// would float in the void row above it.
const WALL_DECOR = [
  // A one-wide painting rather than the two-wide one: with the plaque one
  // column further left, a two-wide piece at the edge would touch it, and a
  // plaque reads as hung only with air on both sides.
  [
    { type: "SMALL_PAINTING_2", col: 0 },
    { type: "PLAQUE_SHANGSHAN", col: 2 },
    { type: "CLOCK", col: 7 },
    { type: "HANGING_PLANT", col: 8 },
  ],
  [
    { type: "HANGING_PLANT", col: 0 },
    { type: "PLAQUE_TIANDAO", col: 2 },
    { type: "DOUBLE_BOOKSHELF", col: 7 },
  ],
  [
    { type: "SMALL_PAINTING", col: 0 },
    { type: "PLAQUE_AIPIN", col: 2 },
    { type: "SMALL_PAINTING_2", col: 8 },
  ],
];

/**
 * Where greenery is allowed to stand: against a wall, in a corner, or beside a
 * desk - never in a lane someone walks down, and no spines within arm's reach
 * of a chair.
 *
 * Those are three rules rather than three tastes, so all three are checked on
 * the emitted layout (see the circulation invariants). This list only has to
 * satisfy them; the checks are what keep the next edit honest, because a plant
 * parked in the middle of the walkway is invisible to the reachability check -
 * the tile around it is still perfectly reachable.
 *
 * Still one list for all three rooms even though the rooms are now furnished
 * differently, because it is a list of PLACES greenery goes in a 9-wide room -
 * corners, edges, beside a desk - and each room's own furniture and lanes
 * decide which of them survive. A candidate that would collide or stand in a
 * walkway is skipped there, so the room with the emptiest floor quietly ends up
 * with the most greenery instead of needing a hand-tuned list of its own.
 * Several entries below exist for exactly one room for that reason.
 *
 * The vocabulary is as small as it looks: pots, three plants, a cactus and a
 * bin are every `decor` and `misc` piece the catalog has that stands on a
 * floor. There is no cabinet, shelf or cooler to break the greenery up with -
 * the catalog has no `storage` category at all, its BOOKSHELF pieces are
 * wall-mounted, and its one remaining misc piece, COFFEE, is drawn small and
 * offset into the top of its tile because it is meant to stand on a desk
 * (`canPlaceOnSurfaces`), which is exactly what a floor pass cannot give it:
 * every desk tile is already covered, so it would only ever land on bare floor
 * and read as a mug left in the middle of the room.
 */
const FLOOR_DECOR = [
  // The strip the desks leave clear under the top wall.
  { type: "POT", col: 0, row: 2 },
  { type: "PLANT", col: 8, row: 2 },
  // The same strip, in the one-tile gap between a room's two desk banks. Only
  // bd has one to spare: its middle band is shifted right, which moves the
  // aisle onto column 4 and leaves column 3 as floor rather than walkway. The
  // other two rooms walk their aisle down 3 and 4 and skip this.
  { type: "PLANT", col: 3, row: 2 },
  // Down the room's two edge columns, alongside the upper desk bank.
  { type: "POT", col: 0, row: 5 },
  { type: "POT", col: 8, row: 4 },
  // A bin belongs at a workstation, not in a corner. The top band is the one
  // band all three rooms share, so these two sit against its desks.
  { type: "BIN", col: 2, row: 5 },
  { type: "BIN", col: 5, row: 5 },
  // The row under the second desk band, for the two rooms that have one: same
  // idea as the bins above, one piece off each end of the band. The room built
  // around a table has its chairs and its edge lanes here instead, so both are
  // skipped there. Knee-high on purpose - row 11 is walkway in both rooms, so
  // a two-tall piece standing on row 10 would lean into it.
  { type: "BIN", col: 2, row: 10 },
  { type: "POT", col: 7, row: 10 },
  // The quiet corner past the last desk row takes the one large piece. Two
  // spots: the second is for a room whose corner at row 13 is desk or walkway,
  // and it collides with the first wherever the first went in.
  { type: "LARGE_PLANT", col: 7, row: 13 },
  { type: "LARGE_PLANT", col: 7, row: 15 },
  // The matching corner on the room's other side, with the same two spots. It
  // is the emptiest floor in the office and was the last bare one: cs parks no
  // desk below row 9 and runs its aisle up the middle, so its lower left stood
  // clear from the walkway to the bottom edge.
  { type: "LARGE_PLANT", col: 0, row: 13 },
  { type: "LARGE_PLANT", col: 0, row: 15 },
  // The edge column beside the last band, for the room whose bottom band takes
  // both corner spots above: bd's runs from column 0 to column 7, so nothing
  // large fits either end of it and column 8 is the only floor left down that
  // side. The second spot is a row lower, for a room that walks its row 13,
  // and knee-high because the corner piece there already covers row 15.
  { type: "PLANT", col: 8, row: 13 },
  { type: "POT", col: 8, row: 14 },
  // And the gap column once more, beside the bottom band rather than under the
  // wall - the same column 3 the aisle leaves free in bd alone.
  { type: "PLANT", col: 3, row: 13 },
  // Along the bottom edge. The cactus goes here because it is the furthest any
  // decor gets from a chair.
  { type: "PLANT_2", col: 0, row: 16 },
  { type: "CACTUS", col: 2, row: 16 },
  { type: "PLANT", col: 6, row: 16 },
  // The last floor row, for a room that walks its bottom band along row 16 and
  // so has no edge to stand a plant on. Only knee-high pieces fit: the row
  // below is off the grid, and everything taller is two tiles tall.
  { type: "POT", col: 0, row: 17 },
  { type: "POT", col: 3, row: 17 },
  { type: "POT", col: 8, row: 17 },
];

const MIN_DECOR_PER_ROOM = 6;

/**
 * Decor with spines. A cactus is fine in a corner and unpleasant at arm's reach
 * from a chair; nothing in the catalog marks that, so it is named here.
 */
const SPIKY_DECOR = new Set(["CACTUS"]);
/** How far a seated person reaches, as a Chebyshev radius around their seat. */
const SEAT_REACH = 1;
/** Categories the floor-decor pass draws from; wall-mounted pieces are `wall`. */
const FLOOR_DECOR_CATEGORIES = new Set(["decor", "misc"]);

const ORTHOGONAL = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/**
 * A rug under each workstation, one variant per room.
 *
 * Carpets are a decorative layer under the furniture and are auto-tiled by the
 * renderer from junctions between marked tiles, so only membership and a
 * variant are declared here - edges and corners resolve themselves.
 */
const CARPET_VARIANTS = [0, 1, 2];

/** `orientationToFacing` from the renderer's layoutSerializer, as a step. */
const FACING_BY_ORIENTATION = {
  front: [0, 1],
  back: [0, -1],
  left: [-1, 0],
  right: [1, 0],
  side: [1, 0],
};

// ── Catalog ─────────────────────────────────────────────────────────────────

if (!existsSync(CATALOG_FILE)) {
  throw new Error(
    `No furniture catalog at ${CATALOG_FILE}. Run ./scripts/setup-pixel-agents.sh first.`,
  );
}
const catalog = new Map(
  JSON.parse(readFileSync(CATALOG_FILE, "utf8")).map((entry) => [entry.id, entry]),
);

/**
 * The manifest fields a placement needs to be computed from, and the reason our
 * pieces are read here rather than through upstream's `buildFurnitureCatalog`.
 *
 * That function is a build helper: a manifest it cannot parse, or one missing a
 * footprint, is skipped without a word. The piece then simply is not in the
 * catalog, and the failure surfaces two hundred lines later as "PLAQUE_X is not
 * in the renderer's furniture catalog" - which reads as a typo in WALL_DECOR
 * and points nowhere near the manifest that is actually broken. It copies these
 * fields verbatim out of the manifest anyway, so reading them directly yields
 * the same numbers with an error that names the file.
 */
const REQUIRED_MANIFEST_FIELDS = [
  "id", "name", "category", "width", "height", "footprintW", "footprintH",
];

if (!existsSync(OUR_FURNITURE_DIR)) {
  throw new Error(`No furniture at ${OUR_FURNITURE_DIR}; the wall decor below is placed from it`);
}
const ourFolders = readdirSync(OUR_FURNITURE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
for (const folderName of ourFolders) {
  const manifestPath = path.join(OUR_FURNITURE_DIR, folderName, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`${manifestPath} is missing, so ${folderName} would never reach the renderer`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  // Group manifests fan one folder out into many pieces, and the flattening
  // that does it lives upstream. Nothing here needs it, so it is refused rather
  // than half-implemented.
  if (manifest.type !== "asset") {
    throw new Error(
      `${manifestPath} has type ${manifest.type ?? "none"}; only single-asset manifests are read here`,
    );
  }
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (manifest[field] === undefined || manifest[field] === null) {
      throw new Error(`${manifestPath} has no ${field}, which a placement is computed from`);
    }
  }
  if (catalog.has(manifest.id)) {
    throw new Error(
      `${manifestPath} declares ${manifest.id}, which the renderer's own catalog already has; ` +
        `rename ours rather than shadowing a vendor piece`,
    );
  }
  const file = manifest.file ?? `${manifest.id}.png`;
  catalog.set(manifest.id, {
    id: manifest.id,
    name: manifest.name,
    label: manifest.name,
    category: manifest.category,
    file,
    furniturePath: `furniture/${folderName}/${file}`,
    width: manifest.width,
    height: manifest.height,
    footprintW: manifest.footprintW,
    footprintH: manifest.footprintH,
    isDesk: manifest.category === "desks",
    canPlaceOnWalls: manifest.canPlaceOnWalls,
    canPlaceOnSurfaces: manifest.canPlaceOnSurfaces,
    backgroundTiles: manifest.backgroundTiles,
    groupId: manifest.id,
  });
}

function entryFor(type) {
  if (type.endsWith(MIRROR_SUFFIX)) {
    const base = entryFor(type.slice(0, -MIRROR_SUFFIX.length));
    if (base.orientation !== "side" || !base.mirrorSide) {
      throw new Error(
        `${type} is not a type the renderer mints: it only mirrors 'side' pieces marked mirrorSide`,
      );
    }
    return { ...base, orientation: "left" };
  }
  const entry = catalog.get(type);
  if (!entry) throw new Error(`${type} is not in the renderer's furniture catalog`);
  return entry;
}

/** Which way a chair's occupant looks, refusing to fall back on adjacency. */
function facingOf(type) {
  const { orientation } = entryFor(type);
  const facing = FACING_BY_ORIENTATION[orientation];
  if (!facing) {
    throw new Error(
      `${type} has orientation ${orientation ?? "none"}, so its seat's facing would be ` +
        `inferred from whatever happens to sit next to it`,
    );
  }
  return facing;
}

/** Tiles a piece occupies. Background rows are walk-through and excluded. */
function blockedTilesOf(type, col, row) {
  const entry = entryFor(type);
  const bg = entry.backgroundTiles ?? 0;
  const tilesOccupied = [];
  for (let dr = bg; dr < entry.footprintH; dr++) {
    for (let dc = 0; dc < entry.footprintW; dc++) tilesOccupied.push([col + dc, row + dr]);
  }
  return tilesOccupied;
}

/** Every tile a piece covers, background rows included, for overlap checks. */
function coveredTilesOf(type, col, row) {
  const entry = entryFor(type);
  const tilesCovered = [];
  for (let dr = 0; dr < entry.footprintH; dr++) {
    for (let dc = 0; dc < entry.footprintW; dc++) tilesCovered.push([col + dc, row + dr]);
  }
  return tilesCovered;
}

// ── Tiles ───────────────────────────────────────────────────────────────────

// Checked before anything is drawn, because the doorway pass below reads array
// order as screen order: it opens the left wall of every room but the first, so
// a room listed out of order would take its doorway with it and punch a hole in
// the wrong wall - silently, since the office would still be connected.
ROOMS.forEach((room, roomIndex) => {
  const expected = 1 + roomIndex * (ROOM_WIDTH + 1);
  if (room.originCol !== expected) {
    throw new Error(
      `Room ${room.label} starts at column ${room.originCol}, but ROOMS is read left to ` +
        `right with one wall between rooms, which puts entry ${roomIndex} at column ${expected}`,
    );
  }
});
if (ROOMS.length * (ROOM_WIDTH + 1) + 1 !== COLS) {
  throw new Error(
    `${ROOMS.length} rooms of ${ROOM_WIDTH} plus their walls need ` +
      `${ROOMS.length * (ROOM_WIDTH + 1) + 1} columns, but the grid is ${COLS} wide`,
  );
}

const tiles = new Array(COLS * ROWS).fill(VOID);
const tileColors = new Array(COLS * ROWS).fill(null);
const areaTiles = new Array(COLS * ROWS).fill(null);
const carpetTiles = new Array(COLS * ROWS).fill(null);
const idx = (col, row) => row * COLS + col;

// Walls keep a null tint so the renderer uses its own wall colour; only floor
// tiles carry one.
const floorTints = new Map(ROOMS.map((room) => [room.label, tintFor(room.tintHue)]));

for (let col = 0; col < COLS; col++) {
  tiles[idx(col, WALL_ROW)] = WALL;
}
for (let row = FLOOR_TOP; row <= FLOOR_BOTTOM; row++) {
  tiles[idx(0, row)] = WALL;
  tiles[idx(COLS - 1, row)] = WALL;
  for (const room of ROOMS) {
    if (room.originCol > 1) tiles[idx(room.originCol - 1, row)] = WALL;
    for (let col = room.originCol; col < room.originCol + ROOM_WIDTH; col++) {
      tiles[idx(col, row)] = ROOM_FLOOR;
      tileColors[idx(col, row)] = floorTints.get(room.label);
      areaTiles[idx(col, row)] = room.label;
    }
  }
}
// Doorways stay unzoned: they belong to no department, and no seat sits in one.
for (const room of ROOMS.slice(1)) {
  for (const row of DOOR_ROWS) {
    tiles[idx(room.originCol - 1, row)] = CORRIDOR_FLOOR;
    tileColors[idx(room.originCol - 1, row)] = CORRIDOR_TINT;
  }
}

/** The tiles a character crosses between a doorway and this room's seats. */
function circulationTilesOf(room) {
  const paths = new Set();
  for (const patch of planFor(room).circulation) {
    for (const row of patch.rows) {
      for (const col of patch.cols) paths.add(`${room.originCol + col},${row}`);
    }
  }
  return paths;
}

// ── Furniture ───────────────────────────────────────────────────────────────

const furniture = [];
const covered = new Set();
let uidCounter = 0;

function place(type, col, row) {
  for (const [c, r] of coveredTilesOf(type, col, row)) covered.add(`${c},${r}`);
  furniture.push({ uid: `office-${String(++uidCounter).padStart(3, "0")}`, type, col, row });
}

/**
 * Places a decor piece only if it fits on clear floor inside the room.
 *
 * A walkway counts as taken, the same as a tile another piece already stands
 * on: the room's plan reserved it, so nothing is free to stand there. Skipping
 * rather than failing is what lets one shared candidate list serve three rooms
 * whose lanes run in different places - and it hides nothing, because the
 * circulation invariant still reads the emitted layout, MIN_DECOR_PER_ROOM
 * still fails a room that ends up bare, and anything placed unconditionally
 * (workstations, wall decor) never comes through here at all.
 */
function tryPlaceDecor(type, col, row, room, paths) {
  for (const [c, r] of coveredTilesOf(type, col, row)) {
    if (covered.has(`${c},${r}`)) return false;
    if (paths.has(`${c},${r}`)) return false;
    if (c < room.originCol || c >= room.originCol + ROOM_WIDTH) return false;
    if (r < FLOOR_TOP || r > FLOOR_BOTTOM) return false;
    if (tiles[idx(c, r)] === WALL || tiles[idx(c, r)] === VOID) return false;
  }
  place(type, col, row);
  return true;
}

ROOMS.forEach((room, roomIndex) => {
  const variant = CARPET_VARIANTS[roomIndex % CARPET_VARIANTS.length];
  const plan = planFor(room);
  const paths = circulationTilesOf(room);

  let seated = 0;
  for (const station of plan.workstations) {
    if (seated === room.seats) break;
    const workstation = expandWorkstation(station);
    if (seated + workstation.seats > room.seats) {
      throw new Error(
        `Room ${room.label} seats ${room.seats}, which its plan cannot reach exactly: the ` +
          `${station.kind} workstation at ${station.col},${station.row} would take it to ` +
          `${seated + workstation.seats}`,
      );
    }
    const originCol = room.originCol + station.col;
    // Grounds the workstation: desks, monitors and chairs share one rug.
    for (let r = station.row; r < station.row + workstation.height; r++) {
      for (let c = originCol; c < originCol + workstation.width; c++) {
        carpetTiles[idx(c, r)] = { variant };
      }
    }
    for (const piece of workstation.pieces) {
      place(piece.type, originCol + piece.dc, station.row + piece.dr);
    }
    seated += workstation.seats;
  }
  if (seated < room.seats) {
    throw new Error(
      `Room ${room.label} needs ${room.seats} desks but its plan seats only ${seated}; add ` +
        `workstations to its plan rather than letting desks go missing`,
    );
  }

  for (const item of WALL_DECOR[roomIndex % WALL_DECOR.length]) {
    place(item.type, room.originCol + item.col, WALL_ROW - 1);
  }

  let placed = 0;
  for (const item of FLOOR_DECOR) {
    if (tryPlaceDecor(item.type, room.originCol + item.col, item.row, room, paths)) placed++;
  }
  if (placed < MIN_DECOR_PER_ROOM) {
    throw new Error(
      `Room ${room.label} fitted only ${placed} decor pieces (want ${MIN_DECOR_PER_ROOM}); ` +
        `its workstations leave too little clear floor`,
    );
  }
});

// ── Pets ────────────────────────────────────────────────────────────────────

/**
 * Two pets, one of each animal the bundle ships.
 *
 * Pets are not a per-department thing and carry no position here: the renderer
 * spawns each on a uniformly random walkable tile and wanders it across the
 * whole office (`OfficeState.addPet`, `petEntity.updatePet`), so the count is
 * not tied to the three rooms. It is tied to the art. Two distinct spritesheets
 * ship, so a third pet could only be a second copy of an animal already walking
 * around - visible enough that the office reads as inhabited, and short of the
 * point where wandering sprites start competing with the agents for attention.
 *
 * `petType` is an index into the array the extractor decodes from PETS_DIR, so
 * the count is checked against the real folders rather than trusted: a pet
 * whose index runs past the end of that array is dropped by the renderer with
 * nothing logged.
 */
const PET_COUNT = 2;
if (!existsSync(PETS_DIR)) {
  throw new Error(`No pet sprites at ${PETS_DIR}. Run ./scripts/setup-pixel-agents.sh first.`);
}
const petSpriteFolders = readdirSync(PETS_DIR, { withFileTypes: true }).filter((entry) =>
  entry.isDirectory(),
);
if (petSpriteFolders.length < PET_COUNT) {
  throw new Error(
    `Office places ${PET_COUNT} pets but ${PETS_DIR} holds ${petSpriteFolders.length} ` +
      `sprite folder(s); the renderer drops any pet whose petType is out of range`,
  );
}

/**
 * Ids are stable rather than the `crypto.randomUUID()` upstream's editor mints,
 * because this generator has to be deterministic: a random id would make every
 * run rewrite the layout. Nothing else reads them - the renderer only compares
 * them to each other, to de-dupe and to reconcile a roster across a reload.
 */
const pets = Array.from({ length: PET_COUNT }, (_unused, petType) => ({
  id: `office-pet-${String(petType + 1).padStart(3, "0")}`,
  petType,
}));

const layout = {
  version: 1,
  cols: COLS,
  rows: ROWS,
  layoutRevision: 2,
  tiles,
  tileColors,
  furniture,
  areas: ROOMS.map((room) => ({ label: room.label, color: room.color })),
  areaTiles,
  carpetTiles,
  pets,
};

// ── Invariants ──────────────────────────────────────────────────────────────
// A layout that violates one of these renders as a subtly wrong office - agents
// seated in the wrong department, or standing because nothing could seat them -
// which is far harder to diagnose than a failed build.

// Each pod has to be internally consistent before any of it is placed: the
// chair must be a chair whose orientation reads as the facing the slot asked
// for, the desk must be something the renderer counts as a desk, and the
// monitor must be electronics that can stand on a surface.
for (const [facingName, pod] of Object.entries(POD_LAYOUTS)) {
  const chair = entryFor(pod.chair.type);
  if (chair.category !== "chairs") {
    throw new Error(`${facingName} pod seats on ${pod.chair.type}, which is not a chair`);
  }
  const [dc, dr] = facingOf(pod.chair.type);
  if (dc !== pod.facing[0] || dr !== pod.facing[1]) {
    throw new Error(
      `${facingName} pod uses ${pod.chair.type}, whose occupant looks ${dc},${dr} ` +
        `rather than ${pod.facing[0]},${pod.facing[1]}`,
    );
  }
  if (!entryFor(pod.desk.type).isDesk) {
    throw new Error(`${facingName} pod faces ${pod.desk.type}, which is not a desk`);
  }
  const pc = entryFor(pod.pc.type);
  if (pc.category !== "electronics" || !pc.canPlaceOnSurfaces) {
    throw new Error(`${facingName} pod's ${pod.pc.type} is not a monitor that stands on a desk`);
  }
}

// Every chair a workstation is allowed to bring, pods and table alike - listed
// from the layouts themselves so the check stays exact rather than accidentally
// true because the table happens to reuse a pod's chair.
const CHAIR_TYPES = new Set([
  ...Object.values(POD_LAYOUTS).map((pod) => pod.chair.type),
  ...TABLE4_LAYOUT.places.map((seat) => seat.chair.type),
]);
for (const item of furniture) {
  if (CHAIR_TYPES.has(item.type)) continue;
  if (entryFor(item.type).category === "chairs") {
    throw new Error(`${item.type} is a chair and would add a seat outside a workstation`);
  }
}

for (const item of furniture) {
  for (const [c, r] of coveredTilesOf(item.type, item.col, item.row)) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) {
      throw new Error(`Furniture ${item.uid} (${item.type}) falls outside the grid`);
    }
  }
}

/**
 * No two wall pieces on the same tile.
 *
 * Every other overlap in the office is caught by something else: floor decor is
 * placed through `tryPlaceDecor`, which refuses a covered tile, and a
 * workstation drawn on top of another would trip circulation or reachability.
 * Wall decor has neither guard. It is placed unconditionally, above the walk
 * surface, so two pieces sharing a column draw over each other and the layout
 * still passes every check below - the office just quietly loses a plaque
 * behind a bookshelf. Hung pieces are the ones above the floor; overlap is by
 * covered tile rather than blocked tile, because a piece hidden behind another
 * is hidden whether or not the tile stops anyone walking.
 */
const wallPieceByTile = new Map();
for (const item of furniture) {
  if (item.row >= FLOOR_TOP) continue;
  for (const [c, r] of coveredTilesOf(item.type, item.col, item.row)) {
    const key = `${c},${r}`;
    const other = wallPieceByTile.get(key);
    if (other) {
      throw new Error(
        `Wall decor ${item.type} (${item.uid}) at ${item.col},${item.row} covers ${key}, which ` +
          `${other.type} (${other.uid}) at ${other.col},${other.row} already hangs on`,
      );
    }
    wallPieceByTile.set(key, item);
  }
}

/**
 * Seats read back off the emitted layout the way `layoutToSeats` reads them:
 * every non-background footprint tile of a chairs-category piece is a seat, so
 * a bench swapped in for a chair would show up here as the extra seats it
 * really is instead of as one.
 */
const seats = [];
for (const item of furniture) {
  const entry = entryFor(item.type);
  if (entry.category !== "chairs") continue;
  for (let dr = entry.backgroundTiles ?? 0; dr < entry.footprintH; dr++) {
    for (let dc = 0; dc < entry.footprintW; dc++) {
      seats.push({ col: item.col + dc, row: item.row + dr, facing: facingOf(item.type) });
    }
  }
}

// A seat only works if the tile it looks at carries both the desk and the
// monitor: the renderer prefers seats facing electronics and animates typing
// there, so a chair turned away from its own desk degrades to idle sitting.
const deskTiles = new Set();
const screenTiles = new Set();
for (const item of furniture) {
  const entry = entryFor(item.type);
  const target = entry.isDesk ? deskTiles : entry.category === "electronics" ? screenTiles : null;
  if (!target) continue;
  for (const [c, r] of coveredTilesOf(item.type, item.col, item.row)) target.add(`${c},${r}`);
}
/**
 * The renderer's own test for "this seat faces a screen"
 * (`OfficeState.isSeatFacingElectronics`): up to AUTO_ON_FACING_DEPTH tiles
 * straight ahead, and at each of those depths one tile to either side. Mirrored
 * here rather than tightened, because a monitor standing beside the sitter's
 * line of sight is exactly how the camera-facing pod has to be built.
 */
const FACING_DEPTH = 3;
function seatFacesScreen(seat) {
  const [dc, dr] = seat.facing;
  for (let depth = 1; depth <= FACING_DEPTH; depth++) {
    const col = seat.col + dc * depth;
    const row = seat.row + dr * depth;
    const flank = dc !== 0 ? [[col, row - 1], [col, row + 1]] : [[col - 1, row], [col + 1, row]];
    for (const [c, r] of [[col, row], ...flank]) {
      if (screenTiles.has(`${c},${r}`)) return true;
    }
  }
  return false;
}
for (const seat of seats) {
  const ahead = `${seat.col + seat.facing[0]},${seat.row + seat.facing[1]}`;
  if (!deskTiles.has(ahead)) {
    throw new Error(`Seat at ${seat.col},${seat.row} faces ${ahead}, where there is no desk`);
  }
  if (!seatFacesScreen(seat)) {
    throw new Error(
      `Seat at ${seat.col},${seat.row} faces a desk at ${ahead} with no monitor ahead of it or ` +
        `beside its line of sight`,
    );
  }
}

const seatsPerRoom = new Map(ROOMS.map((r) => [r.label, 0]));
for (const seat of seats) {
  const label = areaTiles[idx(seat.col, seat.row)];
  if (label === null) {
    throw new Error(`Seat at ${seat.col},${seat.row} is unzoned; any department could claim it`);
  }
  seatsPerRoom.set(label, seatsPerRoom.get(label) + 1);
}
for (const room of ROOMS) {
  const count = seatsPerRoom.get(room.label);
  if (count !== room.seats) {
    throw new Error(`Room ${room.label} has ${count} seats, expected ${room.seats}`);
  }
}

// Reachability, furniture included. Seat tiles are excluded as destinations:
// a chair blocks its own tile by design and characters are placed onto seats
// directly, so requiring them to be walkable would reject every valid layout.
const blocked = new Set();
for (const item of furniture) {
  for (const [c, r] of blockedTilesOf(item.type, item.col, item.row)) blocked.add(`${c},${r}`);
}
const walkable = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const tile = tiles[idx(col, row)];
    if (tile === WALL || tile === VOID) continue;
    if (blocked.has(`${col},${row}`)) continue;
    walkable.push({ col, row });
  }
}
const seen = new Set([`${walkable[0].col},${walkable[0].row}`]);
const queue = [walkable[0]];
while (queue.length > 0) {
  const { col, row } = queue.pop();
  for (const [dc, dr] of ORTHOGONAL) {
    const nc = col + dc;
    const nr = row + dr;
    const key = `${nc},${nr}`;
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
    const tile = tiles[idx(nc, nr)];
    if (tile === WALL || tile === VOID || blocked.has(key) || seen.has(key)) continue;
    seen.add(key);
    queue.push({ col: nc, row: nr });
  }
}
if (seen.size !== walkable.length) {
  throw new Error(
    `Furniture cut the office into pieces: ${seen.size} of ${walkable.length} walkable tiles reachable`,
  );
}

// Circulation. The reachability pass above is satisfied by a plant standing in
// the middle of the aisle - the floor around it is still connected - so the
// walkways are named and checked separately. Each room's declared path is first
// proved to be a real path, then proved clear.
for (const room of ROOMS) {
  const paths = circulationTilesOf(room);
  const pathTiles = [...paths].map((key) => key.split(",").map(Number));

  for (const [c, r] of pathTiles) {
    const tile = tiles[idx(c, r)];
    if (tile === WALL || tile === VOID) {
      throw new Error(
        `Room ${room.label} routes circulation through ${c},${r}, which is not floor`,
      );
    }
  }

  // One piece, or it is not a route - it is two routes and a claim.
  const [origin] = pathTiles;
  const joined = new Set([`${origin[0]},${origin[1]}`]);
  const frontier = [origin];
  while (frontier.length > 0) {
    const [c, r] = frontier.pop();
    for (const [dc, dr] of ORTHOGONAL) {
      const key = `${c + dc},${r + dr}`;
      if (!paths.has(key) || joined.has(key)) continue;
      joined.add(key);
      frontier.push([c + dc, r + dr]);
    }
  }
  if (joined.size !== paths.size) {
    throw new Error(
      `Room ${room.label}'s circulation is not one connected path: ${joined.size} of ` +
        `${paths.size} tiles hang together`,
    );
  }

  const touchesPath = (col, row) =>
    ORTHOGONAL.some(([dc, dr]) => paths.has(`${col + dc},${row + dr}`));

  // Both ends have to be on it: every doorway into the room, and every seat.
  for (const col of [room.originCol - 1, room.originCol + ROOM_WIDTH]) {
    if (col < 0 || col >= COLS) continue;
    for (let row = FLOOR_TOP; row <= FLOOR_BOTTOM; row++) {
      if (tiles[idx(col, row)] !== CORRIDOR_FLOOR) continue;
      if (!touchesPath(col, row)) {
        throw new Error(
          `Room ${room.label}'s doorway at ${col},${row} opens onto no circulation tile`,
        );
      }
    }
  }
  for (const seat of seats) {
    if (areaTiles[idx(seat.col, seat.row)] !== room.label) continue;
    if (!touchesPath(seat.col, seat.row)) {
      throw new Error(
        `Seat at ${seat.col},${seat.row} in room ${room.label} has no circulation tile beside ` +
          `it, so nothing walks up to it`,
      );
    }
  }

  // And nothing stands on it. Covered tiles rather than blocked ones: a plant
  // whose leaves hang over the aisle is still a plant in the aisle, and this
  // catches a desk parked across a walkway just as well as a pot.
  for (const item of furniture) {
    for (const [c, r] of coveredTilesOf(item.type, item.col, item.row)) {
      if (paths.has(`${c},${r}`)) {
        throw new Error(
          `${item.type} (${item.uid}) at ${item.col},${item.row} covers ${c},${r}, which is ` +
            `circulation in room ${room.label}`,
        );
      }
    }
  }
}

// Floor decor belongs against a wall, in a corner, or beside a desk. Anything
// else is a piece marooned in open floor, which reads as clutter however
// carefully the walkways were dodged.
for (const item of furniture) {
  if (item.row < FLOOR_TOP) continue; // wall-mounted, hung above the wall row
  if (!FLOOR_DECOR_CATEGORIES.has(entryFor(item.type).category)) continue;
  const footprint = coveredTilesOf(item.type, item.col, item.row);
  const againstWall = footprint.some(([c, r]) =>
    ORTHOGONAL.some(([dc, dr]) => {
      const nc = c + dc;
      const nr = r + dr;
      // Off the grid counts: the office has no bottom wall row, so the last
      // floor row is still an edge to stand against.
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return true;
      const tile = tiles[idx(nc, nr)];
      return tile === WALL || tile === VOID;
    }),
  );
  const besideDesk = footprint.some(([c, r]) =>
    ORTHOGONAL.some(([dc, dr]) => deskTiles.has(`${c + dc},${r + dr}`)),
  );
  if (!againstWall && !besideDesk) {
    throw new Error(
      `${item.type} (${item.uid}) at ${item.col},${item.row} stands in open floor; floor decor ` +
        `belongs against a wall or beside a desk`,
    );
  }
}

// Nothing spiky within arm's reach of a chair.
for (const item of furniture) {
  if (!SPIKY_DECOR.has(item.type)) continue;
  for (const [c, r] of coveredTilesOf(item.type, item.col, item.row)) {
    for (const seat of seats) {
      if (Math.max(Math.abs(c - seat.col), Math.abs(r - seat.row)) <= SEAT_REACH) {
        throw new Error(
          `${item.type} (${item.uid}) covers ${c},${r}, within reach of the seat at ` +
            `${seat.col},${seat.row}`,
        );
      }
    }
  }
}

mkdirSync(path.dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(layout, null, 2)}\n`);
console.log(
  `Wrote ${OUT_FILE}: ${COLS}x${ROWS}, ` +
    ROOMS.map((r) => `${r.label}=${r.seats}`).join(" ") +
    `, ${furniture.length} furniture items, ` +
    `${carpetTiles.filter(Boolean).length} carpet tiles, ${walkable.length} walkable tiles, ` +
    `${pets.length} pets`,
);
