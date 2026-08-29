import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import {
  AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY,
  AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
  REOPEN_SOFT_REJECTED_AFFILIATE_SAMPLE_APPLICATION_MUTATION,
} from "../../../api/shops-queries.js";
import { Select } from "../../../components/inputs/Select.js";
import { LoadingSpinner } from "../../../components/LoadingSpinner.js";
import { useToast } from "../../../components/Toast.js";
import {
  formatLocalizedMonthDay,
  formatLocalizedRelativeTime,
  formatLocalizedTime,
  formatShortDateTime,
} from "../../../lib/format-datetime.js";
import panelI18n from "../../../i18n/index.js";

const PAGE_SIZE = 25;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type AffiliateWorkbenchEntityTab = "SAMPLES" | "MESSAGES";

export interface AffiliateWorkbenchEntityOpenTarget {
  creatorRelationshipId: string;
  selectedShopId?: string;
  initialTab: "samples" | "conversation";
  replyToLifecycleEventId?: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  tab: AffiliateWorkbenchEntityTab;
  selectedShopId: string;
  shopOptions: FilterOption[];
  onSelectShop: (shopId: string) => void;
  businessDeveloperOptions: FilterOption[];
  selectedBusinessDeveloperId: string;
  onSelectBusinessDeveloper: (businessDeveloperId: string) => void;
  refreshRevision: number;
  onOpen: (target: AffiliateWorkbenchEntityOpenTarget) => void;
}

/**
 * Rows accumulated for ONE exact filter set.
 *
 * The buffer carries the filter key it was fetched for so a filter change never
 * needs a reset effect: a buffer whose key no longer matches the active filters
 * is simply not used for render. Clearing rows from an effect instead raced the
 * ingest effect on mount (Apollo can serve the cache synchronously, and the
 * reset then wiped those rows while `page` kept its identity, so the ingest
 * effect never re-ran and the list stayed permanently empty).
 * Mirrors `affiliateProposalPageQueryKey` / `proposalPageBuffer` in
 * `AffiliateManagementPage.tsx`.
 */
