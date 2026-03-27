import { describe, it, expect, beforeEach } from "vitest";
import { entityCache, normalizePlatform } from "./entity-cache.js";
import type { CachedShop } from "./entity-cache.js";

beforeEach(() => {
  // Reset cache state before each test
  entityCache.setState({ runProfiles: [], surfaces: [], toolSpecs: [], shops: [] });
});

// ─── RunProfiles ────────────────────────────────────────────────────────────

describe("runProfiles ingestion", () => {
  it("ingests runProfiles array from query response", () => {
    const profiles = [
      { id: "rp-1", name: "CS Profile", selectedToolIds: ["tool_a", "tool_b"], surfaceId: "s-1" },
      { id: "rp-2", name: "Ops Profile", selectedToolIds: ["tool_c"], userId: "u-1" },
    ];

    entityCache.getState().ingestGraphQLResponse({ runProfiles: profiles });

    expect(entityCache.getState().runProfiles).toEqual(profiles);
  });

  it("overwrites existing runProfiles on re-ingestion", () => {
    entityCache.getState().ingestGraphQLResponse({
      runProfiles: [{ id: "rp-old", name: "Old", selectedToolIds: [] }],
    });
    entityCache.getState().ingestGraphQLResponse({
      runProfiles: [{ id: "rp-new", name: "New", selectedToolIds: ["x"] }],
    });

    expect(entityCache.getState().runProfiles).toHaveLength(1);
    expect(entityCache.getState().runProfiles[0]!.id).toBe("rp-new");
  });

  it("appends on createRunProfile mutation", () => {
    entityCache.getState().ingestGraphQLResponse({
      runProfiles: [{ id: "rp-1", name: "Existing", selectedToolIds: [] }],
    });
    entityCache.getState().ingestGraphQLResponse({
      createRunProfile: { id: "rp-2", name: "Created", selectedToolIds: ["tool_x"] },
    });

    expect(entityCache.getState().runProfiles).toHaveLength(2);
    expect(entityCache.getState().runProfiles[1]!.id).toBe("rp-2");
  });

  it("updates matching profile on updateRunProfile mutation", () => {
    entityCache.getState().ingestGraphQLResponse({
      runProfiles: [
        { id: "rp-1", name: "Before", selectedToolIds: ["old"] },
        { id: "rp-2", name: "Untouched", selectedToolIds: ["keep"] },
      ],
    });
    entityCache.getState().ingestGraphQLResponse({
      updateRunProfile: { id: "rp-1", name: "After", selectedToolIds: ["new_a", "new_b"] },
    });

    const updated = entityCache.getState().runProfiles.find(p => p.id === "rp-1");
    expect(updated!.name).toBe("After");
    expect(updated!.selectedToolIds).toEqual(["new_a", "new_b"]);

    // Other profiles unchanged
    const untouched = entityCache.getState().runProfiles.find(p => p.id === "rp-2");
    expect(untouched!.name).toBe("Untouched");
  });

  it("ignores non-array runProfiles (e.g. null)", () => {
    entityCache.getState().ingestGraphQLResponse({
      runProfiles: [{ id: "rp-1", name: "Keep", selectedToolIds: [] }],
    });
    entityCache.getState().ingestGraphQLResponse({ runProfiles: null });

    expect(entityCache.getState().runProfiles).toHaveLength(1);
  });
});

// ─── getRunProfile ──────────────────────────────────────────────────────────

describe("getRunProfile", () => {
  it("returns the profile matching the given ID", () => {
    entityCache.getState().ingestGraphQLResponse({
      runProfiles: [
        { id: "rp-1", name: "First", selectedToolIds: ["a"] },
        { id: "rp-2", name: "Second", selectedToolIds: ["b", "c"] },
      ],
    });

    const result = entityCache.getState().getRunProfile("rp-2");
    expect(result).toEqual({ id: "rp-2", name: "Second", selectedToolIds: ["b", "c"] });
  });

  it("returns undefined for a missing ID", () => {
    entityCache.getState().ingestGraphQLResponse({
      runProfiles: [{ id: "rp-1", name: "Only", selectedToolIds: [] }],
    });

    expect(entityCache.getState().getRunProfile("nonexistent")).toBeUndefined();
  });

  it("returns undefined when cache is empty", () => {
    expect(entityCache.getState().getRunProfile("anything")).toBeUndefined();
  });
});

