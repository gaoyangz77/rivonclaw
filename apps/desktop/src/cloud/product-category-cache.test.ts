import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GQL } from "@rivonclaw/core";
import { readProductCategoryCache, writeProductCategoryCache } from "./product-category-cache.js";

let home: string;
const directory = () => join(home, "cache", "product-categories");
const catalog = (locale = "zh", name = "美妆"): GQL.ProductCategoryCatalog => ({
  locale,
  fetchedAt: "2026-10-23T00:00:00.000Z",
  items: [
    {
      id: "FR:1",
      categoryId: "1",
      market: "FR",
      categoryVersion: "v2",
      listingPlatform: "TIKTOK_SHOP",
      parentId: "0",
      isLeaf: true,
      name,
    },
  ],
  marketVersions: [{ market: "FR", categoryVersion: "v2" }],
  syncStatus: [],
});

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "rivonclaw-category-cache-"));
  vi.stubEnv("RIVONCLAW_HOME", home);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(home, { recursive: true, force: true });
});

describe("compressed product category disk cache", () => {
  it("treats a missing cache as a cache miss", async () => {
    expect(await readProductCategoryCache("zh")).toBeNull();
  });

  it("round-trips language buckets without changing their fetch timestamps", async () => {
    await writeProductCategoryCache(catalog());
    await writeProductCategoryCache(catalog("en", "Beauty"));
    expect(await readProductCategoryCache("zh")).toEqual(catalog());
    expect(await readProductCategoryCache("en")).toEqual(catalog("en", "Beauty"));
    const bytes = await readFile(join(directory(), "zh.json.gz"));
    expect([...bytes.subarray(0, 2)]).toEqual([0x1f, 0x8b]);
  });

  it("leaves a complete catalog and no temporary files after concurrent writes", async () => {
    await Promise.all([
      writeProductCategoryCache(catalog("zh", "A")),
      writeProductCategoryCache(catalog("zh", "B")),
    ]);
    const cached = await readProductCategoryCache("zh");
    expect(["A", "B"]).toContain(cached?.items[0].name);
    expect(await readdir(directory())).toEqual(["zh.json.gz"]);
  });

  it.each([
    { version: 2, catalog: catalog() },
    { version: 1, catalog: catalog("en") },
    { version: 1, catalog: { ...catalog(), fetchedAt: "invalid" } },
  ])("rejects incompatible cache metadata: %j", async (payload) => {
    await mkdir(directory(), { recursive: true });
    await writeFile(join(directory(), "zh.json.gz"), gzipSync(JSON.stringify(payload)));
    await expect(readProductCategoryCache("zh")).rejects.toThrow(
      "Invalid product category disk cache",
    );
  });

  it("reports damaged compressed files instead of treating them as valid catalogs", async () => {
    await mkdir(directory(), { recursive: true });
    await writeFile(join(directory(), "zh.json.gz"), "not gzip");
    await expect(readProductCategoryCache("zh")).rejects.toThrow();
  });
});
