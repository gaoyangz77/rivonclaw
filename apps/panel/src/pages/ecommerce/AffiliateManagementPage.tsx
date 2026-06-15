import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../components/inputs/Select.js";
import { useToast } from "../../components/Toast.js";
import { CheckIcon, CopyIcon, InfoIcon, RefreshIcon, ShopIcon, UserIcon } from "../../components/icons.js";
import { panelEventBus } from "../../lib/event-bus.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import {
  AFFILIATE_ACTION_PROPOSALS_QUERY,
  AFFILIATE_COLLABORATION_ACTIVITY_QUERY,
  AFFILIATE_COLLABORATION_RECORD_ITEMS_QUERY,
  AFFILIATE_ML_INSIGHTS_QUERY,
  DECIDE_ACTION_PROPOSAL_MUTATION,
  RESOLVE_AFFILIATE_COLLABORATION_STAFF_ACTION_MUTATION,
} from "../../api/shops-queries.js";
import { ProductSummaryCard } from "./components/ProductSummaryCard.js";

type DashboardItem = GQL.AffiliateDashboardItem;
type CollaborationDetailItem = {
  collaborationRecord: GQL.AffiliateCollaborationRecord;
  creatorProfile?: GQL.CreatorGlobalProfile | null;
  productSummary?: GQL.EcomProductSummary | null;
  latestProposal?: GQL.ActionProposal | null;
  latestLifecycleEvent?: GQL.LifecycleEvent | null;
};

const HISTORY_FILTERS = [
  "NEEDS_ATTENTION",
  "IN_PROGRESS",
  "ALL",
  GQL.AffiliateCollaborationRecordProcessingStatus.AgentNeeded,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingApproval,
  GQL.AffiliateCollaborationRecordProcessingStatus.StaffNeeded,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingCreator,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingPlatform,
  GQL.AffiliateCollaborationRecordProcessingStatus.Done,
  GQL.AffiliateCollaborationRecordProcessingStatus.Blocked,
] as const;

type HistoryFilter = (typeof HISTORY_FILTERS)[number];
type CollaborationListItem = GQL.AffiliateCollaborationRecordListItem;
const COLLABORATION_HISTORY_PAGE_SIZE = 24;
type CollaborationWorkViewModel = {
  badge: string;
  badgeTone: "attention" | "waiting" | "done" | "blocked";
  stage: string;
  title: string;
  description: string;
  ownerLabel: string;
};

const PROPOSAL_FILTERS = [
  GQL.ActionProposalStatus.Pending,
  "ALL",
  GQL.ActionProposalStatus.Approved,
  GQL.ActionProposalStatus.Executed,
  GQL.ActionProposalStatus.Rejected,
  GQL.ActionProposalStatus.Superseded,
  GQL.ActionProposalStatus.Expired,
  GQL.ActionProposalStatus.Modified,
] as const;

type ProposalFilter = (typeof PROPOSAL_FILTERS)[number];

type AffiliateInsightScope = {
  key: string;
  kind: "user" | "shop";
  label: string;
  shopId?: string;
};

type AffiliateInsightRow = AffiliateInsightScope & {
  summary: GQL.AffiliateMlModelEfficiencySummary | null;
  failed?: boolean;
};

type AffiliateInsightPayload = Record<string, unknown>;

type AffiliateSalesHistogramBucket = {
  key: string;
  label: string;
  count: number;
};

type AffiliateIntelligenceView = "same_budget" | "same_sales_bar";

export function AffiliateManagementPage() {
  return <AffiliateNeedsAttentionPage />;
}