// ─── Surfaces ───────────────────────────────────────────────────────────────

describe("surfaces ingestion", () => {
  it("ingests surfaces array from query response", () => {
    const surfaces = [
      { id: "s-1", name: "Surface A", allowedToolIds: ["tool_1"], userId: "u-1" },
      { id: "s-2", name: "Surface B", allowedToolIds: [] },
    ];

    entityCache.getState().ingestGraphQLResponse({ surfaces });

    expect(entityCache.getState().surfaces).toEqual(surfaces);
  });

  it("appends on createSurface mutation", () => {
    entityCache.getState().ingestGraphQLResponse({
      surfaces: [{ id: "s-1", name: "Existing", allowedToolIds: [] }],
    });
    entityCache.getState().ingestGraphQLResponse({
      createSurface: { id: "s-2", name: "New", allowedToolIds: ["tool_a"] },
    });

    expect(entityCache.getState().surfaces).toHaveLength(2);
    expect(entityCache.getState().surfaces[1]!.id).toBe("s-2");
  });

  it("updates matching surface on updateSurface mutation", () => {
    entityCache.getState().ingestGraphQLResponse({
      surfaces: [
        { id: "s-1", name: "Before", allowedToolIds: ["old"] },
        { id: "s-2", name: "Keep", allowedToolIds: ["keep"] },
      ],
    });
    entityCache.getState().ingestGraphQLResponse({
      updateSurface: { id: "s-1", name: "After", allowedToolIds: ["new"] },
    });

    const updated = entityCache.getState().surfaces.find(s => s.id === "s-1");
    expect(updated!.name).toBe("After");
    expect(updated!.allowedToolIds).toEqual(["new"]);

    const kept = entityCache.getState().surfaces.find(s => s.id === "s-2");
    expect(kept!.name).toBe("Keep");
  });

  it("ignores non-array surfaces", () => {
    entityCache.getState().ingestGraphQLResponse({
      surfaces: [{ id: "s-1", name: "Keep", allowedToolIds: [] }],
    });
    entityCache.getState().ingestGraphQLResponse({ surfaces: "not-an-array" });

    expect(entityCache.getState().surfaces).toHaveLength(1);
  });
});

// ─── ToolSpecs ingestion ─────────────────────────────────────────────────────

describe("toolSpecs ingestion", () => {
  const makeSpec = (overrides: Partial<{ id: string; name: string; surfaces: string[]; runProfiles: string[] }> = {}) => ({
    id: overrides.id ?? "TOOL_A",
    name: overrides.name ?? "tool_a",
    displayName: "Tool A",
    description: "A tool",
    category: "cs",
    operationType: "mutation",
    parameters: [],
    surfaces: overrides.surfaces ?? null,
    runProfiles: overrides.runProfiles ?? null,
  });

  it("ingests toolSpecs array from query response", () => {
    const specs = [makeSpec(), makeSpec({ id: "TOOL_B", name: "tool_b" })];
    entityCache.getState().ingestGraphQLResponse({ toolSpecs: specs });

    expect(entityCache.getState().toolSpecs).toHaveLength(2);
    expect(entityCache.getState().toolSpecs[0]!.name).toBe("tool_a");
  });

  it("overwrites existing toolSpecs on re-ingestion", () => {
    entityCache.getState().ingestGraphQLResponse({ toolSpecs: [makeSpec()] });
    entityCache.getState().ingestGraphQLResponse({ toolSpecs: [makeSpec({ id: "TOOL_NEW", name: "tool_new" })] });

    expect(entityCache.getState().toolSpecs).toHaveLength(1);
    expect(entityCache.getState().toolSpecs[0]!.name).toBe("tool_new");
  });

  it("ignores non-array toolSpecs (e.g. null)", () => {
    entityCache.getState().ingestGraphQLResponse({ toolSpecs: [makeSpec()] });
    entityCache.getState().ingestGraphQLResponse({ toolSpecs: null });

    expect(entityCache.getState().toolSpecs).toHaveLength(1);
  });
});

