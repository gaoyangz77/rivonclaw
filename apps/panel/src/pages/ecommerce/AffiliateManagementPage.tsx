import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useMutation, useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../components/inputs/Select.js";
import { useToast } from "../../components/Toast.js";
import { CopyIcon } from "../../components/icons.js";
import { panelEventBus } from "../../lib/event-bus.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import {
  AFFILIATE_ACTION_PROPOSALS_QUERY,
  AFFILIATE_COLLABORATION_ACTIVITY_QUERY,
  AFFILIATE_COLLABORATION_RECORD_ITEMS_QUERY,
  AFFILIATE_ML_INSIGHTS_QUERY,
  DECIDE_ACTION_PROPOSAL_MUTATION,
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
  "IN_PROGRESS",
  "ALL",
  GQL.AffiliateCollaborationRecordProcessingStatus.NeedProcess,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingApproval,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingStaff,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingCreator,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingPlatform,
  GQL.AffiliateCollaborationRecordProcessingStatus.Done,
  GQL.AffiliateCollaborationRecordProcessingStatus.Blocked,
] as const;

type HistoryFilter = (typeof HISTORY_FILTERS)[number];
type CollaborationListItem = GQL.AffiliateCollaborationRecordListItem;

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

const ATTENTION_COLLABORATION_FILTERS = [
  "NEEDS_ATTENTION",
  "ALL",
  GQL.AffiliateCollaborationRecordProcessingStatus.NeedProcess,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingStaff,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingApproval,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingCreator,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingPlatform,
  GQL.AffiliateCollaborationRecordProcessingStatus.Done,
  GQL.AffiliateCollaborationRecordProcessingStatus.Blocked,
] as const;

type AttentionCollaborationFilter = (typeof ATTENTION_COLLABORATION_FILTERS)[number];

export function AffiliateManagementPage() {
  return <AffiliateNeedsAttentionPage />;
}