export const AffiliateIntelligencePage = observer(function AffiliateIntelligencePage() {
  const { t } = useTranslation();
  const apolloClient = useApolloClient();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const [selectedScopeKey, setSelectedScopeKey] = useState("user");
  const [insightRows, setInsightRows] = useState<AffiliateInsightRow[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  const insightScopes = useMemo<AffiliateInsightScope[]>(
    () => [
      {
        key: "user",
        kind: "user",
        label: t("ecommerce.affiliateWorkspace.intelligenceUserModel"),
      },
      ...shops.map((shop) => ({
        key: `shop:${shop.id}`,
        kind: "shop" as const,
        shopId: shop.id,
        label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
      })),
    ],
    [shops, t],
  );
  useEffect(() => {
    if (!user) {
      setInsightRows([]);
      return;
    }

    let active = true;
    setInsightsLoading(true);
    Promise.all(
      insightScopes.map(async (scope): Promise<AffiliateInsightRow> => {
        try {
          const result = await apolloClient.query<
            { affiliateMlInsights: GQL.AffiliateMlInsightsPayload },
            { input?: GQL.AffiliateMlInsightsInput | null }
          >({
            query: AFFILIATE_ML_INSIGHTS_QUERY,
            variables: { input: scope.shopId ? { shopId: scope.shopId } : null },
            fetchPolicy: "network-only",
          });
          return {
            ...scope,
            summary: result.data?.affiliateMlInsights.latestModelEfficiencySummary ?? null,
          };
        } catch {
          return { ...scope, summary: null, failed: true };
        }
      }),
    ).then((rows) => {
      if (!active) return;
      setInsightRows(rows);
      setInsightsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [apolloClient, insightScopes, refreshCount, user]);

  useEffect(() => {
    if (insightRows.length > 0 && !insightRows.some((row) => row.key === selectedScopeKey)) {
      setSelectedScopeKey("user");
    }
  }, [insightRows, selectedScopeKey]);

  const selectedRow =
    insightRows.find((row) => row.key === selectedScopeKey)
    ?? insightRows.find((row) => row.key === "user")
    ?? insightRows[0]
    ?? null;

  if (authChecking) {
    return (
      <div className="page-enter">
        <AffiliateLoadingState />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter affiliate-workbench affiliate-intelligence-page">
      <div className="affiliate-intelligence-hero">
        <div>
          <p className="affiliate-intelligence-kicker">
            {t("ecommerce.affiliateWorkspace.intelligenceKicker")}
          </p>
          <h1>{t("ecommerce.affiliateWorkspace.mlInsightsTitle")}</h1>
          <p className="ecommerce-page-subtitle">
            {t("ecommerce.affiliateWorkspace.mlInsightsHint")}
          </p>
        </div>
        <div className="affiliate-intelligence-controls">
          <button
            className="btn btn-secondary affiliate-intelligence-refresh"
            type="button"
            onClick={() => setRefreshCount((value) => value + 1)}
            disabled={insightsLoading}
          >
            <RefreshIcon />
            <span>
              {insightsLoading
                ? t("common.loading")
                : t("ecommerce.affiliateWorkspace.intelligenceRefresh")}
            </span>
          </button>
        </div>
      </div>

      <AffiliateMlInsightsPanel
        loading={insightsLoading}
        rows={insightRows}
        selectedKey={selectedRow?.key ?? selectedScopeKey}
        onSelect={setSelectedScopeKey}
      />
    </div>
  );
});

export const AffiliateNeedsAttentionPage = observer(function AffiliateNeedsAttentionPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const [selectedShopId, setSelectedShopId] = useState("");
  const [proposalFilter, setProposalFilter] = useState<ProposalFilter>(GQL.ActionProposalStatus.Pending);
  const [attentionSearch, setAttentionSearch] = useState("");
  const [selectedCollaboration, setSelectedCollaboration] = useState<CollaborationDetailItem | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<GQL.CreatorGlobalProfile | null>(null);

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  const shopOptions = useMemo(
    () => [
      { value: "", label: t("ecommerce.affiliateWorkspace.allShops") },
      ...shops
        .filter((shop) => shop.services?.affiliateService?.enabled)
        .map((shop) => ({
          value: shop.id,
          label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
        })),
    ],
    [shops, t],
  );
  const proposalFilterOptions = useMemo(
    () => PROPOSAL_FILTERS.map((filter) => ({
      value: filter,
      label: t(`ecommerce.affiliateWorkspace.proposalFilters.${filter}`, {
        defaultValue: filter,
      }),
    })),
    [t],
  );

  const proposalStatus = useMemo(() => {
    return proposalFilter === "ALL" ? undefined : proposalFilter;
  }, [proposalFilter]);

  const {
    data: proposalData,
    loading: proposalsLoading,
    refetch: refetchProposals,
  } = useQuery<
    { actionProposals: GQL.ActionProposal[] },
    { input: GQL.ReadActionProposalsInput }
  >(AFFILIATE_ACTION_PROPOSALS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || undefined,
        status: proposalStatus,
        limit: 200,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !user,
  });

  const [decideActionProposal, { loading: decidingProposal }] = useMutation<
    { decideActionProposal: GQL.ActionProposal },
    { input: GQL.DecideActionProposalInput }
  >(DECIDE_ACTION_PROPOSAL_MUTATION);

  useEffect(() => {
    const unsubscribeProposal = panelEventBus.subscribe("affiliate-action-proposal-changed", () => {
      void refetchProposals();
    });
    const unsubscribeWorkItem = panelEventBus.subscribe("affiliate-work-item-changed", () => {
      void refetchProposals();
    });
    return () => {
      unsubscribeProposal();
      unsubscribeWorkItem();
    };
  }, [refetchProposals]);

  const proposalItems = proposalData?.actionProposals ?? [];
  const visibleProposalItems = useMemo(
    () => filterActionProposals(proposalItems, attentionSearch, shopLabel),
    [attentionSearch, proposalItems, shops],
  );

  async function decideProposal(proposal: GQL.ActionProposal, status: GQL.ActionProposalStatus) {
    try {
      await decideActionProposal({
        variables: {
          input: {
            id: proposal.id,
            status,
            decision: {
              decidedAt: new Date().toISOString(),
              note: status === GQL.ActionProposalStatus.Approved
                ? t("ecommerce.shopDrawer.affiliate.proposalApprovedNote")
                : t("ecommerce.shopDrawer.affiliate.proposalRejectedNote"),
            },
          },
        },
      });
      showToast(
        status === GQL.ActionProposalStatus.Approved
          ? t("ecommerce.shopDrawer.affiliate.proposalApproveSuccess")
          : t("ecommerce.shopDrawer.affiliate.proposalRejectSuccess"),
        "success",
      );
      await refetchProposals();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  function refetchActive() {
    return refetchProposals();
  }

  function shopLabel(shopId: string): string {
    const shop = shops.find((candidate) => candidate.id === shopId);
    return shop?.alias || shop?.shopName || shop?.platformShopId || shopId;
  }

  if (authChecking) {
    return (
      <div className="page-enter">
        <AffiliateLoadingState />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter affiliate-workbench">
      <div className="ecommerce-page-header affiliate-workbench-header">
        <div>
          <h1>{t("ecommerce.affiliateWorkspace.pageTitles.NEEDS_ATTENTION")}</h1>
          <p className="ecommerce-page-subtitle">
            {t("ecommerce.affiliateWorkspace.pageSubtitles.NEEDS_ATTENTION")}
          </p>
        </div>
        <div className="affiliate-workbench-controls">
          <Select
            value={selectedShopId}
            onChange={setSelectedShopId}
            options={shopOptions}
            className="affiliate-workspace-shop-select"
          />
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void refetchActive()}
            disabled={proposalsLoading}
          >
            {proposalsLoading
              ? t("common.loading")
              : t("ecommerce.shopDrawer.affiliate.refreshProposals")}
          </button>
        </div>
      </div>

      <div className="affiliate-workbench-panel">
        <div className="affiliate-workbench-panel-head affiliate-attention-panel-head">
          <div>
            <div className="affiliate-workbench-panel-title">
              {t("ecommerce.affiliateWorkspace.approvalQueueTitle")}
            </div>
            <div className="form-hint">
              {t("ecommerce.affiliateWorkspace.approvalQueueHint")}
            </div>
          </div>
          <div className="affiliate-attention-toolbar">
            <label className="affiliate-filter-field">
              <span>{t("ecommerce.affiliateWorkspace.statusFilter")}</span>
              <Select
                value={proposalFilter}
                onChange={(value) => setProposalFilter(value as ProposalFilter)}
                options={proposalFilterOptions}
                className="affiliate-status-select"
                ariaLabel={t("ecommerce.affiliateWorkspace.statusFilter")}
              />
            </label>
            <label className="affiliate-filter-field affiliate-filter-field-search">
              <span>{t("ecommerce.affiliateWorkspace.searchFilter")}</span>
              <input
                className="affiliate-attention-search"
                value={attentionSearch}
                onChange={(event) => setAttentionSearch(event.target.value)}
                placeholder={t("ecommerce.affiliateWorkspace.searchPlaceholder")}
                aria-label={t("ecommerce.affiliateWorkspace.searchPlaceholder")}
              />
            </label>
          </div>
        </div>

        <div className="affiliate-attention-active-list">
          {proposalsLoading && visibleProposalItems.length === 0 ? (
            <AffiliateLoadingState />
          ) : visibleProposalItems.length === 0 ? (
            <div className="affiliate-proposal-empty">
              {proposalFilter === GQL.ActionProposalStatus.Pending
                ? t("ecommerce.affiliateWorkspace.emptyApprovals")
                : t("ecommerce.affiliateWorkspace.emptyProposalEntities")}
            </div>
          ) : (
            <div className="affiliate-workbench-list">
              {visibleProposalItems.map((proposal) => (
                <ActionProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  shopLabel={shopLabel(proposal.shopId)}
                  decidingProposal={decidingProposal}
                  onOpenCollaboration={(detailItem) => setSelectedCollaboration(detailItem)}
                  onOpenCreator={(profile) => setSelectedCreator(profile)}
                  onApprove={(item) => decideProposal(item, GQL.ActionProposalStatus.Approved)}
                  onReject={(item) => decideProposal(item, GQL.ActionProposalStatus.Rejected)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedCollaboration ? (
        <CollaborationActivityModal
          item={selectedCollaboration}
          shopLabel={shopLabel(selectedCollaboration.collaborationRecord.shopId)}
          onOpenCreator={(profile) => setSelectedCreator(profile)}
          onClose={() => setSelectedCollaboration(null)}
        />
      ) : null}
      {selectedCreator ? (
        <CreatorDetailModal
          profile={selectedCreator}
          onClose={() => setSelectedCreator(null)}
        />
      ) : null}

    </div>
  );
});

function AffiliateMlInsightsPanel({
  loading,
  rows,
  selectedKey,
  onSelect,
}: {
  loading: boolean;
  rows: AffiliateInsightRow[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<AffiliateIntelligenceView>("same_budget");
  const selectedRow =
    rows.find((row) => row.key === selectedKey)
    ?? rows.find((row) => row.summary)
    ?? rows[0]
    ?? null;
  const summary = selectedRow?.summary ?? null;

  if (loading && rows.length === 0) {
    return <AffiliateLoadingState />;
  }

  if (!selectedRow) {
    return (
      <div className="affiliate-proposal-empty">
        {t("ecommerce.affiliateWorkspace.mlInsightsEmpty", {
          defaultValue: "No affiliate ML evaluation is available yet. Run the training pipeline after affiliate history is ready.",
        })}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="affiliate-ml-insights affiliate-intelligence-dashboard">
        <AffiliateInsightScopeRail
          rows={rows}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
        <div className="affiliate-intelligence-empty">
          <InfoIcon />
          <strong>{selectedRow.label}</strong>
          <span>
            {t("ecommerce.affiliateWorkspace.mlInsightsEmpty", {
              defaultValue: "No affiliate ML evaluation is available yet. Run the training pipeline after affiliate history is ready.",
            })}
          </span>
        </div>
      </div>
    );
  }

  const payload = parseAffiliateInsightPayload(summary.payload);
  const sameBudgetPayload = payloadObject(payload, "same_sample_budget");
  const sameBudget = {
    ...sameBudgetPayload,
    historical_sample_count: payloadNumber(sameBudgetPayload, "historical_sample_count") ?? summary.rowCount,
    historical_approved_count:
      payloadNumber(sameBudgetPayload, "historical_approved_count") ?? summary.humanApprovedCount,
    historical_approval_rate:
      payloadNumber(sameBudgetPayload, "historical_approval_rate") ?? summary.humanApprovalRate,
    historical_expected_sales_units:
      payloadNumber(sameBudgetPayload, "historical_expected_sales_units")
      ?? summary.humanSameBudgetExpectedUnits,
    model_selected_count:
      payloadNumber(sameBudgetPayload, "model_selected_count") ?? summary.modelSameBudgetCount,
    model_expected_sales_units:
      payloadNumber(sameBudgetPayload, "model_expected_sales_units")
      ?? summary.modelSameBudgetExpectedUnits,
    expected_sales_lift_ratio:
      payloadNumber(sameBudgetPayload, "expected_sales_lift_ratio")
      ?? summary.modelVsHumanExpectedUnitsLiftRatio,
    model_selected_human_rejected_count:
      payloadNumber(sameBudgetPayload, "model_selected_human_rejected_count")
      ?? summary.modelSelectedHumanRejectedCount,
    model_rejected_human_approved_count:
      payloadNumber(sameBudgetPayload, "model_rejected_human_approved_count")
      ?? summary.modelRejectedHumanApprovedCount,
    historical_approved_actual_units:
      payloadNumber(sameBudgetPayload, "historical_approved_actual_units")
      ?? summary.humanApprovedActualUnits,
    historical_approved_actual_avg_units:
      payloadNumber(sameBudgetPayload, "historical_approved_actual_avg_units")
      ?? summary.humanApprovedActualAvgUnits,
    historical_approved_observed_count:
      payloadNumber(sameBudgetPayload, "historical_approved_observed_count")
      ?? summary.humanApprovedObservedCount,
  };
  const sameSalesBarPayload = payloadObject(payload, "same_sales_bar");
  const fallbackHistoricalQualifiedCount =
    summary.humanApprovedCount - summary.modelRejectedHumanApprovedCount;
  const fallbackQualifiedLiftRatio =
    fallbackHistoricalQualifiedCount > 0
      ? summary.modelSameBudgetCount / fallbackHistoricalQualifiedCount
      : null;
  const sameSalesBar = {
    ...sameSalesBarPayload,
    min_expected_sales_units_bar:
      payloadNumber(sameSalesBarPayload, "min_expected_sales_units_bar")
      ?? summary.minExpectedSalesUnitsSameBudget,
    historical_sample_count:
      payloadNumber(sameSalesBarPayload, "historical_sample_count") ?? summary.rowCount,
    historical_approved_count:
      payloadNumber(sameSalesBarPayload, "historical_approved_count") ?? summary.humanApprovedCount,
    historical_qualified_approved_count:
      payloadNumber(sameSalesBarPayload, "historical_qualified_approved_count")
      ?? fallbackHistoricalQualifiedCount,
    historical_approved_below_bar_count:
      payloadNumber(sameSalesBarPayload, "historical_approved_below_bar_count")
      ?? summary.modelRejectedHumanApprovedCount,
    model_qualified_count:
      payloadNumber(sameSalesBarPayload, "model_qualified_count") ?? summary.modelSameBudgetCount,
    model_qualified_human_rejected_count:
      payloadNumber(sameSalesBarPayload, "model_qualified_human_rejected_count")
      ?? summary.modelSelectedHumanRejectedCount,
    qualified_creator_lift_ratio:
      payloadNumber(sameSalesBarPayload, "qualified_creator_lift_ratio")
      ?? fallbackQualifiedLiftRatio,
  };
  const budgetHumanApprovedCount = payloadNumber(sameBudget, "historical_approved_count");
  const budgetHumanExpectedUnits = payloadNumber(sameBudget, "historical_expected_sales_units");
  const budgetModelExpectedUnits = payloadNumber(sameBudget, "model_expected_sales_units");
  const budgetLiftRatio = payloadNumber(sameBudget, "expected_sales_lift_ratio");
  const budgetModelRejectedHumanApprovedCount = payloadNumber(sameBudget, "model_rejected_human_approved_count");
  const salesBarThreshold = payloadNumber(sameSalesBar, "min_expected_sales_units_bar");
  const salesBarHistoricalQualifiedCount = payloadNumber(sameSalesBar, "historical_qualified_approved_count");
  const salesBarModelQualifiedCount = payloadNumber(sameSalesBar, "model_qualified_count");
  const salesBarOverlookedCount = payloadNumber(sameSalesBar, "model_qualified_human_rejected_count");
  const salesBarLiftRatio = payloadNumber(sameSalesBar, "qualified_creator_lift_ratio");
  const sampleSavingsRisk =
    budgetHumanApprovedCount && budgetHumanApprovedCount > 0
      ? (budgetModelRejectedHumanApprovedCount ?? 0) / budgetHumanApprovedCount
      : null;
  const budgetMaxUnits = Math.max(budgetModelExpectedUnits ?? 0, budgetHumanExpectedUnits ?? 0, 1);
  const modelBarWidth = `${Math.max(8, Math.round(((budgetModelExpectedUnits ?? 0) / budgetMaxUnits) * 100))}%`;
  const humanBarWidth = `${Math.max(8, Math.round(((budgetHumanExpectedUnits ?? 0) / budgetMaxUnits) * 100))}%`;
  const salesBarMaxCount = Math.max(salesBarModelQualifiedCount ?? 0, salesBarHistoricalQualifiedCount ?? 0, 1);
  const salesBarModelWidth = `${Math.max(8, Math.round(((salesBarModelQualifiedCount ?? 0) / salesBarMaxCount) * 100))}%`;
  const salesBarHumanWidth = `${Math.max(8, Math.round(((salesBarHistoricalQualifiedCount ?? 0) / salesBarMaxCount) * 100))}%`;
  const evaluationWindow = formatEvaluationWindow(payload, summary.evaluationScope, t);
  const precisionLiftPercent = budgetLiftRatio == null ? null : (budgetLiftRatio - 1) * 100;
  const reachLiftPercent = salesBarLiftRatio == null ? null : (salesBarLiftRatio - 1) * 100;
  const precisionLiftLabel = precisionLiftPercent == null ? "—" : `+${formatNumber(precisionLiftPercent, 1)}%`;
  const reachLiftLabel = reachLiftPercent == null ? "—" : `+${formatNumber(reachLiftPercent, 1)}%`;
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;

  return (
    <div className="affiliate-ml-insights affiliate-intelligence-dashboard">
      <AffiliateInsightScopeRail
        rows={rows}
        selectedKey={selectedRow.key}
        onSelect={onSelect}
      />

      <div className="affiliate-intelligence-main">
        <div className="affiliate-intelligence-claim-grid" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "same_budget"}
            className={`affiliate-intelligence-verdict affiliate-intelligence-tab-card${activeView === "same_budget" ? " affiliate-intelligence-tab-card-active" : ""}`}
            onClick={() => setActiveView("same_budget")}
          >
            <div className="affiliate-intelligence-verdict-icon">
              <AffiliateSparkIcon />
            </div>
            <div>
              <span>{selectedRow.label}</span>
              <strong>{t("ecommerce.affiliateWorkspace.intelligenceClaimPrecisionTitle")}</strong>
              <p>
                {precisionLiftPercent != null && precisionLiftPercent > 0
                  ? translate(
                    "ecommerce.affiliateWorkspace.intelligenceClaimPrecisionBody",
                    {
                      lift: precisionLiftLabel,
                      count: formatInteger(budgetHumanApprovedCount),
                    },
                  )
                  : translate(
                    "ecommerce.affiliateWorkspace.intelligenceClaimPrecisionNeutral",
                    {
                      lift: precisionLiftLabel,
                      count: formatInteger(budgetHumanApprovedCount),
                    },
                )}
              </p>
            </div>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "same_sales_bar"}
            className={`affiliate-intelligence-verdict affiliate-intelligence-verdict-reach affiliate-intelligence-tab-card${activeView === "same_sales_bar" ? " affiliate-intelligence-tab-card-active" : ""}`}
            onClick={() => setActiveView("same_sales_bar")}
          >
            <div className="affiliate-intelligence-verdict-icon">
              <AffiliateTargetIcon />
            </div>
            <div>
              <span>{selectedRow.label}</span>
              <strong>{t("ecommerce.affiliateWorkspace.intelligenceClaimReachTitle")}</strong>
              <p>
                {reachLiftPercent != null && reachLiftPercent > 0
                  ? translate(
                    "ecommerce.affiliateWorkspace.intelligenceClaimReachBody",
                    {
                      bar: formatNumber(salesBarThreshold, 1),
                      lift: reachLiftLabel,
                      creators: formatInteger(salesBarModelQualifiedCount),
                      overlooked: formatInteger(salesBarOverlookedCount),
                    },
                  )
                  : translate(
                    "ecommerce.affiliateWorkspace.intelligenceClaimReachNeutral",
                    {
                      bar: formatNumber(salesBarThreshold, 1),
                      lift: reachLiftLabel,
                      creators: formatInteger(salesBarModelQualifiedCount),
                      overlooked: formatInteger(salesBarOverlookedCount),
                    },
                )}
              </p>
            </div>
          </button>
        </div>

        {activeView === "same_budget" ? (
          <div className="affiliate-intelligence-claim-section">
            <div className="affiliate-intelligence-comparison">
              <div className="affiliate-intelligence-card-head">
                <div>
                  <span>{t("ecommerce.affiliateWorkspace.intelligenceChartSameBudget")}</span>
                  <strong>{precisionLiftLabel}</strong>
                </div>
                <small>
                  {translate("ecommerce.affiliateWorkspace.intelligenceSameBudgetStory", {
                    count: formatInteger(budgetHumanApprovedCount),
                    window: evaluationWindow,
                  })}
                </small>
              </div>

              <div className="affiliate-intelligence-race">
                <AffiliateRaceRow
                  icon={<AffiliateSparkIcon />}
                  label={t("ecommerce.affiliateWorkspace.intelligenceModelSelector")}
                  value={formatNumber(budgetModelExpectedUnits, 1)}
                  width={modelBarWidth}
                  variant="model"
                />
                <AffiliateRaceRow
                  icon={<UserIcon />}
                  label={t("ecommerce.affiliateWorkspace.intelligenceHumanSelector")}
                  value={formatNumber(budgetHumanExpectedUnits, 1)}
                  width={humanBarWidth}
                  variant="human"
                />
              </div>
            </div>

            <AffiliateBudgetDistributionPanel
              claim={sameBudget}
              windowLabel={evaluationWindow}
            />
          </div>
        ) : (
          <div className="affiliate-intelligence-claim-section">
            <div className="affiliate-intelligence-comparison affiliate-intelligence-comparison-secondary">
              <div className="affiliate-intelligence-card-head">
                <div>
                  <span>{t("ecommerce.affiliateWorkspace.intelligenceChartSameSalesBar")}</span>
                  <strong>{reachLiftLabel}</strong>
                </div>
                <small>
                  {t("ecommerce.affiliateWorkspace.intelligenceSameSalesBarStory", {
                    bar: formatNumber(salesBarThreshold, 1),
                    window: evaluationWindow,
                  })}
                </small>
              </div>

              <div className="affiliate-intelligence-race">
                <AffiliateRaceRow
                  icon={<AffiliateTargetIcon />}
                  label={t("ecommerce.affiliateWorkspace.intelligenceModelQualifiedCreators")}
                  value={formatInteger(salesBarModelQualifiedCount)}
                  width={salesBarModelWidth}
                  variant="model"
                />
                <AffiliateRaceRow
                  icon={<AffiliateShieldIcon />}
                  label={t("ecommerce.affiliateWorkspace.intelligenceHumanQualifiedCreators")}
                  value={formatInteger(salesBarHistoricalQualifiedCount)}
                  width={salesBarHumanWidth}
                  variant="human"
                />
              </div>
            </div>

            <AffiliateSalesBarOpportunityPanel
              claim={sameSalesBar}
              windowLabel={evaluationWindow}
            />

            <div className="affiliate-intelligence-explainers">
              <AffiliateExplainerTile
                icon={<AffiliateGaugeIcon />}
                value={formatNumber(salesBarThreshold, 1)}
                label={t("ecommerce.affiliateWorkspace.intelligenceApprovalBar")}
              />
              <AffiliateExplainerTile
                icon={<AffiliateTargetIcon />}
                value={formatPercent(summary.humanApprovalRate)}
                label={t("ecommerce.affiliateWorkspace.intelligenceHistoricalRate")}
              />
              <AffiliateExplainerTile
                icon={<AffiliateShieldIcon />}
                value={formatPercent(sampleSavingsRisk)}
                label={t("ecommerce.affiliateWorkspace.intelligenceFilteredRate")}
              />
            </div>
          </div>
        )}

        <div className="affiliate-intelligence-footnote">
          <span
            className="affiliate-intelligence-disclaimer"
            title={t("ecommerce.affiliateWorkspace.intelligenceLegalDisclaimer")}
          >
            <InfoIcon />
          </span>
          <span>
            {t("ecommerce.affiliateWorkspace.intelligenceTrainingScope", {
              approvalRate: formatPercent(summary.humanApprovalRate),
              filteredRate: formatPercent(sampleSavingsRisk),
              trainedAt: formatDate(summary.trainedAt),
              window: evaluationWindow,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

function AffiliateInsightScopeRail({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: AffiliateInsightRow[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="affiliate-intelligence-scope-rail">
      {rows.map((row) => {
        const ready = Boolean(row.summary);
        return (
          <button
            key={row.key}
            type="button"
            className={`affiliate-intelligence-scope${selectedKey === row.key ? " affiliate-intelligence-scope-active" : ""}${ready ? "" : " affiliate-intelligence-scope-empty"}`}
            onClick={() => onSelect(row.key)}
          >
            <span className="affiliate-intelligence-scope-icon">
              {row.kind === "user" ? <UserIcon /> : <ShopIcon />}
            </span>
            <span className="affiliate-intelligence-scope-copy">
              <strong>{row.label}</strong>
              <small>
                {ready
                  ? t("ecommerce.affiliateWorkspace.intelligenceModelReady")
                  : t("ecommerce.affiliateWorkspace.intelligenceNoModel")}
              </small>
            </span>
            {ready ? <CheckIcon /> : <InfoIcon />}
          </button>
        );
      })}
    </div>
  );
}

function AffiliateRaceRow({
  icon,
  label,
  value,
  width,
  variant,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  width: string;
  variant: "model" | "human";
}) {
  return (
    <div className={`affiliate-intelligence-race-row affiliate-intelligence-race-${variant}`}>
      <span className="affiliate-intelligence-race-icon">{icon}</span>
      <span className="affiliate-intelligence-race-label">{label}</span>
      <div className="affiliate-intelligence-race-track">
        <div style={{ width }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function AffiliateExplainerTile({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="affiliate-intelligence-explainer">
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function AffiliateBudgetDistributionPanel({
  claim,
  windowLabel,
}: {
  claim: AffiliateInsightPayload;
  windowLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <AffiliateClaimDistributionPanel
      title={t("ecommerce.affiliateWorkspace.intelligenceBudgetStatsTitle")}
      headline={t("ecommerce.affiliateWorkspace.intelligenceBudgetStatsHeadline")}
      hint={t("ecommerce.affiliateWorkspace.intelligenceBudgetStatsHint", { window: windowLabel })}
      stats={[
        {
          label: t("ecommerce.affiliateWorkspace.intelligenceHistoricalApplications"),
          value: formatInteger(payloadNumber(claim, "historical_sample_count")),
        },
        {
          label: t("ecommerce.affiliateWorkspace.intelligenceHistoricalApproved"),
          value: formatInteger(payloadNumber(claim, "historical_approved_count")),
        },
        {
          label: t("ecommerce.affiliateWorkspace.intelligenceHistoricalExpectedUnits"),
          value: formatNumber(payloadNumber(claim, "historical_expected_sales_units"), 1),
        },
        {
          label: t("ecommerce.affiliateWorkspace.intelligenceModelExpectedUnits"),
          value: formatNumber(payloadNumber(claim, "model_expected_sales_units"), 1),
        },
      ]}
      series={[
        {
          key: "rejected",
          label: t("ecommerce.affiliateWorkspace.intelligenceHistoricalApprovedExpected"),
          buckets: payloadHistogram(claim, "historical_approved_expected_units_histogram"),
          expectedTotal: payloadNumber(claim, "historical_approved_count"),
        },
        {
          key: "selected",
          label: t("ecommerce.affiliateWorkspace.intelligenceModelSelectedExpected"),
          buckets: payloadHistogram(claim, "model_selected_expected_units_histogram"),
          expectedTotal: payloadNumber(claim, "model_selected_count"),
        },
      ]}
    />
  );
}

function AffiliateSalesBarOpportunityPanel({
  claim,
  windowLabel,
}: {
  claim: AffiliateInsightPayload;
  windowLabel: string;
}) {
  const { t } = useTranslation();
  const bar = payloadNumber(claim, "min_expected_sales_units_bar");
  const historicalSampleCount = payloadNumber(claim, "historical_sample_count");
  const historicalQualifiedCount = payloadNumber(claim, "historical_qualified_approved_count");
  const modelQualifiedCount = payloadNumber(claim, "model_qualified_count");
  const overlookedCount = payloadNumber(claim, "model_qualified_human_rejected_count");
  const historicalBuckets = payloadHistogram(claim, "historical_qualified_expected_units_histogram");
  const modelBuckets = payloadHistogram(claim, "model_qualified_expected_units_histogram");
  const total = Math.max(historicalQualifiedCount ?? 0, modelQualifiedCount ?? 0, 1);
  const humanWidth = `${Math.max(8, Math.round(((historicalQualifiedCount ?? 0) / total) * 100))}%`;
  const modelWidth = `${Math.max(8, Math.round(((modelQualifiedCount ?? 0) / total) * 100))}%`;
  const cumulativeRows = [
    {
      key: "bar",
      label: t("ecommerce.affiliateWorkspace.intelligenceReachThresholdBar", {
        bar: formatNumber(bar, 1),
      }),
      humanCount: historicalQualifiedCount ?? 0,
      modelCount: modelQualifiedCount ?? 0,
    },
    {
      key: "3",
      label: t("ecommerce.affiliateWorkspace.intelligenceReachThresholdUnits", { units: "3" }),
      humanCount: cumulativeHistogramCountAtOrAbove(historicalBuckets, 3),
      modelCount: cumulativeHistogramCountAtOrAbove(modelBuckets, 3),
    },
    {
      key: "6",
      label: t("ecommerce.affiliateWorkspace.intelligenceReachThresholdUnits", { units: "6" }),
      humanCount: cumulativeHistogramCountAtOrAbove(historicalBuckets, 6),
      modelCount: cumulativeHistogramCountAtOrAbove(modelBuckets, 6),
    },
    {
      key: "10",
      label: t("ecommerce.affiliateWorkspace.intelligenceReachThresholdUnits", { units: "10" }),
      humanCount: cumulativeHistogramCountAtOrAbove(historicalBuckets, 10),
      modelCount: cumulativeHistogramCountAtOrAbove(modelBuckets, 10),
    },
    {
      key: "20",
      label: t("ecommerce.affiliateWorkspace.intelligenceReachThresholdUnits", { units: "20" }),
      humanCount: cumulativeHistogramCountAtOrAbove(historicalBuckets, 20),
      modelCount: cumulativeHistogramCountAtOrAbove(modelBuckets, 20),
    },
  ];

  return (
    <div className="affiliate-intelligence-distribution-card affiliate-intelligence-reach-card">
      <div className="affiliate-intelligence-distribution-head">
        <div>
          <span>{t("ecommerce.affiliateWorkspace.intelligenceReachStatsTitle")}</span>
          <strong>{t("ecommerce.affiliateWorkspace.intelligenceReachStatsHeadline")}</strong>
        </div>
        <small>
          {t("ecommerce.affiliateWorkspace.intelligenceReachStatsHint", {
            bar: formatNumber(bar, 1),
            window: windowLabel,
          })}
        </small>
      </div>

      <div className="affiliate-intelligence-stat-strip">
        <AffiliateTinyStat
          label={t("ecommerce.affiliateWorkspace.intelligenceHistoricalApplications")}
          value={formatInteger(historicalSampleCount)}
        />
        <AffiliateTinyStat
          label={t("ecommerce.affiliateWorkspace.intelligenceHumanQualifiedCreators")}
          value={formatInteger(historicalQualifiedCount)}
        />
        <AffiliateTinyStat
          label={t("ecommerce.affiliateWorkspace.intelligenceModelQualifiedCreators")}
          value={formatInteger(modelQualifiedCount)}
        />
        <AffiliateTinyStat
          label={t("ecommerce.affiliateWorkspace.intelligenceOverlookedQualifiedCreators")}
          value={formatInteger(overlookedCount)}
        />
      </div>

      <div className="affiliate-intelligence-reach-compare" role="img">
        <AffiliateReachRow
          label={t("ecommerce.affiliateWorkspace.intelligenceHumanQualifiedCreators")}
          value={formatInteger(historicalQualifiedCount)}
          width={humanWidth}
          variant="human"
        />
        <AffiliateReachRow
          label={t("ecommerce.affiliateWorkspace.intelligenceModelQualifiedCreators")}
          value={formatInteger(modelQualifiedCount)}
          width={modelWidth}
          variant="model"
        />
      </div>

      <AffiliateReachCumulativeChart rows={cumulativeRows} />

      <div className="affiliate-intelligence-reach-note">
        <strong>
          {t("ecommerce.affiliateWorkspace.intelligenceReachOpportunityTitle", {
            count: overlookedCount ?? 0,
          })}
        </strong>
        <span>{t("ecommerce.affiliateWorkspace.intelligenceReachOpportunityBody")}</span>
      </div>
    </div>
  );
}

function AffiliateReachCumulativeChart({
  rows,
}: {
  rows: Array<{
    key: string;
    label: string;
    humanCount: number;
    modelCount: number;
  }>;
}) {
  const { t } = useTranslation();
  const maxCount = Math.max(1, ...rows.flatMap((row) => [row.humanCount, row.modelCount]));

  return (
    <div className="affiliate-intelligence-cumulative">
      <div className="affiliate-intelligence-cumulative-head">
        <strong>{t("ecommerce.affiliateWorkspace.intelligenceReachCumulativeTitle")}</strong>
        <span>{t("ecommerce.affiliateWorkspace.intelligenceReachCumulativeHint")}</span>
      </div>
      <div className="affiliate-intelligence-cumulative-grid" role="img">
        {rows.map((row) => {
          const humanHeight = Math.max(3, Math.round((row.humanCount / maxCount) * 100));
          const modelHeight = Math.max(3, Math.round((row.modelCount / maxCount) * 100));
          return (
            <div key={row.key} className="affiliate-intelligence-cumulative-column">
              <div className="affiliate-intelligence-cumulative-bars">
                <span
                  className="affiliate-intelligence-cumulative-bar affiliate-intelligence-cumulative-bar-human"
                  style={{ height: `${humanHeight}%` }}
                  title={`${row.label} · ${formatInteger(row.humanCount)}`}
                />
                <span
                  className="affiliate-intelligence-cumulative-bar affiliate-intelligence-cumulative-bar-model"
                  style={{ height: `${modelHeight}%` }}
                  title={`${row.label} · ${formatInteger(row.modelCount)}`}
                />
              </div>
              <strong>{row.label}</strong>
              <small>
                {formatInteger(row.humanCount)} / {formatInteger(row.modelCount)}
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AffiliateReachRow({
  label,
  value,
  width,
  variant,
}: {
  label: string;
  value: string;
  width: string;
  variant: "human" | "model";
}) {
  return (
    <div className={`affiliate-intelligence-reach-row affiliate-intelligence-reach-row-${variant}`}>
      <div className="affiliate-intelligence-reach-row-head">
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
      <div className="affiliate-intelligence-reach-track">
        <i style={{ width }} />
      </div>
    </div>
  );
}

function AffiliateClaimDistributionPanel({
  title,
  headline,
  hint,
  stats,
  series,
}: {
  title: string;
  headline: string;
  hint: string;
  stats: Array<{ label: string; value: string }>;
  series: Array<{
    key: string;
    label: string;
    buckets: AffiliateSalesHistogramBucket[];
    expectedTotal?: number | null;
  }>;
}) {
  const { t } = useTranslation();
  const labels = mergedHistogramLabels(series.map((item) => item.buckets));
  const hasData = labels.length > 0 && series.some((item) => item.buckets.some((bucket) => bucket.count > 0));
  const hasCompleteData = series.every((item) => {
    const expectedTotal = item.expectedTotal;
    if (expectedTotal == null) return true;
    return histogramTotal(item.buckets) === Math.trunc(expectedTotal);
  });

  return (
    <div className="affiliate-intelligence-distribution-card">
      <div className="affiliate-intelligence-distribution-head">
        <div>
          <span>{title}</span>
          <strong>{headline}</strong>
        </div>
        <small>{hint}</small>
      </div>

      <div className="affiliate-intelligence-stat-strip">
        {stats.map((item) => (
          <AffiliateTinyStat key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      {hasData && hasCompleteData ? (
        <AffiliateBucketShareChart labels={labels} series={series} />
      ) : (
        <div className="affiliate-intelligence-distribution-empty">
          {t("ecommerce.affiliateWorkspace.intelligenceDistributionIncomplete")}
        </div>
      )}
    </div>
  );
}

function AffiliateBucketShareChart({
  labels,
  series,
}: {
  labels: AffiliateSalesHistogramBucket[];
  series: Array<{
    key: string;
    label: string;
    buckets: AffiliateSalesHistogramBucket[];
    expectedTotal?: number | null;
  }>;
}) {
  const seriesShares = series.map((item) => {
    const total = histogramTotal(item.buckets);
    const shares = labels.map((label) => {
      const bucket = item.buckets.find((candidate) => candidate.key === label.key);
      return total > 0 ? (bucket?.count ?? 0) / total : 0;
    });
    return { ...item, total, shares };
  });
  const maxShare = Math.max(0.01, ...seriesShares.flatMap((item) => item.shares));

  return (
    <div className="affiliate-intelligence-bucket-panel">
      <div className="affiliate-intelligence-bucket-legend">
        {seriesShares.map((item) => (
          <span key={item.key} className={`affiliate-bucket-legend-${salesBucketClass(item.key)}`}>
            <i />
            <strong>{item.label}</strong>
            <small>{formatInteger(item.total)}</small>
          </span>
        ))}
      </div>
      <div
        className="affiliate-intelligence-bucket-chart"
        role="img"
        aria-label={seriesShares.map((item) => item.label).join(" versus ")}
      >
        {labels.map((label, index) => (
          <div key={label.key} className="affiliate-intelligence-bucket-group">
            <div className="affiliate-intelligence-bucket-bars">
              {seriesShares.map((item) => {
                const count = item.buckets.find((bucket) => bucket.key === label.key)?.count ?? 0;
                const share = item.shares[index] ?? 0;
                const heightPercent = maxShare > 0 ? Math.max(2, (share / maxShare) * 100) : 2;
                if (count <= 0) {
                  return (
                    <span
                      key={item.key}
                      className={`affiliate-bucket-bar affiliate-bucket-bar-empty affiliate-bucket-bar-${salesBucketClass(item.key)}`}
                      title={`${item.label} · ${label.label}: 0% (0)`}
                    />
                  );
                }
                return (
                  <span
                    key={item.key}
                    className={`affiliate-bucket-bar affiliate-bucket-bar-${salesBucketClass(item.key)}`}
                    style={{ height: `${heightPercent}%` }}
                    title={`${item.label} · ${label.label}: ${formatPercent(share)} (${formatInteger(count)})`}
                  />
                );
              })}
            </div>
            <span className="affiliate-intelligence-bucket-label">{label.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function histogramTotal(buckets: AffiliateSalesHistogramBucket[]): number {
  return buckets.reduce((sum, bucket) => sum + bucket.count, 0);
}

function cumulativeHistogramCountAtOrAbove(
  buckets: AffiliateSalesHistogramBucket[],
  threshold: number,
): number {
  return buckets.reduce((sum, bucket) => {
    const lowerBound = salesBucketLowerBound(bucket.key);
    if (lowerBound == null || lowerBound < threshold) return sum;
    return sum + bucket.count;
  }, 0);
}

function salesBucketLowerBound(key: string): number | null {
  const normalized = key.toLowerCase().replace(/\+/g, "_plus");
  const match = normalized.match(/^(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function salesBucketClass(key: string): string {
  return key.replace(/\+/g, "_plus").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function AffiliateTinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="affiliate-intelligence-tiny-stat">
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function AffiliateSparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" />
    </svg>
  );
}

function AffiliateTargetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function AffiliateShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.6-2.7 8-7 10-4.3-2-7-5.4-7-10V6l7-3z" />
      <path d="M8.5 12.2l2.1 2.1 4.9-5" />
    </svg>
  );
}

function AffiliateGaugeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M12 14l4-5" />
      <path d="M6 18h12" />
    </svg>
  );
}

function parseAffiliateInsightPayload(payload: unknown): AffiliateInsightPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as AffiliateInsightPayload;
}

function payloadNumber(payload: AffiliateInsightPayload, key: string): number | null {
  const value = payload[key];
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function payloadObject(payload: AffiliateInsightPayload, key: string): AffiliateInsightPayload {
  const value = payload[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AffiliateInsightPayload;
}

function payloadHistogram(payload: AffiliateInsightPayload, key: string): AffiliateSalesHistogramBucket[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const bucketKey = typeof source.key === "string" ? source.key : null;
    const label = typeof source.label === "string" ? source.label : bucketKey;
    const count = payloadNumber(source, "count");
    if (!bucketKey || !label || count == null) return [];
    return [{ key: bucketKey, label, count }];
  });
}

function mergedHistogramLabels(bucketLists: AffiliateSalesHistogramBucket[][]): AffiliateSalesHistogramBucket[] {
  const labels = new Map<string, AffiliateSalesHistogramBucket>();
  for (const buckets of bucketLists) {
    for (const bucket of buckets) {
      if (!labels.has(bucket.key)) {
        labels.set(bucket.key, { key: bucket.key, label: bucket.label, count: 0 });
      }
    }
  }
  return Array.from(labels.values());
}

function formatEvaluationWindow(
  payload: AffiliateInsightPayload,
  evaluationScope: string,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const windowPayload = payloadObject(payload, "evaluation_window");
  const start = typeof windowPayload.start === "string" ? windowPayload.start : null;
  const end = typeof windowPayload.end === "string" ? windowPayload.end : null;
  if (start && end) {
    const dayCount = inclusiveDayCount(start, end);
    return t("ecommerce.affiliateWorkspace.intelligenceWindowRange", {
      start: formatShortDate(start),
      end: formatShortDate(end),
      days: dayCount == null ? "—" : formatInteger(dayCount),
    });
  }
  return t(`ecommerce.affiliateWorkspace.evaluationScopes.${evaluationScope}`, {
    defaultValue: t("ecommerce.affiliateWorkspace.intelligenceWindowLatestTraining"),
  });
}

function inclusiveDayCount(start: string | Date, end: string | Date): number | null {
  const startDate = parseDateOnlyAsLocalDate(start);
  const endDate = parseDateOnlyAsLocalDate(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.max(1, Math.round((endUtc - startUtc) / 86400000) + 1);
}

function formatInteger(value: number | null | undefined): string {
  return value == null ? "—" : new Intl.NumberFormat().format(value);
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  return value == null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  return value == null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value);
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = parseDateOnlyAsLocalDate(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function parseDateOnlyAsLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(value);
}

function isPendingActionProposalItem(item: DashboardItem): boolean {
  return item.proposal?.status === GQL.ActionProposalStatus.Pending;
}

function filterDashboardItems(
  items: DashboardItem[],
  search: string,
  shopLabel: (shopId: string) => string,
): DashboardItem[] {
  const query = search.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => dashboardItemSearchText(item, shopLabel).includes(query));
}

function dashboardItemSearchText(
  item: DashboardItem,
  shopLabel: (shopId: string) => string,
): string {
  const creatorProfile = item.creatorProfile;
  const collaboration = item.collaborationRecord;
  const proposal = item.proposal;
  const sample = item.sampleApplicationRecord;
  const values = [
    item.id,
    item.title,
    item.summary,
    item.shopId,
    shopLabel(item.shopId),
    item.creatorId,
    creatorProfile?.id,
    creatorProfile?.nickname,
    creatorProfile?.username,
    creatorProfile?.creatorOpenId,
    creatorProfile?.creatorImId,
    item.proposalId,
    proposal?.id,
    proposal?.operatorSummary,
    item.collaborationRecordId,
    collaboration?.id,
    collaboration?.creatorId,
    collaboration?.creatorOpenId,
    collaboration?.creatorImId,
    collaboration?.productId,
    collaboration?.platformCollaborationId,
    collaboration?.platformConversationId,
    collaboration?.sampleApplicationRecordId,
    item.sampleApplicationRecordId,
    sample?.id,
    sample?.platformApplicationId,
    sample?.creatorOpenId,
    sample?.productId,
    item.lifecycleEventId,
    item.lifecycleEventType,
    item.statusLabel,
    item.productSummary?.productId,
    item.productSummary?.title,
    item.productSummary?.status,
  ];
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function filterActionProposals(
  proposals: GQL.ActionProposal[],
  search: string,
  shopLabel: (shopId: string) => string,
): GQL.ActionProposal[] {
  const query = search.trim().toLowerCase();
  if (!query) return proposals;
  return proposals.filter((proposal) => actionProposalSearchText(proposal, shopLabel).includes(query));
}

function actionProposalSearchText(
  proposal: GQL.ActionProposal,
  shopLabel: (shopId: string) => string,
): string {
  const creatorProfile = proposal.creatorProfile;
  const collaboration = proposal.collaborationRecord;
  const values = [
    proposal.id,
    proposal.shopId,
    shopLabel(proposal.shopId),
    proposal.creatorId,
    proposal.operatorSummary,
    proposal.type,
    proposal.status,
    creatorProfile?.id,
    creatorProfile?.nickname,
    creatorProfile?.username,
    creatorProfile?.creatorOpenId,
    creatorProfile?.creatorImId,
    proposal.collaborationRecordId,
    collaboration?.id,
    collaboration?.creatorId,
    collaboration?.creatorOpenId,
    collaboration?.creatorImId,
    collaboration?.productId,
    collaboration?.platformCollaborationId,
    collaboration?.platformConversationId,
    proposal.messageIntent?.text,
    proposal.messageIntent?.productId,
    proposal.sampleReviewIntent?.platformApplicationId,
    proposal.sampleReviewIntent?.sampleApplicationRecordId,
  ];
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function filterCollaborationItems(
  items: CollaborationListItem[],
  search: string,
  shopLabel: (shopId: string) => string,
): CollaborationListItem[] {
  const query = search.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => collaborationItemSearchText(item, shopLabel).includes(query));
}

function collaborationItemSearchText(
  item: CollaborationListItem,
  shopLabel: (shopId: string) => string,
): string {
  const record = item.collaborationRecord;
  const creatorProfile = item.creatorProfile;
  const values = [
    record.id,
    record.shopId,
    shopLabel(record.shopId),
    record.creatorId,
    record.creatorOpenId,
    record.creatorImId,
    record.productId,
    record.platformCollaborationId,
    record.platformConversationId,
    record.processingStatus,
    record.lifecycleStage,
    item.productSummary?.productId,
    item.productSummary?.title,
    item.productSummary?.status,
    item.latestProposal?.id,
    item.latestProposal?.operatorSummary,
    item.latestLifecycleEvent?.eventType,
    creatorProfile?.id,
    creatorProfile?.nickname,
    creatorProfile?.username,
    creatorProfile?.creatorOpenId,
    creatorProfile?.creatorImId,
  ];
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function AffiliateLoadingState() {
  const { t } = useTranslation();
  return (
    <div className="affiliate-loading-state" role="status" aria-live="polite">
      <div className="affiliate-loading-spinner" aria-hidden="true" />
      <span>{t("ecommerce.affiliateWorkspace.loadingEntities")}</span>
    </div>
  );
}

export const AffiliateHistoryPage = observer(function AffiliateHistoryPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const [selectedShopId, setSelectedShopId] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("NEEDS_ATTENTION");
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageInput, setHistoryPageInput] = useState("1");
  const [selectedItem, setSelectedItem] = useState<CollaborationListItem | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<GQL.CreatorGlobalProfile | null>(null);
  const [resolvingCollaborationId, setResolvingCollaborationId] = useState<string | null>(null);
  const [resolveStaffAction] = useMutation<
    { resolveAffiliateCollaborationStaffAction: GQL.ResolveAffiliateCollaborationStaffActionPayload },
    { input: GQL.ResolveAffiliateCollaborationStaffActionInput }
  >(RESOLVE_AFFILIATE_COLLABORATION_STAFF_ACTION_MUTATION);

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  const shopOptions = useMemo(
    () => [
      { value: "", label: t("ecommerce.affiliateWorkspace.allShops") },
      ...shops
        .filter((shop) => shop.services?.affiliateService?.enabled)
        .map((shop) => ({
          value: shop.id,
          label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
        })),
    ],
    [shops, t],
  );
  const historyFilterOptions = useMemo(
    () => HISTORY_FILTERS.map((filter) => ({
      value: filter,
      label: t(`ecommerce.affiliateWorkspace.historyFilters.${filter}`, {
        defaultValue: filter,
      }),
    })),
    [t],
  );

  const processingStatus = useMemo(() => {
    if (historyFilter === "ALL" || historyFilter === "IN_PROGRESS" || historyFilter === "NEEDS_ATTENTION") return undefined;
    return historyFilter;
  }, [historyFilter]);
  const processingStatuses = useMemo(() => {
    if (historyFilter === "NEEDS_ATTENTION") {
      return [
        GQL.AffiliateCollaborationRecordProcessingStatus.AgentNeeded,
        GQL.AffiliateCollaborationRecordProcessingStatus.WaitingApproval,
        GQL.AffiliateCollaborationRecordProcessingStatus.StaffNeeded,
      ];
    }
    if (historyFilter !== "IN_PROGRESS") return undefined;
    return [
      GQL.AffiliateCollaborationRecordProcessingStatus.AgentNeeded,
      GQL.AffiliateCollaborationRecordProcessingStatus.WaitingApproval,
      GQL.AffiliateCollaborationRecordProcessingStatus.StaffNeeded,
      GQL.AffiliateCollaborationRecordProcessingStatus.WaitingCreator,
      GQL.AffiliateCollaborationRecordProcessingStatus.WaitingPlatform,
    ];
  }, [historyFilter]);

  const { data, loading, refetch } = useQuery<
    { affiliateCollaborationRecordItems: CollaborationListItem[] },
    { input: GQL.ReadAffiliateCollaborationRecordsInput }
  >(AFFILIATE_COLLABORATION_RECORD_ITEMS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || undefined,
        processingStatus,
        processingStatuses,
        limit: 200,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !user,
  });

  useEffect(() => {
    const unsubscribeProposal = panelEventBus.subscribe("affiliate-action-proposal-changed", () => {
      void refetch();
    });
    const unsubscribeWorkItem = panelEventBus.subscribe("affiliate-work-item-changed", () => {
      void refetch();
    });
    return () => {
      unsubscribeProposal();
      unsubscribeWorkItem();
    };
  }, [refetch]);

  const items = useMemo(() => {
    return data?.affiliateCollaborationRecordItems ?? [];
  }, [data?.affiliateCollaborationRecordItems]);
  const visibleItems = useMemo(
    () => filterCollaborationItems(items, historySearch, shopLabel),
    [historySearch, items, shops],
  );
  const historyPageCount = Math.max(1, Math.ceil(visibleItems.length / COLLABORATION_HISTORY_PAGE_SIZE));
  const pagedVisibleItems = useMemo(() => {
    const start = (historyPage - 1) * COLLABORATION_HISTORY_PAGE_SIZE;
    return visibleItems.slice(start, start + COLLABORATION_HISTORY_PAGE_SIZE);
  }, [historyPage, visibleItems]);
  const pageStart = visibleItems.length === 0
    ? 0
    : (historyPage - 1) * COLLABORATION_HISTORY_PAGE_SIZE + 1;
  const pageEnd = Math.min(historyPage * COLLABORATION_HISTORY_PAGE_SIZE, visibleItems.length);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilter, historySearch, selectedShopId]);

  useEffect(() => {
    setHistoryPage((page) => Math.min(page, historyPageCount));
  }, [historyPageCount]);

  useEffect(() => {
    setHistoryPageInput(String(historyPage));
  }, [historyPage]);

  function commitHistoryPageInput(): void {
    const nextPage = Number.parseInt(historyPageInput, 10);
    if (!Number.isFinite(nextPage)) {
      setHistoryPageInput(String(historyPage));
      return;
    }
    const clampedPage = Math.min(historyPageCount, Math.max(1, nextPage));
    setHistoryPage(clampedPage);
    setHistoryPageInput(String(clampedPage));
  }

  async function handleStaffAction(
    record: GQL.AffiliateCollaborationRecord,
  ): Promise<void> {
    setResolvingCollaborationId(record.id);
    try {
      await resolveStaffAction({
        variables: {
          input: {
            shopId: record.shopId,
            collaborationRecordId: record.id,
            action: GQL.AffiliateStaffCollaborationResolutionAction.MarkHandled,
            note: t("ecommerce.affiliateWorkspace.staffActionHandledNote"),
          },
        },
      });
      showToast(t("ecommerce.affiliateWorkspace.staffActionHandled"), "success");
      await refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    } finally {
      setResolvingCollaborationId(null);
    }
  }

  function shopLabel(shopId: string): string {
    const shop = shops.find((candidate) => candidate.id === shopId);
    return shop?.alias || shop?.shopName || shop?.platformShopId || shopId;
  }

  if (authChecking) {
    return (
      <div className="page-enter">
        <AffiliateLoadingState />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter affiliate-workbench">
      <div className="ecommerce-page-header affiliate-workbench-header">
        <div>
          <h1>{t("ecommerce.affiliateWorkspace.historyTitle")}</h1>
          <p className="ecommerce-page-subtitle">
            {t("ecommerce.affiliateWorkspace.historySubtitle")}
          </p>
        </div>
        <div className="affiliate-workbench-controls">
          <Select
            value={selectedShopId}
            onChange={setSelectedShopId}
            options={shopOptions}
            className="affiliate-workspace-shop-select"
          />
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void refetch()}
            disabled={loading}
          >
            {loading
              ? t("common.loading")
              : t("ecommerce.shopDrawer.affiliate.refreshProposals")}
          </button>
        </div>
      </div>

      <div className="affiliate-workbench-panel">
        <div className="affiliate-workbench-panel-head">
          <div>
            <div className="affiliate-workbench-panel-title">
              {t("ecommerce.affiliateWorkspace.collaborationRecords")}
            </div>
            <div className="form-hint">
              {t("ecommerce.affiliateWorkspace.collaborationRecordsHint")}
            </div>
          </div>
          <div className="affiliate-attention-toolbar">
            <label className="affiliate-filter-field">
              <span>{t("ecommerce.affiliateWorkspace.statusFilter")}</span>
              <Select
                value={historyFilter}
                onChange={(value) => setHistoryFilter(value as HistoryFilter)}
                options={historyFilterOptions}
                className="affiliate-status-select"
                ariaLabel={t("ecommerce.affiliateWorkspace.statusFilter")}
              />
            </label>
            <label className="affiliate-filter-field affiliate-filter-field-search">
              <span>{t("ecommerce.affiliateWorkspace.searchFilter")}</span>
              <input
                className="affiliate-attention-search"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder={t("ecommerce.affiliateWorkspace.searchPlaceholder")}
                aria-label={t("ecommerce.affiliateWorkspace.searchPlaceholder")}
              />
            </label>
          </div>
        </div>

        {loading && visibleItems.length === 0 ? (
          <AffiliateLoadingState />
        ) : visibleItems.length === 0 ? (
          <div className="affiliate-proposal-empty">
            {t("ecommerce.affiliateWorkspace.emptyHistory")}
          </div>
        ) : (
          <>
            <div className="affiliate-collaboration-list">
              {pagedVisibleItems.map((item) => (
                <CollaborationRecordCard
                  key={item.collaborationRecord.id}
                  item={item}
                  shopLabel={shopLabel(item.collaborationRecord.shopId)}
                  onOpen={() => setSelectedItem(item)}
                  onOpenCreator={(profile) => setSelectedCreator(profile)}
                  resolving={resolvingCollaborationId === item.collaborationRecord.id}
                  onStaffAction={(record) => void handleStaffAction(record)}
                />
              ))}
            </div>
            {visibleItems.length > COLLABORATION_HISTORY_PAGE_SIZE ? (
              <div className="affiliate-collaboration-pagination" aria-label={t("ecommerce.affiliateWorkspace.pagination")}>
                <span className="affiliate-collaboration-pagination-summary">
                  {t("ecommerce.affiliateWorkspace.pageSummary", {
                    start: pageStart,
                    end: pageEnd,
                    total: visibleItems.length,
                    page: historyPage,
                    pages: historyPageCount,
                  })}
                </span>
                <div className="affiliate-collaboration-pagination-actions">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                  >
                    {t("ecommerce.affiliateWorkspace.prevPage")}
                  </button>
                  <span className="affiliate-collaboration-page-pill">
                    {t("ecommerce.affiliateWorkspace.page", {
                      page: historyPage,
                      pages: historyPageCount,
                    })}
                  </span>
                  <label className="affiliate-collaboration-page-jump">
                    <span>{t("ecommerce.affiliateWorkspace.jumpToPage")}</span>
                    <input
                      type="number"
                      min={1}
                      max={historyPageCount}
                      value={historyPageInput}
                      aria-label={t("ecommerce.affiliateWorkspace.jumpPageAria")}
                      onChange={(event) => setHistoryPageInput(event.target.value)}
                      onBlur={commitHistoryPageInput}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </label>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={historyPage >= historyPageCount}
                    onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))}
                  >
                    {t("ecommerce.affiliateWorkspace.nextPage")}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {selectedItem ? (
        <CollaborationActivityModal
          item={selectedItem}
          shopLabel={shopLabel(selectedItem.collaborationRecord.shopId)}
          onOpenCreator={(profile) => setSelectedCreator(profile)}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
      {selectedCreator ? (
        <CreatorDetailModal
          profile={selectedCreator}
          onClose={() => setSelectedCreator(null)}
        />
      ) : null}
    </div>
  );
});

function CollaborationRecordCard({
  item,
  shopLabel,
  onOpen,
  onOpenCreator,
  resolving,
  onStaffAction,
}: {
  item: CollaborationListItem;
  shopLabel: string;
  onOpen: () => void;
  onOpenCreator: (profile: GQL.CreatorGlobalProfile) => void;
  resolving: boolean;
  onStaffAction: (
    record: GQL.AffiliateCollaborationRecord,
  ) => void;
}) {
  const { t } = useTranslation();
  const record = item.collaborationRecord;
  const workView = buildCollaborationWorkView(record, item.latestProposal, t);
  const creatorName = item.creatorProfile
    ? creatorPrimaryName(item.creatorProfile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : t("ecommerce.affiliateWorkspace.unknownCreator");
  const creatorHandle = item.creatorProfile ? creatorTikTokHandle(item.creatorProfile) : null;
  const creatorPlatformId = item.creatorProfile ? creatorPlatformIdentity(item.creatorProfile) : null;

  return (
    <article
      className="affiliate-collaboration-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="affiliate-work-item-head">
        <div className="affiliate-creator-block">
          <div className="affiliate-avatar" aria-hidden="true">
            {creatorName.slice(0, 1).toUpperCase()}
          </div>
          <div className="affiliate-creator-text">
            <CreatorName
              name={creatorName}
              onOpen={item.creatorProfile ? () => onOpenCreator(item.creatorProfile as GQL.CreatorGlobalProfile) : undefined}
            />
            <CreatorPlatformId
              handle={creatorHandle}
              platformId={creatorPlatformId}
            />
            <div className="affiliate-work-item-meta">
              <span>{shopLabel}</span>
              <span>{workView.stage}</span>
              <span>{formatProposalTime(record.stateUpdatedAt)}</span>
              <DebugIdCopy value={record.id} />
            </div>
          </div>
        </div>
        <div className="affiliate-work-item-badges">
          <span className={`affiliate-kind-badge affiliate-collaboration-tone-${workView.badgeTone}`}>
            {workView.badge}
          </span>
        </div>
      </div>
      <div className="affiliate-collaboration-card-body">
        <section className="affiliate-card-section affiliate-card-section-primary">
          <div className="affiliate-card-section-label">
            {workView.ownerLabel}
          </div>
          <div className="affiliate-card-section-title">{workView.title}</div>
          <div className="affiliate-card-section-copy">{workView.description}</div>
        </section>
        <ProductSummaryCard
          product={item.productSummary}
          productId={record.productId}
          shopId={record.shopId}
          label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
        />
        {record.processingStatus === GQL.AffiliateCollaborationRecordProcessingStatus.StaffNeeded ? (
          <div className="affiliate-collaboration-staff-actions" onClick={(event) => event.stopPropagation()}>
            <div className="affiliate-collaboration-staff-actions-buttons">
              <button
                className="btn btn-primary"
                type="button"
                disabled={resolving}
                onClick={() => onStaffAction(record)}
              >
                {resolving
                  ? t("common.loading")
                  : t("ecommerce.affiliateWorkspace.markStaffHandled")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CollaborationActivityModal({
  item,
  shopLabel,
  onOpenCreator,
  onClose,
}: {
  item: CollaborationDetailItem;
  shopLabel: string;
  onOpenCreator?: (profile: GQL.CreatorGlobalProfile) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const record = item.collaborationRecord;
  const creatorName = item.creatorProfile
    ? creatorPrimaryName(item.creatorProfile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : t("ecommerce.affiliateWorkspace.unknownCreator");
  const { data, loading } = useQuery<
    { affiliateCollaborationActivity: GQL.AffiliateCollaborationActivityPayload },
    { input: GQL.AffiliateCollaborationActivityInput }
  >(AFFILIATE_COLLABORATION_ACTIVITY_QUERY, {
    variables: { input: { collaborationRecordId: record.id, limit: 80 } },
    fetchPolicy: "cache-and-network",
  });
  const proposals = data?.affiliateCollaborationActivity.actionProposals ?? [];
  const lifecycleEvents = data?.affiliateCollaborationActivity.lifecycleEvents ?? [];

  const timeline = useMemo(
    () => [
      ...proposals.map((proposal) => ({
        id: `proposal:${proposal.id}`,
        time: proposal.updatedAt,
        kind: t(
          `ecommerce.affiliateWorkspace.itemKinds.${dashboardKindForProposalStatus(proposal.status)}`,
        ),
        title: proposal.operatorSummary || proposal.type,
        detail: renderProposalActivityDetail(proposal, t),
      })),
      ...lifecycleEvents.map((event) => ({
        id: `event:${event.id}`,
        time: event.createdAt,
        kind: t("ecommerce.affiliateWorkspace.itemKinds.PLATFORM_EVENT"),
        title: event.eventType,
        detail: event.displayPayloadJson ?? "",
      })),
    ].sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime()),
    [lifecycleEvents, proposals, t],
  );

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-content affiliate-collaboration-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="affiliate-collaboration-modal-title-block">
            <button
              className="affiliate-collaboration-modal-creator"
              type="button"
              onClick={() => {
                if (item.creatorProfile && onOpenCreator) onOpenCreator(item.creatorProfile);
              }}
              disabled={!item.creatorProfile || !onOpenCreator}
            >
              {creatorName}
            </button>
            <p>{shopLabel}</p>
          </div>
          <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>
        <div className="affiliate-collaboration-modal-summary">
          <span>{t(`ecommerce.affiliateWorkspace.statusLabels.${record.processingStatus}`)}</span>
          <span>{t(`ecommerce.affiliateWorkspace.lifecycleStages.${record.lifecycleStage}`, {
            defaultValue: record.lifecycleStage,
          })}</span>
          <span>{item.productSummary?.title || record.productId || t("ecommerce.affiliateWorkspace.productContextMissing")}</span>
        </div>
        <ProductSummaryCard
          product={item.productSummary}
          productId={record.productId}
          shopId={record.shopId}
          label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
        />
        <div className="affiliate-collaboration-modal-section-title">
          {t("ecommerce.affiliateWorkspace.operationHistory")}
        </div>
        <div className="affiliate-collaboration-timeline">
          {loading && timeline.length === 0 ? (
            <div className="affiliate-proposal-empty">{t("common.loading")}</div>
          ) : timeline.length === 0 ? (
            <div className="affiliate-proposal-empty">
              {t("ecommerce.affiliateWorkspace.noActivityYet")}
            </div>
          ) : (
            timeline.map((entry) => (
              <div className="affiliate-timeline-row" key={entry.id}>
                <div className="affiliate-timeline-dot" aria-hidden="true" />
                <div>
                  <div className="affiliate-timeline-meta">
                    <span>{entry.kind}</span>
                    <span>{formatProposalTime(entry.time)}</span>
                  </div>
                  <div className="affiliate-work-item-title">{entry.title}</div>
                  {entry.detail ? (
                    <div className="affiliate-work-item-preview">{entry.detail}</div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function dashboardKindForProposalStatus(status: GQL.ActionProposalStatus): GQL.AffiliateDashboardItemKind {
  if (status === GQL.ActionProposalStatus.Pending) {
    return GQL.AffiliateDashboardItemKind.ApprovalRequired;
  }
  if (status === GQL.ActionProposalStatus.Rejected) {
    return GQL.AffiliateDashboardItemKind.ActionRejected;
  }
  return GQL.AffiliateDashboardItemKind.ActionExecuted;
}

function renderDashboardItemPrimaryBadge(
  item: DashboardItem,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (item.statusLabel) {
    return t(`ecommerce.affiliateWorkspace.statusLabels.${item.statusLabel}`, {
      defaultValue: item.statusLabel,
    });
  }
  return t(`ecommerce.affiliateWorkspace.itemKinds.${item.kind}`, {
    defaultValue: item.kind,
  });
}

function ActionProposalCard({
  proposal,
  shopLabel,
  decidingProposal,
  onOpenCollaboration,
  onOpenCreator,
  onApprove,
  onReject,
}: {
  proposal: GQL.ActionProposal;
  shopLabel: string;
  decidingProposal: boolean;
  onOpenCollaboration: (item: CollaborationDetailItem) => void;
  onOpenCreator: (profile: GQL.CreatorGlobalProfile) => void;
  onApprove: (proposal: GQL.ActionProposal) => Promise<void>;
  onReject: (proposal: GQL.ActionProposal) => Promise<void>;
}) {
  const { t } = useTranslation();
  const creatorName = proposal.creatorProfile
    ? creatorPrimaryName(proposal.creatorProfile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : t("ecommerce.affiliateWorkspace.unknownCreator");
  const creatorHandle = proposal.creatorProfile ? creatorTikTokHandle(proposal.creatorProfile) : null;
  const creatorPlatformId = proposal.creatorProfile ? creatorPlatformIdentity(proposal.creatorProfile) : null;
  const recommendationTitle = renderProposalRecommendationTitle(proposal, t);
  const executionDescription = renderProposalExecutionDescription(proposal, t);
  const messagePreview = getProposalMessagePreview(proposal);
  const canDecide = proposal.status === GQL.ActionProposalStatus.Pending;
  const detailItem = detailItemFromProposal(proposal);

  return (
    <article
      className={`affiliate-work-item-card affiliate-work-item-needs_attention${detailItem ? " affiliate-work-item-clickable" : ""}`}
      role={detailItem ? "button" : undefined}
      tabIndex={detailItem ? 0 : undefined}
      onClick={() => {
        if (detailItem) onOpenCollaboration(detailItem);
      }}
      onKeyDown={(event) => {
        if (!detailItem) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenCollaboration(detailItem);
        }
      }}
    >
      <div className="affiliate-work-item-head">
        <div className="affiliate-creator-block">
          <div className="affiliate-avatar" aria-hidden="true">
            {creatorName.slice(0, 1).toUpperCase()}
          </div>
          <div className="affiliate-creator-text">
            <CreatorName
              name={creatorName}
              onOpen={proposal.creatorProfile ? () => onOpenCreator(proposal.creatorProfile as GQL.CreatorGlobalProfile) : undefined}
            />
            <CreatorPlatformId
              handle={creatorHandle}
              platformId={creatorPlatformId}
            />
            <div className="affiliate-work-item-meta">
              <span>{shopLabel}</span>
              <span>{formatProposalTime(proposal.updatedAt)}</span>
              <DebugIdCopy value={proposal.id} />
            </div>
          </div>
        </div>
        <div className="affiliate-work-item-badges">
          <span className={`affiliate-kind-badge affiliate-kind-${proposal.status.toLowerCase()}`}>
            {t(`ecommerce.affiliateWorkspace.proposalFilters.${proposal.status}`, {
              defaultValue: proposal.status,
            })}
          </span>
        </div>
      </div>

      <div className="affiliate-work-item-body">
        <section className="affiliate-card-section affiliate-card-section-primary">
          <div className="affiliate-card-section-label">
            {t("ecommerce.affiliateWorkspace.labels.aiRecommendation")}
          </div>
          <div className="affiliate-card-section-title">{recommendationTitle}</div>
          {proposal.operatorSummary ? (
            <div className="affiliate-card-section-copy">{proposal.operatorSummary}</div>
          ) : null}
        </section>
        <ProposalProductSummary
          proposal={proposal}
          label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
        />
        {executionDescription ? (
          <section className="affiliate-card-section affiliate-card-execution-section">
            <div className="affiliate-card-section-label">
              {t("ecommerce.affiliateWorkspace.labels.whatWillHappen")}
            </div>
            <div className="affiliate-card-section-copy">{executionDescription}</div>
            {messagePreview ? (
              <div className="affiliate-work-item-preview">{messagePreview}</div>
            ) : null}
          </section>
        ) : null}
        {proposal.policySnapshot?.requiresApproval ? (
          <div className="affiliate-policy-note">
            {t("ecommerce.affiliateWorkspace.policyApprovalNote")}
          </div>
        ) : null}
      </div>

      {canDecide ? (
        <div className="affiliate-work-item-actions">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={decidingProposal}
            onClick={(event) => {
              event.stopPropagation();
              void onReject(proposal);
            }}
          >
            {t("common.reject", { defaultValue: "Reject" })}
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={decidingProposal}
            onClick={(event) => {
              event.stopPropagation();
              void onApprove(proposal);
            }}
          >
            {t("common.approve", { defaultValue: "Approve" })}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function DashboardItemCard({
  item,
  shopLabel,
  decidingProposal,
  onOpenCollaboration,
  onOpenCreator,
  onApprove,
  onReject,
}: {
  item: DashboardItem;
  shopLabel: string;
  decidingProposal: boolean;
  onOpenCollaboration: (item: CollaborationDetailItem) => void;
  onOpenCreator: (profile: GQL.CreatorGlobalProfile) => void;
  onApprove: (proposal: GQL.ActionProposal) => Promise<void>;
  onReject: (proposal: GQL.ActionProposal) => Promise<void>;
}) {
  const { t } = useTranslation();
  const proposal = item.proposal ?? null;
  const creatorName = item.creatorProfile
    ? creatorPrimaryName(item.creatorProfile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : t("ecommerce.affiliateWorkspace.unknownCreator");
  const creatorHandle = item.creatorProfile ? creatorTikTokHandle(item.creatorProfile) : null;
  const creatorPlatformId = item.creatorProfile ? creatorPlatformIdentity(item.creatorProfile) : null;
  const recommendationTitle = proposal
    ? renderProposalRecommendationTitle(proposal, t)
    : renderCollaborationWorkTitle({
        processReasons: item.collaborationRecord?.processReasons ?? [],
        sampleApplicationRecord: item.sampleApplicationRecord ?? null,
        fallback: item.title || item.summary,
        t,
      });
  const recommendationCopy = proposal?.operatorSummary || item.summary || "";
  const executionDescription = proposal
    ? renderProposalExecutionDescription(proposal, t)
    : renderCollaborationSituation({
        sampleApplicationRecord: item.sampleApplicationRecord ?? null,
        lifecycleEventType: item.lifecycleEventType ?? null,
        fallback: item.summary,
        t,
      });
  const messagePreview = proposal ? getProposalMessagePreview(proposal) : null;
  const canDecide = proposal?.status === GQL.ActionProposalStatus.Pending;
  const detailItem = detailItemFromDashboard(item);

  return (
    <article
      className={`affiliate-work-item-card affiliate-work-item-${item.section.toLowerCase()}${detailItem ? " affiliate-work-item-clickable" : ""}`}
      role={detailItem ? "button" : undefined}
      tabIndex={detailItem ? 0 : undefined}
      onClick={() => {
        if (detailItem) onOpenCollaboration(detailItem);
      }}
      onKeyDown={(event) => {
        if (!detailItem) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenCollaboration(detailItem);
        }
      }}
    >
      <div className="affiliate-work-item-head">
        <div className="affiliate-creator-block">
          <div className="affiliate-avatar" aria-hidden="true">
            {creatorName.slice(0, 1).toUpperCase()}
          </div>
          <div className="affiliate-creator-text">
            <CreatorName
              name={creatorName}
              onOpen={item.creatorProfile ? () => onOpenCreator(item.creatorProfile as GQL.CreatorGlobalProfile) : undefined}
            />
            <CreatorPlatformId
              handle={creatorHandle}
              platformId={creatorPlatformId}
            />
            <div className="affiliate-work-item-meta">
              <span>{shopLabel}</span>
              <span>{formatProposalTime(item.updatedAt)}</span>
              <DebugIdCopy value={item.proposalId ?? item.collaborationRecordId ?? item.id} />
            </div>
          </div>
        </div>
        <div className="affiliate-work-item-badges">
          <span className={`affiliate-kind-badge affiliate-kind-${item.kind.toLowerCase()}`}>
            {renderDashboardItemPrimaryBadge(item, t)}
          </span>
        </div>
      </div>

      <div className="affiliate-work-item-body">
        <section className="affiliate-card-section affiliate-card-section-primary">
          <div className="affiliate-card-section-label">
            {proposal
              ? t("ecommerce.affiliateWorkspace.labels.aiRecommendation")
              : t("ecommerce.affiliateWorkspace.labels.needsYourAction")}
          </div>
          <div className="affiliate-card-section-title">{recommendationTitle}</div>
          {recommendationCopy ? (
            <div className="affiliate-card-section-copy">{recommendationCopy}</div>
          ) : null}
        </section>
        <ProductContextSummary
          item={item}
          label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
        />
        {executionDescription ? (
          <section className="affiliate-card-section affiliate-card-execution-section">
            <div className="affiliate-card-section-label">
              {proposal
                ? t("ecommerce.affiliateWorkspace.labels.whatWillHappen")
                : t("ecommerce.affiliateWorkspace.labels.currentSituation")}
            </div>
            <div className="affiliate-card-section-copy">{executionDescription}</div>
            {messagePreview ? (
              <div className="affiliate-work-item-preview">{messagePreview}</div>
            ) : null}
          </section>
        ) : null}
        {proposal?.policySnapshot?.requiresApproval ? (
          <div className="affiliate-policy-note">
            {t("ecommerce.affiliateWorkspace.policyApprovalNote")}
          </div>
        ) : null}
        {item.kind === GQL.AffiliateDashboardItemKind.ManualFollowUp ? (
          <div className="affiliate-manual-note">
            {t("ecommerce.affiliateWorkspace.manualFollowUpNote")}
          </div>
        ) : null}
      </div>

      {canDecide ? (
        <div className="affiliate-work-item-actions">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={decidingProposal}
            onClick={(event) => {
              event.stopPropagation();
              void onReject(proposal);
            }}
          >
            {t("common.reject", { defaultValue: "Reject" })}
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={decidingProposal}
            onClick={(event) => {
              event.stopPropagation();
              void onApprove(proposal);
            }}
          >
            {t("common.approve", { defaultValue: "Approve" })}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ProductContextSummary({ item, label }: { item: DashboardItem; label?: string }) {
  const product = item.productSummary;
  const productId =
    item.collaborationRecord?.productId ??
    item.sampleApplicationRecord?.productId ??
    getProposalActionProductId(item.proposal ?? null);
  return <ProductSummaryCard product={product} productId={productId} shopId={item.shopId} label={label} />;
}

function ProposalProductSummary({ proposal, label }: { proposal: GQL.ActionProposal; label?: string }) {
  const productId = proposal.collaborationRecord?.productId ?? getProposalActionProductId(proposal);
  return (
    <ProductSummaryCard
      product={proposal.productSummary ?? null}
      productId={productId}
      shopId={proposal.shopId}
      label={label}
    />
  );
}

function detailItemFromDashboard(item: DashboardItem): CollaborationDetailItem | null {
  if (!item.collaborationRecord) return null;
  return {
    collaborationRecord: item.collaborationRecord,
    creatorProfile: item.creatorProfile ?? null,
    productSummary: item.productSummary ?? null,
    latestProposal: item.proposal ?? null,
    latestLifecycleEvent: null,
  };
}

function detailItemFromProposal(proposal: GQL.ActionProposal): CollaborationDetailItem | null {
  if (!proposal.collaborationRecord) return null;
  return {
    collaborationRecord: proposal.collaborationRecord,
    creatorProfile: proposal.creatorProfile ?? null,
    productSummary: proposal.productSummary ?? null,
    latestProposal: proposal,
    latestLifecycleEvent: null,
  };
}

function CreatorName({ name, onOpen }: { name: string; onOpen?: () => void }) {
  const { t } = useTranslation();
  function openCreator(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onOpen?.();
  }

  return (
    <button
      className="affiliate-creator-name"
      type="button"
      title={onOpen ? t("ecommerce.affiliateWorkspace.openCreatorDetail") : name}
      onClick={openCreator}
      disabled={!onOpen}
    >
      {name}
    </button>
  );
}

function CreatorDetailModal({
  profile,
  onClose,
}: {
  profile: GQL.CreatorGlobalProfile;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const name = creatorPrimaryName(profile, t("ecommerce.affiliateWorkspace.unknownCreator"));
  const handle = creatorTikTokHandle(profile);
  const platformId = creatorPlatformIdentity(profile);
  const marketplace = parseMarketplaceCreatorSnapshot(profile.marketplaceSnapshotJson);
  const marketplaceMetrics = buildMarketplaceMetricRows(marketplace, t);
  const categorySummary = profile.categoryIds?.length
    ? profile.categoryIds.slice(0, 8).join(", ")
    : null;

  return (
    <div className="modal-backdrop affiliate-creator-detail-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-content affiliate-creator-detail-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header affiliate-creator-detail-header">
          <div className="affiliate-creator-detail-identity">
            {profile.avatarUrl ? (
              <img className="affiliate-creator-detail-avatar" src={profile.avatarUrl} alt="" />
            ) : (
              <div className="affiliate-creator-detail-avatar affiliate-creator-detail-avatar-empty" aria-hidden="true">
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h2>{name}</h2>
              {handle ? <p>{handle}</p> : null}
            </div>
          </div>
          <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <div className="affiliate-creator-detail-grid">
          <CreatorDetailMetric
            label={t("ecommerce.affiliateWorkspace.creatorDetail.followers")}
            value={formatCount(profile.followerCount)}
          />
          <CreatorDetailMetric
            label={t("ecommerce.affiliateWorkspace.creatorDetail.platform")}
            value={t(`platforms.${profile.platform}`, { defaultValue: profile.platform })}
          />
          <CreatorDetailMetric
            label={t("ecommerce.affiliateWorkspace.creatorDetail.lastUpdated")}
            value={profile.updatedAt ? formatProposalTime(profile.updatedAt) : null}
          />
        </div>

        <div className="affiliate-creator-detail-section">
          <div className="affiliate-card-section-label">
            {t("ecommerce.affiliateWorkspace.creatorDetail.marketplacePerformance")}
          </div>
          {marketplaceMetrics.length ? (
            <div className="affiliate-creator-detail-grid affiliate-creator-detail-performance-grid">
              {marketplaceMetrics.map((metric) => (
                <CreatorDetailMetric key={metric.label} label={metric.label} value={metric.value} />
              ))}
            </div>
          ) : (
            <div className="affiliate-creator-detail-copy">
              {t("ecommerce.affiliateWorkspace.creatorDetail.noMarketplacePerformance")}
            </div>
          )}
        </div>

        <div className="affiliate-creator-detail-section">
          <div className="affiliate-card-section-label">
            {t("ecommerce.affiliateWorkspace.creatorDetail.identifiers")}
          </div>
          <div className="affiliate-creator-detail-id-list">
            {handle ? (
              <CreatorDetailCopyRow
                label={t("ecommerce.affiliateWorkspace.creatorDetail.tiktokHandle")}
                value={handle}
              />
            ) : null}
            {platformId ? (
              <CreatorDetailCopyRow
                label={t("ecommerce.affiliateWorkspace.creatorPlatformIdLabel")}
                value={platformId}
              />
            ) : null}
          </div>
        </div>

        <div className="affiliate-creator-detail-section">
          <div className="affiliate-card-section-label">
            {t("ecommerce.affiliateWorkspace.creatorDetail.creatorSignals")}
          </div>
          <div className="affiliate-creator-detail-copy">
            {categorySummary
              ? t("ecommerce.affiliateWorkspace.creatorDetail.categorySummary", { categories: categorySummary })
              : t("ecommerce.affiliateWorkspace.creatorDetail.noSignals")}
          </div>
        </div>
      </div>
    </div>
  );
}

type MarketplaceCreatorSnapshot = Record<string, unknown>;

function parseMarketplaceCreatorSnapshot(value: string | null | undefined): MarketplaceCreatorSnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as MarketplaceCreatorSnapshot) : null;
  } catch {
    return null;
  }
}

function buildMarketplaceMetricRows(
  snapshot: MarketplaceCreatorSnapshot | null,
  t: ReturnType<typeof useTranslation>["t"],
): Array<{ label: string; value: string }> {
  if (!snapshot) return [];
  const rows: Array<{ label: string; value: string | null }> = [
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.totalGmv"),
      value: readMoneyOrRange(snapshot, "gmv", "gmvRange"),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.videoGmv"),
      value: readMoneyOrRange(snapshot, "videoGmv", "videoGmvRange"),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.liveGmv"),
      value: readMoneyOrRange(snapshot, "liveGmv", "liveGmvRange"),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.gpm"),
      value: readMoneyOrRange(snapshot, "gpm", "gpmRange"),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.unitsSold"),
      value: readCountOrRange(snapshot, "unitsSold", "unitsSoldRange"),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.promotedProducts"),
      value: formatCount(readNumber(snapshot, "promotedProductNum")),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.ecVideos"),
      value: formatCount(readNumber(snapshot, "ecVideoCount")),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.ecLives"),
      value: formatCount(readNumber(snapshot, "ecLiveCount")),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.avgVideoViews"),
      value: formatCount(readNumber(snapshot, "avgEcVideoViewCount") ?? readNumber(snapshot, "avgEcVideoPlayCount")),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.rating"),
      value: readString(snapshot, "rating"),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.pps"),
      value: readString(snapshot, "pps"),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.postRate"),
      value: formatScaledPercent(readString(snapshot, "postRate")),
    },
  ];
  return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
}

function readMoneyOrRange(
  snapshot: MarketplaceCreatorSnapshot,
  moneyKey: string,
  rangeKey: string,
): string | null {
  const money = readObject(snapshot, moneyKey);
  const amount = readString(money, "amount");
  const currency = readString(money, "currency");
  if (amount) return formatCreatorMoney(amount, currency);

  const range = readObject(snapshot, rangeKey);
  const formattedRange = readString(range, "formattedRange") ?? readString(range, "formatted_range");
  if (formattedRange) return formattedRange;
  const min = readString(range, "minimumAmount") ?? readString(range, "minimum_amount");
  const max = readString(range, "maximumAmount") ?? readString(range, "maximum_amount");
    const rangeCurrency = readString(range, "currency");
    if (min && max) {
    const minText = formatCreatorMoney(min, rangeCurrency) ?? min;
    const maxText = formatCreatorMoney(max, rangeCurrency) ?? max;
    return `${minText} - ${maxText}`;
  }
  return null;
}

function formatCreatorMoney(amount: string | null | undefined, currency?: string | null): string | null {
  if (!amount) return null;
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || !currency) return amount;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    }).format(numeric);
  } catch {
    return `${currency} ${amount}`;
  }
}

function readCountOrRange(
  snapshot: MarketplaceCreatorSnapshot,
  countKey: string,
  rangeKey: string,
): string | null {
  const count = readNumber(snapshot, countKey);
  if (count != null) return formatCount(count);
  const range = readObject(snapshot, rangeKey);
  const formattedRange = readString(range, "formattedRange") ?? readString(range, "formatted_range");
  if (formattedRange) return formattedRange;
  const min = readNumber(range, "minimumAmount") ?? readNumber(range, "minimum_amount");
  const max = readNumber(range, "maximumAmount") ?? readNumber(range, "maximum_amount");
  if (min != null && max != null) return `${formatCount(min)} - ${formatCount(max)}`;
  return null;
}

function readObject(value: unknown, key: string): MarketplaceCreatorSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === "object" ? (child as MarketplaceCreatorSnapshot) : null;
}

function readString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null;
  const child = (value as Record<string, unknown>)[key];
  if (typeof child === "string" && child.trim()) return child.trim();
  if (typeof child === "number" && Number.isFinite(child)) return String(child);
  return null;
}

function readNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null;
  const child = (value as Record<string, unknown>)[key];
  if (typeof child === "number" && Number.isFinite(child)) return child;
  if (typeof child === "string") {
    const parsed = Number(child);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatScaledPercent(value: string | null): string | null {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return `${(numeric / 100).toFixed(1)}%`;
}

function CreatorDetailMetric({ label, value }: { label: string; value?: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="affiliate-creator-detail-metric">
      <span>{label}</span>
      <strong>{value || t("ecommerce.affiliateWorkspace.creatorDetail.unknown")}</strong>
    </div>
  );
}

function CreatorDetailCopyRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`affiliate-creator-detail-id-row${muted ? " affiliate-creator-detail-id-row-muted" : ""}`}>
      <span>{label}</span>
      <CopyInlineValue
        value={value}
        className="affiliate-creator-detail-copy-button"
        copiedMessageKey="ecommerce.affiliateWorkspace.creatorPlatformIdCopied"
        copyLabelKey="ecommerce.affiliateWorkspace.copyCreatorPlatformId"
      />
    </div>
  );
}

function CreatorPlatformId({
  handle,
  platformId,
}: {
  handle: string | null;
  platformId: string | null;
}) {
  const { t } = useTranslation();
  const value = handle ?? platformId;
  if (!value) return null;
  return (
    <span className="affiliate-creator-platform-row">
      <span className="affiliate-creator-platform-label">
        {handle ? "TikTok" : t("ecommerce.affiliateWorkspace.creatorPlatformIdLabel")}
      </span>
      <CopyInlineValue
        value={value}
        className="affiliate-creator-platform-value"
        copiedMessageKey="ecommerce.affiliateWorkspace.creatorPlatformIdCopied"
        copyLabelKey="ecommerce.affiliateWorkspace.copyCreatorPlatformId"
      />
    </span>
  );
}

function DebugIdCopy({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <CopyInlineValue
      value={value}
      className="affiliate-debug-id-copy"
      iconOnly
      copiedMessageKey="ecommerce.affiliateWorkspace.debugIdCopied"
      copyLabelKey="ecommerce.affiliateWorkspace.copyDebugId"
    />
  );
}

function CopyInlineValue({
  value,
  className,
  iconOnly,
  copiedMessageKey,
  copyLabelKey,
}: {
  value: string;
  className: string;
  iconOnly?: boolean;
  copiedMessageKey: string;
  copyLabelKey: string;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  async function copyValue(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(t("ecommerce.affiliateWorkspace.copyFailed"));
      }
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showToast(t(copiedMessageKey), "success");
      window.setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.affiliateWorkspace.copyFailed"), "error");
    }
  }

  return (
    <button
      className={className}
      type="button"
      onClick={copyValue}
      onKeyDown={(event) => event.stopPropagation()}
      aria-label={t(copyLabelKey)}
      title={copied ? t(copiedMessageKey) : t(copyLabelKey)}
    >
      {iconOnly ? null : <span>{value}</span>}
      <CopyIcon />
    </button>
  );
}

function creatorPrimaryName(profile: GQL.CreatorGlobalProfile, fallback: string): string {
  const nickname = profile.nickname?.trim();
  const username = normalizeTikTokUsername(profile.username);
  if (nickname) return nickname;
  if (username) return `@${username}`;
  return fallback;
}

function creatorTikTokHandle(profile: GQL.CreatorGlobalProfile): string | null {
  const username = normalizeTikTokUsername(profile.username);
  if (!username) return null;
  const nickname = profile.nickname?.trim();
  if (!nickname || nickname === username || nickname === `@${username}`) return null;
  return `@${username}`;
}

function creatorPlatformIdentity(profile: GQL.CreatorGlobalProfile): string | null {
  return profile.creatorOpenId || profile.creatorImId || null;
}

function normalizeTikTokUsername(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^@+/, "");
}

function getProposalActionProductId(proposal: GQL.ActionProposal | null): string | null {
  if (!proposal) return null;
  const directProductId = proposal.messageIntent?.productId
    ?? proposal.campaignProductUpdateIntent?.productId
    ?? null;
  if (directProductId) return directProductId;
  for (const step of proposal.steps ?? []) {
    const stepProductId = step.messageIntent?.productId
      ?? step.campaignProductUpdateIntent?.productId
      ?? null;
    if (stepProductId) return stepProductId;
  }
  return null;
}

function formatProposalTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatCount(value?: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10000 ? 1 : 0,
  }).format(value);
}

function renderProposalRecommendationTitle(
  proposal: GQL.ActionProposal,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (proposal.type === GQL.ActionProposalType.ReviewSampleApplication) {
    const decision = proposal.sampleReviewIntent?.decision;
    if (decision === GQL.AffiliateSampleReviewDecision.Approve) {
      return t("ecommerce.affiliateWorkspace.proposalRecommendationTitles.APPROVE_SAMPLE_REQUEST");
    }
    if (decision === GQL.AffiliateSampleReviewDecision.Reject) {
      return t("ecommerce.affiliateWorkspace.proposalRecommendationTitles.REJECT_SAMPLE_REQUEST");
    }
    return t("ecommerce.shopDrawer.affiliate.proposalTypes.REVIEW_SAMPLE_APPLICATION");
  }
  if (proposal.type === GQL.ActionProposalType.SendMessage) {
    return t("ecommerce.affiliateWorkspace.proposalRecommendationTitles.SEND_MESSAGE");
  }
  if (proposal.type === GQL.ActionProposalType.CreateTargetCollaboration) {
    return t("ecommerce.affiliateWorkspace.proposalRecommendationTitles.CREATE_TARGET_COLLABORATION");
  }
  return t(`ecommerce.shopDrawer.affiliate.proposalTypes.${proposal.type}`, {
    defaultValue: proposal.type,
  });
}

function renderProposalExecutionDescription(
  proposal: GQL.ActionProposal,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (proposal.type === GQL.ActionProposalType.ReviewSampleApplication) {
    const decision = proposal.sampleReviewIntent?.decision;
    if (decision === GQL.AffiliateSampleReviewDecision.Approve) {
      return t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.APPROVE_SAMPLE_REQUEST");
    }
    if (decision === GQL.AffiliateSampleReviewDecision.Reject) {
      return t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.REJECT_SAMPLE_REQUEST");
    }
    return t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.REVIEW_SAMPLE_REQUEST");
  }
  if (proposal.type === GQL.ActionProposalType.SendMessage) {
    return t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.SEND_MESSAGE");
  }
  if (proposal.type === GQL.ActionProposalType.CreateTargetCollaboration) {
    return t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.CREATE_TARGET_COLLABORATION");
  }
  return renderProposalPreview(proposal, t);
}

function getProposalMessagePreview(proposal: GQL.ActionProposal): string | null {
  const directText = proposal.messageIntent?.text?.trim();
  if (directText) return directText;
  for (const step of proposal.steps ?? []) {
    const text = step.messageIntent?.text?.trim();
    if (text) return text;
  }
  return null;
}

function buildCollaborationWorkView(
  record: GQL.AffiliateCollaborationRecord,
  latestProposal: GQL.ActionProposal | null | undefined,
  t: ReturnType<typeof useTranslation>["t"],
): CollaborationWorkViewModel {
  const stage = t(`ecommerce.affiliateWorkspace.lifecycleStages.${record.lifecycleStage}`, {
    defaultValue: record.lifecycleStage,
  });
  const proposalRejected = latestProposal?.status === GQL.ActionProposalStatus.Rejected;
  const proposalPending = latestProposal?.status === GQL.ActionProposalStatus.Pending;

  if (record.processingStatus === GQL.AffiliateCollaborationRecordProcessingStatus.Blocked) {
    return {
      badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.blocked"),
      badgeTone: "blocked",
      stage,
      ownerLabel: t("ecommerce.affiliateWorkspace.labels.currentSituation"),
      title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.BLOCKED"),
      description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.BLOCKED"),
    };
  }

  if (record.processingStatus === GQL.AffiliateCollaborationRecordProcessingStatus.Done) {
    return {
      badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.done"),
      badgeTone: "done",
      stage,
      ownerLabel: t("ecommerce.affiliateWorkspace.labels.currentSituation"),
      title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.DONE"),
      description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.DONE"),
    };
  }

  if (proposalRejected) {
    return {
      badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.staff"),
      badgeTone: "attention",
      stage,
      ownerLabel: t("ecommerce.affiliateWorkspace.labels.needsYourAction"),
      title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.PROPOSAL_REJECTED"),
      description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.PROPOSAL_REJECTED"),
    };
  }

  if (
    proposalPending ||
    record.processingStatus === GQL.AffiliateCollaborationRecordProcessingStatus.WaitingApproval ||
    record.requiredAction === GQL.AffiliateCollaborationRequiredAction.ReviewActionProposal
  ) {
    return {
      badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.approval"),
      badgeTone: "attention",
      stage,
      ownerLabel: t("ecommerce.affiliateWorkspace.labels.needsYourAction"),
      title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.REVIEW_ACTION_PROPOSAL"),
      description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.REVIEW_ACTION_PROPOSAL"),
    };
  }

  switch (record.requiredAction) {
    case GQL.AffiliateCollaborationRequiredAction.RespondToCreator:
      return {
        badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.agent"),
        badgeTone: "attention",
        stage,
        ownerLabel: t("ecommerce.affiliateWorkspace.labels.nextStep"),
        title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.RESPOND_TO_CREATOR"),
        description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.RESPOND_TO_CREATOR"),
      };
    case GQL.AffiliateCollaborationRequiredAction.ReviewSampleApplication:
      return {
        badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.agent"),
        badgeTone: "attention",
        stage,
        ownerLabel: t("ecommerce.affiliateWorkspace.labels.nextStep"),
        title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.SAMPLE_PENDING_REVIEW"),
        description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.REVIEW_SAMPLE_APPLICATION"),
      };
    case GQL.AffiliateCollaborationRequiredAction.ShipSample:
      return {
        badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.staff"),
        badgeTone: "attention",
        stage,
        ownerLabel: t("ecommerce.affiliateWorkspace.labels.needsYourAction"),
        title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.SAMPLE_AWAITING_SHIPMENT"),
        description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.SHIP_SAMPLE"),
      };
    case GQL.AffiliateCollaborationRequiredAction.FollowUpContent:
      return {
        badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.agent"),
        badgeTone: "attention",
        stage,
        ownerLabel: t("ecommerce.affiliateWorkspace.labels.nextStep"),
        title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.SAMPLE_SHIPPED_CONTENT_FOLLOW_UP_DUE"),
        description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.FOLLOW_UP_CONTENT"),
      };
    case GQL.AffiliateCollaborationRequiredAction.ReviewAgentFailure:
      return {
        badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.staff"),
        badgeTone: "attention",
        stage,
        ownerLabel: t("ecommerce.affiliateWorkspace.labels.needsYourAction"),
        title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.AGENT_RUN_FAILED"),
        description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.REVIEW_AGENT_FAILURE"),
      };
    case GQL.AffiliateCollaborationRequiredAction.ResolveCreatorIdentity:
      return {
        badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.staff"),
        badgeTone: "attention",
        stage,
        ownerLabel: t("ecommerce.affiliateWorkspace.labels.needsYourAction"),
        title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.CREATOR_IDENTITY_UNRESOLVED"),
        description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.RESOLVE_CREATOR_IDENTITY"),
      };
    case GQL.AffiliateCollaborationRequiredAction.ReviewCollaboration:
      return {
        badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.staff"),
        badgeTone: "attention",
        stage,
        ownerLabel: t("ecommerce.affiliateWorkspace.labels.needsYourAction"),
        title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.STAFF_REVIEW_REQUESTED"),
        description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.REVIEW_COLLABORATION"),
      };
    case GQL.AffiliateCollaborationRequiredAction.None:
    default:
      break;
  }

  if (record.processingStatus === GQL.AffiliateCollaborationRecordProcessingStatus.WaitingCreator) {
    return {
      badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.waitingCreator"),
      badgeTone: "waiting",
      stage,
      ownerLabel: t("ecommerce.affiliateWorkspace.labels.currentSituation"),
      title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.WAITING_CREATOR"),
      description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.WAITING_CREATOR"),
    };
  }

  if (record.processingStatus === GQL.AffiliateCollaborationRecordProcessingStatus.WaitingPlatform) {
    return {
      badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.waitingPlatform"),
      badgeTone: "waiting",
      stage,
      ownerLabel: t("ecommerce.affiliateWorkspace.labels.currentSituation"),
      title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.WAITING_PLATFORM"),
      description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.WAITING_PLATFORM"),
    };
  }

  return {
    badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.staff"),
    badgeTone: "attention",
    stage,
    ownerLabel: t("ecommerce.affiliateWorkspace.labels.needsYourAction"),
    title: renderCollaborationWorkTitle({
      processReasons: record.processReasons,
      fallback: latestProposal?.operatorSummary,
      t,
    }),
    description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.DEFAULT"),
  };
}

function renderCollaborationWorkTitle({
  processReasons,
  sampleApplicationRecord,
  fallback,
  t,
}: {
  processReasons: GQL.AffiliateCollaborationRecordProcessReason[];
  sampleApplicationRecord?: GQL.SampleApplicationRecord | null;
  fallback?: string | null;
  t: ReturnType<typeof useTranslation>["t"];
}): string {
  if (sampleApplicationRecord?.sampleWorkStatus === GQL.SampleWorkStatus.RequestPendingReview) {
    return t("ecommerce.affiliateWorkspace.collaborationWorkTitles.SAMPLE_REVIEW");
  }
  const priority = [
    GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply,
    GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview,
    GQL.AffiliateCollaborationRecordProcessReason.SampleAwaitingShipment,
    GQL.AffiliateCollaborationRecordProcessReason.SampleShippedContentFollowUpDue,
    GQL.AffiliateCollaborationRecordProcessReason.CreatorIdentityUnresolved,
    GQL.AffiliateCollaborationRecordProcessReason.AgentRunFailed,
    GQL.AffiliateCollaborationRecordProcessReason.StaffReviewRequested,
  ];
  const reason = priority.find((candidate) => processReasons.includes(candidate));
  if (reason) {
    return t(`ecommerce.affiliateWorkspace.collaborationWorkTitles.${reason}`, {
      defaultValue: t(`ecommerce.affiliateWorkspace.processReasons.${reason}`, {
        defaultValue: reason,
      }),
    });
  }
  return fallback || t("ecommerce.affiliateWorkspace.collaborationWorkTitles.DEFAULT");
}

function renderCollaborationSituation({
  sampleApplicationRecord,
  lifecycleEventType,
  fallback,
  t,
}: {
  sampleApplicationRecord?: GQL.SampleApplicationRecord | null;
  lifecycleEventType?: string | null;
  fallback?: string | null;
  t: ReturnType<typeof useTranslation>["t"];
}): string {
  if (sampleApplicationRecord) {
    const statusDescription = t(
      `ecommerce.affiliateWorkspace.sampleWorkStatusDescriptions.${sampleApplicationRecord.sampleWorkStatus}`,
      {
        defaultValue: t("ecommerce.affiliateWorkspace.sampleWorkStatusDescriptions.DEFAULT"),
      },
    );
    return t("ecommerce.affiliateWorkspace.sampleSituationPreview", {
      statusDescription,
      contentCount: sampleApplicationRecord.observedContentCount,
    });
  }
  if (lifecycleEventType) {
    return t("ecommerce.affiliateWorkspace.lifecycleEventPreview", {
      eventType: t(`ecommerce.affiliateWorkspace.lifecycleEvents.${lifecycleEventType}`, {
        defaultValue: lifecycleEventType,
      }),
    });
  }
  return fallback ?? "";
}

function renderNonProposalPreview(
  item: DashboardItem,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (item.sampleApplicationRecord) {
    return renderCollaborationSituation({
      sampleApplicationRecord: item.sampleApplicationRecord,
      lifecycleEventType: item.lifecycleEventType ?? null,
      fallback: item.summary,
      t,
    });
  }
  if (item.lifecycleEventType) {
    return t("ecommerce.affiliateWorkspace.lifecycleEventPreview", {
      eventType: item.lifecycleEventType,
    });
  }
  return item.summary ?? "";
}

function renderProposalPreview(
  proposal: GQL.ActionProposal,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (proposal.messageIntent) {
    const text = proposal.messageIntent.text?.trim();
    if (text) return text;
    return t("ecommerce.shopDrawer.affiliate.messageIntentFallback", {
      type: proposal.messageIntent.messageType,
    });
  }
  if (proposal.sampleReviewIntent) {
    return t("ecommerce.shopDrawer.affiliate.sampleReviewPreview", {
      decision: t(`ecommerce.shopDrawer.affiliate.sampleReviewDecisions.${proposal.sampleReviewIntent.decision}`, {
        defaultValue: proposal.sampleReviewIntent.decision,
      }),
      applicationId: proposal.sampleReviewIntent.platformApplicationId,
    });
  }
  if (proposal.sampleShipmentIntent) {
    return t("ecommerce.shopDrawer.affiliate.sampleShipmentPreview", {
      applicationId: proposal.sampleShipmentIntent.platformApplicationId
        ?? proposal.sampleShipmentIntent.sampleApplicationRecordId,
      quantity: proposal.sampleShipmentIntent.quantity ?? 1,
    });
  }
  if (proposal.targetCollaborationIntent) {
    return t("ecommerce.shopDrawer.affiliate.targetCollaborationPreview", {
      name: proposal.targetCollaborationIntent.name,
      count: proposal.targetCollaborationIntent.products.length,
    });
  }
  if (proposal.blockCreatorIntent) {
    return t("ecommerce.shopDrawer.affiliate.blockCreatorPreview", {
      creatorId: proposal.blockCreatorIntent.creatorId,
    });
  }
  if (proposal.creatorTagIntent) {
    return t("ecommerce.shopDrawer.affiliate.creatorTagPreview", {
      creatorId: proposal.creatorTagIntent.creatorId,
      tagId: proposal.creatorTagIntent.tagId,
    });
  }
  if (proposal.campaignProductUpdateIntent) {
    return t("ecommerce.shopDrawer.affiliate.campaignProductPreview", {
      productId: proposal.campaignProductUpdateIntent.productId,
    });
  }
  if (proposal.approvalPolicyUpdateIntent) {
    return t("ecommerce.shopDrawer.affiliate.approvalPolicyPreview", {
      action: proposal.approvalPolicyUpdateIntent.action,
    });
  }
  if (proposal.candidateDecisionIntent) {
    return t("ecommerce.shopDrawer.affiliate.candidateDecisionPreview", {
      count: proposal.candidateDecisionIntent.candidateIds.length,
      status: proposal.candidateDecisionIntent.status,
    });
  }
  return proposal.operatorSummary;
}

function renderProposalActivityDetail(
  proposal: GQL.ActionProposal,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const lines = [renderProposalPreview(proposal, t)].filter(Boolean);
  if (proposal.decision?.note) {
    lines.push(t("ecommerce.affiliateWorkspace.activity.staffDecision", {
      note: proposal.decision.note,
    }));
  }
  if (proposal.executionResult?.executedAt) {
    lines.push(t("ecommerce.affiliateWorkspace.activity.executedAt", {
      time: formatProposalTime(proposal.executionResult.executedAt),
    }));
  }
  if (proposal.executionResult?.errorMessage) {
    lines.push(t("ecommerce.affiliateWorkspace.activity.executionFailed", {
      error: proposal.executionResult.errorMessage,
    }));
  }
  return lines.join("\n");
}
