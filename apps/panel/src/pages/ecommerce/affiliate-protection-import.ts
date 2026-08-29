import type { GQL } from "@rivonclaw/core";

export const AFFILIATE_CREATOR_UPDATE_IMPORT_MAX_ENTRIES = 200;
export const AFFILIATE_CREATOR_UPDATE_IMPORT_MAX_VARIABLE_BYTES = 48 * 1024;
export const AFFILIATE_DEVELOPER_PROVISION_MAX_ENTRIES = 100;

export const AFFILIATE_CREATOR_UPDATE_TEMPLATE_HEADERS = [
  "creator_username",
  "bd_name",
  "protection_action",
  "protection_note",
  "add_manual_tag_1",
  "add_manual_tag_2",
  "add_manual_tag_3",
  "add_manual_tag_4",
  "add_manual_tag_5",
] as const;

const REQUIRED_CREATOR_UPDATE_HEADERS = [
  "creator_username",
  "bd_name",
  "protection_action",
  "protection_note",
  "add_manual_tag_1",
] as const;

const MANUAL_TAG_HEADER_PATTERN = /^add_manual_tag_([1-9]\d*)$/u;

export type AffiliateCreatorUpdateImportEntry = GQL.ImportAffiliateCreatorUpdateEntryInput;

export type AffiliateCreatorUpdateImportBatch = {
  entries: AffiliateCreatorUpdateImportEntry[];
  startIndex: number;
};

export type ParsedAffiliateCreatorUpdateRow = {
  username: string | null;
  businessDeveloperName: string | null;
  protect: boolean;
  protectionNote: string | null;
  manualTagNames: string[];
  issue: "MISSING_CREATOR" | "INVALID_PROTECTION_ACTION" | "NOTE_WITHOUT_PROTECTION" | "NO_UPDATES" | null;
};

export type AffiliateCreatorUpdateTemplateValidation = {
  valid: boolean;
  missingHeaders: string[];
  unsupportedHeaders: string[];
};

export function normalizeAffiliateCreatorUpdateHeader(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/[\s-]+/gu, "_");
}

/**
 * Reject the former two-column protection workbook instead of silently
 * interpreting blank update columns. Additional numbered manual-tag columns
 * are accepted so customers can extend the template horizontally.
 */
export function validateAffiliateCreatorUpdateTemplate(
  rawHeaders: unknown[],
): AffiliateCreatorUpdateTemplateValidation {
  const headers = rawHeaders.map(normalizeAffiliateCreatorUpdateHeader).filter(Boolean);
  const headerSet = new Set(headers);
  const missingHeaders = REQUIRED_CREATOR_UPDATE_HEADERS.filter((header) => !headerSet.has(header));
  const supported = new Set(["creator_username", "bd_name", "protection_action", "protection_note"]);
  const unsupportedHeaders = headers.filter((header) => (
    !supported.has(header) && !MANUAL_TAG_HEADER_PATTERN.test(header)
  ));
  return {
    valid: missingHeaders.length === 0 && unsupportedHeaders.length === 0,
    missingHeaders,
    unsupportedHeaders,
  };
}

export function parseAffiliateCreatorUpdateRow(
  raw: Record<string, unknown>,
): ParsedAffiliateCreatorUpdateRow {
  const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [
    normalizeAffiliateCreatorUpdateHeader(key),
    value,
  ]));
  const username = cleanCell(row.creator_username)?.replace(/^@/u, "") || null;
  const businessDeveloperName = cleanCell(row.bd_name);
  const protectionAction = cleanCell(row.protection_action)?.toUpperCase() ?? "";
  const protect = protectionAction === "PROTECT";
  const protectionNote = cleanCell(row.protection_note);
  const manualTagsByNormalizedName = new Map<string, string>();
  Object.entries(row)
    .filter(([header]) => MANUAL_TAG_HEADER_PATTERN.test(header))
    .sort(([left], [right]) => Number(left.match(MANUAL_TAG_HEADER_PATTERN)?.[1]) - Number(right.match(MANUAL_TAG_HEADER_PATTERN)?.[1]))
    .forEach(([, value]) => {
      const name = cleanCell(value);
      if (!name) return;
      const normalizedName = name.trim().toLowerCase();
      if (!manualTagsByNormalizedName.has(normalizedName)) manualTagsByNormalizedName.set(normalizedName, name);
    });
  const manualTagNames = [...manualTagsByNormalizedName.values()];
  let issue: ParsedAffiliateCreatorUpdateRow["issue"] = null;
  if (!username) issue = "MISSING_CREATOR";
  else if (protectionAction && !protect) issue = "INVALID_PROTECTION_ACTION";
  else if (protectionNote && !protect) issue = "NOTE_WITHOUT_PROTECTION";
  else if (!businessDeveloperName && !protect && manualTagNames.length === 0) issue = "NO_UPDATES";
  return {
    username,
    businessDeveloperName,
    protect,
    protectionNote,
    manualTagNames,
    issue,
  };
}