// ─── getToolIdsForSurface ────────────────────────────────────────────────────

describe("getToolIdsForSurface", () => {
  const makeSpec = (name: string, surfaces: string[] | null) => ({
    id: name.toUpperCase(),
    name,
    displayName: name,
    description: "",
    category: "cs",
    operationType: "mutation",
    parameters: [],
    surfaces,
    runProfiles: null,
  });

  it("returns tool names matching the given surface", () => {
    entityCache.getState().ingestGraphQLResponse({
      toolSpecs: [
        makeSpec("tool_a", ["ECOM_TIKTOK_GLOBAL_SELLER"]),
        makeSpec("tool_b", ["ECOM_TIKTOK_GLOBAL_SELLER", "OTHER_SURFACE"]),
        makeSpec("tool_c", ["OTHER_SURFACE"]),
        makeSpec("tool_d", null),
      ],
    });

    const result = entityCache.getState().getToolIdsForSurface("ECOM_TIKTOK_GLOBAL_SELLER");
    expect(result).toEqual(["TOOL_A", "TOOL_B"]);
  });

  it("performs case-insensitive matching", () => {
    entityCache.getState().ingestGraphQLResponse({
      toolSpecs: [makeSpec("tool_a", ["ECOM_TIKTOK_GLOBAL_SELLER"])],
    });

    expect(entityCache.getState().getToolIdsForSurface("ecom_tiktok_global_seller")).toEqual(["TOOL_A"]);
    expect(entityCache.getState().getToolIdsForSurface("Ecom_TikTok_Global_Seller")).toEqual(["TOOL_A"]);
  });

  it("returns empty array when no tools match", () => {
    entityCache.getState().ingestGraphQLResponse({
      toolSpecs: [makeSpec("tool_a", ["OTHER_SURFACE"])],
    });

    expect(entityCache.getState().getToolIdsForSurface("NONEXISTENT")).toEqual([]);
  });

  it("returns empty array when cache is empty", () => {
    expect(entityCache.getState().getToolIdsForSurface("ANY")).toEqual([]);
  });
});

// ─── getToolIdsForRunProfile ─────────────────────────────────────────────────

describe("getToolIdsForRunProfile", () => {
  const makeSpec = (name: string, runProfiles: string[] | null) => ({
    id: name.toUpperCase(),
    name,
    displayName: name,
    description: "",
    category: "cs",
    operationType: "mutation",
    parameters: [],
    surfaces: null,
    runProfiles,
  });

  it("returns tool names matching the given run profile", () => {
    entityCache.getState().ingestGraphQLResponse({
      toolSpecs: [
        makeSpec("ecom_cs_send_media", ["ECOM_CS"]),
        makeSpec("ecom_cs_get_order", ["ECOM_CS", "ECOM_OPS"]),
        makeSpec("ecom_ops_cancel_order", ["ECOM_OPS"]),
        makeSpec("tool_no_profile", null),
      ],
    });

    const result = entityCache.getState().getToolIdsForRunProfile("ECOM_CS");
    expect(result).toEqual(["ECOM_CS_SEND_MEDIA", "ECOM_CS_GET_ORDER"]);
  });

  it("performs case-insensitive matching", () => {
    entityCache.getState().ingestGraphQLResponse({
      toolSpecs: [makeSpec("tool_a", ["ECOM_CS"])],
    });

    expect(entityCache.getState().getToolIdsForRunProfile("ecom_cs")).toEqual(["TOOL_A"]);
    expect(entityCache.getState().getToolIdsForRunProfile("Ecom_CS")).toEqual(["TOOL_A"]);
  });

  it("returns empty array when no tools match", () => {
    entityCache.getState().ingestGraphQLResponse({
      toolSpecs: [makeSpec("tool_a", ["ECOM_OPS"])],
    });

    expect(entityCache.getState().getToolIdsForRunProfile("ECOM_CS")).toEqual([]);
  });

  it("returns empty array when cache is empty", () => {
    expect(entityCache.getState().getToolIdsForRunProfile("ECOM_CS")).toEqual([]);
  });
});

// ─── Mixed / edge cases ─────────────────────────────────────────────────────

