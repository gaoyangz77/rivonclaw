import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import { TkAlert, TkBadge, TkButton } from "../../../components/design-system/index.js";
import { AFFILIATE_CAMPAIGN_CREATOR_LIST_ENTRIES_QUERY } from "../../../api/shops-queries.js";
import {
  CREATOR_LIST_MAX_USERNAMES,
  type CreatorListDraft,
} from "../affiliate-campaign-creator-list.js";
import "./AffiliateCampaignCreatorList.css";

const KEY_PREFIX = "ecommerce.affiliateCampaign.creatorList.";
/** Invalid rows listed in the wizard before the rest are summarized. */
const INVALID_ROWS_SHOWN = 10;
const PROBLEM_PAGE_SIZE = 50;
const PROBLEM_STATUSES = [
  GQL.AffiliateCampaignCreatorListEntryStatus.NotFound,
  GQL.AffiliateCampaignCreatorListEntryStatus.Ambiguous,
  GQL.AffiliateCampaignCreatorListEntryStatus.LookupFailed,
];

/** Plain progress counts, copied from the GraphQL summary. */
export interface CreatorListProgress {
  total: number;
  resolved: number;
  pendingLookup: number;
  notFound: number;
  ambiguous: number;
  lookupFailed: number;
  fed: number;
}

function problemCount(progress: CreatorListProgress): number {
  return progress.notFound + progress.ambiguous + progress.lookupFailed;
}

/**
 * Target step, in place of the search direction: download the template, upload the list, and see
 * exactly what will be sent before moving on (ADR-106).
 */
export function AffiliateCampaignCreatorListSection({
  draft,
  existingTotal,
  onFile,
  onDownloadTemplate,
}: {
  draft: CreatorListDraft;
  /** The stored list's size when editing a Campaign; null for a new one. */
  existingTotal: number | null;
  onFile: (file: File) => void;
  onDownloadTemplate: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reading = draft.status === "reading";
  const prepared = draft.status === "ready" ? draft.prepared : null;
  const hasList = draft.status !== "empty";
  return (
    <section className="affiliate-creator-list-section">
      <div>
        <strong>{t(`${KEY_PREFIX}sectionTitle`)}</strong>
        <p>{t(`${KEY_PREFIX}sectionDescription`)}</p>
      </div>
      <div className="affiliate-creator-list-actions">
        <TkButton variant="secondary" onClick={onDownloadTemplate}>
          {t(`${KEY_PREFIX}downloadTemplate`)}
        </TkButton>
        <input
          ref={inputRef}
          className="affiliate-creator-list-file-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          aria-label={t(`${KEY_PREFIX}${hasList ? "replaceFile" : "uploadFile"}`)}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onFile(file);
          }}
        />
        <TkButton variant="secondary" disabled={reading} onClick={() => inputRef.current?.click()}>
          {t(`${KEY_PREFIX}${hasList ? "replaceFile" : "uploadFile"}`)}
        </TkButton>
        {draft.status !== "empty" && (
          <span className="affiliate-creator-list-file-name">{draft.fileName}</span>
        )}
      </div>
      {existingTotal !== null && (
        <p className="affiliate-creator-list-note">
          {t(`${KEY_PREFIX}existingList`, { total: existingTotal })}
        </p>
      )}
      {reading && (
        <p className="affiliate-creator-list-note" role="status">
          {t(`${KEY_PREFIX}reading`)}
        </p>
      )}
      {draft.status === "error" && (
        <TkAlert tone="danger">{t(`${KEY_PREFIX}${draft.errorKey}`)}</TkAlert>
      )}
      {prepared && (
        <div className="affiliate-creator-list-summary" role="status">
          <div className="affiliate-creator-list-badges">
            <TkBadge tone={prepared.usernames.length > 0 ? "success" : "neutral"}>
              {t(`${KEY_PREFIX}summaryValid`, { count: prepared.usernames.length })}
            </TkBadge>
            {prepared.duplicateCount > 0 && (
              <TkBadge tone="neutral">
                {t(`${KEY_PREFIX}summaryDuplicates`, { count: prepared.duplicateCount })}
              </TkBadge>
            )}
            {prepared.invalid.length > 0 && (
              <TkBadge tone="danger">
                {t(`${KEY_PREFIX}summaryInvalid`, { count: prepared.invalid.length })}
              </TkBadge>
            )}
          </div>
          {prepared.tooMany && (
            <TkAlert tone="danger">
              {t(`${KEY_PREFIX}tooMany`, {
                max: CREATOR_LIST_MAX_USERNAMES,
                count: prepared.usernames.length,
              })}
            </TkAlert>
          )}
          {prepared.invalid.length > 0 && (
            <ul className="affiliate-creator-list-invalid">
              {prepared.invalid.slice(0, INVALID_ROWS_SHOWN).map((row) => (
                <li key={row.rowNumber}>
                  {t(`${KEY_PREFIX}invalidRow`, { row: row.rowNumber, value: row.raw })}
                </li>
              ))}
              {prepared.invalid.length > INVALID_ROWS_SHOWN && (
                <li>
                  {t(`${KEY_PREFIX}invalidMore`, {
                    count: prepared.invalid.length - INVALID_ROWS_SHOWN,
                  })}
                </li>
              )}
            </ul>
          )}
        </div>
      )}
      <small className="affiliate-creator-list-note">{t(`${KEY_PREFIX}lookupNote`)}</small>
    </section>
  );
}

/**
 * Campaign detail header toggle. Collapsed it still shows matched, still-being-looked-up and
 * unmatched counts, so a seller sees at a glance whether any username needs attention.
 */
