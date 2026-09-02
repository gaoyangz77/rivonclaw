import { describe, expect, it } from "vitest";
import { BOOTSTRAP_ORDER, buildBootstrapMessages, type SceneAssetBundle } from "./assetBootstrap.js";

const EMPTY_BUNDLE: SceneAssetBundle = {
  characters: [],
  pets: [],
  petNames: [],
  floors: [],
  walls: [],
  carpets: [],
  furnitureCatalog: [],
  furnitureSprites: {},
  layout: { version: 1, cols: 10, rows: 10 },
};

describe("buildBootstrapMessages", () => {
  it("emits every message the renderer needs, in the required order", () => {
    const messages = buildBootstrapMessages(EMPTY_BUNDLE, { hostVersion: "1.0.0" });
    expect(messages.map((m) => m.type)).toEqual([...BOOTSTRAP_ORDER]);
  });

  it("delivers sprites before the layout that references them", () => {
    const types = buildBootstrapMessages(EMPTY_BUNDLE, { hostVersion: "1.0.0" }).map((m) => m.type);
    expect(types.indexOf("characterSpritesLoaded")).toBeLessThan(types.indexOf("layoutLoaded"));
    expect(types.indexOf("furnitureAssetsLoaded")).toBeLessThan(types.indexOf("layoutLoaded"));
  });

  // The renderer bounds-checks a placed pet's `petType` against the sprite sets
  // it has loaded and drops the pet when there are none, so a layout that
  // arrives first produces an office with no pets and no complaint.
  it("delivers pet sprites before the layout that places them", () => {
    const types = buildBootstrapMessages(EMPTY_BUNDLE, { hostVersion: "1.0.0" }).map((m) => m.type);
    expect(types.indexOf("petSpritesLoaded")).toBeLessThan(types.indexOf("layoutLoaded"));
  });

  it("sends pet sprites with their names in the same order", () => {
    const frames = (fill: string) => [[[fill]], [[fill]], [[fill]]];
    const pet = (fill: string) => ({
      walkDown: frames(fill),
      idleDown: frames(fill),
      walkUp: frames(fill),
      idleUp: frames(fill),
      walkRight: frames(fill),
    });
    const messages = buildBootstrapMessages(
      { ...EMPTY_BUNDLE, pets: [pet("#A"), pet("#B")], petNames: ["Claudio", "Gitcat"] },
      { hostVersion: "1.0.0" },
    );
    const loaded = messages.find((m) => m.type === "petSpritesLoaded");
    expect(loaded).toMatchObject({ pets: [pet("#A"), pet("#B")], petNames: ["Claudio", "Gitcat"] });
  });

  // `petType` is an array index, so an office with no pets must still send the
  // message rather than leaving the renderer's sprite table undefined.
  it("sends an empty pet roster rather than omitting the message", () => {
    const messages = buildBootstrapMessages(EMPTY_BUNDLE, { hostVersion: "1.0.0" });
    expect(messages.find((m) => m.type === "petSpritesLoaded")).toMatchObject({
      pets: [],
      petNames: [],
    });
  });

  it("passes the layout through untouched", () => {
    const layout = { version: 1, cols: 24, rows: 16, areas: [{ label: "cs", color: "#f00" }] };
    const messages = buildBootstrapMessages({ ...EMPTY_BUNDLE, layout }, { hostVersion: "1.0.0" });
    const loaded = messages.find((m) => m.type === "layoutLoaded");
    expect(loaded).toMatchObject({ layout });
  });

  // Upstream's hook installer writes into the user's Claude Code config. It has
  // no role here and must never be reachable from a rendered office.
  it("never enables the upstream hook installer", () => {
    const settings = buildBootstrapMessages(EMPTY_BUNDLE, { hostVersion: "1.0.0" }).find(
      (m) => m.type === "settingsLoaded",
    );
    expect(settings).toMatchObject({ hooksEnabled: false, hooksInfoShown: true });
  });

  it("never enables on-disk session discovery", () => {
    const settings = buildBootstrapMessages(EMPTY_BUNDLE, { hostVersion: "1.0.0" }).find(
      (m) => m.type === "settingsLoaded",
    );
    expect(settings).toMatchObject({ watchAllSessions: false, externalAssetDirectories: [] });
  });

  // Without this message the renderer's seat picker skips its in-area stage,
  // and every character lands in the unzoned pool regardless of folderName.
  it("sends the department routing table", () => {
    const messages = buildBootstrapMessages(EMPTY_BUNDLE, {
      hostVersion: "1.0.0",
      areaMappings: { cs: ["cs"], bd: ["bd"] },
    });
    expect(messages.find((m) => m.type === "areaMappingsLoaded")).toMatchObject({
      mappings: { cs: ["cs"], bd: ["bd"] },
    });
  });

  it("sends an empty routing table rather than omitting it", () => {
    const messages = buildBootstrapMessages(EMPTY_BUNDLE, { hostVersion: "1.0.0" });
    expect(messages.find((m) => m.type === "areaMappingsLoaded")).toMatchObject({ mappings: {} });
  });

  it("routes departments only after the layout that defines the Areas", () => {
    const types = buildBootstrapMessages(EMPTY_BUNDLE, { hostVersion: "1.0.0" }).map((m) => m.type);
    expect(types.indexOf("layoutLoaded")).toBeLessThan(types.indexOf("areaMappingsLoaded"));
  });

  it("honours the display options the host does control", () => {
    const settings = buildBootstrapMessages(EMPTY_BUNDLE, {
      hostVersion: "2.5.0",
      showAreas: true,
      alwaysShowLabels: true,
      soundEnabled: true,
    }).find((m) => m.type === "settingsLoaded");
    expect(settings).toMatchObject({
      showAreas: true,
      alwaysShowLabels: true,
      soundEnabled: true,
      extensionVersion: "2.5.0",
    });
  });
});
