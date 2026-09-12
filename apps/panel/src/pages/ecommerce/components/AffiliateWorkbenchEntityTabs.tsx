import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import {
  AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY,
  AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
  REOPEN_SOFT_REJECTED_AFFILIATE_SAMPLE_APPLICATION_MUTATION,
} from "../../../api/shops-queries.js";
import { LoadingSpinner } from "../../../components/LoadingSpinner.js";
import {
  TkButton,
  TkChoiceSelect,
  TkInteractiveTableRow,
  TkPrivate,
  TkTableFrame,
} from "../../../components/design-system/index.js";
import { useToast } from "../../../components/Toast.js";
import {
  formatLocalizedMonthDay,
  formatLocalizedRelativeTime,
  formatLocalizedTime,
  formatShortDateTime,
} from "../../../lib/format-datetime.js";
import panelI18n from "../../../i18n/index.js";
import {
  ProductFilter,
  type ProductFilterValue,
} from "../../../components/ecommerce/ProductFilter.js";
import { WorkbenchCreatorSearch } from "./WorkbenchCreatorSearch.js";
import { creatorSampleTierLabel } from "../affiliate-creator-tiers.js";
import { creatorSystemTagLabel } from "../affiliate-creator-system-tags.js";
import "./AffiliateWorkbenchEntityTabs.css";

import {
  AffiliateProtectionFilter,
  workbenchProtectionValue,
} from "./AffiliateProtectionFilter.js";

const PAGE_SIZE = 25;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/*
 * The same chip budget the Creators page spends, so one Creator reads the same
 * on both surfaces. Anything past the budget collapses into a `+N` chip whose
 * title carries the full set.
 */
