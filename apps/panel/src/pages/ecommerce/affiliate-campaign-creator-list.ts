// ADR-106: the seller-supplied Creator list of a `CREATOR_LIST` Campaign. These rules mirror the
// Backend's exactly, so the Panel never uploads a username the Backend would reject.

type XlsxModule = typeof import("xlsx");

/** The single column of the template. */
export const CREATOR_LIST_HEADER = "creator_username";
export const CREATOR_LIST_MAX_USERNAMES = 5000;
export const CREATOR_LIST_TEMPLATE_FILENAME = "creator-list-template.xlsx";

const USERNAME_PATTERN = /^[a-z0-9._]{1,24}$/;
const PROFILE_URL_PATTERN = /tiktok\.com\/@+([^/?#\s]*)/i;

export interface CreatorListRow {
  /** The spreadsheet row, counting the header as row 1. */
  rowNumber: number;
  raw: string;
}

export class CreatorListWorkbookError extends Error {
  constructor(readonly code: "MISSING_COLUMN" | "NO_ROWS") {
    super(code);
  }
}

/** Trim, reduce a pasted profile link to its name, strip leading `@`, lowercase. */
export function normalizeCreatorListUsername(raw: string): string {
  const trimmed = raw.trim();
  const fromUrl = PROFILE_URL_PATTERN.exec(trimmed)?.[1];
  return (fromUrl ?? trimmed.replace(/^@+/, "")).toLowerCase();
}

export function isValidCreatorListUsername(normalized: string): boolean {
  return USERNAME_PATTERN.test(normalized);
}

/**
 * A numeric cell is a number the seller typed into a General cell. A safe integer keeps its digits;
 * anything else would print as a plausible-looking name ("1.5"), so it stays in exponent form,
 * which no username can contain, and fails validation instead of being silently accepted.
 */
function cellText(value: unknown): string {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? String(value) : value.toExponential();
  }
  return String(value ?? "").trim();
}

function headerText(value: unknown): string {
  return String(value ?? "")
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase();
}

/** Reads the first sheet's `creator_username` column. Cells are carried across as written. */
export function readCreatorListWorkbook(XLSX: XlsxModule, bytes: ArrayBuffer): CreatorListRow[] {
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const cells = sheet
    ? XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        raw: true,
        blankrows: true,
      })
    : [];
  const column = (cells[0] ?? []).findIndex((cell) => headerText(cell) === CREATOR_LIST_HEADER);
  if (column < 0) throw new CreatorListWorkbookError("MISSING_COLUMN");

  const rows: CreatorListRow[] = [];
  cells.slice(1).forEach((cell, index) => {
    const raw = cellText(cell[column]);
    if (raw) rows.push({ rowNumber: index + 2, raw });
  });
  if (!rows.length) throw new CreatorListWorkbookError("NO_ROWS");
  return rows;
}

export interface PreparedCreatorList {
  /** Normalized, valid, distinct, in file order. */
  usernames: string[];
  duplicateCount: number;
  invalid: CreatorListRow[];
  /** More distinct valid usernames than the cap; `usernames` still lists all of them. */
  tooMany: boolean;
}

export function prepareCreatorListUsernames(rows: readonly CreatorListRow[]): PreparedCreatorList {
  const seen = new Set<string>();
  const usernames: string[] = [];
  const invalid: CreatorListRow[] = [];
  let duplicateCount = 0;
  for (const row of rows) {
    const normalized = normalizeCreatorListUsername(row.raw);
    if (!isValidCreatorListUsername(normalized)) {
      invalid.push(row);
    } else if (seen.has(normalized)) {
      duplicateCount += 1;
    } else {
      seen.add(normalized);
      usernames.push(normalized);
    }
  }
  return {
    usernames,
    duplicateCount,
    invalid,
    tooMany: usernames.length > CREATOR_LIST_MAX_USERNAMES,
  };
}

/**
 * The wizard's uploaded-file draft: plain data only, never business state. It lives for one wizard
 * session and is reset whenever the wizard opens.
 */
export type CreatorListDraft =
  | { status: "empty" }
  | { status: "reading"; fileName: string }
  | { status: "error"; fileName: string; errorKey: "missingColumn" | "noRows" | "readFailed" }
  | { status: "ready"; fileName: string; prepared: PreparedCreatorList };

export const EMPTY_CREATOR_LIST_DRAFT: CreatorListDraft = { status: "empty" };

/**
 * Whether the wizard may move past the list. A new Campaign needs a clean prepared file. An edit
 * keeps its list when no file was chosen, but a file that was chosen must be clean.
 */
export function creatorListDraftAllowsContinue(
  draft: CreatorListDraft,
  hasExistingList: boolean,
): boolean {
  switch (draft.status) {
    case "empty":
      return hasExistingList;
    case "ready":
      return (
        draft.prepared.usernames.length > 0 &&
        draft.prepared.invalid.length === 0 &&
        !draft.prepared.tooMany
      );
    default:
      return false;
  }
}

/** The list size the confirmation step states: the new file when there is one, else the stored list. */
export function creatorListConfirmedCount(
  draft: CreatorListDraft,
  existingTotal: number | null,
): number {
  return draft.status === "ready" ? draft.prepared.usernames.length : (existingTotal ?? 0);
}

/** The usernames to send, only when a file was prepared in this wizard session. */
export function creatorListUsernamesToWrite(draft: CreatorListDraft): string[] | undefined {
  return draft.status === "ready" ? draft.prepared.usernames : undefined;
}

/** The Backend reports rejected rows as `...: rows 3,7,12`; the seller reads the row list. */
export function creatorListInvalidRowsFromMessage(message: string): string {
  return /rows\s+([\d,\s]+)/.exec(message)?.[1]?.trim().replace(/,\s*$/, "") ?? "";
}