describe("mixed ingestion", () => {
  it("handles response with both runProfiles and surfaces", () => {
    entityCache.getState().ingestGraphQLResponse({
      runProfiles: [{ id: "rp-1", name: "RP", selectedToolIds: ["t1"] }],
      surfaces: [{ id: "s-1", name: "SF", allowedToolIds: ["t2"] }],
    });

    expect(entityCache.getState().runProfiles).toHaveLength(1);
    expect(entityCache.getState().surfaces).toHaveLength(1);
  });

  it("handles response with toolSpecs alongside runProfiles and surfaces", () => {
    entityCache.getState().ingestGraphQLResponse({
      runProfiles: [{ id: "rp-1", name: "RP", selectedToolIds: ["t1"] }],
      surfaces: [{ id: "s-1", name: "SF", allowedToolIds: ["t2"] }],
      toolSpecs: [{ id: "TS", name: "ts", displayName: "TS", description: "", category: "c", operationType: "query", parameters: [] }],
    });

    expect(entityCache.getState().runProfiles).toHaveLength(1);
    expect(entityCache.getState().surfaces).toHaveLength(1);
    expect(entityCache.getState().toolSpecs).toHaveLength(1);
  });

  it("ignores unrelated fields without errors", () => {
    entityCache.getState().ingestGraphQLResponse({
      someOtherField: true,
      anotherField: 42,
    });

    expect(entityCache.getState().runProfiles).toEqual([]);
    expect(entityCache.getState().surfaces).toEqual([]);
    expect(entityCache.getState().toolSpecs).toEqual([]);
    expect(entityCache.getState().shops).toEqual([]);
  });

  it("handles response with shops alongside other entities", () => {
    entityCache.getState().ingestGraphQLResponse({
      runProfiles: [{ id: "rp-1", name: "RP", selectedToolIds: ["t1"] }],
      shops: [{ id: "shop-1", platform: "TIKTOK_SHOP", platformShopId: "ps-1", shopName: "Test Shop" }],
    });

    expect(entityCache.getState().runProfiles).toHaveLength(1);
    expect(entityCache.getState().shops).toHaveLength(1);
  });
});

// ── Shops ingestion ──────────────────────────────────────────────────────────

const makeShop = (overrides: Partial<CachedShop> = {}): CachedShop => ({
  id: overrides.id ?? "shop-1",
  platform: overrides.platform ?? "TIKTOK_SHOP",
  platformShopId: overrides.platformShopId ?? "ps-1",
  shopName: overrides.shopName ?? "Test Shop",
  services: overrides.services,
});