interface WorkbenchPageBuffer<Row> {
  filterKey: string;
  /** `true` once a request for `filterKey` completed and wrote this buffer. */
  loaded: boolean;
  items: Row[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface WorkbenchPageResult<Row> {
  items: Row[];
  nextCursor?: string | null;
  hasMore: boolean;
}

function workbenchFilterKey(parts: Array<string | null | undefined>): string {
  return JSON.stringify(parts.map((part) => part ?? ""));
}

function emptyWorkbenchPageBuffer<Row>(filterKey: string): WorkbenchPageBuffer<Row> {
  return { filterKey, loaded: false, items: [], nextCursor: null, hasMore: false };
}

function replaceWorkbenchPageBuffer<Row>(
  filterKey: string,
  page: WorkbenchPageResult<Row>,
): WorkbenchPageBuffer<Row> {
  return {
    filterKey,
    loaded: true,
    items: page.items,
    nextCursor: page.nextCursor ?? null,
    hasMore: page.hasMore,
  };
}

interface SamplePageData {
  affiliateWorkbenchSamplePage: GQL.AffiliateWorkbenchSamplePage;
}

interface ConversationPageData {
  affiliateWorkbenchPendingConversationPage: GQL.AffiliateWorkbenchPendingConversationPage;
}

export function AffiliateWorkbenchEntityTabs({
  tab,
  selectedShopId,
  shopOptions,
  onSelectShop,
  businessDeveloperOptions,
  selectedBusinessDeveloperId,
  onSelectBusinessDeveloper,
  refreshRevision,
  onOpen,
}: Props) {
  return tab === "SAMPLES" ? (
    <AffiliateWorkbenchSampleList
      selectedShopId={selectedShopId}
      shopOptions={shopOptions}
      onSelectShop={onSelectShop}
      businessDeveloperOptions={businessDeveloperOptions}
      selectedBusinessDeveloperId={selectedBusinessDeveloperId}
      onSelectBusinessDeveloper={onSelectBusinessDeveloper}
      refreshRevision={refreshRevision}
      onOpen={onOpen}
    />
  ) : (
    <AffiliateWorkbenchMessageList
      shopOptions={shopOptions}
      businessDeveloperOptions={businessDeveloperOptions}
      selectedBusinessDeveloperId={selectedBusinessDeveloperId}
      onSelectBusinessDeveloper={onSelectBusinessDeveloper}
      refreshRevision={refreshRevision}
      onOpen={onOpen}
    />
  );
}

function AffiliateWorkbenchSampleList({
  selectedShopId,
  shopOptions,
  onSelectShop,
  businessDeveloperOptions,
  selectedBusinessDeveloperId,
  onSelectBusinessDeveloper,
  onOpen,
  refreshRevision,
}: Omit<Props, "tab">) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [disposition, setDisposition] = useState<GQL.AffiliateSampleReviewDisposition>(
    GQL.AffiliateSampleReviewDisposition.Open,
  );
  const filterKey = workbenchFilterKey([disposition, selectedShopId, selectedBusinessDeveloperId]);
  const [buffer, setBuffer] = useState<WorkbenchPageBuffer<GQL.AffiliateWorkbenchSampleRow>>(() =>
    emptyWorkbenchPageBuffer(filterKey),
  );
  const activeBuffer =
    buffer.filterKey === filterKey
      ? buffer
      : emptyWorkbenchPageBuffer<GQL.AffiliateWorkbenchSampleRow>(filterKey);
  const items = activeBuffer.items;
  const nextCursor = activeBuffer.nextCursor;
  const hasMore = activeBuffer.hasMore;
  const [reopeningRowId, setReopeningRowId] = useState<string | null>(null);
  const { data, loading, error, fetchMore, refetch } = useQuery<
    SamplePageData,
    { input: GQL.AffiliateWorkbenchSamplePageInput }
  >(AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || null,
        businessDeveloperId: selectedBusinessDeveloperId || null,
        reviewDisposition: disposition,
        limit: PAGE_SIZE,
        cursor: null,
      },
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const [reopenSampleApplication] = useMutation<
    { reopenSoftRejectedAffiliateSampleApplication: GQL.AffiliateWorkbenchSampleRow },
    { input: GQL.ReopenSoftRejectedAffiliateSampleApplicationInput }
  >(REOPEN_SOFT_REJECTED_AFFILIATE_SAMPLE_APPLICATION_MUTATION);
  const page = data?.affiliateWorkbenchSamplePage;
  const softRejectedView = disposition === GQL.AffiliateSampleReviewDisposition.SoftRejected;

  useEffect(() => {
    if (!page) return;
    setBuffer(replaceWorkbenchPageBuffer(filterKey, page));
  }, [filterKey, page]);

  useEffect(() => {
    if (refreshRevision > 0) void refetch();
  }, [refetch, refreshRevision]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor) return;
    const requestFilterKey = filterKey;
    const result = await fetchMore({
      variables: {
        input: {
          shopId: selectedShopId || null,
          businessDeveloperId: selectedBusinessDeveloperId || null,
          reviewDisposition: disposition,
          limit: PAGE_SIZE,
          cursor: nextCursor,
        },
      },
      updateQuery: (current) => current,
    });
    const next = result.data?.affiliateWorkbenchSamplePage;
    if (!next) return;
    setBuffer((current) => {
      if (current.filterKey !== requestFilterKey) return current;
      return {
        filterKey: requestFilterKey,
        loaded: true,
        items: appendUniqueRows(current.items, next.items),
        nextCursor: next.nextCursor ?? null,
        hasMore: next.hasMore,
      };
    });
  }, [
    disposition,
    fetchMore,
    filterKey,
    hasMore,
    nextCursor,
    selectedBusinessDeveloperId,
    selectedShopId,
  ]);

  async function reopenRow(row: GQL.AffiliateWorkbenchSampleRow): Promise<void> {
    setReopeningRowId(row.id);
    try {
      await reopenSampleApplication({
        variables: {
          input: {
            sampleApplicationRecordId: row.sampleApplication.id,
            creatorRelationshipId: row.creatorRelationshipId,
            projectionRevision: row.sampleApplication.projectionRevision,
            reviewDispositionRevision: row.sampleApplication.reviewDispositionRevision,
          },
        },
      });
      showToast(t("ecommerce.affiliateWorkspace.workbench.reopenSuccess"), "success");
      await refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    } finally {
      setReopeningRowId(null);
    }
  }

  function openRow(row: GQL.AffiliateWorkbenchSampleRow): void {
    onOpen({
      creatorRelationshipId: row.creatorRelationshipId,
      selectedShopId: row.sampleApplication.shopId,
      initialTab: "samples",
    });
  }

  const nowMs = Date.now();
  const viewState = workbenchListViewState({
    loading,
    hasError: Boolean(error),
    rowCount: items.length,
    completedRowCount: activeBuffer.loaded ? activeBuffer.items.length : null,
  });
  const tableVariant = softRejectedView
    ? "affiliate-workbench-table-samples-rejected"
    : "affiliate-workbench-table-samples-open";

  return (
    <section className="affiliate-workbench-entity-section">
      <div className="affiliate-workbench-entity-toolbar">
        <div className="affiliate-workbench-entity-filters">
          <Select
            value={selectedShopId}
            onChange={onSelectShop}
            options={shopOptions}
            className="affiliate-workspace-shop-select"
          />
          <Select
            value={disposition}
            onChange={(value) => setDisposition(value as GQL.AffiliateSampleReviewDisposition)}
            options={[
              {
                value: GQL.AffiliateSampleReviewDisposition.Open,
                label: t("ecommerce.affiliateWorkspace.workbench.sampleOpen"),
              },
              {
                value: GQL.AffiliateSampleReviewDisposition.SoftRejected,
                label: t("ecommerce.affiliateWorkspace.workbench.sampleSoftRejected"),
              },
            ]}
            className="affiliate-status-select"
          />
          <Select
            value={selectedBusinessDeveloperId}
            onChange={onSelectBusinessDeveloper}
            options={businessDeveloperOptions}
            className="affiliate-status-select"
            ariaLabel={t("ecommerce.affiliateWorkspace.businessDeveloperFilter")}
            searchable
            searchPlaceholder={t("ecommerce.affiliateWorkspace.businessDeveloperSearchPlaceholder")}
          />
          {softRejectedView ? (
            <span className="affiliate-workbench-entity-summary">
              {t("ecommerce.affiliateWorkspace.workbench.softRejectedHint")}
            </span>
          ) : page ? (
            <span className="affiliate-workbench-entity-summary">
              {t("ecommerce.affiliateWorkspace.workbench.summaryOpenCount", {
                count: page.openCount,
              })}
              {page.expiringSoonCount > 0 ? (
                <>
                  <span className="affiliate-workbench-summary-divider" aria-hidden="true">
                    ·
                  </span>
                  <span className="affiliate-workbench-summary-warning">
                    {t("ecommerce.affiliateWorkspace.workbench.summaryExpiringSoon", {
                      count: page.expiringSoonCount,
                    })}
                  </span>
                </>
              ) : null}
            </span>
          ) : null}
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => void refetch()}>
          {t("common.refresh")}
        </button>
      </div>
      {viewState === "loading" ? (
        <LoadingSpinner variant="page" />
      ) : viewState === "error" ? (
        <WorkbenchError message={error?.message ?? ""} onRetry={() => void refetch()} />
      ) : viewState === "empty" ? (
        <WorkbenchEmpty>
          {t(
            softRejectedView
              ? "ecommerce.affiliateWorkspace.workbench.noSoftRejectedSamples"
              : "ecommerce.affiliateWorkspace.workbench.noSamples",
          )}
        </WorkbenchEmpty>
      ) : (
        <div className="affiliate-workbench-table-shell">
          <div className={`affiliate-workbench-table ${tableVariant}`}>
            <div className="affiliate-workbench-table-head">
              <div>{t("ecommerce.affiliateWorkspace.workbench.colAppliedAt")}</div>
              <div>{t("ecommerce.affiliateWorkspace.workbench.colCreator")}</div>
              <div>{t("ecommerce.affiliateWorkspace.workbench.colShop")}</div>
              <div>{t("ecommerce.affiliateWorkspace.workbench.colProduct")}</div>
              {softRejectedView ? (
                <>
                  <div>{t("ecommerce.affiliateWorkspace.workbench.colHandler")}</div>
                  <div>{t("ecommerce.affiliateWorkspace.workbench.colPlatformExpiry")}</div>
                </>
              ) : (
                <>
                  <div>{t("ecommerce.affiliateWorkspace.workbench.colExpiry")}</div>
                  <div>{t("ecommerce.affiliateWorkspace.workbench.colStatus")}</div>
                </>
              )}
              <div />
            </div>
            {items.map((row) => (
              <div
                key={row.id}
                className="affiliate-workbench-table-row"
                role="button"
                tabIndex={0}
                onClick={() => openRow(row)}
                onKeyDown={rowKeyHandler(() => openRow(row))}
              >
                <TimeCell value={row.sampleApplication.firstObservedAt} />
                <EntityIdentity
                  name={row.creatorName}
                  username={row.creatorUsername}
                  avatarUrl={row.creatorAvatarUrl}
                />
                <div className="affiliate-workbench-cell-shop">
                  {row.shopName || t("common.unknown")}
                </div>
                <div className="affiliate-workbench-cell-product">
                  <strong>
                    {row.productTitle || row.sampleApplication.productId || t("common.unknown")}
                  </strong>
                  {row.productTitle && row.sampleApplication.productId ? (
                    <span>{row.sampleApplication.productId}</span>
                  ) : null}
                </div>
                {softRejectedView ? (
                  <>
                    <SoftRejectHandlerCell sampleApplication={row.sampleApplication} />
                    <div className="affiliate-workbench-cell-expiry">
                      {row.sampleApplication.approveExpirationAt
                        ? t("ecommerce.affiliateWorkspace.workbench.expiresAt", {
                            value: formatLocalizedRelativeTime(
                              new Date(row.sampleApplication.approveExpirationAt).getTime(),
                              nowMs,
                              panelI18n.language,
                            ),
                          })
                        : "—"}
                    </div>
                    <div className="affiliate-workbench-cell-actions">
                      <button
                        className="btn btn-secondary"
                        type="button"
                        disabled={reopeningRowId === row.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void reopenRow(row);
                        }}
                      >
                        {reopeningRowId === row.id
                          ? t("common.loading")
                          : t("ecommerce.affiliateWorkspace.workbench.reopen")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <ExpiryCell
                      approveExpirationAt={row.sampleApplication.approveExpirationAt}
                      nowMs={nowMs}
                    />
                    <div className="affiliate-workbench-cell-badges">
                      <SampleStateBadge sampleApplication={row.sampleApplication} />
                      <StatusBadges
                        protectedCreator={row.protected}
                        humanOnly={row.humanOnly}
                        proposal={row.proposal}
                      />
                      {row.businessDeveloperName ? (
                        <span className="affiliate-workbench-badge">
                          {row.businessDeveloperName}
                        </span>
                      ) : null}
                    </div>
                    <div className="affiliate-workbench-cell-chevron" aria-hidden="true">
                      ›
                    </div>
                  </>
                )}
              </div>
            ))}
            {!hasMore && items.length > 0 ? (
              <div className="affiliate-workbench-table-footer">
                {t(
                  softRejectedView
                    ? "ecommerce.affiliateWorkspace.workbench.allSamplesLoadedSoftRejected"
                    : "ecommerce.affiliateWorkspace.workbench.allSamplesLoadedOpen",
                  { count: items.length },
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
      {hasMore ? (
        <button
          className="btn btn-secondary affiliate-workbench-load-more"
          type="button"
          disabled={loading}
          onClick={() => void loadMore()}
        >
          {loading ? t("common.loading") : t("ecommerce.affiliateWorkspace.loadMoreProposals")}
        </button>
      ) : null}
    </section>
  );
}

function AffiliateWorkbenchMessageList({
  shopOptions,
  businessDeveloperOptions,
  selectedBusinessDeveloperId,
  onSelectBusinessDeveloper,
  onOpen,
  refreshRevision,
}: Pick<
  Props,
  | "shopOptions"
  | "businessDeveloperOptions"
  | "selectedBusinessDeveloperId"
  | "onSelectBusinessDeveloper"
  | "refreshRevision"
  | "onOpen"
>) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<GQL.AffiliateMessageChannel | "">("");
  const [messageShopId, setMessageShopId] = useState("");
  const platformChannelActive = channel === GQL.AffiliateMessageChannel.PlatformChat;
  const queryShopId = platformChannelActive && messageShopId ? messageShopId : null;
  const filterKey = workbenchFilterKey([channel, queryShopId, selectedBusinessDeveloperId]);
  const [buffer, setBuffer] = useState<
    WorkbenchPageBuffer<GQL.AffiliateWorkbenchPendingConversationRow>
  >(() => emptyWorkbenchPageBuffer(filterKey));
  const activeBuffer =
    buffer.filterKey === filterKey
      ? buffer
      : emptyWorkbenchPageBuffer<GQL.AffiliateWorkbenchPendingConversationRow>(filterKey);
  const items = activeBuffer.items;
  const nextCursor = activeBuffer.nextCursor;
  const hasMore = activeBuffer.hasMore;
  const { data, loading, error, fetchMore, refetch } = useQuery<
    ConversationPageData,
    { input: GQL.AffiliateWorkbenchPendingConversationPageInput }
  >(AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY, {
    variables: {
      input: {
        channel: channel || null,
        shopId: queryShopId,
        businessDeveloperId: selectedBusinessDeveloperId || null,
        limit: PAGE_SIZE,
        cursor: null,
      },
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const page = data?.affiliateWorkbenchPendingConversationPage;

  useEffect(() => {
    if (!page) return;
    setBuffer(replaceWorkbenchPageBuffer(filterKey, page));
  }, [filterKey, page]);

  useEffect(() => {
    if (refreshRevision > 0) void refetch();
  }, [refetch, refreshRevision]);

  function selectChannel(next: GQL.AffiliateMessageChannel | ""): void {
    setChannel(next);
    if (next !== GQL.AffiliateMessageChannel.PlatformChat) setMessageShopId("");
  }

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor) return;
    const requestFilterKey = filterKey;
    const result = await fetchMore({
      variables: {
        input: {
          channel: channel || null,
          shopId: queryShopId,
          businessDeveloperId: selectedBusinessDeveloperId || null,
          limit: PAGE_SIZE,
          cursor: nextCursor,
        },
      },
      updateQuery: (current) => current,
    });
    const next = result.data?.affiliateWorkbenchPendingConversationPage;
    if (!next) return;
    setBuffer((current) => {
      if (current.filterKey !== requestFilterKey) return current;
      return {
        filterKey: requestFilterKey,
        loaded: true,
        items: appendUniqueRows(current.items, next.items),
        nextCursor: next.nextCursor ?? null,
        hasMore: next.hasMore,
      };
    });
  }, [
    channel,
    fetchMore,
    filterKey,
    hasMore,
    nextCursor,
    queryShopId,
    selectedBusinessDeveloperId,
  ]);

  const nowMs = Date.now();
  const viewState = workbenchListViewState({
    loading,
    hasError: Boolean(error),
    rowCount: items.length,
    completedRowCount: activeBuffer.loaded ? activeBuffer.items.length : null,
  });
  const channelChips: Array<{
    value: GQL.AffiliateMessageChannel | "";
    label: string;
    count?: number;
  }> = [
    {
      value: "",
      label: t("ecommerce.affiliateWorkspace.workbench.chipAll"),
      count: page?.totalCount,
    },
    {
      value: GQL.AffiliateMessageChannel.PlatformChat,
      label: "TikTok Shop",
      count: page?.platformCount,
    },
    {
      value: GQL.AffiliateMessageChannel.Whatsapp,
      label: "WhatsApp",
      count: page?.whatsappCount,
    },
    {
      value: GQL.AffiliateMessageChannel.Email,
      label: t("ecommerce.affiliateWorkspace.workbench.channelEmail"),
      count: page?.emailCount,
    },
  ];

  return (
    <section className="affiliate-workbench-entity-section">
      <div className="affiliate-workbench-entity-toolbar">
        <div className="affiliate-workbench-entity-filters">
          <div className="affiliate-workbench-channel-chips" role="group">
            {channelChips.map((chip) => (
              <button
                key={chip.value || "ALL"}
                type="button"
                className={`affiliate-workbench-channel-chip${channel === chip.value ? " affiliate-workbench-channel-chip-active" : ""}`}
                aria-pressed={channel === chip.value}
                onClick={() => selectChannel(chip.value)}
              >
                {chip.label}
                {chip.count != null ? <span>{chip.count}</span> : null}
              </button>
            ))}
          </div>
          {platformChannelActive ? (
            <>
              <span className="affiliate-workbench-toolbar-divider" aria-hidden="true" />
              <Select
                value={messageShopId}
                onChange={setMessageShopId}
                options={shopOptions}
                className="affiliate-workspace-shop-select"
              />
            </>
          ) : null}
          <Select
            value={selectedBusinessDeveloperId}
            onChange={onSelectBusinessDeveloper}
            options={businessDeveloperOptions}
            className="affiliate-status-select"
            ariaLabel={t("ecommerce.affiliateWorkspace.businessDeveloperFilter")}
            searchable
            searchPlaceholder={t("ecommerce.affiliateWorkspace.businessDeveloperSearchPlaceholder")}
          />
          {page && page.waitingOver24hCount > 0 ? (
            <span className="affiliate-workbench-entity-summary">
              <span className="affiliate-workbench-summary-warning">
                {t("ecommerce.affiliateWorkspace.workbench.summaryWaitingOver24h", {
                  count: page.waitingOver24hCount,
                })}
              </span>
            </span>
          ) : null}
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => void refetch()}>
          {t("common.refresh")}
        </button>
      </div>
      {viewState === "loading" ? (
        <LoadingSpinner variant="page" />
      ) : viewState === "error" ? (
        <WorkbenchError message={error?.message ?? ""} onRetry={() => void refetch()} />
      ) : viewState === "empty" ? (
        <WorkbenchEmpty>{t("ecommerce.affiliateWorkspace.workbench.noMessages")}</WorkbenchEmpty>
      ) : (
        <div className="affiliate-workbench-table-shell">
          <div className="affiliate-workbench-table affiliate-workbench-table-messages">
            <div className="affiliate-workbench-table-head">
              <div>{t("ecommerce.affiliateWorkspace.workbench.colWaiting")}</div>
              <div>{t("ecommerce.affiliateWorkspace.workbench.colCreator")}</div>
              <div>{t("ecommerce.affiliateWorkspace.workbench.colChannelSource")}</div>
              <div>{t("ecommerce.affiliateWorkspace.workbench.colBd")}</div>
              <div>{t("ecommerce.affiliateWorkspace.workbench.colStatus")}</div>
              <div />
            </div>
            {items.map((row) => (
              <div
                key={row.id}
                className="affiliate-workbench-table-row"
                role="button"
                tabIndex={0}
                onClick={() =>
                  onOpen({
                    creatorRelationshipId: row.creatorRelationshipId,
                    selectedShopId: row.sourceShopId ?? undefined,
                    initialTab: "conversation",
                    replyToLifecycleEventId: row.replyToLifecycleEventId,
                  })
                }
                onKeyDown={rowKeyHandler(() =>
                  onOpen({
                    creatorRelationshipId: row.creatorRelationshipId,
                    selectedShopId: row.sourceShopId ?? undefined,
                    initialTab: "conversation",
                    replyToLifecycleEventId: row.replyToLifecycleEventId,
                  }),
                )}
              >
                <WaitingCell lastPendingAt={row.lastPendingAt} nowMs={nowMs} />
                <EntityIdentity
                  name={row.creatorName}
                  username={row.creatorUsername}
                  avatarUrl={row.creatorAvatarUrl}
                />
                <ChannelSourceCell channel={row.channel} sourceLabel={row.sourceLabel} />
                <div className="affiliate-workbench-cell-badges">
                  {row.businessDeveloperName ? (
                    <span className="affiliate-workbench-badge">{row.businessDeveloperName}</span>
                  ) : null}
                </div>
                <div className="affiliate-workbench-cell-badges">
                  <StatusBadges
                    protectedCreator={row.protected}
                    humanOnly={row.humanOnly}
                    proposal={row.proposal}
                  />
                </div>
                <div className="affiliate-workbench-cell-chevron" aria-hidden="true">
                  ›
                </div>
              </div>
            ))}
            {!hasMore && items.length > 0 ? (
              <div className="affiliate-workbench-table-footer">
                {channel
                  ? t("ecommerce.affiliateWorkspace.workbench.allMessagesLoadedChannel", {
                      count: items.length,
                      channel: channelDisplayName(channel, t),
                    })
                  : t("ecommerce.affiliateWorkspace.workbench.allMessagesLoaded", {
                      count: items.length,
                    })}
              </div>
            ) : null}
          </div>
        </div>
      )}
      {hasMore ? (
        <button
          className="btn btn-secondary affiliate-workbench-load-more"
          type="button"
          disabled={loading}
          onClick={() => void loadMore()}
        >
          {loading ? t("common.loading") : t("ecommerce.affiliateWorkspace.loadMoreProposals")}
        </button>
      ) : null}
    </section>
  );
}

function TimeCell({ value }: { value: string }) {
  return (
    <div className="affiliate-workbench-cell-time">
      <strong>{formatLocalizedTime(value, panelI18n.language)}</strong>
      <span>{formatLocalizedMonthDay(value, panelI18n.language)}</span>
    </div>
  );
}

function ExpiryCell({
  approveExpirationAt,
  nowMs,
}: {
  approveExpirationAt?: string | null;
  nowMs: number;
}) {
  if (!approveExpirationAt) {
    return (
      <div className="affiliate-workbench-cell-expiry affiliate-workbench-cell-expiry-muted">—</div>
    );
  }
  const expiryMs = new Date(approveExpirationAt).getTime();
  const remaining = expiryMs - nowMs;
  const tone =
    remaining < 12 * HOUR_MS
      ? " affiliate-workbench-cell-expiry-danger"
      : remaining < DAY_MS
        ? " affiliate-workbench-cell-expiry-warning"
        : "";
  return (
    <div className={`affiliate-workbench-cell-expiry${tone}`}>
      {formatLocalizedRelativeTime(expiryMs, nowMs, panelI18n.language)}
    </div>
  );
}

function WaitingCell({ lastPendingAt, nowMs }: { lastPendingAt: string; nowMs: number }) {
  const pendingMs = new Date(lastPendingAt).getTime();
  const overdue = nowMs - pendingMs > DAY_MS;
  return (
    <div
      className={`affiliate-workbench-cell-waiting${overdue ? " affiliate-workbench-cell-waiting-warning" : ""}`}
    >
      <strong>{formatWaitingDuration(nowMs - pendingMs)}</strong>
      <small>{formatShortDateTime(lastPendingAt, panelI18n.language)}</small>
    </div>
  );
}

function formatWaitingDuration(elapsedMs: number): string {
  const clamped = Math.max(elapsedMs, 0);
  const [unit, divisor]: [Intl.NumberFormatOptions["unit"], number] =
    clamped >= DAY_MS ? ["day", DAY_MS] : clamped >= HOUR_MS ? ["hour", HOUR_MS] : ["minute", 60_000];
  const value = Math.max(Math.round(clamped / divisor), 1);
  try {
    return new Intl.NumberFormat(panelI18n.language, {
      style: "unit",
      unit,
      unitDisplay: "long",
    }).format(value);
  } catch {
    return String(value);
  }
}

function SoftRejectHandlerCell({
  sampleApplication,
}: {
  sampleApplication: GQL.SampleApplicationRecord;
}) {
  const { t } = useTranslation();
  const agentActor =
    sampleApplication.merchantReviewActorType === GQL.AffiliateLifecycleActorType.Agent;
  const reasonLabel = sampleApplication.merchantReviewRejectReason
    ? t(
        `ecommerce.affiliateWorkspace.rejectReasons.${sampleApplication.merchantReviewRejectReason}`,
        { defaultValue: sampleApplication.merchantReviewRejectReason },
      )
    : null;
  return (
    <div className="affiliate-workbench-cell-handler">
      <span
        className={`affiliate-workbench-badge${agentActor ? " affiliate-workbench-badge-proposal" : ""}`}
      >
        {t(
          agentActor
            ? "ecommerce.affiliateWorkspace.workbench.softRejectedByAgent"
            : "ecommerce.affiliateWorkspace.workbench.softRejectedByStaff",
        )}
      </span>
      <small>
        {sampleApplication.merchantReviewDecidedAt
          ? formatShortDateTime(sampleApplication.merchantReviewDecidedAt, panelI18n.language)
          : "—"}
        {reasonLabel ? ` · ${reasonLabel}` : ""}
      </small>
    </div>
  );
}

function ChannelSourceCell({
  channel,
  sourceLabel,
}: {
  channel: GQL.AffiliateMessageChannel;
  sourceLabel: string;
}) {
  const { t } = useTranslation();
  const tileVariant =
    channel === GQL.AffiliateMessageChannel.Whatsapp
      ? " affiliate-workbench-channel-tile-whatsapp"
      : channel === GQL.AffiliateMessageChannel.Email
        ? " affiliate-workbench-channel-tile-email"
        : "";
  return (
    <div className="affiliate-workbench-cell-channel">
      <span className={`affiliate-workbench-channel-tile${tileVariant}`} aria-hidden="true">
        <ChannelIcon channel={channel} />
      </span>
      <span className="affiliate-workbench-cell-channel-copy">
        <strong>{channelDisplayName(channel, t)}</strong>
        <span>{sourceLabel}</span>
      </span>
    </div>
  );
}

function ChannelIcon({ channel }: { channel: GQL.AffiliateMessageChannel }) {
  if (channel === GQL.AffiliateMessageChannel.Whatsapp) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 2.5C4.96 2.5 2.5 4.96 2.5 8C2.5 9.02 2.78 9.98 3.27 10.8L2.6 13.4L5.28 12.76C6.08 13.23 7 13.5 8 13.5C11.04 13.5 13.5 11.04 13.5 8C13.5 4.96 11.04 2.5 8 2.5Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (channel === GQL.AffiliateMessageChannel.Email) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2.5 4.5H13.5V11.5C13.5 11.78 13.28 12 13 12H3C2.72 12 2.5 11.78 2.5 11.5V4.5ZM2.5 4.5L8 8.5L13.5 4.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2.5 6.5L3.2 3.5H12.8L13.5 6.5M2.5 6.5V13C2.5 13.28 2.72 13.5 3 13.5H13C13.28 13.5 13.5 13.28 13.5 13V6.5M2.5 6.5H13.5M6.5 9.5H9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EntityIdentity(props: {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}) {
  const { t } = useTranslation();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const name = props.name || props.username || t("ecommerce.affiliateWorkspace.unknownCreator");
  return (
    <div className="affiliate-workbench-entity-identity">
      {props.avatarUrl && !avatarFailed ? (
        <img
          src={props.avatarUrl}
          alt=""
          className="affiliate-workbench-entity-avatar"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <span className="affiliate-workbench-entity-avatar affiliate-workbench-entity-avatar-fallback">
          {(Array.from(name)[0] ?? "?").toUpperCase()}
        </span>
      )}
      <span>
        <strong>{name}</strong>
        {props.username ? <small>@{props.username.replace(/^@/u, "")}</small> : null}
      </span>
    </div>
  );
}

function SampleStateBadge({
  sampleApplication,
}: {
  sampleApplication: GQL.SampleApplicationRecord;
}) {
  const { t } = useTranslation();
  if (sampleApplication.sampleWorkStatus === GQL.SampleWorkStatus.PlatformStatusUnknown) {
    return (
      <span className="affiliate-workbench-badge affiliate-workbench-badge-sync">
        {t("ecommerce.affiliateWorkspace.workbench.sampleSyncIssue")}
      </span>
    );
  }
  return (
    <span className="affiliate-workbench-badge">
      {t("ecommerce.affiliateWorkspace.workbench.sampleOpen")}
    </span>
  );
}

function StatusBadges(props: {
  protectedCreator: boolean;
  humanOnly: boolean;
  proposal?: GQL.ActionProposal | null;
}) {
  const { t } = useTranslation();
  return (
    <>
      {props.proposal ? (
        <span className="affiliate-workbench-badge affiliate-workbench-badge-proposal">
          {t("ecommerce.affiliateWorkspace.workbench.agentProposal")}
        </span>
      ) : null}
      {props.protectedCreator ? (
        <span className="affiliate-workbench-badge affiliate-workbench-badge-protected">
          {t("ecommerce.affiliateWorkspace.workbench.protected")}
        </span>
      ) : null}
      {props.humanOnly ? (
        <span className="affiliate-workbench-badge affiliate-workbench-badge-human">
          {t("ecommerce.affiliateWorkspace.workbench.humanOnly")}
        </span>
      ) : null}
    </>
  );
}

type WorkbenchListViewState = "loading" | "error" | "empty" | "ready";

/**
 * Branch order is load-bearing:
 * - rows already on screen stay visible while a refetch is in flight;
 * - an in-flight (or never-completed) request with no rows always shows the
 *   spinner, so a pending request never reads as "no data";
 * - the empty state renders only once a request actually completed with zero rows.
 */
function workbenchListViewState(input: {
  loading: boolean;
  hasError: boolean;
  rowCount: number;
  /** Row count of the latest completed request, or `null` when none completed yet. */
  completedRowCount: number | null;
}): WorkbenchListViewState {
  if (input.rowCount > 0) return "ready";
  if (input.loading) return "loading";
  if (input.hasError) return "error";
  if (input.completedRowCount === 0) return "empty";
  return "loading";
}

function WorkbenchEmpty({ children }: { children: string }) {
  return <div className="affiliate-proposal-empty">{children}</div>;
}

function WorkbenchError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="affiliate-proposal-empty affiliate-workbench-entity-error">
      <span>{message}</span>
      <button className="btn btn-secondary" type="button" onClick={onRetry}>
        {t("common.refresh")}
      </button>
    </div>
  );
}

function channelDisplayName(
  channel: GQL.AffiliateMessageChannel,
  t: (key: string) => string,
): string {
  if (channel === GQL.AffiliateMessageChannel.Whatsapp) return "WhatsApp";
  if (channel === GQL.AffiliateMessageChannel.Email) {
    return t("ecommerce.affiliateWorkspace.workbench.channelEmail");
  }
  return "TikTok Shop";
}

function rowKeyHandler(open: () => void) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };
}

function appendUniqueRows<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()];
}
