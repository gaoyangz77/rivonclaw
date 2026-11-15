import { useCallback, useRef, useState } from "react";
import {
  CreatorListWorkbookError,
  EMPTY_CREATOR_LIST_DRAFT,
  prepareCreatorListUsernames,
  readCreatorListWorkbook,
  type CreatorListDraft,
} from "../affiliate-campaign-creator-list.js";

/**
 * The Creator list file chosen in the Campaign wizard (ADR-106), as a plain draft. Reading is async,
 * so a slower earlier file can never overwrite a later choice or a reset.
 */
export function useCreatorListDraft() {
  const [draft, setDraft] = useState<CreatorListDraft>(EMPTY_CREATOR_LIST_DRAFT);
  const sequence = useRef(0);

  const reset = useCallback(() => {
    sequence.current += 1;
    setDraft(EMPTY_CREATOR_LIST_DRAFT);
  }, []);

  const readFile = useCallback(async (file: File) => {
    const current = ++sequence.current;
    const fileName = file.name;
    setDraft({ status: "reading", fileName });
    let next: CreatorListDraft;
    try {
      const XLSX = await import("xlsx");
      const rows = readCreatorListWorkbook(XLSX, await file.arrayBuffer());
      next = { status: "ready", fileName, prepared: prepareCreatorListUsernames(rows) };
    } catch (error) {
      // The file is untrusted input: every way it can fail to parse is reported to the seller.
      next = {
        status: "error",
        fileName,
        errorKey:
          error instanceof CreatorListWorkbookError
            ? error.code === "MISSING_COLUMN"
              ? "missingColumn"
              : "noRows"
            : "readFailed",
      };
    }
    if (current === sequence.current) setDraft(next);
  }, []);

  return { draft, readFile, reset };
}