describe("shops ingestion", () => {
  it("ingests shops array from query response", () => {
    const shops = [makeShop(), makeShop({ id: "shop-2", platformShopId: "ps-2", shopName: "Shop 2" })];
    entityCache.getState().ingestGraphQLResponse({ shops });

    expect(entityCache.getState().shops).toHaveLength(2);
    expect(entityCache.getState().shops[0]!.id).toBe("shop-1");
    expect(entityCache.getState().shops[1]!.id).toBe("shop-2");
  });

  it("overwrites existing shops on re-ingestion", () => {
    entityCache.getState().ingestGraphQLResponse({
      shops: [makeShop({ id: "shop-old", shopName: "Old" })],
    });
    entityCache.getState().ingestGraphQLResponse({
      shops: [makeShop({ id: "shop-new", shopName: "New" })],
    });

    expect(entityCache.getState().shops).toHaveLength(1);
    expect(entityCache.getState().shops[0]!.id).toBe("shop-new");
  });

  it("appends on createShop mutation", () => {
    entityCache.getState().ingestGraphQLResponse({
      shops: [makeShop()],
    });
    entityCache.getState().ingestGraphQLResponse({
      createShop: makeShop({ id: "shop-2", platformShopId: "ps-2" }),
    });

    expect(entityCache.getState().shops).toHaveLength(2);
    expect(entityCache.getState().shops[1]!.id).toBe("shop-2");
  });

  it("updates matching shop on updateShop mutation", () => {
    entityCache.getState().ingestGraphQLResponse({
      shops: [
        makeShop({ id: "shop-1", shopName: "Before" }),
        makeShop({ id: "shop-2", shopName: "Untouched", platformShopId: "ps-2" }),
      ],
    });
    entityCache.getState().ingestGraphQLResponse({
      updateShop: makeShop({ id: "shop-1", shopName: "After" }),
    });

    const updated = entityCache.getState().shops.find(s => s.id === "shop-1");
    expect(updated!.shopName).toBe("After");

    const untouched = entityCache.getState().shops.find(s => s.id === "shop-2");
    expect(untouched!.shopName).toBe("Untouched");
  });

  it("removes shop on deleteShop mutation", () => {
    entityCache.getState().ingestGraphQLResponse({
      shops: [
        makeShop({ id: "shop-1" }),
        makeShop({ id: "shop-2", platformShopId: "ps-2" }),
      ],
    });
    entityCache.getState().ingestGraphQLResponse({
      deleteShop: { id: "shop-1" },
    });

    expect(entityCache.getState().shops).toHaveLength(1);
    expect(entityCache.getState().shops[0]!.id).toBe("shop-2");
  });

  it("ingests shops with full services structure", () => {
    const shop = makeShop({
      services: {
        customerService: {
          enabled: true,
          businessPrompt: "Help customers",
          csDeviceId: "device-123",
          csModelOverride: "gpt-4o",
          runProfileId: "rp-cs",
          assembledPrompt: "You are a helpful CS agent.",
        },
      },
    });
    entityCache.getState().ingestGraphQLResponse({ shops: [shop] });

    const cached = entityCache.getState().shops[0]!;
    expect(cached.services!.customerService!.enabled).toBe(true);
    expect(cached.services!.customerService!.assembledPrompt).toBe("You are a helpful CS agent.");
    expect(cached.services!.customerService!.csDeviceId).toBe("device-123");
  });

  it("ignores non-array shops (e.g. null)", () => {
    entityCache.getState().ingestGraphQLResponse({
      shops: [makeShop()],
    });
    entityCache.getState().ingestGraphQLResponse({ shops: null });

    expect(entityCache.getState().shops).toHaveLength(1);
  });
});

// ── getShop / getShopByPlatformId ────────────────────────────────────────────

describe("getShop", () => {
  it("returns shop by id", () => {
    entityCache.getState().ingestGraphQLResponse({
      shops: [makeShop({ id: "shop-1" }), makeShop({ id: "shop-2", platformShopId: "ps-2" })],
    });

    const result = entityCache.getState().getShop("shop-2");
    expect(result).toBeDefined();
    expect(result!.id).toBe("shop-2");
  });

  it("returns undefined for missing id", () => {
    entityCache.getState().ingestGraphQLResponse({
      shops: [makeShop()],
    });

    expect(entityCache.getState().getShop("nonexistent")).toBeUndefined();
  });
});

describe("getShopByPlatformId", () => {
  it("returns shop by platformShopId", () => {
    entityCache.getState().ingestGraphQLResponse({
      shops: [
        makeShop({ id: "shop-1", platformShopId: "ps-1" }),
        makeShop({ id: "shop-2", platformShopId: "ps-2" }),
      ],
    });

    const result = entityCache.getState().getShopByPlatformId("ps-2");
    expect(result).toBeDefined();
    expect(result!.id).toBe("shop-2");
  });

  it("returns undefined for missing platformShopId", () => {
    entityCache.getState().ingestGraphQLResponse({
      shops: [makeShop()],
    });

    expect(entityCache.getState().getShopByPlatformId("nonexistent")).toBeUndefined();
  });
});

// ── normalizePlatform ────────────────────────────────────────────────────────

describe("normalizePlatform", () => {
  it("strips _SHOP suffix and lowercases", () => {
    expect(normalizePlatform("TIKTOK_SHOP")).toBe("tiktok");
  });

  it("strips _STORE suffix and lowercases", () => {
    expect(normalizePlatform("SHOPEE_STORE")).toBe("shopee");
  });

  it("lowercases platforms without suffix", () => {
    expect(normalizePlatform("AMAZON")).toBe("amazon");
  });

  it("handles already-lowercase input", () => {
    expect(normalizePlatform("tiktok_shop")).toBe("tiktok");
  });
});