export function AffiliateCampaignCreatorListToggle({
  open,
  progress,
  onToggle,
}: {
  open: boolean;
  progress: CreatorListProgress | null;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="affiliate-campaign-template-toggle affiliate-creator-list-toggle"
      aria-expanded={open}
      onClick={onToggle}
    >
      {t(`${KEY_PREFIX}detail.${open ? "hideList" : "viewList"}`)}
      {progress && (
        <span className="affiliate-creator-list-toggle-counts" aria-hidden="true">
          <span className="is-resolved">✓{progress.resolved}</span>
          {progress.pendingLookup > 0 && (
            <span className="is-pending">…{progress.pendingLookup}</span>
          )}
          {problemCount(progress) > 0 && (
            <span className="is-problem">✕{problemCount(progress)}</span>
          )}
        </span>
      )}
    </button>
  );
}

interface ProblemEntry {
  id: string;
  rowNumber: number;
  username: string;
  status: GQL.AffiliateCampaignCreatorListEntryStatus;
}

interface EntriesQueryData {
  affiliateCampaignCreatorListEntries: {
    items: Array<{
      id: string;
      rowNumber: number;
      username: string;
      status: GQL.AffiliateCampaignCreatorListEntryStatus;
    }>;
    nextCursor?: string | null;
  };
}

type ProblemLoad = "idle" | "loading" | "error";

/**
 * Campaign detail, expanded: how far the list has come, and the usernames that could not be
 * matched. The caller keys it by Campaign, so switching Campaign starts it afresh.
 */
export function AffiliateCampaignCreatorListPanel({
  campaignId,
  progress,
  stopReason,
}: {
  campaignId: string;
  progress: CreatorListProgress | null;
  stopReason?: string | null;
}) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const titleId = useId();
  const [problems, setProblems] = useState<ProblemEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [load, setLoad] = useState<ProblemLoad>("idle");
  const sequence = useRef(0);
  const unmatchedCount = progress ? problemCount(progress) : 0;

  const loadPage = useCallback(
    async (cursor: string | null) => {
      const current = ++sequence.current;
      setLoad("loading");
      try {
        const result = await client.query<EntriesQueryData>({
          query: AFFILIATE_CAMPAIGN_CREATOR_LIST_ENTRIES_QUERY,
          variables: {
            input: { campaignId, statuses: PROBLEM_STATUSES, limit: PROBLEM_PAGE_SIZE, cursor },
          },
          fetchPolicy: "network-only",
        });
        if (current !== sequence.current) return;
        const page = result.data?.affiliateCampaignCreatorListEntries;
        if (!page) throw new Error("Creator list entries are unavailable");
        const items = page.items.map(({ id, rowNumber, username, status }) => ({
          id,
          rowNumber,
          username,
          status,
        }));
        setProblems((existing) => (cursor ? [...existing, ...items] : items));
        setNextCursor(page.nextCursor ?? null);
        setLoad("idle");
      } catch {
        if (current === sequence.current) setLoad("error");
      }
    },
    [client, campaignId],
  );

  // The first page is read again whenever the number of unmatched usernames changes.
  useEffect(() => {
    if (unmatchedCount === 0) {
      sequence.current += 1;
      setProblems([]);
      setNextCursor(null);
      setLoad("idle");
      return;
    }
    void loadPage(null);
  }, [unmatchedCount, loadPage]);

  const counts: Array<[string, number]> = progress
    ? [
        ["resolved", progress.resolved],
        ["pendingLookup", progress.pendingLookup],
        ["notFound", progress.notFound],
        ["ambiguous", progress.ambiguous],
        ["lookupFailed", progress.lookupFailed],
        ["fed", progress.fed],
      ]
    : [];
  const stopLabel =
    stopReason === "WAITING_FOR_CREATOR_LIST_LOOKUP" || stopReason === "CREATOR_LIST_EXHAUSTED"
      ? t(`${KEY_PREFIX}stopReason.${stopReason}`)
      : null;

  return (
    <section className="affiliate-creator-list-panel" aria-labelledby={titleId}>
      <div className="affiliate-creator-list-panel-heading">
        <span id={titleId}>{t(`${KEY_PREFIX}detail.title`)}</span>
        {progress && <small>{t(`${KEY_PREFIX}summaryValid`, { count: progress.total })}</small>}
      </div>
      {progress && (
        <dl className="affiliate-creator-list-counts">
          {counts.map(([key, value]) => (
            <div key={key}>
              <dt>{t(`${KEY_PREFIX}detail.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {stopLabel && <p className="affiliate-creator-list-note">{stopLabel}</p>}
      <div className="affiliate-creator-list-problems">
        <strong>{t(`${KEY_PREFIX}detail.problemTitle`)}</strong>
        {progress && unmatchedCount === 0 ? (
          <p className="affiliate-creator-list-note">{t(`${KEY_PREFIX}detail.problemEmpty`)}</p>
        ) : (
          <ul>
            {problems.map((entry) => (
              <li key={entry.id}>
                <span>
                  {t(`${KEY_PREFIX}invalidRow`, { row: entry.rowNumber, value: entry.username })}
                </span>
                <TkBadge tone="warning">{t(`${KEY_PREFIX}status.${entry.status}`)}</TkBadge>
              </li>
            ))}
          </ul>
        )}
        {load === "error" && <TkAlert tone="danger">{t(`${KEY_PREFIX}detail.loadFailed`)}</TkAlert>}
        {nextCursor && (
          <TkButton
            variant="secondary"
            size="sm"
            disabled={load === "loading"}
            onClick={() => void loadPage(nextCursor)}
          >
            {t(`${KEY_PREFIX}detail.loadMore`)}
          </TkButton>
        )}
      </div>
    </section>
  );
}
