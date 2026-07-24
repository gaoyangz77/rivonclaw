import type { GQL } from "@rivonclaw/core";

export const AFFILIATE_PROTECTION_IMPORT_MAX_ENTRIES = 200;
export const AFFILIATE_PROTECTION_IMPORT_MAX_VARIABLE_BYTES = 48 * 1024;
export const AFFILIATE_DEVELOPER_PROVISION_MAX_ENTRIES = 100;

export type AffiliateProtectionImportEntry = GQL.ImportAffiliateCreatorProtectionEntryInput;

export type AffiliateProtectionImportBatch = {
  entries: AffiliateProtectionImportEntry[];
  startIndex: number;
};

export function buildAffiliateDeveloperProvisionBatches<T>(
  entries: T[],
  maxEntries = AFFILIATE_DEVELOPER_PROVISION_MAX_ENTRIES,
): T[][] {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("Affiliate developer provision maxEntries must be a positive integer.");
  }
  return Array.from(
    { length: Math.ceil(entries.length / maxEntries) },
    (_, index) => entries.slice(index * maxEntries, (index + 1) * maxEntries),
  );
}

export function normalizeAffiliateBusinessDeveloperName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

export type AffiliateProtectionDeveloperResolutionSeed = {
  clientKey: string;
  sourceName: string;
  normalizedSourceName: string;
  proposedName: string;
  rowNumbers: number[];
  archivedDeveloperId: string | null;
  defaultResolution: "CREATE" | "";
};

export function buildAffiliateProtectionDeveloperResolutionSeeds(
  rows: Array<{
    rowNumber: number;
    businessDeveloperName: string | null;
    businessDeveloperId: string | null;
    error: string | null;
  }>,
  developers: Array<{
    id: string;
    normalizedDisplayName: string;
    archivedAt?: unknown;
  }>,
): AffiliateProtectionDeveloperResolutionSeed[] {
  const archivedByName = new Map(
    developers
      .filter((developer) => Boolean(developer.archivedAt))
      .map((developer) => [developer.normalizedDisplayName, developer]),
  );
  const grouped = new Map<string, AffiliateProtectionDeveloperResolutionSeed>();
  for (const row of rows) {
    if (!row.businessDeveloperName || row.businessDeveloperId || row.error) continue;
    const normalizedSourceName = normalizeAffiliateBusinessDeveloperName(row.businessDeveloperName);
    const existing = grouped.get(normalizedSourceName);
    if (existing) {
      existing.rowNumbers.push(row.rowNumber);
      continue;
    }
    const archived = archivedByName.get(normalizedSourceName);
    grouped.set(normalizedSourceName, {
      clientKey: `bd-${grouped.size + 1}`,
      sourceName: row.businessDeveloperName,
      normalizedSourceName,
      proposedName: row.businessDeveloperName,
      rowNumbers: [row.rowNumber],
      archivedDeveloperId: archived?.id ?? null,
      defaultResolution: archived ? "" : "CREATE",
    });
  }
  return [...grouped.values()];
}

const textEncoder = new TextEncoder();

function variablesByteLength(
  entries: AffiliateProtectionImportEntry[],
  importBatchId: string,
): number {
  return textEncoder.encode(JSON.stringify({
    input: {
      importBatchId,
      entries,
    },
  })).byteLength;
}

export function buildAffiliateProtectionImportBatches(
  entries: AffiliateProtectionImportEntry[],
  importBatchId: string,
  options: {
    maxEntries?: number;
    maxVariableBytes?: number;
  } = {},
): AffiliateProtectionImportBatch[] {
  const maxEntries = options.maxEntries ?? AFFILIATE_PROTECTION_IMPORT_MAX_ENTRIES;
  const maxVariableBytes = options.maxVariableBytes ?? AFFILIATE_PROTECTION_IMPORT_MAX_VARIABLE_BYTES;
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("Affiliate protection import maxEntries must be a positive integer.");
  }
  if (!Number.isInteger(maxVariableBytes) || maxVariableBytes < 1) {
    throw new Error("Affiliate protection import maxVariableBytes must be a positive integer.");
  }

  const batches: AffiliateProtectionImportBatch[] = [];
  let currentEntries: AffiliateProtectionImportEntry[] = [];
  let currentStartIndex = 0;

  for (const [index, entry] of entries.entries()) {
    const candidateEntries = [...currentEntries, entry];
    const exceedsEntryLimit = candidateEntries.length > maxEntries;
    const exceedsByteLimit = variablesByteLength(candidateEntries, importBatchId) > maxVariableBytes;

    if (currentEntries.length > 0 && (exceedsEntryLimit || exceedsByteLimit)) {
      batches.push({
        entries: currentEntries,
        startIndex: currentStartIndex,
      });
      currentEntries = [entry];
      currentStartIndex = index;
    } else {
      currentEntries = candidateEntries;
    }

    if (variablesByteLength(currentEntries, importBatchId) > maxVariableBytes) {
      throw new Error(`Affiliate protection import row ${index + 1} exceeds the safe request size.`);
    }
  }

  if (currentEntries.length > 0) {
    batches.push({
      entries: currentEntries,
      startIndex: currentStartIndex,
    });
  }

  return batches;
}

export function affiliateProtectionImportVariablesByteLength(
  entries: AffiliateProtectionImportEntry[],
  importBatchId: string,
): number {
  return variablesByteLength(entries, importBatchId);
}
