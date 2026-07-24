import type { GQL } from "@rivonclaw/core";

export const AFFILIATE_PROTECTION_IMPORT_MAX_ENTRIES = 200;
export const AFFILIATE_PROTECTION_IMPORT_MAX_VARIABLE_BYTES = 48 * 1024;

export type AffiliateProtectionImportEntry = GQL.ImportAffiliateCreatorProtectionEntryInput;

export type AffiliateProtectionImportBatch = {
  entries: AffiliateProtectionImportEntry[];
  startIndex: number;
};

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