export type AffiliateProtectionPreviewDisposition =
  | "ERROR"
  | "EXCLUDED"
  | "NEEDS_DEVELOPER_DECISION"
  | "ASSIGNED"
  | "PROTECTION_ONLY";

export type AffiliateProtectionAssignmentSummary = {
  assigned: Array<{
    businessDeveloperId: string;
    businessDeveloperName: string;
    rowCount: number;
  }>;
  assignedRowCount: number;
  protectionOnlyRowCount: number;
  attentionRowCount: number;
};

export function classifyAffiliateProtectionPreviewRow(row: {
  error: string | null;
  excluded?: boolean;
  businessDeveloperId: string | null;
  businessDeveloperName: string | null;
}): AffiliateProtectionPreviewDisposition {
  if (row.error) return "ERROR";
  if (row.excluded) return "EXCLUDED";
  if (row.businessDeveloperId) return "ASSIGNED";
  if (row.businessDeveloperName) return "NEEDS_DEVELOPER_DECISION";
  return "PROTECTION_ONLY";
}

export function summarizeAffiliateProtectionAssignments(
  rows: Array<{
    error: string | null;
    excluded?: boolean;
    businessDeveloperId: string | null;
    businessDeveloperName: string | null;
  }>,
): AffiliateProtectionAssignmentSummary {
  const assignedByDeveloper = new Map<string, {
    businessDeveloperId: string;
    businessDeveloperName: string;
    rowCount: number;
  }>();
  let assignedRowCount = 0;
  let protectionOnlyRowCount = 0;
  let attentionRowCount = 0;

  for (const row of rows) {
    const disposition = classifyAffiliateProtectionPreviewRow(row);
    if (disposition === "ASSIGNED" && row.businessDeveloperId) {
      assignedRowCount += 1;
      const existing = assignedByDeveloper.get(row.businessDeveloperId);
      if (existing) {
        existing.rowCount += 1;
      } else {
        assignedByDeveloper.set(row.businessDeveloperId, {
          businessDeveloperId: row.businessDeveloperId,
          businessDeveloperName: row.businessDeveloperName ?? row.businessDeveloperId,
          rowCount: 1,
        });
      }
    } else if (disposition === "PROTECTION_ONLY") {
      protectionOnlyRowCount += 1;
    } else {
      attentionRowCount += 1;
    }
  }

  return {
    assigned: [...assignedByDeveloper.values()].sort((left, right) => (
      right.rowCount - left.rowCount ||
      left.businessDeveloperName.localeCompare(right.businessDeveloperName)
    )),
    assignedRowCount,
    protectionOnlyRowCount,
    attentionRowCount,
  };
}

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
  entries: AffiliateCreatorUpdateImportEntry[],
  importBatchId: string,
): number {
  return textEncoder.encode(JSON.stringify({
    input: {
      importBatchId,
      entries,
    },
  })).byteLength;
}

export function buildAffiliateCreatorUpdateImportBatches(
  entries: AffiliateCreatorUpdateImportEntry[],
  importBatchId: string,
  options: {
    maxEntries?: number;
    maxVariableBytes?: number;
  } = {},
): AffiliateCreatorUpdateImportBatch[] {
  const maxEntries = options.maxEntries ?? AFFILIATE_CREATOR_UPDATE_IMPORT_MAX_ENTRIES;
  const maxVariableBytes = options.maxVariableBytes ?? AFFILIATE_CREATOR_UPDATE_IMPORT_MAX_VARIABLE_BYTES;
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("Affiliate Creator update maxEntries must be a positive integer.");
  }
  if (!Number.isInteger(maxVariableBytes) || maxVariableBytes < 1) {
    throw new Error("Affiliate Creator update maxVariableBytes must be a positive integer.");
  }

  const batches: AffiliateCreatorUpdateImportBatch[] = [];
  let currentEntries: AffiliateCreatorUpdateImportEntry[] = [];
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
      throw new Error(`Affiliate Creator update row ${index + 1} exceeds the safe request size.`);
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

export function affiliateCreatorUpdateImportVariablesByteLength(
  entries: AffiliateCreatorUpdateImportEntry[],
  importBatchId: string,
): number {
  return variablesByteLength(entries, importBatchId);
}

function cleanCell(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}
