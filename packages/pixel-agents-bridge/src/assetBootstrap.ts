import type {
  CharacterSpriteSet,
  FurnitureAssetMessage,
  PetSpriteFrameSet,
  PixelAgentsBootstrapMessage,
} from "./protocol.js";

/**
 * Decoded assets the host must hand the renderer before any agent message.
 *
 * Produced offline by upstream's own Node decoders (`core/src/assets/loader.ts`
 * and `build.ts`), which read PNGs and furniture manifests from an assets
 * directory. Decoding is done at build time rather than in the browser: a
 * production upstream build tree-shakes its browser decoder away, and shipping
 * the already-decoded bundle also keeps the office from spending its first
 * second of a livestream decoding sprites.
 */
export type SceneAssetBundle = {
  characters: CharacterSpriteSet[];
  /** Indexed by the layout's `petType`. Order is the contract; see the message. */
  pets: PetSpriteFrameSet[];
  /** Display names, parallel to `pets`. */
  petNames: string[];
  floors: string[][][];
  walls: string[][][][];
  carpets: string[][][][];
  furnitureCatalog: FurnitureAssetMessage[];
  furnitureSprites: Record<string, string[][]>;
  /** Office layout: tiles, walls, furniture, and the Areas that become rooms. */
  layout: Record<string, unknown> | null;
};

export type BootstrapOptions = {
  /** Reported to the renderer's about/version UI. */
  hostVersion: string;
  /**
   * Room id -> Area labels, the routing table that puts a character in its
   * department. Keys must match the `roomId` the translator sends as
   * `folderName`; values must match `label`s defined in the layout's `areas`.
   * Omitting it leaves every character in the unzoned seat pool.
   */
  areaMappings?: Record<string, string[]>;
  /** Draw the translucent Area overlays that mark department boundaries. */
  showAreas?: boolean;
  /** Show a name label over every character instead of only on hover. */
  alwaysShowLabels?: boolean;
  soundEnabled?: boolean;
};

/**
 * Build the bootstrap sequence, in the order the renderer requires.
 *
 * The order is upstream's, not ours: sprites must land before the layout that
 * references them, or the first frame draws against empty sprite tables. It is
 * stated in upstream's own CLAUDE.md and matched by its dev-mode bootstrap
 * (`webview-ui/src/browserMock.ts`), which is the only executable reference for
 * it - so this function exists mainly to keep that ordering in one asserted
 * place rather than spread across call sites.
 */
export function buildBootstrapMessages(
  bundle: SceneAssetBundle,
  options: BootstrapOptions,
): PixelAgentsBootstrapMessage[] {
  return [
    { type: "characterSpritesLoaded", characters: bundle.characters },
    // Alongside the characters, and well before the layout: the renderer's
    // `OfficeState.addPet` bounds-checks each placed pet's `petType` against
    // the number of sprite sets it has loaded, and drops the pet outright when
    // none have arrived. A layout-first order therefore yields a petless office
    // with nothing logged. Upstream's own handshake sends it in this same slot
    // (`server/src/clientMessageHandler.ts`, handleWebviewReady).
    { type: "petSpritesLoaded", pets: bundle.pets, petNames: bundle.petNames },
    { type: "floorTilesLoaded", sprites: bundle.floors },
    { type: "wallTilesLoaded", sets: bundle.walls },
    { type: "carpetTilesLoaded", sets: bundle.carpets },
    {
      type: "furnitureAssetsLoaded",
      catalog: bundle.furnitureCatalog,
      sprites: bundle.furnitureSprites,
    },
    { type: "layoutLoaded", layout: bundle.layout },
    // After the layout, which is where the Area labels these keys point at are
    // defined, and before any agent exists to be seated.
    { type: "areaMappingsLoaded", mappings: options.areaMappings ?? {} },
    {
      type: "settingsLoaded",
      soundEnabled: options.soundEnabled ?? false,
      lastSeenVersion: options.hostVersion,
      extensionVersion: options.hostVersion,
      // Every setting below is deliberately pinned rather than passed through.
      //
      // `hooksEnabled` above all: turning it on drives upstream's installer to
      // write hook scripts into the user's Claude Code configuration. That is
      // its integration with a different product and has no meaning here, so
      // the host must never leave it reachable. `hooksInfoShown` suppresses the
      // first-run prompt that would otherwise ask the viewer about it.
      hooksEnabled: false,
      hooksInfoShown: true,
      // Session discovery is upstream's own runtime finding Claude sessions on
      // disk. Our agents come over the transport; scanning is both useless and
      // a way to surface unrelated work in a demo.
      watchAllSessions: false,
      // External packs are how bundled art gets replaced. The host decides that
      // at build time, so the renderer is given none to discover at runtime.
      externalAssetDirectories: [],
      alwaysShowLabels: options.alwaysShowLabels ?? false,
      ghostHeadlessAgents: false,
      showAreas: options.showAreas ?? false,
    },
  ];
}

/** Message order the renderer requires. Exported so tests can assert on it. */
export const BOOTSTRAP_ORDER = [
  "characterSpritesLoaded",
  "petSpritesLoaded",
  "floorTilesLoaded",
  "wallTilesLoaded",
  "carpetTilesLoaded",
  "furnitureAssetsLoaded",
  "layoutLoaded",
  "areaMappingsLoaded",
  "settingsLoaded",
] as const;