export const AffiliateNeedsAttentionPage = observer(function AffiliateNeedsAttentionPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const [selectedShopId, setSelectedShopId] = useState("");
  const [activeAttentionTab, setActiveAttentionTab] = useState<"PROPOSALS" | "COLLABORATIONS" | "ML">("PROPOSALS");
  const [proposalFilter, setProposalFilter] = useState<ProposalFilter>(GQL.ActionProposalStatus.Pending);
  const [collaborationFilter, setCollaborationFilter] = useState<AttentionCollaborationFilter>("NEEDS_ATTENTION");
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

  const proposalStatus = useMemo(() => {
    return proposalFilter === "ALL" ? undefined : proposalFilter;
  }, [proposalFilter]);

  const collaborationProcessingStatus = useMemo(() => {
    if (collaborationFilter === "ALL" || collaborationFilter === "NEEDS_ATTENTION") return undefined;
    return collaborationFilter;
  }, [collaborationFilter]);

  const collaborationProcessingStatuses = useMemo(() => {
    if (collaborationFilter !== "NEEDS_ATTENTION") return undefined;
    return [
      GQL.AffiliateCollaborationRecordProcessingStatus.NeedProcess,
      GQL.AffiliateCollaborationRecordProcessingStatus.WaitingStaff,
    ];
  }, [collaborationFilter]);

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
    skip: !user || activeAttentionTab !== "PROPOSALS",
  });

  const {
    data: collaborationData,
    loading: collaborationsLoading,
    refetch: refetchCollaborations,
  } = useQuery<
    { affiliateCollaborationRecordItems: CollaborationListItem[] },
    { input: GQL.ReadAffiliateCollaborationRecordsInput }
  >(AFFILIATE_COLLABORATION_RECORD_ITEMS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || undefined,
        processingStatus: collaborationProcessingStatus,
        processingStatuses: collaborationProcessingStatuses,
        limit: 200,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !user || activeAttentionTab !== "COLLABORATIONS",
  });

  const {
    data: mlInsightsData,
    loading: mlInsightsLoading,
    refetch: refetchMlInsights,
  } = useQuery<
    { affiliateMlInsights: GQL.AffiliateMlInsightsPayload },
    { input?: GQL.AffiliateMlInsightsInput | null }
  >(AFFILIATE_ML_INSIGHTS_QUERY, {
    variables: {
      input: selectedShopId ? { shopId: selectedShopId } : null,
    },
    fetchPolicy: "cache-and-network",
    skip: !user || activeAttentionTab !== "ML",
  });

  const [decideActionProposal, { loading: decidingProposal }] = useMutation<
    { decideActionProposal: GQL.ActionProposal },
    { input: GQL.DecideActionProposalInput }
  >(DECIDE_ACTION_PROPOSAL_MUTATION);

  useEffect(() => {
    const unsubscribeProposal = panelEventBus.subscribe("affiliate-action-proposal-changed", () => {
      if (activeAttentionTab === "PROPOSALS") void refetchProposals();
      if (activeAttentionTab === "COLLABORATIONS") void refetchCollaborations();
      if (activeAttentionTab === "ML") void refetchMlInsights();
    });
    const unsubscribeWorkItem = panelEventBus.subscribe("affiliate-work-item-changed", () => {
      if (activeAttentionTab === "PROPOSALS") void refetchProposals();
      if (activeAttentionTab === "COLLABORATIONS") void refetchCollaborations();
      if (activeAttentionTab === "ML") void refetchMlInsights();
    });
    return () => {
      unsubscribeProposal();
      unsubscribeWorkItem();
    };
  }, [activeAttentionTab, refetchCollaborations, refetchMlInsights, refetchProposals]);

  const proposalItems = proposalData?.actionProposals ?? [];
  const collaborationItems = collaborationData?.affiliateCollaborationRecordItems ?? [];
  const visibleProposalItems = useMemo(
    () => filterActionProposals(proposalItems, attentionSearch, shopLabel),
    [attentionSearch, proposalItems, shops],
  );
  const visibleCollaborationItems = useMemo(
    () => filterCollaborationItems(collaborationItems, attentionSearch, shopLabel),
    [attentionSearch, collaborationItems, shops],
  );
  const mlSummary = mlInsightsData?.affiliateMlInsights.latestModelEfficiencySummary ?? null;
  const activeLoading =
    activeAttentionTab === "PROPOSALS"
      ? proposalsLoading
      : activeAttentionTab === "COLLABORATIONS"
        ? collaborationsLoading
        : mlInsightsLoading;

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
      if (activeAttentionTab === "COLLABORATIONS") await refetchCollaborations();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  function refetchActive() {
    if (activeAttentionTab === "PROPOSALS") return refetchProposals();
    if (activeAttentionTab === "ML") return refetchMlInsights();
    return refetchCollaborations();
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
            disabled={activeLoading}
          >
            {activeLoading
              ? t("common.loading")
              : t("ecommerce.shopDrawer.affiliate.refreshProposals")}
          </button>
        </div>
      </div>

      <div className="affiliate-workbench-panel">
        <div className="affiliate-workbench-panel-head affiliate-attention-panel-head">
          <div>
            <div className="affiliate-workbench-panel-title">
              {activeAttentionTab === "PROPOSALS"
                ? t("ecommerce.affiliateWorkspace.approvalQueueTitle")
                : activeAttentionTab === "COLLABORATIONS"
                  ? t("ecommerce.affiliateWorkspace.collaborationWorkQueueTitle")
                  : t("ecommerce.affiliateWorkspace.mlInsightsTitle", { defaultValue: "Affiliate ML performance" })}
            </div>
            <div className="form-hint">
              {activeAttentionTab === "PROPOSALS"
                ? t("ecommerce.affiliateWorkspace.approvalQueueHint")
                : activeAttentionTab === "COLLABORATIONS"
                  ? t("ecommerce.affiliateWorkspace.collaborationWorkQueueHint")
                  : t("ecommerce.affiliateWorkspace.mlInsightsHint", {
                      defaultValue: "Compare model ranking with historical human sample approval behavior.",
                    })}
            </div>
          </div>
          <div className="affiliate-attention-toolbar">
            <div className="affiliate-attention-tabs" role="tablist" aria-label={t("ecommerce.affiliateWorkspace.sections.NEEDS_ATTENTION")}>
              <button
                type="button"
                role="tab"
                aria-selected={activeAttentionTab === "PROPOSALS"}
                className={`affiliate-attention-tab${activeAttentionTab === "PROPOSALS" ? " affiliate-attention-tab-active" : ""}`}
                onClick={() => setActiveAttentionTab("PROPOSALS")}
              >
                <span>{t("ecommerce.affiliateWorkspace.approvalQueueShortTitle")}</span>
                <strong>{proposalItems.length}</strong>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeAttentionTab === "COLLABORATIONS"}
                className={`affiliate-attention-tab${activeAttentionTab === "COLLABORATIONS" ? " affiliate-attention-tab-active" : ""}`}
                onClick={() => setActiveAttentionTab("COLLABORATIONS")}
              >
                <span>{t("ecommerce.affiliateWorkspace.collaborationWorkQueueShortTitle")}</span>
                <strong>{collaborationItems.length}</strong>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeAttentionTab === "ML"}
                className={`affiliate-attention-tab${activeAttentionTab === "ML" ? " affiliate-attention-tab-active" : ""}`}
                onClick={() => setActiveAttentionTab("ML")}
              >
                <span>{t("ecommerce.affiliateWorkspace.mlInsightsShortTitle", { defaultValue: "ML" })}</span>
              </button>
            </div>
            <input
              className="affiliate-attention-search"
              value={attentionSearch}
              onChange={(event) => setAttentionSearch(event.target.value)}
              placeholder={t("ecommerce.affiliateWorkspace.searchPlaceholder")}
              aria-label={t("ecommerce.affiliateWorkspace.searchPlaceholder")}
            />
          </div>
        </div>

        <div className="affiliate-entity-filterbar">
          {activeAttentionTab === "ML" ? null : activeAttentionTab === "PROPOSALS"
            ? PROPOSAL_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`affiliate-filter-chip${proposalFilter === filter ? " affiliate-filter-chip-active" : ""}`}
                  onClick={() => setProposalFilter(filter)}
                >
                  {t(`ecommerce.affiliateWorkspace.proposalFilters.${filter}`, {
                    defaultValue: filter,
                  })}
                </button>
              ))
            : ATTENTION_COLLABORATION_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`affiliate-filter-chip${collaborationFilter === filter ? " affiliate-filter-chip-active" : ""}`}
                  onClick={() => setCollaborationFilter(filter)}
                >
                  {t(`ecommerce.affiliateWorkspace.collaborationFilters.${filter}`, {
                    defaultValue: filter,
                  })}
                </button>
              ))}
        </div>

        <div className="affiliate-attention-active-list">
          {activeAttentionTab === "ML" ? (
            <AffiliateMlInsightsPanel
              loading={mlInsightsLoading}
              summary={mlSummary}
              shopLabel={selectedShopId ? shopLabel(selectedShopId) : t("ecommerce.affiliateWorkspace.allShops")}
            />
          ) : activeLoading && (
            activeAttentionTab === "PROPOSALS"
              ? visibleProposalItems.length === 0
              : visibleCollaborationItems.length === 0
          ) ? (
            <AffiliateLoadingState />
          ) : activeAttentionTab === "PROPOSALS" && visibleProposalItems.length === 0 ? (
            <div className="affiliate-proposal-empty">
              {proposalFilter === GQL.ActionProposalStatus.Pending
                ? t("ecommerce.affiliateWorkspace.emptyApprovals")
                : t("ecommerce.affiliateWorkspace.emptyProposalEntities")}
            </div>
          ) : activeAttentionTab === "COLLABORATIONS" && visibleCollaborationItems.length === 0 ? (
            <div className="affiliate-proposal-empty">
              {collaborationFilter === "NEEDS_ATTENTION"
                ? t("ecommerce.affiliateWorkspace.emptyCollaborationWork")
                : t("ecommerce.affiliateWorkspace.emptyHistory")}
            </div>
          ) : activeAttentionTab === "PROPOSALS" ? (
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
          ) : (
            <div className="affiliate-workbench-list">
              {visibleCollaborationItems.map((item) => (
                <CollaborationRecordCard
                  key={item.collaborationRecord.id}
                  item={item}
                  shopLabel={shopLabel(item.collaborationRecord.shopId)}
                  onOpen={() => setSelectedCollaboration(item)}
                  onOpenCreator={(profile) => setSelectedCreator(profile)}
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
  summary,
  shopLabel,
}: {
  loading: boolean;
  summary: GQL.AffiliateMlModelEfficiencySummary | null;
  shopLabel: string;
}) {
  const { t } = useTranslation();
  if (loading && !summary) {
    return <AffiliateLoadingState />;
  }
  if (!summary) {
    return (
      <div className="affiliate-proposal-empty">
        {t("ecommerce.affiliateWorkspace.mlInsightsEmpty", {
          defaultValue: "No affiliate ML evaluation is available yet. Run the training pipeline after affiliate history is ready.",
        })}
      </div>
    );
  }

  const liftPercent =
    summary.modelVsHumanExpectedUnitsLiftRatio == null
      ? null
      : (summary.modelVsHumanExpectedUnitsLiftRatio - 1) * 100;
  const sampleSavingsRisk =
    summary.humanApprovedCount > 0
      ? summary.modelRejectedHumanApprovedCount / summary.humanApprovedCount
      : null;

  return (
    <div className="affiliate-ml-insights">
      <div className="affiliate-ml-strip">
        <div>
          <span>{t("ecommerce.affiliateWorkspace.mlScope", { defaultValue: "Scope" })}</span>
          <strong>{shopLabel}</strong>
          <small>{formatDate(summary.trainedAt)}</small>
        </div>
        <div>
          <span>{t("ecommerce.affiliateWorkspace.mlHumanApprovalRate", { defaultValue: "Historical approval rate" })}</span>
          <strong>{formatPercent(summary.humanApprovalRate)}</strong>
          <small>{formatInteger(summary.humanApprovedCount)} / {formatInteger(summary.rowCount)}</small>
        </div>
        <div>
          <span>{t("ecommerce.affiliateWorkspace.mlSameBudgetLift", { defaultValue: "Same sample budget lift" })}</span>
          <strong>{liftPercent == null ? "—" : `+${formatNumber(liftPercent, 1)}%`}</strong>
          <small>{t("ecommerce.affiliateWorkspace.mlEstimatedUnits", { defaultValue: "estimated units" })}</small>
        </div>
      </div>

      <div className="affiliate-ml-metrics">
        <AffiliateMlMetric
          label={t("ecommerce.affiliateWorkspace.mlModelExpected", { defaultValue: "Model-ranked expected units" })}
          value={formatNumber(summary.modelSameBudgetExpectedUnits, 1)}
          hint={t("ecommerce.affiliateWorkspace.mlModelExpectedHint", {
            defaultValue: "Predicted total units if the model selected the same number of samples as historical staff.",
          })}
        />
        <AffiliateMlMetric
          label={t("ecommerce.affiliateWorkspace.mlHumanExpected", { defaultValue: "Human-selected expected units" })}
          value={formatNumber(summary.humanSameBudgetExpectedUnits, 1)}
          hint={t("ecommerce.affiliateWorkspace.mlHumanExpectedHint", {
            defaultValue: "Predicted total units for the historical staff-approved applications.",
          })}
        />
        <AffiliateMlMetric
          label={t("ecommerce.affiliateWorkspace.mlDiscoveredCreators", { defaultValue: "Additional high-potential creators" })}
          value={formatInteger(summary.modelSelectedHumanRejectedCount)}
          hint={t("ecommerce.affiliateWorkspace.mlDiscoveredCreatorsHint", {
            defaultValue: "Applications the model would select that historical staff rejected, measured counterfactually.",
          })}
        />
        <AffiliateMlMetric
          label={t("ecommerce.affiliateWorkspace.mlFilteredApproved", { defaultValue: "Human-approved filtered by model" })}
          value={formatInteger(summary.modelRejectedHumanApprovedCount)}
          hint={t("ecommerce.affiliateWorkspace.mlFilteredApprovedHint", {
            defaultValue: "Historical approvals the model would not prioritize at the same sample count.",
          })}
        />
      </div>

      <div className="affiliate-ml-note">
        <div>
          <strong>{t("ecommerce.affiliateWorkspace.mlBudgetThreshold", { defaultValue: "Calibrated threshold" })}</strong>
          <span>
            {t("ecommerce.affiliateWorkspace.mlBudgetThresholdBody", {
              defaultValue: "At the historical approval volume, the implied minimum expected sales is {{value}} units.",
              value: formatNumber(summary.minExpectedSalesUnitsSameBudget, 2),
            })}
          </span>
        </div>
        <div>
          <strong>{t("ecommerce.affiliateWorkspace.mlFalseNegativeRisk", { defaultValue: "Missed historical winners" })}</strong>
          <span>
            {t("ecommerce.affiliateWorkspace.mlFalseNegativeRiskBody", {
              defaultValue: "{{rate}} of historical approvals would be filtered; those observed approvals sold {{units}} units.",
              rate: formatPercent(sampleSavingsRisk),
              units: formatNumber(summary.modelRejectedHumanApprovedActualUnits, 0),
            })}
          </span>
        </div>
        <div>
          <strong>{t("ecommerce.affiliateWorkspace.mlModelVersion", { defaultValue: "Model version" })}</strong>
          <span>{summary.modelVersionKey}</span>
        </div>
      </div>
    </div>
  );
}

function AffiliateMlMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="affiliate-ml-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
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
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const [selectedShopId, setSelectedShopId] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("IN_PROGRESS");
  const [selectedItem, setSelectedItem] = useState<CollaborationListItem | null>(null);
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

  const processingStatus = useMemo(() => {
    if (historyFilter === "ALL" || historyFilter === "IN_PROGRESS") return undefined;
    return historyFilter;
  }, [historyFilter]);
  const processingStatuses = useMemo(() => {
    if (historyFilter !== "IN_PROGRESS") return undefined;
    return [
      GQL.AffiliateCollaborationRecordProcessingStatus.NeedProcess,
      GQL.AffiliateCollaborationRecordProcessingStatus.WaitingApproval,
      GQL.AffiliateCollaborationRecordProcessingStatus.WaitingStaff,
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
          <div className="affiliate-workbench-filterbar">
            {HISTORY_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`affiliate-filter-chip${historyFilter === filter ? " affiliate-filter-chip-active" : ""}`}
                onClick={() => setHistoryFilter(filter)}
              >
                {t(`ecommerce.affiliateWorkspace.historyFilters.${filter}`, {
                  defaultValue: filter,
                })}
              </button>
            ))}
          </div>
        </div>

        {loading && items.length === 0 ? (
          <AffiliateLoadingState />
        ) : items.length === 0 ? (
          <div className="affiliate-proposal-empty">
            {t("ecommerce.affiliateWorkspace.emptyHistory")}
          </div>
        ) : (
          <div className="affiliate-collaboration-list">
            {items.map((item) => (
              <CollaborationRecordCard
                key={item.collaborationRecord.id}
                item={item}
                shopLabel={shopLabel(item.collaborationRecord.shopId)}
                onOpen={() => setSelectedItem(item)}
                onOpenCreator={(profile) => setSelectedCreator(profile)}
              />
            ))}
          </div>
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
}: {
  item: CollaborationListItem;
  shopLabel: string;
  onOpen: () => void;
  onOpenCreator: (profile: GQL.CreatorGlobalProfile) => void;
}) {
  const { t } = useTranslation();
  const record = item.collaborationRecord;
  const creatorName = item.creatorProfile
    ? creatorPrimaryName(item.creatorProfile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : t("ecommerce.affiliateWorkspace.unknownCreator");
  const creatorHandle = item.creatorProfile ? creatorTikTokHandle(item.creatorProfile) : null;
  const creatorPlatformId = item.creatorProfile ? creatorPlatformIdentity(item.creatorProfile) : null;
  const workTitle = renderCollaborationWorkTitle({
    processReasons: record.processReasons,
    sampleApplicationRecord: null,
    fallback: item.latestProposal?.operatorSummary,
    t,
  });
  const situation = renderCollaborationSituation({
    sampleApplicationRecord: null,
    lifecycleEventType: item.latestLifecycleEvent?.eventType ?? null,
    fallback: item.latestProposal?.operatorSummary,
    t,
  });

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
              <span>{t(`ecommerce.affiliateWorkspace.statusLabels.${record.processingStatus}`)}</span>
              <span>{t(`ecommerce.affiliateWorkspace.lifecycleStages.${record.lifecycleStage}`, {
                defaultValue: record.lifecycleStage,
              })}</span>
              <DebugIdCopy value={record.id} />
            </div>
          </div>
        </div>
        <div className="affiliate-work-item-badges">
          <span className={`affiliate-kind-badge affiliate-kind-${record.processingStatus.toLowerCase()}`}>
            {t(`ecommerce.affiliateWorkspace.statusLabels.${record.processingStatus}`)}
          </span>
        </div>
      </div>
      <div className="affiliate-collaboration-card-body">
        <ProductSummaryCard
          product={item.productSummary}
          productId={record.productId}
          shopId={record.shopId}
          label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
        />
        <section className="affiliate-card-section">
          <div className="affiliate-card-section-label">
            {t("ecommerce.affiliateWorkspace.labels.needsYourAction")}
          </div>
          <div className="affiliate-card-section-title">{workTitle}</div>
          {situation ? <div className="affiliate-card-section-copy">{situation}</div> : null}
        </section>
        <div className="affiliate-card-footnote">
          {t("ecommerce.affiliateWorkspace.updatedAt", {
            time: formatProposalTime(record.stateUpdatedAt),
          })}
        </div>
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
    GQL.AffiliateCollaborationRecordProcessReason.ProductContextMissing,
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
