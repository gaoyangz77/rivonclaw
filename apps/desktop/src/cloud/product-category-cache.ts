import type { GQL } from "@rivonclaw/core";
import { resolveRivonClawHome } from "@rivonclaw/core/node";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";
import { normalizeAppLocale } from "../i18n/locale.js";

const compress = promisify(gzip);
const decompress = promisify(gunzip);
const CACHE_VERSION = 1;

function cacheDirectory(): string {
  // The catalog contains shared taxonomy, not account or shop data.
  return join(resolveRivonClawHome(), "cache", "product-categories");
}

function cachePath(locale: string): string {
  return join(cacheDirectory(), `${normalizeAppLocale(locale)}.json.gz`);
}

export async function readProductCategoryCache(
  locale: string,
): Promise<GQL.ProductCategoryCatalog | null> {
  let bytes: Buffer;
  try {
    bytes = await readFile(cachePath(locale));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const json = await decompress(bytes, { maxOutputLength: 64 * 1024 * 1024 });
  const cached = JSON.parse(json.toString("utf-8"));
  const catalog = cached?.catalog;
  if (
    cached?.version !== CACHE_VERSION ||
    !catalog ||
    catalog.locale !== normalizeAppLocale(locale) ||
    !Number.isFinite(Date.parse(catalog.fetchedAt)) ||
    !Array.isArray(catalog.items) ||
    !Array.isArray(catalog.marketVersions) ||
    !Array.isArray(catalog.syncStatus)
  ) {
    throw new Error("Invalid product category disk cache");
  }
  return catalog as GQL.ProductCategoryCatalog;
}

export async function writeProductCategoryCache(
  catalog: GQL.ProductCategoryCatalog,
): Promise<void> {
  const bytes = await compress(JSON.stringify({ version: CACHE_VERSION, catalog }));
  await mkdir(cacheDirectory(), { recursive: true });
  const target = cachePath(catalog.locale);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}