const WORKBENCH_SYSTEM_TAG_CHIP_LIMIT = 2;
const WORKBENCH_MANUAL_TAG_CHIP_LIMIT = 3;

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
  /**
   * Forwarded to `Select` so a shop-name option masks under privacy mode. It is
   * declared here rather than left to survive as an undeclared extra property:
   * these options are passed straight through, and a future `.map` that rebuilt
   * them field by field would silently drop the marking.
   */
  sensitive?: boolean;
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
  const [protection, setProtection] = useState("ALL");
  const [creatorSearch, setCreatorSearch] = useState("");
  /**
   * Application-time order. A backend cursor is bound to the order that minted
   * it, so this belongs in `filterKey` — changing it must start a fresh page 1,
   * never replay the in-flight cursor.
   */
  const [sortOrder, setSortOrder] = useState<GQL.EcomSortOrder>(GQL.EcomSortOrder.Asc);
  const [productSelection, setProductSelection] = useState<{
    scope: string;
    values: ProductFilterValue[];
  }>({ scope: selectedShopId, values: [] });
  const products = productSelection.scope === selectedShopId ? productSelection.values : [];
  const filterKey = workbenchFilterKey([
    creatorSearch,
    JSON.stringify(products),
    protection,
    disposition,
    sortOrder,
    selectedShopId,
    selectedBusinessDeveloperId,
  ]);
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
        protected: workbenchProtectionValue(protection),
        reviewDisposition: disposition,
        sortOrder,
        ...(creatorSearch ? { creatorSearch } : {}),
        ...(products.length ? { products } : {}),
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
          protected: workbenchProtectionValue(protection),
          reviewDisposition: disposition,
          sortOrder,
          ...(creatorSearch ? { creatorSearch } : {}),
          ...(products.length ? { products } : {}),
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
    creatorSearch,
    products,
    disposition,
    fetchMore,
    filterKey,
    protection,
    hasMore,
    nextCursor,
    selectedBusinessDeveloperId,
    selectedShopId,
    sortOrder,
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
    <section
      className="affiliate-workbench-entity-section"
      data-tutorial-id="affiliate-workbench-samples"
    >
      <div className="affiliate-workbench-entity-toolbar" data-tutorial-id="affiliate-workbench-sample-controls">
        <div className="affiliate-workbench-entity-filters">
          <TkChoiceSelect
            label={t("ecommerce.affiliateWorkspace.workbench.colShop")}
            value={selectedShopId}
            onChange={(next) => {
              setProductSelection({ scope: next, values: [] });
              onSelectShop(next);
            }}
            options={shopOptions}
            className="affiliate-workbench-filter-select"
          />
          <TkChoiceSelect
            label={t("ecommerce.affiliateWorkspace.workbench.colStatus")}
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
            className="affiliate-workbench-filter-select"
          />
          <AffiliateProtectionFilter value={protection} onChange={setProtection} />
          <TkChoiceSelect
            value={selectedBusinessDeveloperId}
            onChange={onSelectBusinessDeveloper}
            options={businessDeveloperOptions}
            className="affiliate-workbench-filter-select"
            label={t("ecommerce.affiliateWorkspace.businessDeveloperFilter")}
            searchable
            searchPlaceholder={t("ecommerce.affiliateWorkspace.businessDeveloperSearchPlaceholder")}
          />
          <div className="affiliate-workbench-filter-group">
            <span className="tk-v1-label">
              {t("ecommerce.affiliateWorkspace.workbench.colProduct")}
            </span>
            <ProductFilter
              key={selectedShopId}
              shopId={selectedShopId || undefined}
              value={products}
              onChange={(values) => setProductSelection({ scope: selectedShopId, values })}
            />
          </div>
          <div className="affiliate-workbench-filter-search-actions">
            <WorkbenchCreatorSearch value={creatorSearch} onChange={setCreatorSearch} />
            <TkButton className="affiliate-workbench-filter-refresh" onClick={() => void refetch()}>
              {t("common.refresh")}
            </TkButton>
          </div>
          {/* Ordering is not a filter, so it sits apart from them at the row's end. */}
          <div className="affiliate-workbench-filter-order">
            <TkChoiceSelect
              label={t("ecommerce.affiliateWorkspace.workbench.sampleSortLabel")}
              value={sortOrder}
              onChange={(value) => setSortOrder(value as GQL.EcomSortOrder)}
              options={[
                {
                  value: GQL.EcomSortOrder.Asc,
                  label: t("ecommerce.affiliateWorkspace.workbench.sampleSortOldestFirst"),
                },
                {
                  value: GQL.EcomSortOrder.Desc,
                  label: t("ecommerce.affiliateWorkspace.workbench.sampleSortNewestFirst"),
                },
              ]}
              className="affiliate-workbench-filter-select"
            />
          </div>
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
        <TkTableFrame variant="embedded" className="affiliate-workbench-entity-table-frame">
          <table className={`affiliate-workbench-entity-table ${tableVariant}`}>
            <colgroup>
              <col className="affiliate-workbench-col-time" />
              <col className="affiliate-workbench-col-creator" />
              <col className="affiliate-workbench-col-tags" />
              <col className="affiliate-workbench-col-shop" />
              <col className="affiliate-workbench-col-product" />
              <col className="affiliate-workbench-col-support" />
              <col className="affiliate-workbench-col-status" />
              <col className="affiliate-workbench-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colAppliedAt")}</th>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colCreator")}</th>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colTags")}</th>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colShop")}</th>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colProduct")}</th>
                {softRejectedView ? (
                  <>
                    <th>{t("ecommerce.affiliateWorkspace.workbench.colHandler")}</th>
                    <th>{t("ecommerce.affiliateWorkspace.workbench.colPlatformExpiry")}</th>
                  </>
                ) : (
                  <>
                    <th>{t("ecommerce.affiliateWorkspace.workbench.colExpiry")}</th>
                    <th>{t("ecommerce.affiliateWorkspace.workbench.colStatus")}</th>
                  </>
                )}
                <th>
                  <span className="sr-only">
                    {t("common.actions", { defaultValue: "Actions" })}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <TkInteractiveTableRow
                  key={row.id}
                  className="affiliate-workbench-entity-table-row"
                  onActivate={() => openRow(row)}
                >
                  <td>
                    <TimeCell value={row.sampleApplication.firstObservedAt} />
                  </td>
                  <td>
                    <EntityIdentity
                      name={row.creatorName}
                      username={row.creatorUsername}
                      avatarUrl={row.creatorAvatarUrl}
                    />
                  </td>
                  <td>
                    <CreatorTagsCell
                      sampleTier={row.sampleTier}
                      systemTags={row.systemTags}
                      manualTags={row.manualTags}
                    />
                  </td>
                  <td>
                    <TkPrivate
                      as="div"
                      className="affiliate-workbench-cell-shop"
                      sensitive={Boolean(row.shopName)}
                    >
                      {row.shopName || t("common.unknown")}
                    </TkPrivate>
                  </td>
                  <td>
                    <div className="affiliate-workbench-cell-product">
                      <TkPrivate as="strong" sensitive={Boolean(row.productTitle)}>
                        {row.productTitle || row.sampleApplication.productId || t("common.unknown")}
                      </TkPrivate>
                      {row.productTitle && row.sampleApplication.productId ? (
                        <span>{row.sampleApplication.productId}</span>
                      ) : null}
                    </div>
                  </td>
                  {softRejectedView ? (
                    <>
                      <td>
                        <SoftRejectHandlerCell sampleApplication={row.sampleApplication} />
                      </td>
                      <td>
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
                      </td>
                      <td>
                        <div className="affiliate-workbench-cell-actions">
                          <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={reopeningRowId === row.id}
                            onClick={() => void reopenRow(row)}
                          >
                            {reopeningRowId === row.id
                              ? t("common.loading")
                              : t("ecommerce.affiliateWorkspace.workbench.reopen")}
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <ExpiryCell
                          approveExpirationAt={row.sampleApplication.approveExpirationAt}
                          nowMs={nowMs}
                        />
                      </td>
                      <td>
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
                      </td>
                      <td>
                        <div className="affiliate-workbench-cell-chevron" aria-hidden="true">
                          ›
                        </div>
                      </td>
                    </>
                  )}
                </TkInteractiveTableRow>
              ))}
            </tbody>
            {!hasMore && items.length > 0 ? (
              <tfoot>
                <tr>
                  <td className="affiliate-workbench-table-footer" colSpan={8}>
                    {t(
                      softRejectedView
                        ? "ecommerce.affiliateWorkspace.workbench.allSamplesLoadedSoftRejected"
                        : "ecommerce.affiliateWorkspace.workbench.allSamplesLoadedOpen",
                      { count: items.length },
                    )}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </TkTableFrame>
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
  const [protection, setProtection] = useState("ALL");
  const [creatorSearch, setCreatorSearch] = useState("");
  /**
   * Waiting-time order. A backend cursor is bound to the order that minted it,
   * so this belongs in `filterKey` — changing it must start a fresh page 1,
   * never replay the in-flight cursor.
   */
  const [sortOrder, setSortOrder] = useState<GQL.EcomSortOrder>(GQL.EcomSortOrder.Asc);
  const filterKey = workbenchFilterKey([
    creatorSearch,
    protection,
    channel,
    sortOrder,
    queryShopId,
    selectedBusinessDeveloperId,
  ]);
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
        ...(creatorSearch ? { creatorSearch } : {}),
        shopId: queryShopId,
        businessDeveloperId: selectedBusinessDeveloperId || null,
        protected: workbenchProtectionValue(protection),
        sortOrder,
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
          ...(creatorSearch ? { creatorSearch } : {}),
          shopId: queryShopId,
          businessDeveloperId: selectedBusinessDeveloperId || null,
          protected: workbenchProtectionValue(protection),
          sortOrder,
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
    creatorSearch,
    fetchMore,
    filterKey,
    protection,
    hasMore,
    nextCursor,
    queryShopId,
    selectedBusinessDeveloperId,
    sortOrder,
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
    <section
      className="affiliate-workbench-entity-section"
      data-tutorial-id="affiliate-workbench-messages"
    >
      <div className="affiliate-workbench-entity-toolbar" data-tutorial-id="affiliate-workbench-message-controls">
        <div className="affiliate-workbench-entity-filters">
          <div className="affiliate-workbench-filter-group">
            <span className="tk-v1-label">
              {t("ecommerce.affiliateWorkspace.workbench.colChannelSource")}
            </span>
            <div
              className="affiliate-workbench-channel-chips affiliate-workbench-filter-channels"
              role="group"
              aria-label={t("ecommerce.affiliateWorkspace.workbench.colChannelSource")}
            >
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
          </div>
          {platformChannelActive ? (
            <TkChoiceSelect
              label={t("ecommerce.affiliateWorkspace.workbench.colShop")}
              value={messageShopId}
              onChange={setMessageShopId}
              options={shopOptions}
              className="affiliate-workbench-filter-select"
            />
          ) : null}
          <AffiliateProtectionFilter value={protection} onChange={setProtection} />
          <TkChoiceSelect
            value={selectedBusinessDeveloperId}
            onChange={onSelectBusinessDeveloper}
            options={businessDeveloperOptions}
            className="affiliate-workbench-filter-select"
            label={t("ecommerce.affiliateWorkspace.businessDeveloperFilter")}
            searchable
            searchPlaceholder={t("ecommerce.affiliateWorkspace.businessDeveloperSearchPlaceholder")}
          />
          <div className="affiliate-workbench-filter-search-actions">
            <WorkbenchCreatorSearch value={creatorSearch} onChange={setCreatorSearch} />
            <TkButton className="affiliate-workbench-filter-refresh" onClick={() => void refetch()}>
              {t("common.refresh")}
            </TkButton>
          </div>
          {/* Ordering is not a filter, so it sits apart from them at the row's end. */}
          <div className="affiliate-workbench-filter-order">
            <TkChoiceSelect
              label={t("ecommerce.affiliateWorkspace.workbench.messageSortLabel")}
              value={sortOrder}
              onChange={(value) => setSortOrder(value as GQL.EcomSortOrder)}
              options={[
                {
                  value: GQL.EcomSortOrder.Asc,
                  label: t("ecommerce.affiliateWorkspace.workbench.messageSortLongestWaitingFirst"),
                },
                {
                  value: GQL.EcomSortOrder.Desc,
                  label: t("ecommerce.affiliateWorkspace.workbench.messageSortNewestFirst"),
                },
              ]}
              className="affiliate-workbench-filter-select"
            />
          </div>
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
      </div>
      {viewState === "loading" ? (
        <LoadingSpinner variant="page" />
      ) : viewState === "error" ? (
        <WorkbenchError message={error?.message ?? ""} onRetry={() => void refetch()} />
      ) : viewState === "empty" ? (
        <WorkbenchEmpty>{t("ecommerce.affiliateWorkspace.workbench.noMessages")}</WorkbenchEmpty>
      ) : (
        <TkTableFrame variant="embedded" className="affiliate-workbench-entity-table-frame">
          <table className="affiliate-workbench-entity-table affiliate-workbench-table-messages">
            <colgroup>
              <col className="affiliate-workbench-col-time" />
              <col className="affiliate-workbench-col-creator" />
              <col className="affiliate-workbench-col-tags" />
              <col className="affiliate-workbench-col-product" />
              <col className="affiliate-workbench-col-support" />
              <col className="affiliate-workbench-col-status" />
              <col className="affiliate-workbench-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colWaiting")}</th>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colCreator")}</th>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colTags")}</th>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colChannelSource")}</th>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colBd")}</th>
                <th>{t("ecommerce.affiliateWorkspace.workbench.colStatus")}</th>
                <th>
                  <span className="sr-only">
                    {t("common.actions", { defaultValue: "Actions" })}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const openMessage = () =>
                  onOpen({
                    creatorRelationshipId: row.creatorRelationshipId,
                    selectedShopId: row.sourceShopId ?? undefined,
                    initialTab: "conversation",
                    replyToLifecycleEventId: row.replyToLifecycleEventId,
                  });
                return (
                  <TkInteractiveTableRow
                    key={row.id}
                    className="affiliate-workbench-entity-table-row"
                    onActivate={openMessage}
                  >
                    <td>
                      <WaitingCell lastPendingAt={row.lastPendingAt} nowMs={nowMs} />
                    </td>
                    <td>
                      <EntityIdentity
                        name={row.creatorName}
                        username={row.creatorUsername}
                        avatarUrl={row.creatorAvatarUrl}
                      />
                    </td>
                    <td>
                      <CreatorTagsCell
                        sampleTier={row.sampleTier}
                        systemTags={row.systemTags}
                        manualTags={row.manualTags}
                      />
                    </td>
                    <td>
                      <ChannelSourceCell channel={row.channel} sourceLabel={row.sourceLabel} />
                    </td>
                    <td>
                      <div className="affiliate-workbench-cell-badges">
                        {row.businessDeveloperName ? (
                          <span className="affiliate-workbench-badge">
                            {row.businessDeveloperName}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="affiliate-workbench-cell-badges">
                        <StatusBadges
                          protectedCreator={row.protected}
                          humanOnly={row.humanOnly}
                          proposal={row.proposal}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="affiliate-workbench-cell-chevron" aria-hidden="true">
                        ›
                      </div>
                    </td>
                  </TkInteractiveTableRow>
                );
              })}
            </tbody>
            {!hasMore && items.length > 0 ? (
              <tfoot>
                <tr>
                  <td className="affiliate-workbench-table-footer" colSpan={7}>
                    {channel
                      ? t("ecommerce.affiliateWorkspace.workbench.allMessagesLoadedChannel", {
                          count: items.length,
                          channel: channelDisplayName(channel, t),
                        })
                      : t("ecommerce.affiliateWorkspace.workbench.allMessagesLoaded", {
                          count: items.length,
                        })}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </TkTableFrame>
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
    clamped >= DAY_MS
      ? ["day", DAY_MS]
      : clamped >= HOUR_MS
        ? ["hour", HOUR_MS]
        : ["minute", 60_000];
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

/**
 * The Creator's three kinds of tag in one cell: the sample rung first, then
 * system tags, then manual tags. Each kind keeps its own chip styling and
 * names itself through `title`, so the column needs one header rather than
 * three stacked sub-labels.
 *
 * `sampleTier` is the highest rung across every shop of this Creator, not this
 * row's shop. Absent means no rung was reached anywhere, which is not the
 * lowest rung, so it renders as nothing rather than as SAMPLE_SHIPPED.
 */
function CreatorTagsCell({
  sampleTier,
  systemTags,
  manualTags,
}: {
  sampleTier?: GQL.CreatorSampleTier | null;
  systemTags: ReadonlyArray<GQL.AffiliateCreatorSystemTag>;
  manualTags: ReadonlyArray<GQL.CreatorManualTag>;
}) {
  const { t } = useTranslation();
  if (!sampleTier && systemTags.length === 0 && manualTags.length === 0) {
    return <div className="affiliate-workbench-cell-tags">—</div>;
  }
  const visibleSystemTags = systemTags.slice(0, WORKBENCH_SYSTEM_TAG_CHIP_LIMIT);
  const hiddenSystemTagCount = systemTags.length - visibleSystemTags.length;
  const visibleManualTags = manualTags.slice(0, WORKBENCH_MANUAL_TAG_CHIP_LIMIT);
  const hiddenManualTagCount = manualTags.length - visibleManualTags.length;
  return (
    <div className="affiliate-workbench-cell-tags">
      {sampleTier ? (
        <span
          className="affiliate-workbench-tag affiliate-workbench-tag-tier"
          title={t("ecommerce.affiliateWorkspace.sampleTierColumnLabel")}
        >
          {creatorSampleTierLabel(t, sampleTier)}
        </span>
      ) : null}
      {visibleSystemTags.map((tag) => (
        <span
          className="affiliate-workbench-tag affiliate-workbench-tag-system"
          key={tag}
          title={t("ecommerce.affiliateWorkspace.systemTagFilterLabel")}
        >
          {creatorSystemTagLabel(t, tag)}
        </span>
      ))}
      {hiddenSystemTagCount > 0 ? (
        <span
          className="affiliate-workbench-tag affiliate-workbench-tag-system affiliate-workbench-tag-overflow"
          title={systemTags.map((tag) => creatorSystemTagLabel(t, tag)).join(", ")}
        >
          +{hiddenSystemTagCount}
        </span>
      ) : null}
      {visibleManualTags.map((tag) => (
        <span
          className="affiliate-workbench-tag affiliate-workbench-tag-manual"
          key={tag.id}
          title={t("ecommerce.affiliateWorkspace.manualTagFilterLabel")}
        >
          {tag.name}
        </span>
      ))}
      {hiddenManualTagCount > 0 ? (
        <span
          className="affiliate-workbench-tag affiliate-workbench-tag-manual affiliate-workbench-tag-overflow"
          title={manualTags.map((tag) => tag.name).join(", ")}
        >
          +{hiddenManualTagCount}
        </span>
      ) : null}
    </div>
  );
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

function appendUniqueRows<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()];
}
