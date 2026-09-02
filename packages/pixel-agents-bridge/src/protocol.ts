/**
 * The exact subset of the Pixel Agents wire protocol this bridge emits.
 *
 * Upstream generates its full protocol from `core/asyncapi.yaml` into
 * `core/src/messages.ts`. That package is a private workspace of the upstream
 * repo and is not published, so importing it would mean vendoring their build.
 * Instead this file re-declares only the messages we send, which makes the
 * coupling surface explicit and auditable: if upstream changes one of these
 * shapes, the diff shows up here rather than somewhere inside a renderer.
 *
 * Everything the office needs beyond this - sprites, floors, walls, furniture,
 * layout, settings - is asset bootstrap, not agent state, and is handled
 * separately (see `assetBootstrap` in this package's consumers).
 *
 * Verified against pixel-agents v1.4.1.
 */

/** Their per-agent seat metadata, persisted across sessions. */
export type AgentSeatMeta = {
  palette?: number;
  hueShift?: number;
  seatId?: string;
};

/**
 * Full agent roster. Sent once per (re)connect, before any incremental message.
 * This is upstream's own snapshot-before-patch mechanism; we reuse it rather
 * than inventing a resync path.
 */
export type ExistingAgents = {
  type: "existingAgents";
  agents: number[];
  agentMeta: Record<string, AgentSeatMeta>;
  /**
   * Upstream routes a new character to a room by looking up
   * `areaMappings[folderName]` and preferring free seats inside those Areas
   * (`webview-ui/src/office/engine/officeState.ts`). We put our room id here,
   * which is what makes departments work without forking their seat allocator.
   */
  folderNames: Record<string, string>;
  externalAgents: Record<string, boolean>;
};

export type AgentCreated = {
  type: "agentCreated";
  id: number;
  folderName?: string;
  isExternal?: boolean;
  palette?: number;
  hueShift?: number;
};

export type AgentClosed = { type: "agentClosed"; id: number };

/** Upstream models only these two activity states. */
export type AgentActivityStatus = "active" | "waiting";

export type AgentStatus = {
  type: "agentStatus";
  id: number;
  status: AgentActivityStatus;
  awaitingInput?: boolean;
};

export type AgentToolStart = {
  type: "agentToolStart";
  id: number;
  toolId: string;
  status: string;
  toolName?: string;
};

export type AgentToolDone = { type: "agentToolDone"; id: number; toolId: string };

export type AgentToolsClear = { type: "agentToolsClear"; id: number };

export type AgentToolPermission = { type: "agentToolPermission"; id: number };

export type AgentToolPermissionClear = { type: "agentToolPermissionClear"; id: number };

/** Union of everything this bridge is allowed to emit. */
export type PixelAgentsMessage =
  | ExistingAgents
  | AgentCreated
  | AgentClosed
  | AgentStatus
  | AgentToolStart
  | AgentToolDone
  | AgentToolsClear
  | AgentToolPermission
  | AgentToolPermissionClear;

// ── Asset bootstrap ─────────────────────────────────────────────────────────
//
// Upstream's webview does NOT load its own assets in a production build:
// `initBrowserMock()` is gated behind `import.meta.env.DEV` in
// `webview-ui/src/main.tsx`, so the browser-side PNG decoder is tree-shaken out
// and the host has to deliver every sprite over the transport. These are the
// messages that carry them.

/** One character's frames, per facing. Left is drawn by mirroring right. */
export type CharacterSpriteSet = {
  down: string[][][];
  up: string[][][];
  right: string[][][];
};

export type CharacterSpritesLoaded = {
  type: "characterSpritesLoaded";
  characters: CharacterSpriteSet[];
};

/**
 * One pet's frames. Only three facings are authored: the renderer derives
 * walking left by mirroring `walkRight`, and reuses the front- and back-facing
 * idles for the side-on ones (`webview-ui/src/office/sprites/petSpriteData.ts`).
 */
export type PetSpriteFrameSet = {
  walkDown: string[][][];
  idleDown: string[][][];
  walkUp: string[][][];
  idleUp: string[][][];
  walkRight: string[][][];
};

/**
 * The pet spritesheets, plus their display names in the same order.
 *
 * `pets` is what the layout's `petType` indexes into, so its order is a
 * contract with whoever wrote the layout, and `petNames` is parallel to it. The
 * renderer drops any pet whose `petType` is beyond the end of this array
 * (`OfficeState.addPet`), which is why it has to arrive before the layout.
 */
export type PetSpritesLoaded = {
  type: "petSpritesLoaded";
  pets: PetSpriteFrameSet[];
  petNames: string[];
};

export type FloorTilesLoaded = { type: "floorTilesLoaded"; sprites: string[][][] };
export type WallTilesLoaded = { type: "wallTilesLoaded"; sets: string[][][][] };
export type CarpetTilesLoaded = { type: "carpetTilesLoaded"; sets: string[][][][] };

export type FurnitureAssetMessage = {
  id: string;
  name: string;
  label: string;
  category: string;
  file: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  canPlaceOnWalls: boolean;
  groupId?: string;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
  orientation?: string;
  state?: string;
  mirrorSide?: boolean;
  rotationScheme?: string;
  animationGroup?: string;
  frame?: number;
};

export type FurnitureAssetsLoaded = {
  type: "furnitureAssetsLoaded";
  catalog: FurnitureAssetMessage[];
  sprites: Record<string, string[][]>;
};

/**
 * Maps a character's `folderName` to the Area labels it should be seated in.
 *
 * Without this the renderer's `areaMappings` stays empty and its seat picker
 * skips the in-area stage entirely, falling through to "any unzoned seat" -
 * which is how a department-less office happens even when the layout has Areas
 * and every character carries the right `folderName`.
 */
export type AreaMappingsLoaded = {
  type: "areaMappingsLoaded";
  mappings: Record<string, string[]>;
};

/** `layout` carries rooms as Areas, plus tiles, walls, furniture and carpets. */
export type LayoutLoaded = {
  type: "layoutLoaded";
  layout: Record<string, unknown> | null;
  wasReset?: boolean;
};

export type SettingsLoaded = {
  type: "settingsLoaded";
  soundEnabled: boolean;
  lastSeenVersion: string;
  extensionVersion: string;
  watchAllSessions: boolean;
  alwaysShowLabels: boolean;
  ghostHeadlessAgents: boolean;
  hooksEnabled: boolean;
  hooksInfoShown: boolean;
  externalAssetDirectories: string[];
  showAreas: boolean;
};

export type PixelAgentsBootstrapMessage =
  | CharacterSpritesLoaded
  | PetSpritesLoaded
  | FloorTilesLoaded
  | WallTilesLoaded
  | CarpetTilesLoaded
  | FurnitureAssetsLoaded
  | LayoutLoaded
  | AreaMappingsLoaded
  | SettingsLoaded;
