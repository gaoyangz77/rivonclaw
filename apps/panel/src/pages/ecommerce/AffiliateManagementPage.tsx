import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useMutation, useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import type { AffiliateLifecycleEvent } from "@rivonclaw/core/models";
import { getSnapshot, isStateTreeNode } from "mobx-state-tree";
import { Select } from "../../components/inputs/Select.js";
import { useToast } from "../../components/Toast.js";
import { CheckIcon, CopyIcon, EyeIcon, InfoIcon, RefreshIcon, ShopIcon, UserIcon } from "../../components/icons.js";
import { RemoteMediaImage } from "../../components/images/RemoteMediaImage.js";
import { panelEventBus } from "../../lib/event-bus.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import {
  AFFILIATE_ACTION_PROPOSALS_QUERY,
  AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
  AFFILIATE_COLLABORATION_RECORDS_QUERY,
  AFFILIATE_CREATOR_MESSAGE_HISTORY_QUERY,
  AFFILIATE_CREATORS_QUERY,
  AFFILIATE_RELATIONSHIP_HISTORY_QUERY,
  AFFILIATE_WORK_ITEMS_QUERY,
  AFFILIATE_POLICY_CONTEXT_QUERY,
  APPLY_CREATOR_TAG_MUTATION,
  ASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION,
  DECIDE_ACTION_PROPOSAL_MUTATION,
  REMOVE_CREATOR_TAG_MUTATION,
  SEND_AFFILIATE_CREATOR_MESSAGE_MUTATION,
  SET_AFFILIATE_RELATIONSHIP_AI_ENGAGEMENT_MUTATION,
  UNASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION,
} from "../../api/shops-queries.js";
import { creatorTagLabel } from "./affiliate-tag-labels.js";
import { ProductSummaryCard } from "./components/ProductSummaryCard.js";

type CreatorRelationshipWorkItem = {
  relationshipId: string;
  shopId: string;
  creatorId?: string | null;
  creatorOpenId?: string | null;
  creatorImId?: string | null;
  processingStatus: GQL.AffiliateRelationshipProcessingStatus;
  requiredAction: GQL.AffiliateRelationshipRequiredAction;
  processReasons: GQL.AffiliateCollaborationRecordProcessReason[];
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  nextSellerActionAt?: string | null;
  stateUpdatedAt?: string | null;
  creatorProfile?: GQL.AffiliateCreatorIdentity | null;
  creatorRelation?: GQL.AffiliateCreatorRelationship | null;
  activeCollaborations: GQL.AffiliateCollaborationRecord[];
  ambiguousCollaborations: GQL.AffiliateCollaborationRecord[];
  focusCollaboration?: GQL.AffiliateCollaborationRecord | null;
  pendingProposals: GQL.ActionProposal[];
  focusedProposal?: GQL.ActionProposal | null;
  productContext?: GQL.AffiliateWorkProductContext | null;
  primarySampleApplication?: GQL.SampleApplicationRecord | null;
  relatedSampleApplications?: GQL.SampleApplicationRecord[];
  workItem?: GQL.AffiliateWorkItem | null;
};
type CreatorRelationshipDetailItem = {
  creatorId: string;
  creatorProfile?: GQL.AffiliateCreatorIdentity | null;
  creatorRelation?: GQL.AffiliateCreatorRelationship | null;
  shopState?: GQL.AffiliateCreatorRelationshipShopState | null;
  managementItem?: AffiliateCreatorManagementItem | null;
  workItems?: CreatorRelationshipWorkItem[];
};

type AffiliateCreatorMessageProductReference = {
  productId: string;
  productSummary?: GQL.EcomProductSummary | null;
};

type AffiliateCreatorMessageSampleApplicationReference = {
  platformApplicationId: string;
  sampleApplicationRecord?: GQL.SampleApplicationRecord | null;
};

type AffiliateCreatorMessageTargetCollaborationReference = {
  platformTargetCollaborationId: string;
  affiliateCollaboration?: GQL.AffiliateCollaboration | null;
};

type AffiliateConversationMessage = GQL.AffiliateCreatorMessageHistoryItem & {
  conversationIndex?: string | number | null;
  createTime?: number | null;
  rawContent?: string | null;
  senderId?: string | null;
  productRefs?: AffiliateCreatorMessageProductReference[] | null;
  sampleApplicationRefs?: AffiliateCreatorMessageSampleApplicationReference[] | null;
  targetCollaborationRefs?: AffiliateCreatorMessageTargetCollaborationReference[] | null;
};

type StagedAffiliateAttachment = {
  draftAssetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  inline: boolean;
};

const HISTORY_STATUS_FILTERS = [
  "ALL",
  GQL.AffiliateCollaborationRecordProcessingStatus.AgentRequired,
  GQL.AffiliateCollaborationRecordProcessingStatus.StaffRequired,
  GQL.AffiliateCollaborationRecordProcessingStatus.WaitingExternal,
  GQL.AffiliateCollaborationRecordProcessingStatus.Idle,
] as const;

const ALL_HISTORY_SUB_STATUS = "__ALL_HISTORY_SUB_STATUS__";
const NO_HISTORY_SUB_STATUS = "__NO_HISTORY_SUB_STATUS__";

type HistoryStatusFilter = (typeof HISTORY_STATUS_FILTERS)[number];
type HistorySubStatusFilter = string;
const CREATOR_RELATIONSHIP_WORK_PAGE_SIZE = 24;
const AFFILIATE_TIMELINE_PAGE_SIZE = 25;
const AFFILIATE_CREATORS_LIMIT = 200;
const AFFILIATE_CREATORS_PAGE_SIZE = 24;
const ALL_CREATOR_TAGS_FILTER = "__ALL_CREATOR_TAGS__";
type AffiliateCreatorManagementItem = GQL.AffiliateCreatorManagementItem;
type CollaborationWorkViewModel = {
  badge: string;
  badgeTone: "attention" | "waiting" | "done" | "blocked";
  stage: string;
  title: string;
  description: string;
  ownerLabel: string;
};

type AffiliatePredictionSnapshotOutput = {
  expectedSalesUnits?: number | null;
  expectedSalesPercentile?: number | null;
  humanBaseline?: {
    wouldApprove?: boolean | null;
    humanApprovalProbability?: number | null;
    historicalApprovalRate?: number | null;
    status?: string | null;
    message?: string | null;
  } | null;
};

function affiliateSnapshot<T>(value: T | null | undefined): any {
  if (!value) return null;
  return isStateTreeNode(value as any) ? getSnapshot(value as any) : value;
}

function mergeById<T extends { id?: string | null }>(items: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of items) {
    if (!item?.id) continue;
    merged.set(item.id, item);
  }
  return [...merged.values()];
}

function hydrateAffiliateProposalProjection(projection: {
  proposal: unknown;
  collaborationRecord?: unknown | null;
  creatorProfile?: unknown | null;
  productSummary?: unknown | null;
}): GQL.ActionProposal {
  const proposal = affiliateSnapshot(projection.proposal);
  return {
    ...proposal,
    collaborationRecord: affiliateSnapshot(projection.collaborationRecord ?? (proposal as any).collaborationRecord),
    creatorProfile: affiliateSnapshot(projection.creatorProfile ?? (proposal as any).creatorProfile),
    productSummary: affiliateSnapshot(projection.productSummary ?? (proposal as any).productSummary),
  } as GQL.ActionProposal;
}

type AffiliateWorkspaceStore = {
  upsertAffiliateActionProposal?: (proposal: GQL.ActionProposal | null | undefined) => void;
  upsertAffiliateCollaborationRecord?: (record: GQL.AffiliateCollaborationRecord | null | undefined) => void;
  upsertAffiliateCreatorRelationship?: (relationship: GQL.AffiliateCreatorRelationship | null | undefined) => void;
  upsertAffiliateCreatorProfile?: (profile: GQL.AffiliateCreatorIdentity | null | undefined) => void;
  upsertAffiliateProductSummary?: (product: GQL.EcomProductSummary | null | undefined) => void;
  upsertAffiliateSampleApplicationRecord?: (sample: GQL.SampleApplicationRecord | null | undefined) => void;
  relationshipProjection?: (creatorRelationshipId: string) => unknown;
  proposalProjection?: (proposalId: string) => unknown;
};

function ingestAffiliateWorkItemsIntoWorkspace(
  workspace: AffiliateWorkspaceStore,
  workItems: GQL.AffiliateWorkItem[] | null | undefined,
): void {
  for (const workItem of workItems ?? []) {
    ingestAffiliateWorkItemIntoWorkspace(workspace, workItem);
  }
}

function ingestAffiliateWorkItemIntoWorkspace(
  workspace: AffiliateWorkspaceStore,
  workItem: GQL.AffiliateWorkItem | null | undefined,
): void {
  if (!workItem) return;
  const context = workItem.context;
  const relationship = workItem.creatorRelationship ?? context.creatorRelation ?? null;
  workspace.upsertAffiliateCreatorRelationship?.(relationship);
  workspace.upsertAffiliateCreatorProfile?.(context.creatorProfile ?? null);
  workspace.upsertAffiliateCollaborationRecord?.(workItem.collaboration ?? null);
  workspace.upsertAffiliateCollaborationRecord?.(context.focusCollaboration ?? null);
  for (const record of context.activeCollaborations ?? []) workspace.upsertAffiliateCollaborationRecord?.(record);
  for (const record of context.ambiguousCollaborationCandidates ?? []) workspace.upsertAffiliateCollaborationRecord?.(record);
  workspace.upsertAffiliateActionProposal?.(workItem.latestPendingProposal ?? null);
  for (const proposal of context.pendingProposals ?? []) workspace.upsertAffiliateActionProposal?.(proposal);
  workspace.upsertAffiliateSampleApplicationRecord?.(workItem.sampleApplicationRecord ?? null);
  workspace.upsertAffiliateSampleApplicationRecord?.(context.primarySampleApplication ?? null);
  for (const sample of context.relatedSampleApplications ?? []) workspace.upsertAffiliateSampleApplicationRecord?.(sample);
  workspace.upsertAffiliateProductSummary?.(productSummaryFromWorkContext(context.productContext));
}

function relationshipProjectionSnapshot(
  workspace: AffiliateWorkspaceStore | null | undefined,
  creatorRelationshipId: string | null | undefined,
): any | null {
  if (!workspace || !creatorRelationshipId) return null;
  return affiliateSnapshot(workspace.relationshipProjection?.(creatorRelationshipId));
}

function proposalProjectionSnapshot(
  workspace: AffiliateWorkspaceStore | null | undefined,
  proposalId: string | null | undefined,
): any | null {
  if (!workspace || !proposalId) return null;
  return affiliateSnapshot(workspace.proposalProjection?.(proposalId));
}

function productContextFromProjection(projection: any | null | undefined): GQL.AffiliateWorkProductContext | null {
  const product = projection?.productSummaries?.[0] ?? projection?.productSummary ?? null;
  if (!product?.productId) return null;
  return {
    productId: product.productId,
    title: product.title ?? null,
    imageUrl: product.coverImage ?? null,
    source: "relationship",
  } as GQL.AffiliateWorkProductContext;
}

const PROPOSAL_FILTERS = [
  GQL.ActionProposalStatus.Pending,
  "ALL",
  GQL.ActionProposalStatus.Approved,
  GQL.ActionProposalStatus.Executed,
  GQL.ActionProposalStatus.ExecutionFailed,
  GQL.ActionProposalStatus.Rejected,
  GQL.ActionProposalStatus.RevisionRequested,
  GQL.ActionProposalStatus.Superseded,
  GQL.ActionProposalStatus.Expired,
  GQL.ActionProposalStatus.Modified,
] as const;

type ProposalFilter = (typeof PROPOSAL_FILTERS)[number];

const PROPOSAL_TYPE_FILTERS = [
  "ALL",
  GQL.ActionProposalType.SendMessage,
  GQL.ActionProposalType.ReviewSampleApplication,
  GQL.ActionProposalType.CreateTargetCollaboration,
] as const;

type ProposalTypeFilter = (typeof PROPOSAL_TYPE_FILTERS)[number];

type AffiliateInsightSubject = {
  key: string;
  kind: "user" | "shop";
  label: string;
  shopId?: string;
};

type AffiliateInsightModelScope = "user" | "region" | "shop";

type AffiliateInsightRow = {
  key: string;
  subjectKey: string;
  kind: "user" | "shop";
  label: string;
  shopId?: string;
  modelScope: AffiliateInsightModelScope;
  summary: GQL.AffiliateMlModelEfficiencySummary | null;
  failed?: boolean;
};

type AffiliateInsightPayload = Record<string, unknown>;

type AffiliateSalesHistogramBucket = {
  key: string;
  label: string;
  count: number;
};

export function AffiliateManagementPage() {
  return <AffiliateCreatorsPage />;
}

export const AffiliateIntelligencePage = observer(function AffiliateIntelligencePage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const [selectedScopeKey, setSelectedScopeKey] = useState("user");

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  const insightSubjects: AffiliateInsightSubject[] = [
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
  ];

  useEffect(() => {
    if (user) {
      entityStore.fetchAffiliateMlInsights().catch(() => {});
    }
  }, [entityStore, shops.length, user]);

  const insightRows = useMemo<AffiliateInsightRow[]>(() => {
    const rows: AffiliateInsightRow[] = [];
    const hasError = Boolean(entityStore.affiliateMlInsightsError);
    for (const subject of insightSubjects) {
      const scopes: AffiliateInsightModelScope[] = subject.kind === "user" ? ["user"] : ["user", "region", "shop"];
      for (const modelScope of scopes) {
        const cached = entityStore.affiliateMlInsightRow(subject.key, modelScope);
        rows.push({
          key: `${subject.key}:${modelScope}`,
          subjectKey: subject.key,
          kind: subject.kind,
          label: subject.label,
          shopId: subject.shopId,
          modelScope,
          summary: (cached?.summary ?? null) as GQL.AffiliateMlModelEfficiencySummary | null,
          failed: hasError && !cached,
        });
      }
    }
    return rows;
  }, [
    entityStore,
    entityStore.affiliateMlInsightRows.length,
    entityStore.affiliateMlInsightsError,
    entityStore.affiliateMlInsightsLoadedAt,
    insightSubjects,
  ]);

  useEffect(() => {
    if (insightSubjects.length > 0 && !insightSubjects.some((subject) => subject.key === selectedScopeKey)) {
      setSelectedScopeKey("user");
    }
  }, [insightSubjects, selectedScopeKey]);

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
            onClick={() => entityStore.fetchAffiliateMlInsights().catch(() => {})}
            disabled={entityStore.affiliateMlInsightsLoading}
          >
            <RefreshIcon />
            <span>
              {entityStore.affiliateMlInsightsLoading
                ? t("common.loading")
                : t("ecommerce.affiliateWorkspace.intelligenceRefresh")}
            </span>
          </button>
        </div>
      </div>

      <AffiliateMlInsightsPanel
        loading={entityStore.affiliateMlInsightsLoading}
        subjects={insightSubjects}
        rows={insightRows}
        selectedKey={selectedScopeKey}
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
  const [proposalTypeFilter, setProposalTypeFilter] = useState<ProposalTypeFilter>("ALL");
  const [attentionSearch, setAttentionSearch] = useState("");
  const [selectedRelationship, setSelectedRelationship] = useState<CreatorRelationshipDetailItem | null>(null);

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  const shopOptions = [
    { value: "", label: t("ecommerce.affiliateWorkspace.allShops") },
    ...shops
      .filter((shop) => shop.services?.affiliateService?.enabled)
      .map((shop) => ({
        value: shop.id,
        label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
      })),
  ];
  const proposalFilterOptions = useMemo(
    () => PROPOSAL_FILTERS.map((filter) => ({
      value: filter,
      label: t(`ecommerce.affiliateWorkspace.proposalFilters.${filter}`, {
        defaultValue: filter,
      }),
    })),
    [t],
  );
  const proposalTypeFilterOptions = useMemo(
    () => PROPOSAL_TYPE_FILTERS.map((filter) => ({
      value: filter,
      label: filter === "ALL"
        ? t("ecommerce.affiliateWorkspace.proposalTypeFilters.ALL")
        : formatActionProposalTypeLabel(filter, t),
    })),
    [t],
  );

  const proposalStatus = useMemo(() => {
    return proposalFilter === "ALL" ? undefined : proposalFilter;
  }, [proposalFilter]);
  const proposalType = useMemo(() => {
    return proposalTypeFilter === "ALL" ? undefined : proposalTypeFilter;
  }, [proposalTypeFilter]);

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
        type: proposalType,
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

  useEffect(() => {
    for (const proposal of proposalData?.actionProposals ?? []) {
      entityStore.affiliateWorkspace.upsertAffiliateActionProposal(proposal);
    }
  }, [entityStore.affiliateWorkspace, proposalData?.actionProposals]);

  const proposalItemsFromQuery = (proposalData?.actionProposals ?? []).map((proposal) =>
    hydrateAffiliateProposalProjection(
      proposalProjectionSnapshot(entityStore.affiliateWorkspace, proposal.id) ?? { proposal },
    ),
  );
  const proposalItemsFromStore = entityStore.affiliateWorkspace
    .actionProposalPage({
      shopId: selectedShopId || undefined,
      status: proposalStatus,
      search: attentionSearch,
    })
    .map(hydrateAffiliateProposalProjection);
  const visibleProposalItems = filterActionProposals(
    (proposalItemsFromQuery.length ? proposalItemsFromQuery : proposalItemsFromStore)
      .filter((proposal) => !proposalType || proposal.type === proposalType),
    attentionSearch,
    shopLabel,
  );

  async function decideProposal(
    proposal: GQL.ActionProposal,
    status: GQL.ActionProposalStatus,
    note?: string,
  ) {
    try {
      const creatorRelationshipId = proposal.creatorRelationshipId ?? proposal.sourceWorkBoundary?.creatorRelationshipId;
      if (!creatorRelationshipId) {
        throw new Error(t("ecommerce.affiliateWorkspace.copyFailed"));
      }
      const decisionNote = note?.trim() || (
        status === GQL.ActionProposalStatus.Approved
          ? t("ecommerce.shopDrawer.affiliate.proposalApprovedNote")
          : status === GQL.ActionProposalStatus.RevisionRequested
            ? t("ecommerce.shopDrawer.affiliate.proposalRevisionRequestedNote")
            : t("ecommerce.shopDrawer.affiliate.proposalRejectedNote")
      );
      await decideActionProposal({
        variables: {
          input: {
            id: proposal.id,
            creatorRelationshipId,
            status,
            decision: {
              decidedAt: new Date().toISOString(),
              note: decisionNote,
            },
          },
        },
      });
      showToast(
        status === GQL.ActionProposalStatus.Approved
          ? t("ecommerce.shopDrawer.affiliate.proposalApproveSuccess")
          : status === GQL.ActionProposalStatus.RevisionRequested
            ? t("ecommerce.shopDrawer.affiliate.proposalRevisionRequestSuccess")
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
            <label className="affiliate-filter-field">
              <span>{t("ecommerce.affiliateWorkspace.typeFilter")}</span>
              <Select
                value={proposalTypeFilter}
                onChange={(value) => setProposalTypeFilter(value as ProposalTypeFilter)}
                options={proposalTypeFilterOptions}
                className="affiliate-status-select affiliate-type-select"
                ariaLabel={t("ecommerce.affiliateWorkspace.typeFilter")}
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
                  shopLabel={shopLabel(proposal.focusShopId)}
                  decidingProposal={decidingProposal}
                  affiliateWorkspace={entityStore.affiliateWorkspace}
                  onOpenRelationshipWork={(detailItem) => setSelectedRelationship(relationshipDetailFromWorkItem(detailItem))}
                  onApprove={(item) => decideProposal(item, GQL.ActionProposalStatus.Approved)}
                  onReject={(item) => decideProposal(item, GQL.ActionProposalStatus.Rejected)}
                  onRequestRevision={(item, revisionNote) =>
                    decideProposal(item, GQL.ActionProposalStatus.RevisionRequested, revisionNote)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRelationship ? (
        <CreatorRelationshipDetailModal
          item={selectedRelationship}
          onClose={() => setSelectedRelationship(null)}
        />
      ) : null}

    </div>
  );
});

export const AffiliateStaffHandlingPage = observer(function AffiliateStaffHandlingPage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const [selectedShopId, setSelectedShopId] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedRelationship, setSelectedRelationship] = useState<CreatorRelationshipDetailItem | null>(null);

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  const shopOptions = [
    { value: "", label: t("ecommerce.affiliateWorkspace.allShops") },
    ...shops
      .filter((shop) => shop.services?.affiliateService?.enabled)
      .map((shop) => ({
        value: shop.id,
        label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
      })),
  ];

  const { data, loading, refetch } = useQuery<
    { affiliateWorkItems: GQL.AffiliateWorkItem[] },
    { input: GQL.ReadAffiliateWorkItemsInput }
  >(AFFILIATE_WORK_ITEMS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || undefined,
        processingStatus: GQL.AffiliateRelationshipProcessingStatus.StaffRequired,
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

  useEffect(() => {
    ingestAffiliateWorkItemsIntoWorkspace(
      entityStore.affiliateWorkspace,
      data?.affiliateWorkItems,
    );
  }, [entityStore.affiliateWorkspace, data?.affiliateWorkItems]);

  const staffItems = (data?.affiliateWorkItems ?? [])
    .filter(isAffiliateStaffHandlingWorkItem)
    .map((workItem) => relationshipWorkItemFromWorkItem(workItem, entityStore.affiliateWorkspace));
  const visibleStaffItems = filterRelationshipWorkItems(staffItems, staffSearch, shopLabel)
    .sort(compareStaffHandlingItems);

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
          <h1>{t("ecommerce.affiliateWorkspace.collaborationWorkQueueTitle")}</h1>
          <p className="ecommerce-page-subtitle">
            {t("ecommerce.affiliateWorkspace.collaborationWorkQueueHint")}
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
        <div className="affiliate-workbench-panel-head affiliate-attention-panel-head">
          <div>
            <div className="affiliate-workbench-panel-title">
              {t("ecommerce.affiliateWorkspace.collaborationWorkQueueTitle")}
            </div>
            <div className="form-hint">
              {t("ecommerce.affiliateWorkspace.collaborationWorkQueueHint")}
            </div>
          </div>
          <div className="affiliate-attention-toolbar">
            <label className="affiliate-filter-field affiliate-filter-field-search">
              <span>{t("ecommerce.affiliateWorkspace.searchFilter")}</span>
              <input
                className="affiliate-attention-search"
                value={staffSearch}
                onChange={(event) => setStaffSearch(event.target.value)}
                placeholder={t("ecommerce.affiliateWorkspace.searchPlaceholder")}
                aria-label={t("ecommerce.affiliateWorkspace.searchPlaceholder")}
              />
            </label>
          </div>
        </div>

        {loading && visibleStaffItems.length === 0 ? (
          <AffiliateLoadingState />
        ) : visibleStaffItems.length === 0 ? (
          <div className="affiliate-proposal-empty">
            {t("ecommerce.affiliateWorkspace.emptyCollaborationWork")}
          </div>
        ) : (
          <div className="affiliate-collaboration-list">
            {visibleStaffItems.map((item) => (
              <CreatorRelationshipWorkCard
                key={item.relationshipId}
                item={item}
                shopLabel={shopLabel(item.shopId)}
                onOpen={() => setSelectedRelationship(relationshipDetailFromWorkItem(item))}
                onOpenRelationship={(relationship) => setSelectedRelationship(relationship)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedRelationship ? (
        <CreatorRelationshipDetailModal
          item={selectedRelationship}
          onClose={() => setSelectedRelationship(null)}
        />
      ) : null}
    </div>
  );
});

function AffiliateMlInsightsPanel({
  loading,
  subjects,
  rows,
  selectedKey,
  onSelect,
}: {
  loading: boolean;
  subjects: AffiliateInsightSubject[];
  rows: AffiliateInsightRow[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const [activeModelScope, setActiveModelScope] = useState<AffiliateInsightModelScope>("user");
  const selectedSubject =
    subjects.find((subject) => subject.key === selectedKey)
    ?? subjects.find((subject) => rows.some((row) => row.subjectKey === subject.key && row.summary))
    ?? subjects[0]
    ?? null;
  const selectedRows = selectedSubject
    ? rows.filter((row) => row.subjectKey === selectedSubject.key)
    : [];
  const accountModelRow = selectedRows.find((row) => row.modelScope === "user") ?? null;
  const regionModelRow = selectedRows.find((row) => row.modelScope === "region") ?? null;
  const storeModelRow = selectedRows.find((row) => row.modelScope === "shop") ?? null;
  const availableModelScope =
    activeModelScope === "shop" && storeModelRow?.summary
      ? "shop"
      : activeModelScope === "region" && regionModelRow?.summary
        ? "region"
      : accountModelRow?.summary
        ? "user"
        : regionModelRow?.summary
          ? "region"
        : storeModelRow?.summary
          ? "shop"
          : activeModelScope;
  const selectedRow =
    (availableModelScope === "shop"
      ? storeModelRow
      : availableModelScope === "region"
        ? regionModelRow
        : accountModelRow)
    ?? selectedRows.find((row) => row.summary)
    ?? selectedRows[0]
    ?? rows.find((row) => row.summary)
    ?? rows[0]
    ?? null;
  const summary = selectedRow?.summary ?? null;
  const selectedModelLabel =
    selectedRow?.modelScope === "shop"
      ? t("ecommerce.affiliateWorkspace.intelligenceStoreModel")
      : selectedRow?.modelScope === "region"
        ? t("ecommerce.affiliateWorkspace.intelligenceRegionModel")
      : t("ecommerce.affiliateWorkspace.intelligenceAccountModel");

  useEffect(() => {
    if (selectedSubject?.kind === "user") {
      setActiveModelScope("user");
    }
  }, [selectedSubject?.kind, selectedSubject?.key]);

  if (loading && rows.length === 0) {
    return <AffiliateLoadingState />;
  }

  if (!selectedSubject) {
    return (
      <div className="affiliate-proposal-empty">
        {t("ecommerce.affiliateWorkspace.mlInsightsEmpty", {
          defaultValue: "No affiliate ML evaluation is available yet. Run the training pipeline after affiliate history is ready.",
        })}
      </div>
    );
  }

  if (!summary) {
    const modelLoadFailed = selectedRows.some((row) => row.failed);
    return (
      <div className="affiliate-ml-insights affiliate-intelligence-dashboard">
        <AffiliateInsightScopeRail
          subjects={subjects}
          rows={rows}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
        {selectedSubject.kind === "shop" ? (
          <AffiliateModelSourceSwitch
            accountRow={accountModelRow}
            activeModelScope={availableModelScope}
            regionRow={regionModelRow}
            storeRow={storeModelRow}
            onChange={setActiveModelScope}
          />
        ) : null}
        <div className="affiliate-intelligence-empty">
          <InfoIcon />
          <strong>{selectedSubject.label}</strong>
          <span>
            {modelLoadFailed
              ? t("ecommerce.affiliateWorkspace.intelligenceModelUnavailableHint")
              : t("ecommerce.affiliateWorkspace.mlInsightsEmpty", {
                defaultValue: "No affiliate ML evaluation is available yet. Run the training pipeline after affiliate history is ready.",
              })}
          </span>
        </div>
      </div>
    );
  }

  const payload = parseAffiliateInsightPayload(summary.payload);
  const sameBudgetPayload = payloadObject(payload, "same_sample_budget");
  const sameBudgetConfidence = payloadObject(payload, "same_sample_budget_confidence");
  const sameBudgetConfidenceLevel = affiliateConfidenceLevel(sameBudgetConfidence);
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
  const budgetHumanApprovedCount = payloadNumber(sameBudget, "historical_approved_count");
  const budgetHumanExpectedUnits = payloadNumber(sameBudget, "historical_expected_sales_units");
  const budgetModelExpectedUnits = payloadNumber(sameBudget, "model_expected_sales_units");
  const budgetLiftRatio = payloadNumber(sameBudget, "expected_sales_lift_ratio");
  const budgetModelRejectedHumanApprovedCount = payloadNumber(sameBudget, "model_rejected_human_approved_count");
  const impliedMinExpectedSalesUnits =
    summary.minExpectedSalesUnitsSameBudget
    ?? payloadNumber(sameBudget, "min_expected_sales_units_same_budget");
  const selectedShop = selectedSubject.shopId
    ? entityStore.shops.find((shop) => shop.id === selectedSubject.shopId)
    : null;
  const configuredMinExpectedSalesUnits =
    selectedSubject.kind === "shop"
      ? selectedShop?.services?.affiliateService?.decisionThresholds?.minExpectedSalesUnits ?? null
      : undefined;
  const sampleSavingsRisk =
    budgetHumanApprovedCount && budgetHumanApprovedCount > 0
      ? (budgetModelRejectedHumanApprovedCount ?? 0) / budgetHumanApprovedCount
      : null;
  const budgetMaxUnits = Math.max(budgetModelExpectedUnits ?? 0, budgetHumanExpectedUnits ?? 0, 1);
  const modelBarWidth = `${Math.max(8, Math.round(((budgetModelExpectedUnits ?? 0) / budgetMaxUnits) * 100))}%`;
  const humanBarWidth = `${Math.max(8, Math.round(((budgetHumanExpectedUnits ?? 0) / budgetMaxUnits) * 100))}%`;
  const evaluationWindow = formatEvaluationWindow(payload, summary.evaluationScope, t);
  const precisionLiftPercent = budgetLiftRatio == null ? null : (budgetLiftRatio - 1) * 100;
  const precisionLiftLabel = formatSignedPercent(precisionLiftPercent);
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const precisionClaimBody =
    precisionLiftPercent != null && precisionLiftPercent > 0
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
      );

  return (
    <div className="affiliate-ml-insights affiliate-intelligence-dashboard">
      <AffiliateInsightScopeRail
        subjects={subjects}
        rows={rows}
        selectedKey={selectedSubject.key}
        onSelect={onSelect}
      />

      <div className="affiliate-intelligence-main">
        {selectedSubject.kind === "shop" ? (
          <AffiliateModelSourceSwitch
            accountRow={accountModelRow}
            activeModelScope={availableModelScope}
            regionRow={regionModelRow}
            storeRow={storeModelRow}
            onChange={setActiveModelScope}
          />
        ) : null}

        <div className="affiliate-intelligence-claim-section">
          <div className="affiliate-intelligence-comparison">
            <div className="affiliate-intelligence-card-head">
              <div className="affiliate-intelligence-card-title">
                <span>{selectedSubject.kind === "shop" ? `${selectedSubject.label} · ${selectedModelLabel}` : selectedSubject.label}</span>
                <strong>{t("ecommerce.affiliateWorkspace.intelligenceClaimPrecisionTitle")}</strong>
                <p>{precisionClaimBody}</p>
              </div>
              <div className="affiliate-intelligence-card-aside">
                {precisionLiftPercent != null ? (
                  <div className={`affiliate-intelligence-lift-badge${precisionLiftPercent < 0 ? " affiliate-intelligence-lift-badge-negative" : ""}`}>
                    <strong>{precisionLiftLabel}</strong>
                    <span>{t("ecommerce.affiliateWorkspace.intelligenceChartSameBudget")}</span>
                  </div>
                ) : null}
                <small>
                  {translate("ecommerce.affiliateWorkspace.intelligenceSameBudgetStory", {
                    count: formatInteger(budgetHumanApprovedCount),
                    window: evaluationWindow,
                  })}
                </small>
              </div>
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

            {impliedMinExpectedSalesUnits != null ? (
              <AffiliateImplicitThresholdPanel
                approvalRate={summary.humanApprovalRate}
                configuredThreshold={configuredMinExpectedSalesUnits}
                impliedThreshold={impliedMinExpectedSalesUnits}
              />
            ) : null}

            {sameBudgetConfidenceLevel === "low" || sameBudgetConfidenceLevel === "medium" ? (
              <AffiliateConfidenceNotice level={sameBudgetConfidenceLevel} />
            ) : null}
          </div>

          <AffiliateBudgetDistributionPanel
            claim={sameBudget}
            windowLabel={evaluationWindow}
          />
        </div>

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
  subjects,
  rows,
  selectedKey,
  onSelect,
}: {
  subjects: AffiliateInsightSubject[];
  rows: AffiliateInsightRow[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="affiliate-intelligence-scope-rail">
      {subjects.map((subject) => {
        const subjectRows = rows.filter((row) => row.subjectKey === subject.key);
        const readyCount = subjectRows.filter((row) => row.summary).length;
        const failed = readyCount === 0 && subjectRows.some((row) => row.failed);
        const ready = readyCount > 0;
        const status = ready
          ? subject.kind === "shop" && readyCount > 1
            ? t("ecommerce.affiliateWorkspace.intelligenceModelsReady", { count: readyCount })
            : t("ecommerce.affiliateWorkspace.intelligenceModelReady")
          : failed
            ? t("ecommerce.affiliateWorkspace.intelligenceModelUnavailable")
            : t("ecommerce.affiliateWorkspace.intelligenceNoModel");
        return (
          <button
            key={subject.key}
            type="button"
            className={`affiliate-intelligence-scope${selectedKey === subject.key ? " affiliate-intelligence-scope-active" : ""}${ready ? "" : " affiliate-intelligence-scope-empty"}`}
            onClick={() => onSelect(subject.key)}
          >
            <span className="affiliate-intelligence-scope-icon">
              {subject.kind === "user" ? <UserIcon /> : <ShopIcon />}
            </span>
            <span className="affiliate-intelligence-scope-copy">
              <strong>{subject.label}</strong>
              <small>{status}</small>
            </span>
            {ready ? <CheckIcon /> : <InfoIcon />}
          </button>
        );
      })}
    </div>
  );
}

function AffiliateImplicitThresholdPanel({
  approvalRate,
  configuredThreshold,
  impliedThreshold,
}: {
  approvalRate?: number | null;
  configuredThreshold?: number | null;
  impliedThreshold: number;
}) {
  const { t } = useTranslation();
  return (
    <div className={`affiliate-intelligence-threshold-panel${configuredThreshold === undefined ? " affiliate-intelligence-threshold-panel-single" : ""}`}>
      <div>
        <span>{t("ecommerce.affiliateWorkspace.intelligenceImpliedThresholdTitle")}</span>
        <strong>{formatNumber(impliedThreshold, 1)}</strong>
        <small>
          {t("ecommerce.affiliateWorkspace.intelligenceImpliedThresholdHint", {
            approvalRate: formatPercent(approvalRate),
          })}
        </small>
      </div>
      {configuredThreshold !== undefined ? (
        <div>
          <span>{t("ecommerce.affiliateWorkspace.intelligenceConfiguredThresholdTitle")}</span>
          <strong>
            {configuredThreshold == null
              ? t("ecommerce.affiliateWorkspace.intelligenceConfiguredThresholdUnset")
              : formatNumber(configuredThreshold, 1)}
          </strong>
          <small>{t("ecommerce.affiliateWorkspace.intelligenceConfiguredThresholdHint")}</small>
        </div>
      ) : null}
    </div>
  );
}

function AffiliateModelSourceSwitch({
  accountRow,
  activeModelScope,
  regionRow,
  storeRow,
  onChange,
}: {
  accountRow: AffiliateInsightRow | null;
  activeModelScope: AffiliateInsightModelScope;
  regionRow: AffiliateInsightRow | null;
  storeRow: AffiliateInsightRow | null;
  onChange: (scope: AffiliateInsightModelScope) => void;
}) {
  const { t } = useTranslation();
  const rows = [
    {
      key: "user" as AffiliateInsightModelScope,
      label: t("ecommerce.affiliateWorkspace.intelligenceAccountModel"),
      description: t("ecommerce.affiliateWorkspace.intelligenceAccountModelHint"),
      row: accountRow,
    },
    {
      key: "region" as AffiliateInsightModelScope,
      label: t("ecommerce.affiliateWorkspace.intelligenceRegionModel"),
      description: t("ecommerce.affiliateWorkspace.intelligenceRegionModelHint"),
      row: regionRow,
    },
    {
      key: "shop" as AffiliateInsightModelScope,
      label: t("ecommerce.affiliateWorkspace.intelligenceStoreModel"),
      description: t("ecommerce.affiliateWorkspace.intelligenceStoreModelHint"),
      row: storeRow,
    },
  ];
  const rankedRows = rows.flatMap((item) => {
    const lift = item.row?.summary?.modelVsHumanExpectedUnitsLiftRatio ?? null;
    if (typeof lift !== "number" || !Number.isFinite(lift)) return [];
    return [{
      key: item.key,
      lift,
      confidenceLevel: item.row?.summary ? affiliateSummaryConfidenceLevel(item.row.summary) : null,
    }];
  });
  const recommendationCandidates = rankedRows.filter((item) => item.confidenceLevel !== "low");
  const candidates = recommendationCandidates.length > 0 ? recommendationCandidates : rankedRows;
  const recommendedScope =
    candidates.length > 0
      ? candidates.reduce((best, item) => (item.lift > best.lift ? item : best)).key
      : null;

  return (
    <div className="affiliate-intelligence-model-source" role="tablist">
      <span className="affiliate-intelligence-model-source-label">
        {t("ecommerce.affiliateWorkspace.intelligenceModelSourceSelector")}
      </span>
      <div className="affiliate-intelligence-model-source-options">
        {rows.map((item) => {
          const summary = item.row?.summary ?? null;
          const lift = summary?.modelVsHumanExpectedUnitsLiftRatio == null
            ? null
            : (summary.modelVsHumanExpectedUnitsLiftRatio - 1) * 100;
          const confidenceLevel = summary ? affiliateSummaryConfidenceLevel(summary) : null;
          const active = activeModelScope === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`affiliate-intelligence-model-source-option${active ? " affiliate-intelligence-model-source-option-active" : ""}`}
              disabled={!summary}
              onClick={() => onChange(item.key)}
            >
              <strong>{item.label}</strong>
              <span>
                {summary
                  ? formatSignedPercent(lift)
                  : item.row?.failed
                    ? t("ecommerce.affiliateWorkspace.intelligenceModelUnavailable")
                    : t("ecommerce.affiliateWorkspace.intelligenceNoModel")}
              </span>
              <small>{item.description}</small>
              {confidenceLevel ? (
                <b
                  className={`affiliate-intelligence-confidence-chip affiliate-intelligence-confidence-chip-${confidenceLevel}`}
                  title={t(`ecommerce.affiliateWorkspace.intelligenceConfidence${confidenceLevel === "low" ? "Low" : confidenceLevel === "medium" ? "Medium" : "High"}Hint`)}
                >
                  {t(`ecommerce.affiliateWorkspace.intelligenceConfidence${confidenceLevel === "low" ? "Low" : confidenceLevel === "medium" ? "Medium" : "High"}`)}
                </b>
              ) : null}
              {recommendedScope === item.key ? (
                <em>{t("ecommerce.affiliateWorkspace.intelligenceRecommendedModel")}</em>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AffiliateConfidenceNotice({ level }: { level: "low" | "medium" }) {
  const { t } = useTranslation();
  const suffix = level === "low" ? "Low" : "Medium";
  return (
    <div className={`affiliate-intelligence-confidence-note affiliate-intelligence-confidence-note-${level}`}>
      <InfoIcon />
      <div>
        <strong>{t(`ecommerce.affiliateWorkspace.intelligenceConfidence${suffix}`)}</strong>
        <span>{t(`ecommerce.affiliateWorkspace.intelligenceConfidence${suffix}Hint`)}</span>
      </div>
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

function payloadString(payload: AffiliateInsightPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function payloadObject(payload: AffiliateInsightPayload, key: string): AffiliateInsightPayload {
  const value = payload[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AffiliateInsightPayload;
}

function affiliateConfidenceLevel(payload: AffiliateInsightPayload): "low" | "medium" | "high" | null {
  const level = payloadString(payload, "level")?.toLowerCase();
  return level === "low" || level === "medium" || level === "high" ? level : null;
}

function affiliateSummaryConfidenceLevel(summary: GQL.AffiliateMlModelEfficiencySummary): "low" | "medium" | "high" | null {
  const payload = parseAffiliateInsightPayload(summary.payload);
  return affiliateConfidenceLevel(payloadObject(payload, "same_sample_budget_confidence"));
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

function formatSignedPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Object.is(value, -0) || Math.abs(value) < 0.05) return "0.0%";
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)}%`;
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
    proposal.focusShopId,
    shopLabel(proposal.focusShopId),
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
    ...(proposal.messageIntent?.parts.flatMap((part) => [part.text, part.productId, part.fileName]) ?? []),
    proposal.sampleReviewIntent?.platformApplicationId,
    proposal.sampleReviewIntent?.sampleApplicationRecordId,
  ];
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function filterRelationshipWorkItems(
  items: CreatorRelationshipWorkItem[],
  search: string,
  shopLabel: (shopId: string) => string,
): CreatorRelationshipWorkItem[] {
  const query = search.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => relationshipWorkItemSearchText(item, shopLabel).includes(query));
}

function relationshipWorkItemSearchText(
  item: CreatorRelationshipWorkItem,
  shopLabel: (shopId: string) => string,
): string {
  const creatorProfile = item.creatorProfile;
  const values = [
    item.relationshipId,
    item.shopId,
    shopLabel(item.shopId),
    item.creatorId,
    item.creatorOpenId,
    item.creatorImId,
    item.processingStatus,
    item.requiredAction,
    ...(item.processReasons ?? []),
    creatorProfile?.id,
    creatorProfile?.nickname,
    creatorProfile?.username,
    creatorProfile?.creatorOpenId,
    creatorProfile?.creatorImId,
    ...item.activeCollaborations.flatMap((record) => [
      record.id,
      record.productId,
      record.platformCollaborationId,
      record.sampleApplicationRecordId,
      record.processingStatus,
      record.lifecycleStage,
    ]),
    ...item.pendingProposals.flatMap((proposal) => [
      proposal.id,
      proposal.type,
      proposal.status,
      proposal.operatorSummary,
      getProposalMessagePreview(proposal),
      getProposalActionProductId(proposal),
    ]),
  ];
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function filterCollaborationRecords(
  records: GQL.AffiliateCollaborationRecord[],
  search: string,
  shopLabel: (shopId: string) => string,
): GQL.AffiliateCollaborationRecord[] {
  const query = search.trim().toLowerCase();
  if (!query) return records;
  return records.filter((record) => collaborationRecordSearchText(record, shopLabel).includes(query));
}

function collaborationRecordSearchText(
  record: GQL.AffiliateCollaborationRecord,
  shopLabel: (shopId: string) => string,
): string {
  const samples = record.sampleApplicationRecords ?? [];
  const values = [
    record.id,
    record.shopId,
    shopLabel(record.shopId),
    record.creatorId,
    record.creatorOpenId,
    record.creatorImId,
    record.productId,
    record.platformCollaborationId,
    record.affiliateCollaborationId,
    record.sampleApplicationRecordId,
    record.processingStatus,
    record.requiredAction,
    record.lifecycleStage,
    record.collaborationType,
    ...(record.processReasons ?? []),
    ...samples.flatMap((sample) => [
      sample.id,
      sample.platformApplicationId,
      sample.productId,
      sample.platformCollaborationId,
      sample.platformOpenCollaborationId,
      sample.platformTargetCollaborationId,
      sample.sampleWorkStatus,
      sample.order?.platformOrderId,
      sample.order?.trackingNumber,
      sample.trackingNumber,
      sample.carrier,
    ]),
  ];
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function collaborationRecordMatchesHistoryStatusFilter(
  record: GQL.AffiliateCollaborationRecord,
  filter: HistoryStatusFilter,
): boolean {
  if (filter === "ALL") return true;
  return record.processingStatus === filter;
}

function isAffiliateStaffHandlingWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  const hasPendingProposal =
    workItem.latestPendingProposal?.status === GQL.ActionProposalStatus.Pending ||
    (workItem.context.pendingProposals ?? []).some((proposal) => proposal.status === GQL.ActionProposalStatus.Pending);
  if (hasPendingProposal) return false;
  if (workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.ReviewActionProposal) return false;
  if (workItem.staffReviewRequired) return true;
  if (workItem.processingStatus === GQL.AffiliateRelationshipProcessingStatus.StaffRequired) return true;
  switch (workItem.requiredAction) {
    case GQL.AffiliateRelationshipRequiredAction.ResolveCreatorIdentity:
    case GQL.AffiliateRelationshipRequiredAction.ReviewAgentFailure:
    case GQL.AffiliateRelationshipRequiredAction.ReviewAmbiguousContext:
    case GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask:
      return true;
    default:
      return false;
  }
}

function compareStaffHandlingItems(
  left: CreatorRelationshipWorkItem,
  right: CreatorRelationshipWorkItem,
): number {
  const leftTime = Date.parse(left.nextSellerActionAt ?? left.stateUpdatedAt ?? "");
  const rightTime = Date.parse(right.nextSellerActionAt ?? right.stateUpdatedAt ?? "");
  const normalizedLeft = Number.isFinite(leftTime) ? leftTime : 0;
  const normalizedRight = Number.isFinite(rightTime) ? rightTime : 0;
  return normalizedRight - normalizedLeft;
}

function filterCreatorItems(items: AffiliateCreatorManagementItem[], search: string): AffiliateCreatorManagementItem[] {
  const query = search.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => creatorManagementSearchText(item).includes(query));
}

function creatorManagementSearchText(item: AffiliateCreatorManagementItem): string {
  const profile = item.creatorProfile;
  const record = item.latestCollaborationRecord;
  const proposal = item.latestPendingProposal;
  const sample = item.latestSampleApplicationRecord;
  const values = [
    item.creatorId,
    profile?.id,
    profile?.nickname,
    profile?.username,
    profile?.creatorOpenId,
    profile?.creatorImId,
    record?.id,
    record?.creatorOpenId,
    record?.creatorImId,
    record?.productId,
    record?.platformCollaborationId,
    proposal?.id,
    proposal?.operatorSummary,
    ...(proposal?.messageIntent?.parts.flatMap((part) => [part.text, part.productId, part.fileName]) ?? []),
    sample?.id,
    sample?.platformApplicationId,
    sample?.productId,
    ...item.tags.map((tag) => tag.name),
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

export const AffiliateCreatorsPage = observer(function AffiliateCreatorsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const affiliateShops = entityStore.shops.filter((shop) => shop.services?.affiliateService?.enabled);
  const affiliateShopIds = affiliateShops.map((shop) => shop.id).join("\u0001");
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedTagId, setSelectedTagId] = useState(ALL_CREATOR_TAGS_FILTER);
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [creatorPage, setCreatorPage] = useState(1);
  const [creatorPageInput, setCreatorPageInput] = useState("1");
  const [selectedRelationship, setSelectedRelationship] = useState<CreatorRelationshipDetailItem | null>(null);
  const [updatingTagKey, setUpdatingTagKey] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  useEffect(() => {
    if (!selectedShopId && affiliateShops.length) {
      setSelectedShopId(affiliateShops[0].id);
    }
  }, [affiliateShopIds, selectedShopId]);

  const shopOptions = affiliateShops.map((shop) => ({
    value: shop.id,
    label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
  }));
  function shopLabel(shopId: string): string {
    const shop = affiliateShops.find((candidate) => candidate.id === shopId);
    return shop?.alias || shop?.shopName || shop?.platformShopId || shopId;
  }

  const { data: policyContextData } = useQuery<
    { creatorTags: GQL.CreatorTag[] },
    { campaignsInput: GQL.ReadAffiliateCampaignsInput; shopId: string }
  >(AFFILIATE_POLICY_CONTEXT_QUERY, {
    variables: {
      campaignsInput: { shopId: selectedShopId, limit: 1 },
      shopId: selectedShopId,
    },
    fetchPolicy: "cache-and-network",
    skip: !user || !selectedShopId,
  });

  const tagOptions = useMemo(() => {
    const tags = policyContextData?.creatorTags ?? [];
    return [
      { value: ALL_CREATOR_TAGS_FILTER, label: t("ecommerce.affiliateWorkspace.allCreatorTagsFilter") },
      ...tags.map((tag) => ({ value: tag.id, label: creatorTagLabel(t, tag) })),
    ];
  }, [policyContextData?.creatorTags, t]);

  useEffect(() => {
    const available = new Set(tagOptions.map((option) => option.value));
    if (!available.has(selectedTagId)) {
      setSelectedTagId(ALL_CREATOR_TAGS_FILTER);
    }
  }, [selectedTagId, tagOptions]);

  const { data, loading, refetch } = useQuery<
    { affiliateCreators: AffiliateCreatorManagementItem[] },
    { input: GQL.ReadAffiliateCreatorsInput }
  >(AFFILIATE_CREATORS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId,
        tagIds: selectedTagId === ALL_CREATOR_TAGS_FILTER ? undefined : [selectedTagId],
        needsAttentionOnly,
        limit: AFFILIATE_CREATORS_LIMIT,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !user || !selectedShopId,
  });
  const {
    data: relationshipWorkData,
    loading: relationshipWorkLoading,
    refetch: refetchRelationshipWork,
  } = useQuery<
    { affiliateWorkItems: GQL.AffiliateWorkItem[] },
    { input: GQL.ReadAffiliateWorkItemsInput }
  >(AFFILIATE_WORK_ITEMS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId,
        limit: AFFILIATE_CREATORS_LIMIT,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !user || !selectedShopId,
  });

  const [applyCreatorTag] = useMutation<
    { applyCreatorTag: GQL.AffiliateCreatorRelationship },
    { input: GQL.ApplyCreatorTagInput }
  >(APPLY_CREATOR_TAG_MUTATION);
  const [removeCreatorTag] = useMutation<
    { removeCreatorTag: GQL.AffiliateCreatorRelationship },
    { input: GQL.ApplyCreatorTagInput }
  >(REMOVE_CREATOR_TAG_MUTATION);

  useEffect(() => {
    const unsubscribeProposal = panelEventBus.subscribe("affiliate-action-proposal-changed", () => {
      void refetch();
      void refetchRelationshipWork();
    });
    const unsubscribeWorkItem = panelEventBus.subscribe("affiliate-work-item-changed", () => {
      void refetch();
      void refetchRelationshipWork();
    });
    return () => {
      unsubscribeProposal();
      unsubscribeWorkItem();
    };
  }, [refetch, refetchRelationshipWork]);

  useEffect(() => {
    ingestAffiliateWorkItemsIntoWorkspace(
      entityStore.affiliateWorkspace,
      relationshipWorkData?.affiliateWorkItems,
    );
  }, [entityStore.affiliateWorkspace, relationshipWorkData?.affiliateWorkItems]);

  const creatorItems = data?.affiliateCreators ?? [];
  const relationshipWorkItems = useMemo(
    () => (relationshipWorkData?.affiliateWorkItems ?? []).map((workItem) =>
      relationshipWorkItemFromWorkItem(workItem, entityStore.affiliateWorkspace)),
    [entityStore.affiliateWorkspace, relationshipWorkData?.affiliateWorkItems],
  );
  const workItemsByCreatorId = useMemo(() => {
    const grouped = new Map<string, CreatorRelationshipWorkItem[]>();
    for (const relationshipWorkItem of relationshipWorkItems) {
      const creatorId = relationshipWorkItem.creatorProfile?.id ?? relationshipWorkItem.creatorId ?? relationshipWorkItem.creatorRelation?.creatorId ?? "";
      if (!creatorId) continue;
      const list = grouped.get(creatorId) ?? [];
      list.push(relationshipWorkItem);
      grouped.set(creatorId, list);
    }
    return grouped;
  }, [relationshipWorkItems]);
  const visibleCreatorItems = useMemo(
    () => filterCreatorItems(creatorItems, creatorSearch),
    [creatorItems, creatorSearch],
  );
  const allTags = policyContextData?.creatorTags ?? [];
  const creatorPageCount = Math.max(1, Math.ceil(visibleCreatorItems.length / AFFILIATE_CREATORS_PAGE_SIZE));
  const pagedVisibleCreatorItems = useMemo(() => {
    const start = (creatorPage - 1) * AFFILIATE_CREATORS_PAGE_SIZE;
    return visibleCreatorItems.slice(start, start + AFFILIATE_CREATORS_PAGE_SIZE);
  }, [creatorPage, visibleCreatorItems]);
  const creatorPageStart = visibleCreatorItems.length === 0
    ? 0
    : (creatorPage - 1) * AFFILIATE_CREATORS_PAGE_SIZE + 1;
  const creatorPageEnd = Math.min(creatorPage * AFFILIATE_CREATORS_PAGE_SIZE, visibleCreatorItems.length);

  useEffect(() => {
    setCreatorPage(1);
  }, [creatorSearch, needsAttentionOnly, selectedShopId, selectedTagId]);

  useEffect(() => {
    setCreatorPage((page) => Math.min(page, creatorPageCount));
  }, [creatorPageCount]);

  useEffect(() => {
    setCreatorPageInput(String(creatorPage));
  }, [creatorPage]);

  function commitCreatorPageInput(): void {
    const nextPage = Number.parseInt(creatorPageInput, 10);
    if (!Number.isFinite(nextPage)) {
      setCreatorPageInput(String(creatorPage));
      return;
    }
    const clampedPage = Math.min(creatorPageCount, Math.max(1, nextPage));
    setCreatorPage(clampedPage);
    setCreatorPageInput(String(clampedPage));
  }

  async function updateCreatorTag(creatorId: string, tagId: string, mode: "apply" | "remove"): Promise<void> {
    const key = `${mode}:${creatorId}:${tagId}`;
    setUpdatingTagKey(key);
    try {
      const variables = { input: { shopId: selectedShopId, creatorId, tagId } };
      if (mode === "apply") {
        await applyCreatorTag({ variables });
      } else {
        await removeCreatorTag({ variables });
      }
      showToast(t("ecommerce.affiliateWorkspace.creatorTagApplySuccess"), "success");
      await refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.affiliateWorkspace.creatorTagUpdateFailed"), "error");
    } finally {
      setUpdatingTagKey(null);
    }
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
          <h1>{t("ecommerce.affiliateWorkspace.creatorsTitle")}</h1>
          <p className="ecommerce-page-subtitle">
            {t("ecommerce.affiliateWorkspace.creatorsSubtitle")}
          </p>
        </div>
        <div className="affiliate-workbench-controls">
          <Select
            value={selectedShopId}
            onChange={setSelectedShopId}
            options={shopOptions}
            className="affiliate-workspace-shop-select"
            disabled={shopOptions.length === 0}
          />
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              void refetch();
              void refetchRelationshipWork();
            }}
            disabled={(loading || relationshipWorkLoading) || !selectedShopId}
          >
            {(loading || relationshipWorkLoading)
              ? t("common.loading")
              : t("ecommerce.shopDrawer.affiliate.refreshProposals")}
          </button>
        </div>
      </div>

      <div className="affiliate-workbench-panel">
        <div className="affiliate-workbench-panel-head affiliate-creators-panel-head">
          <div>
            <div className="affiliate-workbench-panel-title">
              {t("ecommerce.affiliateWorkspace.creatorsPanelTitle")}
            </div>
            <div className="form-hint">
              {t("ecommerce.affiliateWorkspace.creatorsPanelHint")}
            </div>
          </div>
          <div className="affiliate-attention-toolbar">
            <label className="affiliate-filter-field">
              <span>{t("ecommerce.affiliateWorkspace.creatorTagFilter")}</span>
              <Select
                value={selectedTagId}
                onChange={setSelectedTagId}
                options={tagOptions}
                className="affiliate-status-select"
                ariaLabel={t("ecommerce.affiliateWorkspace.creatorTagFilter")}
              />
            </label>
            <label className="affiliate-filter-field affiliate-filter-field-search">
              <span>{t("ecommerce.affiliateWorkspace.searchFilter")}</span>
              <input
                className="affiliate-attention-search"
                value={creatorSearch}
                onChange={(event) => setCreatorSearch(event.target.value)}
                placeholder={t("ecommerce.affiliateWorkspace.creatorSearchPlaceholder")}
                aria-label={t("ecommerce.affiliateWorkspace.creatorSearchPlaceholder")}
              />
            </label>
            <label className="affiliate-creators-toggle">
              <input
                type="checkbox"
                checked={needsAttentionOnly}
                onChange={(event) => setNeedsAttentionOnly(event.target.checked)}
              />
              <span>{t("ecommerce.affiliateWorkspace.creatorAttentionOnly")}</span>
            </label>
          </div>
        </div>

        {loading && visibleCreatorItems.length === 0 ? (
          <AffiliateLoadingState />
        ) : visibleCreatorItems.length === 0 ? (
          <div className="affiliate-proposal-empty">
            {t("ecommerce.affiliateWorkspace.emptyCreators")}
          </div>
        ) : (
          <div className="affiliate-creator-roster">
            {pagedVisibleCreatorItems.map((item) => (
              <CreatorRelationshipCard
                key={item.creatorId}
                item={item}
                workItems={workItemsByCreatorId.get(item.creatorId) ?? []}
                allTags={allTags}
                updatingTagKey={updatingTagKey}
                onOpenRelationship={(relationship) => setSelectedRelationship(relationship)}
                onUpdateTag={(creatorId, tagId, mode) => void updateCreatorTag(creatorId, tagId, mode)}
              />
            ))}
            {visibleCreatorItems.length > AFFILIATE_CREATORS_PAGE_SIZE ? (
              <div className="affiliate-collaboration-pagination affiliate-creator-pagination" aria-label={t("ecommerce.affiliateWorkspace.pagination")}>
                <span className="affiliate-collaboration-pagination-summary">
                  {t("ecommerce.affiliateWorkspace.pageSummary", {
                    start: creatorPageStart,
                    end: creatorPageEnd,
                    total: visibleCreatorItems.length,
                    page: creatorPage,
                    pages: creatorPageCount,
                  })}
                </span>
                <div className="affiliate-collaboration-pagination-actions">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={creatorPage <= 1}
                    onClick={() => setCreatorPage((page) => Math.max(1, page - 1))}
                  >
                    {t("ecommerce.affiliateWorkspace.prevPage")}
                  </button>
                  <span className="affiliate-collaboration-page-pill">
                    {t("ecommerce.affiliateWorkspace.page", {
                      page: creatorPage,
                      pages: creatorPageCount,
                    })}
                  </span>
                  <label className="affiliate-collaboration-page-jump">
                    <span>{t("ecommerce.affiliateWorkspace.jumpToPage")}</span>
                    <input
                      type="number"
                      min={1}
                      max={creatorPageCount}
                      value={creatorPageInput}
                      aria-label={t("ecommerce.affiliateWorkspace.jumpPageAria")}
                      onChange={(event) => setCreatorPageInput(event.target.value)}
                      onBlur={commitCreatorPageInput}
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
                    disabled={creatorPage >= creatorPageCount}
                    onClick={() => setCreatorPage((page) => Math.min(creatorPageCount, page + 1))}
                  >
                    {t("ecommerce.affiliateWorkspace.nextPage")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {selectedRelationship ? (
        <CreatorRelationshipDetailModal
          item={selectedRelationship}
          onClose={() => setSelectedRelationship(null)}
        />
      ) : null}
    </div>
  );
});

function CreatorRelationshipCard({
  item,
  workItems,
  allTags,
  updatingTagKey,
  onOpenRelationship,
  onUpdateTag,
}: {
  item: AffiliateCreatorManagementItem;
  workItems?: CreatorRelationshipWorkItem[];
  allTags: GQL.CreatorTag[];
  updatingTagKey: string | null;
  onOpenRelationship: (item: CreatorRelationshipDetailItem) => void;
  onUpdateTag: (creatorId: string, tagId: string, mode: "apply" | "remove") => void;
}) {
  const { t } = useTranslation();
  const profile = item.creatorProfile;
  const name = profile
    ? creatorPrimaryName(profile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : item.creatorId;
  const handle = profile ? creatorTikTokHandle(profile) : null;
  const platformId = profile ? creatorPlatformIdentity(profile) : item.latestCollaborationRecord?.creatorOpenId ?? null;
  const missingTags = allTags.filter((tag) => !item.tagIds.includes(tag.id));
  const latestRecord = item.latestCollaborationRecord;
  const latestStatus = latestRecord?.processingStatus
    ? t(`ecommerce.affiliateWorkspace.collaborationFilters.${latestRecord.processingStatus}`, {
      defaultValue: latestRecord.processingStatus,
    })
    : t("ecommerce.affiliateWorkspace.creatorStable");
  const lifecycleStage = item.shopState?.lifecycleStage ?? latestRecord?.lifecycleStage ?? null;
  const lifecycleLabel = lifecycleStage
    ? t(`ecommerce.affiliateWorkspace.lifecycleStages.${lifecycleStage}`, { defaultValue: lifecycleStage })
    : t("ecommerce.affiliateWorkspace.creatorUnknownStage");
  const followerCount = profile ? formatCount(profile.followerCount) : null;
  const relationshipDetail = relationshipDetailFromManagementItem(item, workItems ?? []);

  return (
    <article
      className="affiliate-creator-row affiliate-relationship-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpenRelationship(relationshipDetail)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenRelationship(relationshipDetail);
        }
      }}
    >
      <div className="affiliate-creator-row-main">
        <CreatorAvatarImage
          avatarUrl={profile?.avatarUrl}
          className="affiliate-creator-avatar"
          fallbackClassName="affiliate-creator-avatar-empty"
          name={name}
        />
        <div className="affiliate-creator-row-copy">
          <div className="affiliate-creator-row-title">
            <CreatorName name={name} onOpen={() => onOpenRelationship(relationshipDetail)} />
            <span className={`affiliate-creator-state ${item.needsAttention ? "affiliate-creator-state-attention" : ""}`}>
              {item.needsAttention
                ? t("ecommerce.affiliateWorkspace.creatorNeedsAttention")
                : t("ecommerce.affiliateWorkspace.creatorStable")}
            </span>
          </div>
          <div className="affiliate-creator-row-meta">
            <CreatorPlatformId handle={handle} platformId={platformId} />
            {followerCount ? <span>{followerCount}</span> : null}
            <span>{t("ecommerce.affiliateWorkspace.creatorActiveCollaborations", { count: item.activeCollaborationCount })}</span>
          </div>
          <div className="affiliate-creator-tag-list">
            {item.tags.length ? item.tags.map((tag) => {
              const updateKey = `remove:${item.creatorId}:${tag.id}`;
              return (
                <span className="affiliate-creator-tag" key={tag.id}>
                  <span>{creatorTagLabel(t, tag)}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onUpdateTag(item.creatorId, tag.id, "remove");
                    }}
                    disabled={updatingTagKey === updateKey}
                    aria-label={t("ecommerce.affiliateWorkspace.creatorTagRemove")}
                    title={t("ecommerce.affiliateWorkspace.creatorTagRemove")}
                  >
                    ×
                  </button>
                </span>
              );
            }) : (
              <span className="affiliate-creator-tag-empty">
                {t("ecommerce.affiliateWorkspace.creatorTagsEmpty")}
              </span>
            )}
            <span
              className="affiliate-creator-tag-select-wrap"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Select
                value=""
                onChange={(tagId) => onUpdateTag(item.creatorId, tagId, "apply")}
                options={missingTags.map((tag) => ({ value: tag.id, label: creatorTagLabel(t, tag) }))}
                placeholder={t("ecommerce.affiliateWorkspace.creatorTagAdd")}
                ariaLabel={t("ecommerce.affiliateWorkspace.creatorTagAdd")}
                disabled={missingTags.length === 0 || updatingTagKey?.startsWith(`apply:${item.creatorId}:`)}
                className="affiliate-creator-tag-select"
              />
            </span>
          </div>
        </div>
      </div>

      <div className="affiliate-creator-work-summary">
        <div className="affiliate-creator-work-summary-item">
          <span>{t("ecommerce.affiliateWorkspace.creatorLatestWork")}</span>
          <strong>{latestStatus}</strong>
          {latestRecord?.productId ? <small>{t("ecommerce.affiliateWorkspace.productContextConfirmed")}</small> : null}
        </div>
        <div className="affiliate-creator-work-summary-item">
          <span>{t("ecommerce.affiliateWorkspace.creatorLifecycle")}</span>
          <strong>{lifecycleLabel}</strong>
          {item.lastInteractionAt ? (
            <small>{t("ecommerce.affiliateWorkspace.creatorLastInteraction")}: {formatProposalTime(item.lastInteractionAt)}</small>
          ) : null}
        </div>
        <div className="affiliate-creator-work-summary-item">
          <span>{t("ecommerce.affiliateWorkspace.creatorPendingProposal")}</span>
          <strong>{item.latestPendingProposal?.operatorSummary ?? "—"}</strong>
        </div>
        <div className="affiliate-creator-work-summary-item">
          <span>{t("ecommerce.affiliateWorkspace.creatorSampleStatus")}</span>
          <strong>{item.latestSampleApplicationRecord?.sampleWorkStatus ?? "—"}</strong>
          {item.latestSampleApplicationRecord?.observedContentCount ? (
            <small>{formatCount(item.latestSampleApplicationRecord.observedContentCount)}</small>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CreatorRelationshipWorkCard({
  item,
  shopLabel,
  onOpen,
  onOpenRelationship,
}: {
  item: CreatorRelationshipWorkItem;
  shopLabel: string;
  onOpen: () => void;
  onOpenRelationship: (item: CreatorRelationshipDetailItem) => void;
}) {
  const { t } = useTranslation();
  const creatorName = item.creatorProfile
    ? creatorPrimaryName(item.creatorProfile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : t("ecommerce.affiliateWorkspace.unknownCreator");
  const creatorHandle = item.creatorProfile ? creatorTikTokHandle(item.creatorProfile) : null;
  const creatorPlatformId = item.creatorProfile ? creatorPlatformIdentity(item.creatorProfile) : item.creatorOpenId ?? null;
  const statusDisplay = creatorRelationshipStatusDisplay(item, t);
  const nextAction = t(`ecommerce.affiliateWorkspace.requiredActions.${item.requiredAction}`, {
    defaultValue: formatAffiliateEnumLabel(item.requiredAction),
  });

  return (
    <article
      className="affiliate-collaboration-card affiliate-creator-relationship-work-card"
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
          <CreatorAvatarImage
            avatarUrl={item.creatorProfile?.avatarUrl}
            className="affiliate-avatar affiliate-relationship-work-avatar-image"
            name={creatorName}
          />
          <div className="affiliate-creator-text">
            <CreatorName
              name={creatorName}
              onOpen={
                item.creatorProfile
                  ? () => onOpenRelationship({
                      creatorId: item.creatorProfile?.id ?? item.creatorId ?? "",
                      creatorProfile: item.creatorProfile,
                      creatorRelation: item.creatorRelation ?? null,
                      workItems: [item],
                    })
                  : undefined
              }
            />
            <CreatorPlatformId handle={creatorHandle} platformId={creatorPlatformId} />
            <div className="affiliate-work-item-meta">
              <span>{shopLabel}</span>
              <span>{formatProposalTime(item.stateUpdatedAt)}</span>
              <SystemIdCopy value={item.relationshipId} />
            </div>
          </div>
        </div>
        <RelationshipStatusBadge display={statusDisplay} tone={relationshipStatusTone(item.processingStatus)} />
      </div>
      <div className="affiliate-collaboration-card-body">
        <section className="affiliate-card-section affiliate-card-section-primary">
          <div className="affiliate-card-section-label">
            {t("ecommerce.affiliateWorkspace.creatorRelationshipWorkPrimaryObject")}
          </div>
          <div className="affiliate-card-section-title">
            {renderCreatorRelationshipWorkTitle(item, t)}
          </div>
          <div className="affiliate-card-section-copy">
            {renderCreatorRelationshipWorkSummary(item, t)}
          </div>
        </section>
        <div className="affiliate-relationship-work-card-priority">
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.sampleApplication.status")}
            value={statusDisplay.primary}
          />
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.labels.nextStep")}
            value={nextAction}
          />
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.relationshipWorkPendingProposals")}
            value={String(item.pendingProposals.length)}
          />
        </div>
        <div className="affiliate-collaboration-card-footer">
          <span>{t("ecommerce.affiliateWorkspace.openCreatorRelationshipWorkDetailHint")}</span>
          <button
            className="affiliate-collaboration-card-footer-action"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            <EyeIcon size={16} />
            <span>{t("ecommerce.affiliateWorkspace.viewDetails")}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function CollaborationRecordCard({
  record,
  shopLabel,
  onOpen,
}: {
  record: GQL.AffiliateCollaborationRecord;
  shopLabel: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const samples = record.sampleApplicationRecords ?? [];
  const primarySample = samples[0] ?? null;
  const sampleOrder = primarySample?.order;
  const trackingNumber = sampleOrder?.trackingNumber ?? primarySample?.trackingNumber ?? null;
  const carrier = sampleOrder?.carrier ?? primarySample?.carrier ?? null;
  const sampleStatus = primarySample
    ? t(`ecommerce.affiliateWorkspace.sampleWorkStatusLabels.${primarySample.sampleWorkStatus}`, {
        defaultValue: formatAffiliateEnumLabel(primarySample.sampleWorkStatus),
      })
    : t("ecommerce.affiliateWorkspace.sampleApplication.none");
  const statusDisplay = collaborationRecordStatusDisplay(record, t);
  const workView = buildCollaborationWorkView(record, null, t);
  const creatorProfile = record.creatorProfile ?? null;
  const creatorPlatformId = creatorProfile
    ? creatorPlatformIdentity(creatorProfile)
    : record.creatorOpenId ?? record.creatorImId ?? null;
  const creatorHandle = creatorProfile ? creatorTikTokHandle(creatorProfile) : null;
  const creatorLabel = creatorProfile
    ? creatorPrimaryName(creatorProfile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : creatorPlatformId
      ? `@${formatCompactIdentifier(creatorPlatformId, 24)}`
    : t("ecommerce.affiliateWorkspace.unknownCreator");
  const contentCount = primarySample?.observedContentCount ?? 0;
  const logisticsLabel = trackingNumber
    ? [carrier, trackingNumber].filter(Boolean).join(" ")
    : t("ecommerce.affiliateWorkspace.sampleApplication.noTrackingYet");

  return (
    <article
      className="affiliate-collaboration-card affiliate-collaboration-record-card"
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
          <CreatorAvatarImage
            avatarUrl={creatorProfile?.avatarUrl}
            className="affiliate-avatar affiliate-relationship-work-avatar-image"
            name={creatorLabel}
          />
          <div className="affiliate-creator-text">
            <div className="affiliate-creator-name-static">{creatorLabel}</div>
            <CreatorPlatformId handle={creatorHandle} platformId={creatorPlatformId} />
            <div className="affiliate-work-item-meta">
              <span>{shopLabel}</span>
              <span>{formatProposalTime(record.stateUpdatedAt ?? record.updatedAt)}</span>
              <SystemIdCopy value={record.id} />
            </div>
          </div>
        </div>
        <RelationshipStatusBadge display={statusDisplay} tone={collaborationStatusTone(record.processingStatus)} />
      </div>

      <div className="affiliate-collaboration-card-body affiliate-collaboration-record-card-body">
        <section className="affiliate-card-section affiliate-card-section-primary">
          <div className="affiliate-card-section-label">
            {t("ecommerce.affiliateWorkspace.collaborationRecords")}
          </div>
          <div className="affiliate-card-section-title">{workView.title}</div>
          <div className="affiliate-card-section-copy">{workView.description}</div>
        </section>

        <ProductSummaryCard
          product={null}
          productId={record.productId}
          shopId={record.shopId}
          label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
        />

        <div className="affiliate-relationship-work-card-priority">
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.labels.nextStep")}
            value={t(`ecommerce.affiliateWorkspace.requiredActions.${relationshipRequiredActionFromCollaboration(record.requiredAction)}`, {
              defaultValue: formatAffiliateEnumLabel(record.requiredAction),
            })}
          />
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.sampleApplication.status")}
            value={sampleStatus}
          />
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.sampleApplication.shippingProgress")}
            value={logisticsLabel}
          />
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.sampleApplication.contentProgress")}
            value={t("ecommerce.affiliateWorkspace.sampleApplication.contentProgressValue", {
              count: contentCount,
            })}
          />
        </div>

        <div className="affiliate-collaboration-card-footer">
          <span>{t("ecommerce.affiliateWorkspace.openCreatorRelationshipWorkDetailHint")}</span>
          <button
            className="affiliate-collaboration-card-footer-action"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            <EyeIcon size={16} />
            <span>{t("ecommerce.affiliateWorkspace.viewDetails")}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function RelationshipMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="affiliate-relationship-work-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RelationshipStatusBadge({
  display,
  tone,
  compact = false,
}: {
  display: { primary: string; secondary?: string | null };
  tone: CollaborationWorkViewModel["badgeTone"];
  compact?: boolean;
}) {
  return (
    <div className="affiliate-work-item-badges">
      <span className={[
        "affiliate-kind-badge",
        "affiliate-status-stack-badge",
        compact ? "affiliate-status-stack-badge-compact" : "",
        `affiliate-collaboration-tone-${tone}`,
      ].filter(Boolean).join(" ")}>
        <strong>{display.primary}</strong>
        {display.secondary ? <span>{display.secondary}</span> : null}
      </span>
    </div>
  );
}

function CollaborationRecordSubcard({
  record,
  compact = false,
  focused = false,
  statusDisplay,
  statusTone,
  samples = [],
  pendingProposals = [],
  productSummary,
  shopId,
  shopLabel,
  onOpenCreator,
  onApprove,
  onReject,
  onRequestRevision,
  decidingProposal = false,
}: {
  record: GQL.AffiliateCollaborationRecord;
  compact?: boolean;
  focused?: boolean;
  statusDisplay?: { primary: string; secondary?: string | null };
  statusTone?: CollaborationWorkViewModel["badgeTone"];
  samples?: GQL.SampleApplicationRecord[];
  pendingProposals?: GQL.ActionProposal[];
  productSummary?: GQL.EcomProductSummary | null;
  shopId?: string | null;
  shopLabel?: string;
  onOpenCreator?: (profile: GQL.AffiliateCreatorIdentity) => void;
  onApprove?: (proposal: GQL.ActionProposal) => Promise<void>;
  onReject?: (proposal: GQL.ActionProposal) => Promise<void>;
  onRequestRevision?: (proposal: GQL.ActionProposal, note: string) => Promise<void>;
  decidingProposal?: boolean;
}) {
  const { t } = useTranslation();
  const resolvedStatusDisplay = statusDisplay ?? collaborationRecordStatusDisplay(record, t);
  const resolvedStatusTone = statusTone ?? collaborationStatusTone(record.processingStatus);
  const primarySample = samples[0] ?? (record.sampleApplicationRecords ?? [])[0] ?? null;
  const productHeading = record.productId
    ? t("ecommerce.affiliateWorkspace.productIdShort", {
        productId: formatCompactIdentifier(record.productId, 28),
      })
    : t("ecommerce.affiliateWorkspace.relationshipConversationTitle");
  const sampleHeading = primarySample?.platformApplicationId
    ? `${t("ecommerce.affiliateWorkspace.sampleApplication.title")} ${formatCompactIdentifier(primarySample.platformApplicationId, 24)}`
    : null;
  return (
    <article className={[
      "affiliate-relationship-work-collaboration-subcard",
      compact ? "affiliate-relationship-work-collaboration-subcard-compact" : "",
      focused ? "affiliate-relationship-work-collaboration-subcard-focused" : "",
    ].filter(Boolean).join(" ")}>
      <div>
        <span>{t("ecommerce.affiliateWorkspace.collaborationRecordObject", {
          defaultValue: t("ecommerce.affiliateWorkspace.collaborationRecords"),
        })}</span>
        <strong>{sampleHeading ?? productHeading}</strong>
        {sampleHeading && record.productId ? (
          <small>{productHeading}</small>
        ) : null}
      </div>
      <div className="affiliate-relationship-work-collaboration-subcard-meta">
        <span>{t(`ecommerce.affiliateWorkspace.lifecycleStages.${record.lifecycleStage}`, {
          defaultValue: record.lifecycleStage,
        })}</span>
        <RelationshipStatusBadge display={resolvedStatusDisplay} tone={resolvedStatusTone} compact />
        <SystemIdCopy value={record.id} />
        <PlatformIdCopy value={record.productId ?? record.platformCollaborationId} />
      </div>
      {!compact ? (
        <div className="affiliate-relationship-work-collaboration-evidence">
          <ProductSummaryCard
            product={productSummary ?? null}
            productId={record.productId ?? primarySample?.productId}
            shopId={shopId ?? record.shopId}
            label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
          />
          <div className="affiliate-relationship-work-collaboration-evidence-header">
            <span>{t("ecommerce.affiliateWorkspace.sampleApplication.title")}</span>
            <strong>{samples.length}</strong>
          </div>
          {samples.length > 0 ? (
            <div className="affiliate-relationship-work-collaboration-sample-stack">
              {samples.map((sampleApplication) => (
                <SampleApplicationSummaryCard
                  key={sampleApplication.id}
                  sampleApplication={sampleApplication}
                  productSummary={sampleApplication.productId === record.productId ? productSummary : null}
                  shopId={shopId ?? record.shopId}
                  embedded
                />
              ))}
            </div>
          ) : (
            <div className="affiliate-relationship-work-collaboration-empty-evidence">
              {t("ecommerce.affiliateWorkspace.sampleApplication.none")}
            </div>
          )}
        </div>
      ) : null}
      {pendingProposals.length > 0 ? (
        <div className="affiliate-relationship-work-collaboration-proposals">
          <div className="affiliate-relationship-work-collaboration-evidence-header">
            <span>{t("ecommerce.affiliateWorkspace.relationshipWorkPendingProposals")}</span>
            <strong>{pendingProposals.length}</strong>
          </div>
          <div className="affiliate-relationship-work-collaboration-proposal-stack">
            {pendingProposals.map((proposal) => (
              <ActionProposalCard
                key={proposal.id}
                proposal={proposal}
                shopLabel={shopLabel ?? ""}
                variant="compact"
                allowDecisionActions
                decidingProposal={decidingProposal}
                onOpenCreator={onOpenCreator}
                onApprove={onApprove}
                onReject={onReject}
                onRequestRevision={onRequestRevision}
              />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function sampleBelongsToCollaboration(
  sample: GQL.SampleApplicationRecord,
  record: GQL.AffiliateCollaborationRecord,
): boolean {
  if (record.sampleApplicationRecordId && sample.id === record.sampleApplicationRecordId) return true;
  if (record.affiliateCollaborationId && sample.affiliateCollaborationId === record.affiliateCollaborationId) return true;
  if (record.platformCollaborationId && sample.platformCollaborationId === record.platformCollaborationId) return true;
  if (record.platformCollaborationId && sample.platformTargetCollaborationId === record.platformCollaborationId) return true;
  if (record.platformCollaborationId && sample.platformOpenCollaborationId === record.platformCollaborationId) return true;
  return Boolean(record.productId && sample.productId === record.productId);
}

type RelationshipTimelineEntryModel =
  {
    id: string;
    type: "event";
    time: string;
    kind: string;
    title: string;
    detail: string;
    cardPayload?: AffiliateCreatorMessageRawCardPayload | null;
    sampleApplication?: GQL.SampleApplicationRecord | null;
  };

function buildRelationshipHistoryTimelineEntries(
  items: GQL.AffiliateRelationshipHistoryItem[],
  sampleApplications: GQL.SampleApplicationRecord[],
  t: ReturnType<typeof useTranslation>["t"],
): RelationshipTimelineEntryModel[] {
  const sampleById = new Map<string, GQL.SampleApplicationRecord>();
  const sampleByPlatformId = new Map<string, GQL.SampleApplicationRecord>();
  for (const sample of sampleApplications) {
    sampleById.set(sample.id, sample);
    if (sample.platformApplicationId) sampleByPlatformId.set(sample.platformApplicationId, sample);
  }

  return items
    .map((item) => {
      const cardPayload = relationshipHistoryCardPayload(item);
      const sampleApplication = item.relatedIds.sampleApplicationRecordId
        ? sampleById.get(item.relatedIds.sampleApplicationRecordId) ?? null
        : cardPayload?.kind === "sample" && cardPayload.id
          ? sampleByPlatformId.get(cardPayload.id) ?? null
          : null;
      return {
        id: item.id,
        type: "event" as const,
        time: item.occurredAt,
        kind: relationshipHistoryKindLabel(item, t),
        title: relationshipHistoryTitle(item, t),
        detail: relationshipHistoryDetail(item, t),
        cardPayload,
        sampleApplication,
      };
    });
}

function relationshipHistoryKindLabel(
  item: GQL.AffiliateRelationshipHistoryItem,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const actorKey = relationshipHistoryActorRoleKey(item.actorRole ?? item.lifecycleEvent?.actorRole);
  return t(`ecommerce.affiliateWorkspace.historyActors.${actorKey}`, {
    defaultValue: formatAffiliateEnumLabel(actorKey),
  });
}

function relationshipHistoryTitle(
  item: GQL.AffiliateRelationshipHistoryItem,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (item.message) {
    const direction = item.message.direction
      ? t(`ecommerce.affiliateWorkspace.messageDirections.${item.message.direction}`, {
          defaultValue: formatAffiliateEnumLabel(item.message.direction),
        })
      : "";
    const channel = relationshipMessageChannelLabel(item.message, t);
    return [channel, direction].filter(Boolean).join(" · ");
  }
  if (item.lifecycleEvent) {
    return t(`ecommerce.affiliateWorkspace.lifecycleEvents.${item.lifecycleEvent.eventType}`, {
      defaultValue: formatAffiliateEnumLabel(item.lifecycleEvent.eventType),
    });
  }
  return item.summary;
}

function relationshipHistoryDetail(
  item: GQL.AffiliateRelationshipHistoryItem,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const lines: string[] = [];
  if (item.message?.subject) lines.push(item.message.subject);
  if (item.message?.textPreview && !parsePlatformCardPayload(item.message.textPreview)) {
    lines.push(item.message.textPreview);
  }
  if (item.message?.deliveryStatus) {
    const selection = item.message.channelSelectionSource
      ? t(`ecommerce.affiliateWorkspace.deliverySelection.${item.message.channelSelectionSource}`, {
          defaultValue: formatAffiliateEnumLabel(item.message.channelSelectionSource),
        })
      : "—";
    lines.push(t("ecommerce.affiliateWorkspace.deliveryAudit", {
      defaultValue: "{{selection}} · selected {{preferred}} · actual {{actual}} · {{status}}",
      selection,
      preferred: item.message.preferredChannel
        ? formatAffiliateEnumLabel(item.message.preferredChannel)
        : "—",
      actual: item.message.actualChannel
        ? formatAffiliateEnumLabel(item.message.actualChannel)
        : "—",
      status: formatAffiliateEnumLabel(item.message.deliveryStatus),
    }));
  }
  if (item.message?.errorMessage) {
    lines.push(t("ecommerce.affiliateWorkspace.deliveryFailure", {
      defaultValue: "Delivery failed: {{error}}",
      error: item.message.errorMessage,
    }));
  }
  if (item.lifecycleEvent?.displaySummary) lines.push(item.lifecycleEvent.displaySummary);
  if (!lines.length && item.summary && !item.lifecycleEvent) lines.push(item.summary);
  const facts = [
    item.relatedIds.productId
      ? t("ecommerce.affiliateWorkspace.productIdShort", {
          productId: formatCompactIdentifier(item.relatedIds.productId, 24),
        })
      : null,
    item.relatedIds.platformApplicationId
      ? `${t("ecommerce.affiliateWorkspace.sampleApplication.applicationId")} ${formatCompactIdentifier(item.relatedIds.platformApplicationId, 24)}`
      : null,
    item.message?.shopName ?? item.message?.accountLabel ?? null,
  ].filter((fact): fact is string => Boolean(fact));
  if (facts.length) lines.push(facts.join(" · "));
  return [...new Set(lines)].join("\n");
}

function relationshipHistoryActorRoleKey(role?: GQL.AffiliateLifecycleActorRole | null): string {
  switch (role) {
    case GQL.AffiliateLifecycleActorRole.Agent:
      return "AGENT_ACTION";
    case GQL.AffiliateLifecycleActorRole.Staff:
      return "STAFF_ACTION";
    case GQL.AffiliateLifecycleActorRole.Creator:
      return "CREATOR_ACTION";
    case GQL.AffiliateLifecycleActorRole.Platform:
      return "PLATFORM_EVENT";
    case GQL.AffiliateLifecycleActorRole.System:
    default:
      return "SYSTEM_RECORD";
  }
}

function relationshipMessageChannelLabel(
  message: GQL.AffiliateRelationshipHistoryMessageSummary,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (message.channel === GQL.AffiliateMessageChannel.PlatformChat) {
    return t("ecommerce.affiliateWorkspace.messageChannels.PLATFORM_CHAT", {
      defaultValue: "Platform chat",
    });
  }
  return message.channelLabel
    ?? t(`ecommerce.affiliateWorkspace.messageChannels.${message.channel}`, {
      defaultValue: formatAffiliateEnumLabel(message.channel),
    });
}

function relationshipHistoryCardPayload(
  item: GQL.AffiliateRelationshipHistoryItem,
): AffiliateCreatorMessageRawCardPayload | null {
  if (item.message?.textPreview) return parsePlatformCardPayload(item.message.textPreview);
  return null;
}

function RelationshipTimelineEntry({
  entry,
}: {
  entry: RelationshipTimelineEntryModel;
}) {
  const samplePayload = entry.cardPayload?.kind === "sample" && entry.cardPayload.id
    ? {
      platformApplicationId: entry.cardPayload.id,
      sampleApplicationRecord: entry.sampleApplication ?? null,
    }
    : null;
  return (
    <div className="affiliate-timeline-row" key={entry.id}>
      <div className="affiliate-timeline-dot" aria-hidden="true" />
      <div>
        <div className="affiliate-timeline-meta">
          <span>{entry.kind}</span>
          <span>{formatProposalTime(entry.time)}</span>
        </div>
        <div className="affiliate-timeline-event-card">
          <div className="affiliate-work-item-title">{entry.title}</div>
          {entry.detail ? (
            <div className="affiliate-work-item-preview">{entry.detail}</div>
          ) : null}
          {samplePayload ? (
            <div className="affiliate-conversation-card-stack affiliate-timeline-card-stack">
              <AffiliateCreatorMessageSampleRefCard refItem={samplePayload} />
            </div>
          ) : entry.cardPayload ? (
            <div className="affiliate-conversation-card-stack affiliate-timeline-card-stack">
              <AffiliateCreatorMessageRawPayloadCard payload={entry.cardPayload} />
            </div>
          ) : null}
        </div>
      </div>
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
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>("ALL");
  const [historySubStatusFilter, setHistorySubStatusFilter] = useState<HistorySubStatusFilter>(ALL_HISTORY_SUB_STATUS);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageInput, setHistoryPageInput] = useState("1");
  const [selectedRelationship, setSelectedRelationship] = useState<CreatorRelationshipDetailItem | null>(null);

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  const shopOptions = [
    { value: "", label: t("ecommerce.affiliateWorkspace.allShops") },
    ...shops
      .filter((shop) => shop.services?.affiliateService?.enabled)
      .map((shop) => ({
        value: shop.id,
        label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
      })),
  ];
  const historyStatusFilterOptions = useMemo(
    () => HISTORY_STATUS_FILTERS.map((filter) => ({
      value: filter,
      label: filter === "ALL"
        ? t("ecommerce.affiliateWorkspace.historyFilters.ALL")
        : t(`ecommerce.affiliateWorkspace.statusLabels.${filter}`, {
          defaultValue: formatAffiliateEnumLabel(filter),
        }),
    })),
    [t],
  );

  const processingStatus = useMemo(() => {
    if (historyStatusFilter === "ALL") return undefined;
    return historyStatusFilter;
  }, [historyStatusFilter]);
  const { data: collaborationRecordsData, loading, refetch } = useQuery<
    { collaborationRecords: GQL.AffiliateCollaborationRecord[] },
    { input: GQL.ReadAffiliateCollaborationRecordsInput }
  >(AFFILIATE_COLLABORATION_RECORDS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || undefined,
        processingStatus,
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

  const collaborationRecords = collaborationRecordsData?.collaborationRecords ?? [];
  const searchedItems = filterCollaborationRecords(collaborationRecords, historySearch, shopLabel)
    .filter((record) => collaborationRecordMatchesHistoryStatusFilter(record, historyStatusFilter));
  const historySubStatusOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = [{
      value: ALL_HISTORY_SUB_STATUS,
      label: t("ecommerce.affiliateWorkspace.allSubStatuses"),
    }];
    for (const record of searchedItems) {
      const key = collaborationRecordSubStatusKey(record) ?? NO_HISTORY_SUB_STATUS;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        value: key,
        label: relationshipSubStatusLabel(key, t),
      });
    }
    return options;
  }, [searchedItems, t]);
  const visibleItems = searchedItems
    .filter((record) => historySubStatusFilter === ALL_HISTORY_SUB_STATUS || (collaborationRecordSubStatusKey(record) ?? NO_HISTORY_SUB_STATUS) === historySubStatusFilter);
  const historyPageCount = Math.max(1, Math.ceil(visibleItems.length / CREATOR_RELATIONSHIP_WORK_PAGE_SIZE));
  const pagedVisibleItems = useMemo(() => {
    const start = (historyPage - 1) * CREATOR_RELATIONSHIP_WORK_PAGE_SIZE;
    return visibleItems.slice(start, start + CREATOR_RELATIONSHIP_WORK_PAGE_SIZE);
  }, [historyPage, visibleItems]);
  const pageStart = visibleItems.length === 0
    ? 0
    : (historyPage - 1) * CREATOR_RELATIONSHIP_WORK_PAGE_SIZE + 1;
  const pageEnd = Math.min(historyPage * CREATOR_RELATIONSHIP_WORK_PAGE_SIZE, visibleItems.length);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyStatusFilter, historySubStatusFilter, historySearch, selectedShopId]);

  useEffect(() => {
    if (!historySubStatusOptions.some((option) => option.value === historySubStatusFilter)) {
      setHistorySubStatusFilter(ALL_HISTORY_SUB_STATUS);
    }
  }, [historySubStatusFilter, historySubStatusOptions]);

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
          <div className="affiliate-workbench-panel-title-row">
            <div className="affiliate-workbench-panel-title">
              {t("ecommerce.affiliateWorkspace.collaborationRecords")}
            </div>
            <button
              className="affiliate-panel-info-button"
              type="button"
              aria-label={t("ecommerce.affiliateWorkspace.collaborationRecordsHint")}
              data-tooltip={t("ecommerce.affiliateWorkspace.collaborationRecordsHint")}
            >
              <InfoIcon />
            </button>
          </div>
          <div className="affiliate-attention-toolbar">
            <label className="affiliate-filter-field">
              <span>{t("ecommerce.affiliateWorkspace.statusFilter")}</span>
              <Select
                value={historyStatusFilter}
                onChange={(value) => {
                  setHistoryStatusFilter(value as HistoryStatusFilter);
                  setHistorySubStatusFilter(ALL_HISTORY_SUB_STATUS);
                }}
                options={historyStatusFilterOptions}
                className="affiliate-status-select"
                ariaLabel={t("ecommerce.affiliateWorkspace.statusFilter")}
              />
            </label>
            <label className="affiliate-filter-field">
              <span>{t("ecommerce.affiliateWorkspace.subStatusFilter")}</span>
              <Select
                value={historySubStatusFilter}
                onChange={(value) => setHistorySubStatusFilter(value)}
                options={historySubStatusOptions}
                className="affiliate-status-select"
                ariaLabel={t("ecommerce.affiliateWorkspace.subStatusFilter")}
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
              {pagedVisibleItems.map((record) => (
                <CollaborationRecordCard
                  key={record.id}
                  record={record}
                  shopLabel={shopLabel(record.shopId)}
                  onOpen={() => setSelectedRelationship(relationshipDetailFromWorkItem(
                    relationshipWorkItemFromCollaborationRecord(record, entityStore.affiliateWorkspace),
                  ))}
                />
              ))}
            </div>
            {visibleItems.length > CREATOR_RELATIONSHIP_WORK_PAGE_SIZE ? (
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

      {selectedRelationship ? (
        <CreatorRelationshipDetailModal
          item={selectedRelationship}
          onClose={() => setSelectedRelationship(null)}
        />
      ) : null}
    </div>
  );
});

function affiliateCreatorMessageKey(
  message: AffiliateConversationMessage,
): string {
  if (message.messageRef) return `message:${message.messageRef}`;
  if ("conversationIndex" in message && message.conversationIndex != null) {
    return `platform-index:${message.conversationIndex}`;
  }
  const channel = "channel" in message ? message.channel : "PLATFORM_CHAT";
  const sender = "senderId" in message ? message.senderId ?? "" : "";
  return `${channel}:${message.createdAt ?? "unknown"}:${sender}:${JSON.stringify(message.parts ?? [])}`;
}

function mergeAffiliateCreatorMessageHistoryItems(
  currentItems: GQL.AffiliateCreatorMessageHistoryItem[],
  nextItems: GQL.AffiliateCreatorMessageHistoryItem[],
): GQL.AffiliateCreatorMessageHistoryItem[] {
  const merged = new Map<string, GQL.AffiliateCreatorMessageHistoryItem>();
  for (const item of [...currentItems, ...nextItems]) {
    merged.set(affiliateCreatorMessageKey(item), item);
  }
  return [...merged.values()];
}

function mergeAffiliateRelationshipHistoryPayload(
  previous: { affiliateRelationshipHistory: GQL.AffiliateRelationshipHistoryPayload },
  next: { affiliateRelationshipHistory: GQL.AffiliateRelationshipHistoryPayload },
): { affiliateRelationshipHistory: GQL.AffiliateRelationshipHistoryPayload } {
  return {
    affiliateRelationshipHistory: {
      ...next.affiliateRelationshipHistory,
      items: mergeById([
        ...previous.affiliateRelationshipHistory.items,
        ...next.affiliateRelationshipHistory.items,
      ]).sort((left, right) =>
        new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
      ),
    },
  };
}

function AffiliateCreatorMessageRow({
  message,
  creatorRelationshipId,
}: {
  message: AffiliateConversationMessage;
  creatorRelationshipId: string;
}) {
  const { t } = useTranslation();
  const direction = message.direction ?? GQL.AffiliateCreatorMessageDirection.System;
  const text = message.parts
    .filter((part) => part.kind === GQL.AffiliateHistoryPartKind.Text)
    .map((part) => part.text?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n\n") || ("rawContent" in message ? message.rawContent?.trim() : "") || "";
  const time = message.createdAt
    ?? (typeof message.createTime === "number" ? new Date(message.createTime * 1000).toISOString() : null);
  const productRefs = "productRefs" in message ? message.productRefs ?? [] : [];
  const sampleRefs = "sampleApplicationRefs" in message ? message.sampleApplicationRefs ?? [] : [];
  const targetRefs = "targetCollaborationRefs" in message ? message.targetCollaborationRefs ?? [] : [];
  const channelLabel = message.accountLabel
    ?? message.shopName
    ?? ("channel" in message
      ? t(`ecommerce.affiliateWorkspace.messageChannels.${message.channel}`, {
          defaultValue: formatAffiliateEnumLabel(message.channel),
        })
      : null);
  const directionKey = String(direction).toLowerCase();
  const hasCardRefs = Boolean(productRefs.length || sampleRefs.length || targetRefs.length);
  const rawCardPayload = text ? parsePlatformCardPayload(text) : null;
  const shouldShowText = Boolean(text && !rawCardPayload);

  return (
    <div className={`affiliate-conversation-message-row affiliate-conversation-message-${directionKey}`}>
      <div className="affiliate-conversation-message-meta">
        <span>
          {t(`ecommerce.affiliateWorkspace.conversation.directions.${direction}`, {
            defaultValue: direction,
          })}
        </span>
        {time ? <span>{formatProposalTime(time)}</span> : null}
        {channelLabel ? <span>{channelLabel}</span> : null}
      </div>
      {shouldShowText ? (
        <div className="affiliate-conversation-message-text">{text}</div>
      ) : (
        <div className="affiliate-conversation-message-text affiliate-conversation-message-empty">
          {t("ecommerce.affiliateWorkspace.conversation.cardOnlyMessage")}
        </div>
      )}
      {hasCardRefs ? (
        <div className="affiliate-conversation-card-stack">
          {productRefs.map((ref) => (
            <AffiliateCreatorMessageProductRefCard key={`product:${ref.productId}`} refItem={ref} />
          ))}
          {sampleRefs.map((ref) => (
            <AffiliateCreatorMessageSampleRefCard key={`sample:${ref.platformApplicationId}`} refItem={ref} />
          ))}
          {targetRefs.map((ref) => (
            <AffiliateCreatorMessageTargetRefCard key={`target:${ref.platformTargetCollaborationId}`} refItem={ref} />
          ))}
        </div>
      ) : null}
      {rawCardPayload && !hasCardRefs ? (
        <div className="affiliate-conversation-card-stack">
          <AffiliateCreatorMessageRawPayloadCard payload={rawCardPayload} />
        </div>
      ) : null}
      {message.parts.some((part) => part.kind !== GQL.AffiliateHistoryPartKind.Text) ? (
        <div className="affiliate-conversation-card-stack">
          {message.parts.map((part, index) => (
            <AffiliateHistoryPartView
              key={`${message.messageRef}:${index}`}
              part={part}
              creatorRelationshipId={creatorRelationshipId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AffiliateHistoryPartView({
  part,
  creatorRelationshipId,
}: {
  part: GQL.AffiliateHistoryPart;
  creatorRelationshipId: string;
}) {
  const [downloading, setDownloading] = useState(false);
  if (part.kind === GQL.AffiliateHistoryPartKind.Text) return null;
  if (part.kind === GQL.AffiliateHistoryPartKind.Attachment) {
    return (
      <div className="affiliate-conversation-card affiliate-conversation-target-card">
        <div className="affiliate-conversation-card-icon" aria-hidden="true">A</div>
        <div className="affiliate-conversation-card-body">
          <strong>{part.fileName ?? "Attachment"}</strong>
          <span>{[part.mimeType, part.sizeBytes != null ? formatFileSize(part.sizeBytes) : null].filter(Boolean).join(" · ")}</span>
          {part.caption ? <span>{part.caption}</span> : null}
          {part.attachmentRef ? (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={downloading}
              onClick={() => void downloadAffiliateAttachment(part, creatorRelationshipId, setDownloading)}
            >
              {downloading ? "Loading…" : "Open / download"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  const id = part.productId ?? part.targetCollaborationId ?? part.sampleApplicationId;
  return (
    <div className="affiliate-conversation-card affiliate-conversation-target-card">
      <div className="affiliate-conversation-card-icon" aria-hidden="true">C</div>
      <div className="affiliate-conversation-card-body">
        <strong>{formatAffiliateEnumLabel(part.kind)}</strong>
        {id ? <PlatformIdCopy value={id} /> : null}
        {part.summary ? <span>{part.summary}</span> : null}
      </div>
    </div>
  );
}

async function downloadAffiliateAttachment(
  part: GQL.AffiliateHistoryPart,
  creatorRelationshipId: string,
  setDownloading: (value: boolean) => void,
): Promise<void> {
  if (!part.attachmentRef) return;
  setDownloading(true);
  try {
    const response = await fetch("/api/cloud/ecommerce/affiliate/read-message-attachment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Creator-Relationship-Id": creatorRelationshipId,
        "X-Affiliate-Read-Mode": "DOWNLOAD",
      },
      body: JSON.stringify({ attachmentRef: part.attachmentRef }),
    });
    if (!response.ok) throw new Error(`Attachment download failed (${response.status})`);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = part.fileName ?? "attachment";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } finally {
    setDownloading(false);
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type AffiliateCreatorMessageRawCardPayload = {
  id: string | null;
  kind: "product" | "sample" | "target" | "unknown";
};

function AffiliateCreatorMessageRawPayloadCard({
  payload,
}: {
  payload: AffiliateCreatorMessageRawCardPayload;
}) {
  const { t } = useTranslation();
  const label =
    payload.kind === "product"
      ? t("ecommerce.affiliateWorkspace.conversation.productCardLabel")
      : payload.kind === "sample"
        ? t("ecommerce.affiliateWorkspace.conversation.sampleApplicationCardLabel")
        : payload.kind === "target"
          ? t("ecommerce.affiliateWorkspace.conversation.targetCollaborationCardLabel")
          : t("ecommerce.affiliateWorkspace.conversation.cardOnlyMessage");
  const title =
    payload.kind === "sample"
      ? t("ecommerce.affiliateWorkspace.conversation.sampleApplicationCardTitle")
      : payload.kind === "target"
        ? t("ecommerce.affiliateWorkspace.conversation.targetCollaborationCardTitle")
        : label;
  return (
    <div className="affiliate-conversation-card affiliate-conversation-target-card">
      <div className="affiliate-conversation-card-icon" aria-hidden="true">
        {payload.kind === "product" ? "P" : payload.kind === "sample" ? "S" : payload.kind === "target" ? "T" : "C"}
      </div>
      <div className="affiliate-conversation-card-body">
        <span className="affiliate-conversation-card-kicker">{label}</span>
        <strong>{title}</strong>
        {payload.id ? (
          <div className="affiliate-conversation-card-meta">
            <PlatformIdCopy value={payload.id} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AffiliateCreatorMessageProductRefCard({
  refItem,
}: {
  refItem: AffiliateCreatorMessageProductReference;
}) {
  const { t } = useTranslation();
  const product = refItem.productSummary;
  const price = formatConversationProductPrice(product);
  return (
    <div className="affiliate-conversation-card affiliate-conversation-product-card">
      <div className="affiliate-conversation-card-media">
        {product?.coverImage ? (
          <RemoteMediaImage alt="" loading="lazy" sourceUrl={product.coverImage} />
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <div className="affiliate-conversation-card-body">
        <span className="affiliate-conversation-card-kicker">
          {t("ecommerce.affiliateWorkspace.conversation.productCardLabel")}
        </span>
        <strong>{product?.title || t("ecommerce.affiliateWorkspace.productContextConfirmed")}</strong>
        <div className="affiliate-conversation-card-meta">
          {price ? <span className="affiliate-conversation-card-price">{price}</span> : null}
          {product?.status ? (
            <span>
              {t(`ecommerce.productCard.statusLabels.${product.status}`, {
                defaultValue: formatAffiliateEnumLabel(product.status),
              })}
            </span>
          ) : null}
          <PlatformIdCopy value={refItem.productId} />
        </div>
      </div>
    </div>
  );
}

function AffiliateCreatorMessageSampleRefCard({
  refItem,
}: {
  refItem: AffiliateCreatorMessageSampleApplicationReference;
}) {
  const { t } = useTranslation();
  const sample = refItem.sampleApplicationRecord;
  return (
    <div className="affiliate-conversation-card affiliate-conversation-sample-card">
      <div className="affiliate-conversation-card-icon" aria-hidden="true">S</div>
      <div className="affiliate-conversation-card-body">
        <span className="affiliate-conversation-card-kicker">
          {t("ecommerce.affiliateWorkspace.conversation.sampleApplicationCardLabel")}
        </span>
        <strong>
          {sample?.sampleWorkStatus
            ? t(`ecommerce.affiliateWorkspace.sampleWorkStatusLabels.${sample.sampleWorkStatus}`, {
                defaultValue: formatAffiliateEnumLabel(sample.sampleWorkStatus),
              })
            : t("ecommerce.affiliateWorkspace.conversation.sampleApplicationCardTitle")}
        </strong>
        <div className="affiliate-conversation-card-meta">
          <PlatformIdCopy value={refItem.platformApplicationId} />
          {sample?.observedContentCount != null ? (
            <span>{t("ecommerce.affiliateWorkspace.sampleApplication.contentCount")}: {sample.observedContentCount}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AffiliateCreatorMessageTargetRefCard({
  refItem,
}: {
  refItem: AffiliateCreatorMessageTargetCollaborationReference;
}) {
  const { t } = useTranslation();
  const collaboration = refItem.affiliateCollaboration;
  const productCount = collaboration?.productIds?.length ?? 0;
  return (
    <div className="affiliate-conversation-card affiliate-conversation-target-card">
      <div className="affiliate-conversation-card-icon" aria-hidden="true">T</div>
      <div className="affiliate-conversation-card-body">
        <span className="affiliate-conversation-card-kicker">
          {t("ecommerce.affiliateWorkspace.conversation.targetCollaborationCardLabel")}
        </span>
        <strong>
          {collaboration?.status
            ? formatAffiliateEnumLabel(collaboration.status)
            : t("ecommerce.affiliateWorkspace.conversation.targetCollaborationCardTitle")}
        </strong>
        <div className="affiliate-conversation-card-meta">
          <PlatformIdCopy value={refItem.platformTargetCollaborationId} />
          {productCount > 0 ? (
            <span>{t("ecommerce.affiliateWorkspace.conversation.productCount", { count: productCount })}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function parsePlatformCardPayload(value: string): AffiliateCreatorMessageRawCardPayload | null {
  const text = value.trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const targetId = stringRecordValue(parsed, "target_collaboration_id") ?? stringRecordValue(parsed, "invitation_group_id");
    if (targetId) return { id: targetId, kind: "target" };
    const sampleId = stringRecordValue(parsed, "application_id") ?? stringRecordValue(parsed, "apply_id");
    if (sampleId) return { id: sampleId, kind: "sample" };
    const productId = stringRecordValue(parsed, "product_id");
    if (productId) return { id: productId, kind: "product" };
    return null;
  } catch {
    return null;
  }
}

function stringRecordValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function formatConversationProductPrice(product: GQL.EcomProductSummary | null | undefined): string | null {
  if (!product?.priceMin) return null;
  const currency = product.skus?.find((sku) => sku.currency)?.currency;
  const min = formatConversationMoney(product.priceMin, currency);
  if (product.priceMax && product.priceMax !== product.priceMin) {
    const max = formatConversationMoney(product.priceMax, currency);
    return min && max ? `${min} - ${max}` : `${product.priceMin} - ${product.priceMax}`;
  }
  return min ?? product.priceMin;
}

function formatConversationMoney(amount: string | null | undefined, currency?: GQL.EcomProductSkuCurrency | null): string | null {
  if (!amount) return null;
  const value = Number.parseFloat(amount);
  if (!Number.isFinite(value)) return amount;
  const normalizedCurrency = typeof currency === "string" && currency.length === 3 ? currency : "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return amount;
  }
}

function proposalTimelineKindKey(status: GQL.ActionProposalStatus): string {
  if (status === GQL.ActionProposalStatus.Pending) {
    return "APPROVAL_REQUIRED";
  }
  if (status === GQL.ActionProposalStatus.Rejected) {
    return "ACTION_REJECTED";
  }
  if (status === GQL.ActionProposalStatus.RevisionRequested) {
    return "MANUAL_FOLLOW_UP";
  }
  return "ACTION_EXECUTED";
}

function ActionProposalCard({
  proposal,
  shopLabel,
  decidingProposal = false,
  variant = "full",
  allowDecisionActions,
  affiliateWorkspace,
  onOpenRelationshipWork,
  onOpenCreator,
  onApprove,
  onReject,
  onRequestRevision,
}: {
  proposal: GQL.ActionProposal;
  shopLabel: string;
  decidingProposal?: boolean;
  variant?: "full" | "compact";
  allowDecisionActions?: boolean;
  affiliateWorkspace?: AffiliateWorkspaceStore;
  onOpenRelationshipWork?: (item: CreatorRelationshipWorkItem) => void;
  onOpenCreator?: (profile: GQL.AffiliateCreatorIdentity) => void;
  onApprove?: (proposal: GQL.ActionProposal) => Promise<void>;
  onReject?: (proposal: GQL.ActionProposal) => Promise<void>;
  onRequestRevision?: (proposal: GQL.ActionProposal, note: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [compactOpen, setCompactOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const creatorName = proposal.creatorProfile
    ? creatorPrimaryName(proposal.creatorProfile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : t("ecommerce.affiliateWorkspace.unknownCreator");
  const creatorHandle = proposal.creatorProfile ? creatorTikTokHandle(proposal.creatorProfile) : null;
  const creatorPlatformId = proposal.creatorProfile ? creatorPlatformIdentity(proposal.creatorProfile) : null;
  const recommendationTitle = renderProposalRecommendationTitle(proposal, t);
  const executionDescription = renderProposalExecutionDescription(proposal, t);
  const messagePreview = getProposalMessagePreview(proposal);
  const predictionSnapshot = findProposalPredictionSnapshot(proposal);
  const isCompact = variant === "compact";
  const bodyExpanded = !isCompact || compactOpen;
  const canDecide =
    proposal.status === GQL.ActionProposalStatus.Pending &&
    Boolean(onApprove && onReject) &&
    (allowDecisionActions ?? !isCompact);
  const canRequestRevision = canDecide && Boolean(onRequestRevision);
  const trimmedRevisionNote = revisionNote.trim();
  const proposalStepCount = proposal.steps?.length ?? 0;
  const proposalStepCountLabel = proposalStepCount > 1
    ? t("ecommerce.affiliateWorkspace.activity.proposalStepCount", { count: proposalStepCount })
    : null;
  const detailItem = relationshipWorkItemFromProposal(proposal, affiliateWorkspace);
  const canOpenRelationshipWork = !isCompact && Boolean(detailItem && onOpenRelationshipWork);
  const openPrimaryTarget = () => {
    if (canOpenRelationshipWork && detailItem && onOpenRelationshipWork) onOpenRelationshipWork(detailItem);
  };
  const shouldShowProductSummary = hasProposalProductContext(proposal);
  const statusBadge = (
    <span className={`affiliate-kind-badge affiliate-kind-${proposal.status.toLowerCase()}`}>
      {t(`ecommerce.affiliateWorkspace.proposalFilters.${proposal.status}`, {
        defaultValue: proposal.status,
      })}
    </span>
  );
  const revisionEditor = canDecide && revisionOpen ? (
    <div
      className="affiliate-proposal-revision-box"
      onClick={(event) => event.stopPropagation()}
    >
      <label className="affiliate-proposal-revision-label" htmlFor={`proposal-revision-${proposal.id}`}>
        {t("ecommerce.shopDrawer.affiliate.proposalRevisionNoteLabel")}
      </label>
      <textarea
        id={`proposal-revision-${proposal.id}`}
        className="affiliate-proposal-revision-textarea"
        value={revisionNote}
        rows={3}
        maxLength={1200}
        placeholder={t("ecommerce.shopDrawer.affiliate.proposalRevisionNotePlaceholder")}
        disabled={decidingProposal}
        onChange={(event) => setRevisionNote(event.target.value)}
      />
      <div className="affiliate-proposal-revision-foot">
        <span>
          {t("ecommerce.shopDrawer.affiliate.proposalRevisionNoteHint")}
        </span>
        <span>{trimmedRevisionNote.length}/1200</span>
      </div>
    </div>
  ) : null;
  const decisionActions = canDecide ? (
    <div className="affiliate-work-item-actions">
      {revisionOpen ? (
        <button
          className="btn btn-secondary"
          type="button"
          disabled={decidingProposal}
          onClick={(event) => {
            event.stopPropagation();
            setRevisionOpen(false);
            setRevisionNote("");
          }}
        >
          {t("common.cancel", { defaultValue: "Cancel" })}
        </button>
      ) : (
        <>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={decidingProposal}
            onClick={(event) => {
              event.stopPropagation();
              void onReject?.(proposal);
            }}
          >
            {t("common.reject", { defaultValue: "Reject" })}
          </button>
          {canRequestRevision ? (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={decidingProposal}
              onClick={(event) => {
                event.stopPropagation();
                setRevisionOpen(true);
              }}
            >
              {t("ecommerce.shopDrawer.affiliate.requestProposalRevision")}
            </button>
          ) : null}
        </>
      )}
      <button
        className="btn btn-primary"
        type="button"
        disabled={decidingProposal || (revisionOpen && !trimmedRevisionNote)}
        onClick={(event) => {
          event.stopPropagation();
          if (revisionOpen) {
            if (!trimmedRevisionNote) return;
            const revisionPromise = onRequestRevision?.(proposal, trimmedRevisionNote);
            if (revisionPromise) {
              void revisionPromise.then(() => {
                setRevisionOpen(false);
                setRevisionNote("");
              });
            }
            return;
          }
          void onApprove?.(proposal);
        }}
      >
        {revisionOpen
          ? t("ecommerce.shopDrawer.affiliate.sendProposalRevisionRequest")
          : t("common.approve", { defaultValue: "Approve" })}
      </button>
    </div>
  ) : null;

  if (!isCompact) {
    return (
      <article
        className={[
          "affiliate-work-item-card",
          "affiliate-work-item-needs_attention",
          "affiliate-action-proposal-card-row",
          canOpenRelationshipWork ? "affiliate-work-item-clickable" : "",
        ].filter(Boolean).join(" ")}
        role={canOpenRelationshipWork ? "button" : undefined}
        tabIndex={canOpenRelationshipWork ? 0 : undefined}
        onClick={() => {
          if (canOpenRelationshipWork) openPrimaryTarget();
        }}
        onKeyDown={(event) => {
          if (!canOpenRelationshipWork) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPrimaryTarget();
          }
        }}
      >
        <div className="affiliate-proposal-row-shell">
          <div className="affiliate-proposal-row-identity">
            <div className="affiliate-creator-block">
              <CreatorAvatarImage
                avatarUrl={proposal.creatorProfile?.avatarUrl}
                className="affiliate-avatar affiliate-remote-avatar-image"
                name={creatorName}
              />
              <div className="affiliate-creator-text">
                <CreatorName
                  name={creatorName}
                  onOpen={
                    proposal.creatorProfile && onOpenCreator
                      ? () => onOpenCreator(proposal.creatorProfile as GQL.AffiliateCreatorIdentity)
                      : undefined
                  }
                />
                <CreatorPlatformId
                  handle={creatorHandle}
                  platformId={creatorPlatformId}
                />
                <div className="affiliate-work-item-meta">
                  <span>{shopLabel}</span>
                  <span>{formatProposalTime(proposal.updatedAt)}</span>
                </div>
              </div>
            </div>
            <div className="affiliate-proposal-row-id-actions">
              <SystemIdCopy value={proposal.id} />
            </div>
          </div>

          <div className="affiliate-proposal-row-main">
            <div className="affiliate-proposal-row-heading">
              <div>
                <div className="affiliate-card-section-label">
                  {t("ecommerce.affiliateWorkspace.labels.aiRecommendation")}
                </div>
                <div className="affiliate-card-section-title">{recommendationTitle}</div>
              </div>
              {statusBadge}
            </div>
            {proposal.operatorSummary ? (
              <div className="affiliate-card-section-copy affiliate-proposal-row-summary">{proposal.operatorSummary}</div>
            ) : null}
            <div className="affiliate-proposal-row-context">
              <ProposalPredictionComparison
                proposal={proposal}
                snapshot={predictionSnapshot}
              />
              {shouldShowProductSummary ? (
                <ProposalProductSummary
                  proposal={proposal}
                  label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
                />
              ) : null}
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
            </div>
          </div>

          <aside className="affiliate-proposal-row-decision" onClick={(event) => event.stopPropagation()}>
            <div className="affiliate-proposal-row-decision-meta">
              <span>{formatActionProposalTypeLabel(proposal.type, t)}</span>
              {proposalStepCountLabel ? <span>{proposalStepCountLabel}</span> : null}
              <strong>{formatProposalTime(proposal.updatedAt)}</strong>
            </div>
            {decisionActions}
          </aside>
        </div>
        {revisionEditor}
      </article>
    );
  }

  return (
    <article
      className={[
        "affiliate-work-item-card",
        "affiliate-work-item-needs_attention",
        isCompact ? "affiliate-action-proposal-card-compact" : "",
        canOpenRelationshipWork ? "affiliate-work-item-clickable" : "",
      ].filter(Boolean).join(" ")}
      role={canOpenRelationshipWork ? "button" : undefined}
      tabIndex={canOpenRelationshipWork ? 0 : undefined}
      onClick={() => {
        if (canOpenRelationshipWork) openPrimaryTarget();
      }}
      onKeyDown={(event) => {
        if (!canOpenRelationshipWork) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPrimaryTarget();
        }
      }}
    >
      <div className="affiliate-work-item-head">
        <div className="affiliate-creator-block">
          <CreatorAvatarImage
            avatarUrl={proposal.creatorProfile?.avatarUrl}
            className="affiliate-avatar affiliate-remote-avatar-image"
            name={creatorName}
          />
          <div className="affiliate-creator-text">
            <CreatorName
              name={creatorName}
              onOpen={
                proposal.creatorProfile && onOpenCreator
                  ? () => onOpenCreator(proposal.creatorProfile as GQL.AffiliateCreatorIdentity)
                  : undefined
              }
            />
            <CreatorPlatformId
              handle={creatorHandle}
              platformId={creatorPlatformId}
            />
            <div className="affiliate-work-item-meta">
              <span>{shopLabel}</span>
              <span>{formatProposalTime(proposal.updatedAt)}</span>
              {proposalStepCountLabel ? <span>{proposalStepCountLabel}</span> : null}
              <SystemIdCopy value={proposal.id} />
            </div>
          </div>
        </div>
        <div className="affiliate-work-item-badges">
          {statusBadge}
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
          {isCompact ? (
            <div className="affiliate-card-section-footline">
              <span>{formatActionProposalTypeLabel(proposal.type, t)}</span>
              {proposalStepCountLabel ? <span>{proposalStepCountLabel}</span> : null}
              <span>{formatProposalTime(proposal.updatedAt)}</span>
            </div>
          ) : null}
        </section>
        {bodyExpanded ? (
          <>
            <ProposalPredictionComparison
              proposal={proposal}
              snapshot={predictionSnapshot}
            />
            {shouldShowProductSummary ? (
              <ProposalProductSummary
                proposal={proposal}
                label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
              />
            ) : null}
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
          </>
        ) : null}
      </div>

      {isCompact ? (
        <button
          className="affiliate-inline-detail-toggle"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setCompactOpen((value) => !value);
          }}
        >
          {compactOpen
            ? t("ecommerce.affiliateWorkspace.sampleApplication.hideDetails")
            : t("ecommerce.affiliateWorkspace.sampleApplication.showDetails")}
        </button>
      ) : null}

      {canDecide ? (
        <>
          {revisionEditor}
          {decisionActions}
        </>
      ) : null}
    </article>
  );
}

function ProposalPredictionComparison({
  proposal,
  snapshot,
}: {
  proposal: GQL.ActionProposal;
  snapshot: GQL.AffiliateCollaborationRecordPredictionSnapshot | null;
}) {
  const { t } = useTranslation();
  const output = readPredictionSnapshotOutput(snapshot);
  if (!output) return null;
  const humanBaseline = output?.humanBaseline ?? null;
  const expectedSalesUnits = output?.expectedSalesUnits ?? null;
  const hasHumanBaseline = typeof humanBaseline?.wouldApprove === "boolean";
  const hasPrediction = typeof expectedSalesUnits === "number" || hasHumanBaseline;
  if (!hasPrediction) return null;

  const predictionJudgmentLabel = getPredictionSalesJudgmentLabel(expectedSalesUnits, t);
  const humanDecisionLabel = hasHumanBaseline
    ? humanBaseline?.wouldApprove
      ? t("ecommerce.affiliateWorkspace.predictionComparison.humanWouldApprove")
      : t("ecommerce.affiliateWorkspace.predictionComparison.humanWouldReject")
    : t("ecommerce.affiliateWorkspace.predictionComparison.humanInsufficient");
  const probability = typeof humanBaseline?.humanApprovalProbability === "number"
    ? formatPercent(humanBaseline.humanApprovalProbability)
    : null;

  return (
    <section className="affiliate-prediction-comparison" aria-label={t("ecommerce.affiliateWorkspace.predictionComparison.title")}>
      <div className="affiliate-prediction-comparison-head">
        <span>{t("ecommerce.affiliateWorkspace.predictionComparison.title")}</span>
      </div>
      <div className="affiliate-prediction-comparison-grid">
        <div className="affiliate-prediction-metric">
          <span>{t("ecommerce.affiliateWorkspace.predictionComparison.predictionJudgment")}</span>
          <strong>{predictionJudgmentLabel}</strong>
        </div>
        <div className="affiliate-prediction-metric">
          <span>{t("ecommerce.affiliateWorkspace.predictionComparison.humanBaseline")}</span>
          <strong>{humanDecisionLabel}</strong>
          {probability ? (
            <small>
              {t("ecommerce.affiliateWorkspace.predictionComparison.humanApprovalProbability", { probability })}
            </small>
          ) : null}
        </div>
        <div className="affiliate-prediction-metric">
          <span>{t("ecommerce.affiliateWorkspace.predictionComparison.expectedSales")}</span>
          <strong>
            {typeof expectedSalesUnits === "number"
              ? t("ecommerce.affiliateWorkspace.predictionComparison.expectedSalesValue", {
                  units: formatCompactNumber(expectedSalesUnits),
                })
              : t("ecommerce.affiliateWorkspace.predictionComparison.unknown")}
          </strong>
        </div>
      </div>
    </section>
  );
}

function SampleApplicationSummaryCard({
  sampleApplication,
  productSummary,
  shopId,
  embedded = false,
}: {
  sampleApplication: GQL.SampleApplicationRecord;
  productSummary?: GQL.EcomProductSummary | null;
  shopId?: string | null;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const [detailOpen, setDetailOpen] = useState(false);
  const sampleOrder = sampleApplication.order;
  const trackingNumber = sampleOrder?.trackingNumber ?? sampleApplication.trackingNumber;
  const carrier = sampleOrder?.carrier ?? sampleApplication.carrier;
  const status = t(`ecommerce.affiliateWorkspace.sampleWorkStatusLabels.${sampleApplication.sampleWorkStatus}`, {
    defaultValue: formatAffiliateEnumLabel(sampleApplication.sampleWorkStatus),
  });
  const detailFields = [
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.applicationId"),
      value: sampleApplication.platformApplicationId,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.status"),
      value: status,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.productId"),
      value: sampleApplication.productId,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.collaborationId"),
      value: sampleApplication.platformCollaborationId ?? sampleApplication.affiliateCollaborationId,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.openCollaborationId"),
      value: sampleApplication.platformOpenCollaborationId,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.targetCollaborationId"),
      value: sampleApplication.platformTargetCollaborationId,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.latestContent"),
      value: sampleApplication.latestObservedContentId,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.latestContentAt"),
      value: sampleApplication.latestObservedContentAt
        ? formatProposalTime(sampleApplication.latestObservedContentAt)
        : null,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.latestContentViews"),
      value: sampleApplication.latestObservedContentViewCount != null
        ? formatCompactNumber(sampleApplication.latestObservedContentViewCount)
        : null,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.carrier"),
      value: carrier,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.shippedAt"),
      value: sampleApplication.shippedAt ? formatProposalTime(sampleApplication.shippedAt) : null,
    },
    {
      label: t("ecommerce.affiliateWorkspace.sampleApplication.deliveredAt"),
      value: sampleApplication.deliveredAt ? formatProposalTime(sampleApplication.deliveredAt) : null,
    },
  ].filter((field): field is { label: string; value: string } =>
    typeof field.value === "string" && field.value.trim().length > 0,
  );
  const contentCount = sampleApplication.observedContentCount ?? 0;

  return (
    <article className={[
      "affiliate-collaboration-sample-card",
      embedded ? "affiliate-collaboration-sample-card-embedded" : "",
      detailOpen ? "affiliate-collaboration-sample-card-expanded" : "",
    ].filter(Boolean).join(" ")}>
      <div className="affiliate-collaboration-sample-card-head">
        <div>
          <span>{t("ecommerce.affiliateWorkspace.sampleApplication.title")}</span>
          <strong>{t("ecommerce.affiliateWorkspace.sampleApplication.title")}</strong>
          <PlatformIdCopy value={sampleApplication.platformApplicationId} labelKey="ecommerce.affiliateWorkspace.copySamplePlatformId" />
        </div>
        <div className="affiliate-collaboration-sample-status">{status}</div>
      </div>
      {!embedded ? (
        <ProductSummaryCard
          product={productSummary ?? null}
          productId={sampleApplication.productId}
          shopId={shopId ?? sampleApplication.shopId}
          label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
        />
      ) : null}
      <div className="affiliate-collaboration-sample-grid">
        <SampleApplicationFact
          label={t("ecommerce.affiliateWorkspace.sampleApplication.contentProgress")}
          value={t("ecommerce.affiliateWorkspace.sampleApplication.contentProgressValue", {
            count: contentCount,
          })}
        />
        <SampleApplicationFact
          label={t("ecommerce.affiliateWorkspace.sampleApplication.shippingProgress")}
          value={trackingNumber || t("ecommerce.affiliateWorkspace.sampleApplication.noTrackingYet")}
        />
        <SampleApplicationFact
          label={t("ecommerce.affiliateWorkspace.sampleApplication.updatedAt")}
          value={formatProposalTime(sampleApplication.updatedAt)}
        />
      </div>
      {detailOpen ? (
        <div className="affiliate-collaboration-sample-details">
          <div className="affiliate-collaboration-sample-details-grid">
            {detailFields.map((field) => (
              <SampleApplicationFact
                key={field.label}
                label={field.label}
                value={field.value}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div className="affiliate-collaboration-sample-footer">
        <button
          className="affiliate-inline-link-button"
          type="button"
          aria-expanded={detailOpen}
          onClick={() => setDetailOpen((value) => !value)}
        >
          {detailOpen
            ? t("ecommerce.affiliateWorkspace.sampleApplication.hideDetails")
            : t("ecommerce.affiliateWorkspace.sampleApplication.showDetails")}
        </button>
      </div>
    </article>
  );
}

function SampleApplicationFact({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="affiliate-entity-fact">
      <span>{label}</span>
      <strong>{value == null || value === "" ? "—" : value}</strong>
    </div>
  );
}

function SampleApplicationCopyFact({
  label,
  value,
  kind,
}: {
  label: string;
  value?: string | null;
  kind: "system" | "platform";
}) {
  return (
    <div className="affiliate-entity-fact">
      <span>{label}</span>
      {kind === "system" ? <SystemIdCopy value={value} /> : <PlatformIdCopy value={value} />}
    </div>
  );
}

function ProposalProductSummary({ proposal, label }: { proposal: GQL.ActionProposal; label?: string }) {
  const productId = proposal.collaborationRecord?.productId ?? getProposalActionProductId(proposal);
  return (
    <ProductSummaryCard
      product={proposal.productSummary ?? null}
      productId={productId}
      shopId={proposal.focusShopId}
      label={label}
    />
  );
}

function hasProposalProductContext(proposal: GQL.ActionProposal): boolean {
  return Boolean(
    proposal.productSummary ||
    proposal.collaborationRecord?.productId ||
    getProposalActionProductId(proposal),
  );
}

function relationshipWorkItemFromProposal(
  proposal: GQL.ActionProposal,
  workspace?: AffiliateWorkspaceStore,
): CreatorRelationshipWorkItem | null {
  const projection = relationshipProjectionSnapshot(workspace, proposal.creatorRelationshipId);
  const proposalProjection = proposalProjectionSnapshot(workspace, proposal.id);
  const hydratedProposal = hydrateAffiliateProposalProjection(proposalProjection ?? { proposal });
  const projectionCollaborations = (projection?.collaborationRecords ?? []) as GQL.AffiliateCollaborationRecord[];
  const projectionPendingProposals = ((projection?.actionProposals ?? []) as GQL.ActionProposal[])
    .filter((item) => item.status === GQL.ActionProposalStatus.Pending);
  const focusCollaboration =
    hydratedProposal.collaborationRecord ??
    projectionCollaborations.find((record) => record.id === hydratedProposal.collaborationRecordId) ??
    projectionCollaborations[0] ??
    null;
  const relationship = projection?.creatorRelationship ?? hydratedProposal.creatorRelationship ?? null;
  const activeCollaborations = mergeById([
    ...(focusCollaboration ? [focusCollaboration] : []),
    ...projectionCollaborations,
  ]);
  const pendingProposals = mergeById([
    ...(hydratedProposal.status === GQL.ActionProposalStatus.Pending ? [hydratedProposal] : []),
    ...projectionPendingProposals,
  ]);
  return {
    relationshipId: hydratedProposal.creatorRelationshipId,
    shopId: hydratedProposal.focusShopId,
    creatorId: relationship?.creatorId ?? hydratedProposal.creatorId ?? focusCollaboration?.creatorId ?? null,
    creatorOpenId: focusCollaboration?.creatorOpenId ?? null,
    creatorImId: focusCollaboration?.creatorImId ?? null,
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.StaffRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.ReviewActionProposal,
    processReasons: focusCollaboration?.processReasons ?? [GQL.AffiliateCollaborationRecordProcessReason.ProposalWaitingApproval],
    lastInboundAt: focusCollaboration?.lastCreatorMessageAt ?? null,
    lastOutboundAt: relationship?.lastOutboundAt ?? null,
    nextSellerActionAt: relationship?.nextSellerActionAt ?? focusCollaboration?.nextSellerActionAt ?? null,
    stateUpdatedAt: relationship?.stateUpdatedAt ?? hydratedProposal.updatedAt ?? hydratedProposal.createdAt,
    creatorProfile: projection?.creatorProfile ?? hydratedProposal.creatorProfile ?? null,
    creatorRelation: relationship,
    activeCollaborations,
    ambiguousCollaborations: (relationship?.ambiguousCollaborationRecordIds ?? [])
      .map((recordId: string) => activeCollaborations.find((record) => record.id === recordId))
      .filter(Boolean) as GQL.AffiliateCollaborationRecord[],
    focusCollaboration,
    pendingProposals,
    focusedProposal: hydratedProposal,
    productContext: productContextFromProposal(hydratedProposal) ?? productContextFromProjection(proposalProjection ?? projection),
    primarySampleApplication: projection?.sampleApplications?.[0] ?? null,
    relatedSampleApplications: projection?.sampleApplications ?? [],
    workItem: null,
  };
}

function relationshipWorkItemFromWorkItem(
  workItem: GQL.AffiliateWorkItem,
  workspace?: AffiliateWorkspaceStore,
): CreatorRelationshipWorkItem {
  const context = workItem.context;
  const projection = relationshipProjectionSnapshot(workspace, workItem.creatorRelationshipId);
  const projectionCollaborations = (projection?.collaborationRecords ?? []) as GQL.AffiliateCollaborationRecord[];
  const projectionPendingProposals = ((projection?.actionProposals ?? []) as GQL.ActionProposal[])
    .filter((proposal) => proposal.status === GQL.ActionProposalStatus.Pending);
  const pendingProposals = mergeById([
    ...(context.pendingProposals?.length
      ? context.pendingProposals
      : workItem.latestPendingProposal
        ? [workItem.latestPendingProposal]
        : []),
    ...projectionPendingProposals,
  ]);
  const projectedFocusCollaboration = projection?.creatorRelationship?.focusCollaborationRecordId
    ? projectionCollaborations.find((record) => record.id === projection.creatorRelationship.focusCollaborationRecordId)
    : null;
  const focusCollaboration =
    context.focusCollaboration ??
    workItem.collaboration ??
    projectionCollaborations.find((record) => record.id === workItem.collaborationRecordId) ??
    projectedFocusCollaboration ??
    null;
  const relationship = workItem.creatorRelationship ?? context.creatorRelation ?? projection?.creatorRelationship ?? null;
  const primaryAgenda = relationship?.agendaItems?.find(
    (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.Agent,
  ) ?? relationship?.agendaItems?.find(
    (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.Staff,
  ) ?? relationship?.agendaItems?.find(
    (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.External,
  ) ?? null;
  const activeCollaborations = mergeById([
    ...(context.activeCollaborations ?? []),
    ...(focusCollaboration ? [focusCollaboration] : []),
    ...projectionCollaborations,
  ]);
  const sampleApplications = mergeById([
    ...(context.primarySampleApplication ? [context.primarySampleApplication] : []),
    ...(workItem.sampleApplicationRecord ? [workItem.sampleApplicationRecord] : []),
    ...(context.relatedSampleApplications ?? []),
    ...((projection?.sampleApplications ?? []) as GQL.SampleApplicationRecord[]),
  ]);
  return {
    relationshipId: workItem.creatorRelationshipId,
    shopId: workItem.focusShopId,
    creatorId: relationship?.creatorId ?? focusCollaboration?.creatorId ?? null,
    creatorOpenId: focusCollaboration?.creatorOpenId ?? null,
    creatorImId: focusCollaboration?.creatorImId ?? null,
    processingStatus: primaryAgenda
      ? relationshipProcessingStatusFromAgendaOwner(primaryAgenda.owner)
      : workItem.processingStatus,
    requiredAction: primaryAgenda?.requiredAction ?? workItem.requiredAction,
    processReasons: primaryAgenda?.reasons ?? workItem.processReasons ?? [],
    lastInboundAt: relationship?.lastInboundAt ?? focusCollaboration?.lastCreatorMessageAt ?? null,
    lastOutboundAt: relationship?.lastOutboundAt ?? null,
    nextSellerActionAt: relationship?.workSummary?.nextActionAt ?? focusCollaboration?.nextSellerActionAt ?? null,
    stateUpdatedAt: relationship?.stateUpdatedAt ?? focusCollaboration?.stateUpdatedAt ?? workItem.versionAt,
    creatorProfile: context.creatorProfile ?? projection?.creatorProfile ?? null,
    creatorRelation: relationship,
    activeCollaborations,
    ambiguousCollaborations: context.ambiguousCollaborationCandidates ?? [],
    focusCollaboration,
    pendingProposals,
    focusedProposal: workItem.latestPendingProposal ?? pendingProposals[0] ?? null,
    productContext: context.productContext ?? productContextFromProjection(projection),
    primarySampleApplication: context.primarySampleApplication ?? workItem.sampleApplicationRecord ?? sampleApplications[0] ?? null,
    relatedSampleApplications: sampleApplications,
    workItem,
  };
}

function relationshipWorkItemFromCollaborationRecord(
  record: GQL.AffiliateCollaborationRecord,
  workspace?: AffiliateWorkspaceStore,
): CreatorRelationshipWorkItem {
  const projection = relationshipProjectionSnapshot(workspace, record.creatorRelationshipId);
  const relationship = projection?.creatorRelationship ?? null;
  const creatorProfile = record.creatorProfile ?? projection?.creatorProfile ?? null;
  const projectionCollaborations = (projection?.collaborationRecords ?? []) as GQL.AffiliateCollaborationRecord[];
  const projectionPendingProposals = ((projection?.actionProposals ?? []) as GQL.ActionProposal[])
    .filter((proposal) => proposal.status === GQL.ActionProposalStatus.Pending);
  const sampleApplications = mergeById([
    ...((record.sampleApplicationRecords ?? []) as GQL.SampleApplicationRecord[]),
    ...((projection?.sampleApplications ?? []) as GQL.SampleApplicationRecord[])
      .filter((sample) => sampleBelongsToCollaboration(sample, record)),
  ]);
  const activeCollaborations = mergeById([
    record,
    ...projectionCollaborations,
  ]);
  const pendingProposals = projectionPendingProposals.filter((proposal) =>
    !proposal.collaborationRecordId || proposal.collaborationRecordId === record.id,
  );
  return {
    relationshipId: record.creatorRelationshipId,
    shopId: record.shopId,
    creatorId: relationship?.creatorId ?? creatorProfile?.id ?? record.creatorId ?? null,
    creatorOpenId: creatorProfile?.creatorOpenId ?? record.creatorOpenId ?? null,
    creatorImId: creatorProfile?.creatorImId ?? record.creatorImId ?? null,
    processingStatus: relationshipProcessingStatusFromCollaboration(record.processingStatus),
    requiredAction: relationshipRequiredActionFromCollaboration(record.requiredAction),
    processReasons: record.processReasons ?? [],
    lastInboundAt: relationship?.lastInboundAt ?? record.lastCreatorMessageAt ?? null,
    lastOutboundAt: relationship?.lastOutboundAt ?? null,
    nextSellerActionAt: relationship?.nextSellerActionAt ?? record.nextSellerActionAt ?? null,
    stateUpdatedAt: relationship?.stateUpdatedAt ?? record.stateUpdatedAt ?? record.updatedAt,
    creatorProfile,
    creatorRelation: relationship,
    activeCollaborations,
    ambiguousCollaborations: (relationship?.ambiguousCollaborationRecordIds ?? [])
      .map((recordId: string) => activeCollaborations.find((candidate) => candidate.id === recordId))
      .filter(Boolean) as GQL.AffiliateCollaborationRecord[],
    focusCollaboration: record,
    pendingProposals,
    focusedProposal: pendingProposals[0] ?? null,
    productContext: productContextFromCollaborationRecord(record),
    primarySampleApplication: sampleApplications[0] ?? null,
    relatedSampleApplications: sampleApplications,
    workItem: null,
  };
}

function relationshipProcessingStatusFromCollaboration(
  status: GQL.AffiliateCollaborationRecordProcessingStatus,
): GQL.AffiliateRelationshipProcessingStatus {
  switch (status) {
    case GQL.AffiliateCollaborationRecordProcessingStatus.AgentRequired:
      return GQL.AffiliateRelationshipProcessingStatus.AgentRequired;
    case GQL.AffiliateCollaborationRecordProcessingStatus.StaffRequired:
      return GQL.AffiliateRelationshipProcessingStatus.StaffRequired;
    case GQL.AffiliateCollaborationRecordProcessingStatus.WaitingExternal:
      return GQL.AffiliateRelationshipProcessingStatus.ExternalWaiting;
    case GQL.AffiliateCollaborationRecordProcessingStatus.Idle:
    default:
      return GQL.AffiliateRelationshipProcessingStatus.Idle;
  }
}

function relationshipProcessingStatusFromAgendaOwner(
  owner: GQL.AffiliateRelationshipAgendaOwner,
): GQL.AffiliateRelationshipProcessingStatus {
  if (owner === GQL.AffiliateRelationshipAgendaOwner.Agent) {
    return GQL.AffiliateRelationshipProcessingStatus.AgentRequired;
  }
  if (owner === GQL.AffiliateRelationshipAgendaOwner.Staff) {
    return GQL.AffiliateRelationshipProcessingStatus.StaffRequired;
  }
  return GQL.AffiliateRelationshipProcessingStatus.ExternalWaiting;
}

function relationshipRequiredActionFromCollaboration(
  action: GQL.AffiliateCollaborationRequiredAction,
): GQL.AffiliateRelationshipRequiredAction {
  switch (action) {
    case GQL.AffiliateCollaborationRequiredAction.RespondToCreator:
      return GQL.AffiliateRelationshipRequiredAction.ReplyToCreator;
    case GQL.AffiliateCollaborationRequiredAction.ReviewSampleApplication:
      return GQL.AffiliateRelationshipRequiredAction.ReviewSampleApplication;
    case GQL.AffiliateCollaborationRequiredAction.ShipSample:
      return GQL.AffiliateRelationshipRequiredAction.ShipSample;
    case GQL.AffiliateCollaborationRequiredAction.FollowUpCreator:
      return GQL.AffiliateRelationshipRequiredAction.FollowUpCreator;
    case GQL.AffiliateCollaborationRequiredAction.ReviewAgentFailure:
      return GQL.AffiliateRelationshipRequiredAction.ReviewAgentFailure;
    case GQL.AffiliateCollaborationRequiredAction.ResolveCreatorIdentity:
      return GQL.AffiliateRelationshipRequiredAction.ResolveCreatorIdentity;
    case GQL.AffiliateCollaborationRequiredAction.ReviewActionProposal:
      return GQL.AffiliateRelationshipRequiredAction.ReviewActionProposal;
    case GQL.AffiliateCollaborationRequiredAction.ReviewCollaboration:
      return GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask;
    case GQL.AffiliateCollaborationRequiredAction.None:
    default:
      return GQL.AffiliateRelationshipRequiredAction.NoAction;
  }
}

function productContextFromCollaborationRecord(
  record: GQL.AffiliateCollaborationRecord,
): GQL.AffiliateWorkProductContext | null {
  if (!record.productId) return null;
  return {
    productId: record.productId,
    title: null,
    imageUrl: null,
    source: "collaboration",
  } as GQL.AffiliateWorkProductContext;
}

function relationshipDetailFromProfile(
  profile: GQL.AffiliateCreatorIdentity,
): CreatorRelationshipDetailItem {
  return {
    creatorId: profile.id,
    creatorProfile: profile,
    creatorRelation: null,
    shopState: null,
    managementItem: null,
    workItems: [],
  };
}

function relationshipDetailFromWorkItem(
  item: CreatorRelationshipWorkItem,
): CreatorRelationshipDetailItem {
  return {
    creatorId: item.creatorProfile?.id ?? item.creatorId ?? item.creatorRelation?.creatorId ?? "",
    creatorProfile: item.creatorProfile ?? null,
    creatorRelation: item.creatorRelation ?? null,
    shopState: item.creatorRelation?.shopStates?.find((state) => state.shopId === item.shopId) ?? null,
    managementItem: null,
    workItems: [item],
  };
}

function relationshipDetailFromManagementItem(
  item: AffiliateCreatorManagementItem,
  workItems: CreatorRelationshipWorkItem[] = [],
): CreatorRelationshipDetailItem {
  return {
    creatorId: item.creatorId,
    creatorProfile: item.creatorProfile ?? null,
    creatorRelation: item.creatorRelation ?? null,
    shopState: item.shopState ?? null,
    managementItem: item,
    workItems,
  };
}

function productContextFromProposal(
  proposal: GQL.ActionProposal,
): GQL.AffiliateWorkProductContext | null {
  const productId = proposal.collaborationRecord?.productId ?? getProposalActionProductId(proposal);
  if (!productId) return null;
  return {
    productId,
    title: proposal.productSummary?.title ?? null,
    imageUrl: proposal.productSummary?.coverImage ?? null,
    source: proposal.collaborationRecord?.productId ? "collaboration" : "proposal",
  } as GQL.AffiliateWorkProductContext;
}

function productSummaryFromWorkContext(
  context: GQL.AffiliateWorkProductContext | null | undefined,
): GQL.EcomProductSummary | null {
  if (!context?.productId) return null;
  return {
    productId: context.productId,
    title: context.title ?? null,
    coverImage: context.imageUrl ?? null,
    status: null,
    priceMin: null,
    priceMax: null,
    skus: [],
  } as GQL.EcomProductSummary;
}

function withRelationshipContext(
  proposal: GQL.ActionProposal,
  item: CreatorRelationshipWorkItem,
): GQL.ActionProposal {
  return {
    ...proposal,
    creatorProfile: proposal.creatorProfile ?? item.creatorProfile ?? null,
    collaborationRecord: proposal.collaborationRecord ?? item.focusCollaboration ?? null,
  } as GQL.ActionProposal;
}

function relationshipStatusTone(
  status: GQL.AffiliateRelationshipProcessingStatus,
): CollaborationWorkViewModel["badgeTone"] {
  if (status === GQL.AffiliateRelationshipProcessingStatus.AgentRequired) return "attention";
  if (status === GQL.AffiliateRelationshipProcessingStatus.StaffRequired) return "blocked";
  if (status === GQL.AffiliateRelationshipProcessingStatus.ExternalWaiting) return "waiting";
  return "done";
}

function collaborationStatusTone(
  status: GQL.AffiliateCollaborationRecordProcessingStatus,
): CollaborationWorkViewModel["badgeTone"] {
  if (status === GQL.AffiliateCollaborationRecordProcessingStatus.AgentRequired) return "attention";
  if (status === GQL.AffiliateCollaborationRecordProcessingStatus.StaffRequired) return "blocked";
  if (status === GQL.AffiliateCollaborationRecordProcessingStatus.WaitingExternal) return "waiting";
  return "done";
}

function relationshipSubStatusKey(item: CreatorRelationshipWorkItem): string | null {
  return firstStatusDetailKey(
    item.processReasons,
    item.workItem?.workKind,
    item.requiredAction,
    item.focusCollaboration?.processReasons,
    item.focusCollaboration?.requiredAction,
  );
}

function collaborationRecordSubStatusKey(record: GQL.AffiliateCollaborationRecord): string | null {
  return firstStatusDetailKey(
    record.processReasons,
    null,
    record.requiredAction,
  );
}

function relationshipSubStatusLabel(
  key: string,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (key === NO_HISTORY_SUB_STATUS) return t("ecommerce.affiliateWorkspace.noSubStatus");
  const [kind, value] = key.split(":", 2);
  if (!value) return formatAffiliateEnumLabel(key);
  if (kind === "reason") {
    return t(`ecommerce.affiliateWorkspace.processReasons.${value}`, {
      defaultValue: formatAffiliateEnumLabel(value),
    });
  }
  if (kind === "work") {
    return t(`ecommerce.affiliateWorkspace.workKinds.${value}`, {
      defaultValue: formatAffiliateEnumLabel(value),
    });
  }
  if (kind === "action") {
    return t(`ecommerce.affiliateWorkspace.requiredActions.${value}`, {
      defaultValue: formatAffiliateEnumLabel(value),
    });
  }
  return formatAffiliateEnumLabel(value);
}

function creatorRelationshipStatusDisplay(
  item: CreatorRelationshipWorkItem,
  t: ReturnType<typeof useTranslation>["t"],
): { primary: string; secondary?: string | null } {
  return {
    primary: t(`ecommerce.affiliateWorkspace.statusLabels.${item.processingStatus}`, {
      defaultValue: formatAffiliateEnumLabel(item.processingStatus),
    }),
    secondary: firstTranslatedStatusDetail(
      t,
      item.processReasons,
      item.workItem?.workKind,
      item.requiredAction,
      item.focusCollaboration?.processReasons,
      item.focusCollaboration?.requiredAction,
    ) ?? null,
  };
}

function collaborationRecordStatusDisplay(
  record: GQL.AffiliateCollaborationRecord,
  t: ReturnType<typeof useTranslation>["t"],
): { primary: string; secondary?: string | null } {
  return {
    primary: t(`ecommerce.affiliateWorkspace.statusLabels.${record.processingStatus}`, {
      defaultValue: formatAffiliateEnumLabel(record.processingStatus),
    }),
    secondary: firstTranslatedStatusDetail(
      t,
      record.processReasons,
      null,
      record.requiredAction,
    ) ?? t(`ecommerce.affiliateWorkspace.lifecycleStages.${record.lifecycleStage}`, {
      defaultValue: formatAffiliateEnumLabel(record.lifecycleStage),
    }),
  };
}

function firstTranslatedStatusDetail(
  t: ReturnType<typeof useTranslation>["t"],
  primaryReasons?: Array<string | null | undefined> | null,
  workKind?: string | null,
  requiredAction?: string | null,
  fallbackReasons?: Array<string | null | undefined> | null,
  fallbackRequiredAction?: string | null,
): string | null {
  const key = firstStatusDetailKey(
    primaryReasons,
    workKind,
    requiredAction,
    fallbackReasons,
    fallbackRequiredAction,
  );
  return key ? relationshipSubStatusLabel(key, t) : null;
}

function firstStatusDetailKey(
  primaryReasons?: Array<string | null | undefined> | null,
  workKind?: string | null,
  requiredAction?: string | null,
  fallbackReasons?: Array<string | null | undefined> | null,
  fallbackRequiredAction?: string | null,
): string | null {
  const reason = [...(primaryReasons ?? []), ...(fallbackReasons ?? [])].find(Boolean);
  if (reason) return `reason:${reason}`;
  if (workKind && workKind !== "MANUAL_REVIEW") {
    return `work:${workKind}`;
  }
  const action = !isNoRequiredAction(requiredAction)
    ? requiredAction
    : fallbackRequiredAction;
  if (!isNoRequiredAction(action)) {
    return `action:${action}`;
  }
  return null;
}

function isNoRequiredAction(action?: string | null): boolean {
  return !action ||
    action === GQL.AffiliateCollaborationRequiredAction.None ||
    action === GQL.AffiliateRelationshipRequiredAction.NoAction;
}

function renderCreatorRelationshipWorkTitle(
  item: CreatorRelationshipWorkItem,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const proposal = item.focusedProposal ?? item.pendingProposals[0] ?? null;
  if (proposal) return renderProposalRecommendationTitle(proposal, t);
  if (item.workItem?.workKind) {
    return t(`ecommerce.affiliateWorkspace.workKinds.${item.workItem.workKind}`, {
      defaultValue: formatAffiliateEnumLabel(item.workItem.workKind),
    });
  }
  if (item.activeCollaborations.length > 0) {
    return t("ecommerce.affiliateWorkspace.relationshipWorkActiveTitle", {
      count: item.activeCollaborations.length,
    });
  }
  return t("ecommerce.affiliateWorkspace.relationshipConversationTitle");
}

function renderCreatorRelationshipWorkSummary(
  item: CreatorRelationshipWorkItem,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const proposal = item.focusedProposal ?? item.pendingProposals[0] ?? null;
  if (proposal?.operatorSummary) return proposal.operatorSummary;
  if (item.ambiguousCollaborations.length > 0) {
    return t("ecommerce.affiliateWorkspace.relationshipWorkAmbiguousSummary", {
      count: item.ambiguousCollaborations.length,
    });
  }
  const reason = item.processReasons?.[0];
  if (reason) {
    return t(`ecommerce.affiliateWorkspace.processReasons.${reason}`, {
      defaultValue: formatAffiliateEnumLabel(reason),
    });
  }
  return t("ecommerce.affiliateWorkspace.relationshipWorkDefaultSummary");
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

function CreatorAvatarImage({
  avatarUrl,
  className,
  fallbackClassName,
  name,
}: {
  avatarUrl?: string | null;
  className: string;
  fallbackClassName?: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  const handleImageError = useCallback(() => setFailed(true), []);

  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  if (!avatarUrl || failed) {
    return (
      <div className={`${className} ${fallbackClassName ?? ""}`.trim()} aria-hidden="true">
        {initial}
      </div>
    );
  }

  return (
    <RemoteMediaImage
      alt=""
      cachePolicy="force"
      className={className}
      loading="lazy"
      onImageError={handleImageError}
      sourceUrl={avatarUrl}
    />
  );
}

function CreatorRelationshipDetailModal({
  item,
  onClose,
}: {
  item: CreatorRelationshipDetailItem;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const affiliateWorkspace = entityStore.affiliateWorkspace;
  const [activeTab, setActiveTab] = useState<"overview" | "conversation" | "collaborations" | "activity">("overview");
  const [showCreatorProfile, setShowCreatorProfile] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [composerChannel, setComposerChannel] = useState<"AUTO" | GQL.AffiliateMessageChannel>("AUTO");
  const [composerSubject, setComposerSubject] = useState("");
  const [stagedAttachments, setStagedAttachments] = useState<StagedAffiliateAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const activityBottomRef = useRef<HTMLDivElement | null>(null);
  const activityLoadedOlderRef = useRef(false);
  const profile = item.creatorProfile ?? null;
  const name = profile
    ? creatorPrimaryName(profile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : item.creatorId;
  const handle = profile ? creatorTikTokHandle(profile) : null;
  const platformId = profile ? creatorPlatformIdentity(profile) : null;
  const marketplace = profile ? parseMarketplaceCreatorSnapshot(profile.marketplaceSnapshotJson) : null;
  const marketplaceBio = readMarketplaceCreatorBio(marketplace);
  const marketplaceMetrics = profile ? buildMarketplaceMetricRows(marketplace, t) : [];
  const management = item.managementItem ?? null;
  const blocked = Boolean(item.creatorRelation?.blocked);
  const shopStates = item.creatorRelation?.shopStates ?? (item.shopState ? [item.shopState] : []);
  const workItems = item.workItems ?? [];
  const primaryWorkItem = [...workItems].sort((left, right) =>
    new Date(right.stateUpdatedAt ?? 0).getTime() - new Date(left.stateUpdatedAt ?? 0).getTime(),
  )[0] ?? null;
  const relationshipId = item.creatorRelation?.id ?? primaryWorkItem?.relationshipId ?? null;
  const [relationshipOwnerId, setRelationshipOwnerId] = useState(item.creatorRelation?.businessDeveloperId ?? "__AI_TEAM__");
  const [relationshipAiStatus, setRelationshipAiStatus] = useState<GQL.AffiliateRelationshipAiEngagementStatus>(
    item.creatorRelation?.aiEngagementStatus ?? GQL.AffiliateRelationshipAiEngagementStatus.Protected,
  );
  const { data: developerData } = useQuery<{ affiliateBusinessDevelopers: GQL.AffiliateBusinessDeveloper[] }>(
    AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
    { variables: { includeArchived: false }, fetchPolicy: "cache-and-network" },
  );
  useEffect(() => {
    if (developerData) affiliateWorkspace.replaceAffiliateBusinessDevelopers(developerData.affiliateBusinessDevelopers);
  }, [affiliateWorkspace, developerData]);
  const [assignDeveloper, assignDeveloperState] = useMutation(ASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION);
  const [unassignDeveloper, unassignDeveloperState] = useMutation(UNASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION);
  const [setAiEngagement, setAiEngagementState] = useMutation(SET_AFFILIATE_RELATIONSHIP_AI_ENGAGEMENT_MUTATION);
  const ownerOptions = [
    { value: "__AI_TEAM__", label: t("ecommerce.affiliateTeam.aiTeam") },
    ...affiliateWorkspace.businessDevelopers
      .filter((developer) => !developer.archivedAt)
      .map((developer) => ({ value: developer.id, label: developer.displayName })),
  ];
  const relationshipOwner = relationshipOwnerId === "__AI_TEAM__"
    ? null
    : affiliateWorkspace.getBusinessDeveloper(relationshipOwnerId);
  const effectiveAiLabel = relationshipAiStatus === GQL.AffiliateRelationshipAiEngagementStatus.Protected
    ? t("ecommerce.affiliateWorkspace.relationshipProtected")
    : relationshipOwner?.agentAssistanceMode === GQL.AffiliateAgentAssistanceMode.HumanOnly
      ? t("ecommerce.affiliateTeam.humanOnly")
      : t("ecommerce.affiliateTeam.aiAssisted");
  const ownershipBusy = assignDeveloperState.loading || unassignDeveloperState.loading || setAiEngagementState.loading;
  const messageShopId = primaryWorkItem?.shopId ?? item.shopState?.shopId ?? shopStates[0]?.shopId ?? null;
  const [sendAffiliateCreatorMessage] = useMutation<
    { sendAffiliateCreatorMessage: GQL.SendAffiliateCreatorMessagePayload },
    { input: GQL.SendAffiliateCreatorMessageInput }
  >(SEND_AFFILIATE_CREATOR_MESSAGE_MUTATION);
  const { data: relationshipCollaborationsData } = useQuery<
    { collaborationRecords: GQL.AffiliateCollaborationRecord[] },
    { input: GQL.ReadAffiliateCollaborationRecordsInput }
  >(AFFILIATE_COLLABORATION_RECORDS_QUERY, {
    variables: {
      input: {
        creatorRelationshipId: relationshipId ?? undefined,
        limit: 100,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
  });
  const collaborationRecords = mergeById([
    ...(relationshipCollaborationsData?.collaborationRecords ?? []),
    ...workItems.flatMap((workItem) => workItem.activeCollaborations),
    ...(management?.latestCollaborationRecord ? [management.latestCollaborationRecord] : []),
  ]).sort((left, right) => new Date(right.updatedAt ?? right.createdAt).getTime() - new Date(left.updatedAt ?? left.createdAt).getTime());
  const pendingProposals = mergeById(workItems.flatMap((workItem) => [
    ...workItem.pendingProposals,
    ...(workItem.focusedProposal ? [workItem.focusedProposal] : []),
  ])).filter((proposal) => proposal.status === GQL.ActionProposalStatus.Pending);
  const relationshipSummary = item.creatorRelation?.workSummary;
  const relationshipAgenda = item.creatorRelation?.agendaItems ?? [];
  const relationshipAggregateStatus =
    (relationshipSummary?.agentRequiredCount ?? 0) > 0
      ? GQL.AffiliateRelationshipProcessingStatus.AgentRequired
      : (relationshipSummary?.staffRequiredCount ?? 0) > 0
        ? GQL.AffiliateRelationshipProcessingStatus.StaffRequired
        : (relationshipSummary?.externalWaitingCount ?? 0) > 0
          ? GQL.AffiliateRelationshipProcessingStatus.ExternalWaiting
          : GQL.AffiliateRelationshipProcessingStatus.Idle;
  const relationshipStatusDisplay = primaryWorkItem
    ? creatorRelationshipStatusDisplay(primaryWorkItem, t)
    : item.creatorRelation
      ? {
          primary: t(`ecommerce.affiliateWorkspace.statusLabels.${relationshipAggregateStatus}`, {
            defaultValue: formatAffiliateEnumLabel(relationshipAggregateStatus),
          }),
          secondary: relationshipAgenda[0]
            ? formatAffiliateEnumLabel(relationshipAgenda[0].workKind)
            : null,
        }
      : {
          primary: management?.needsAttention
            ? t("ecommerce.affiliateWorkspace.creatorNeedsAttention")
            : t("ecommerce.affiliateWorkspace.creatorStable"),
          secondary: null,
        };
  const relationshipTone = primaryWorkItem
    ? relationshipStatusTone(primaryWorkItem.processingStatus)
    : item.creatorRelation
      ? relationshipStatusTone(relationshipAggregateStatus)
      : management?.needsAttention
        ? "attention"
        : "done";
  const currentTitle = primaryWorkItem
    ? renderCreatorRelationshipWorkTitle(primaryWorkItem, t)
    : pendingProposals[0]
      ? renderProposalRecommendationTitle(pendingProposals[0], t)
      : management?.needsAttention
        ? t("ecommerce.affiliateWorkspace.creatorNeedsAttention")
        : t("ecommerce.affiliateWorkspace.relationshipNoCurrentWork");
  const currentSummary = primaryWorkItem
    ? renderCreatorRelationshipWorkSummary(primaryWorkItem, t)
    : management?.needsAttention
      ? t("ecommerce.affiliateWorkspace.relationshipNeedsManualReview")
      : t("ecommerce.affiliateWorkspace.relationshipNoCurrentWorkHint");

  const {
    data: messageHistoryData,
    loading: conversationLoading,
    fetchMore: fetchMoreConversationMessages,
    refetch: refetchConversationMessages,
  } = useQuery<
    { affiliateCreatorMessageHistory: GQL.AffiliateCreatorMessageHistoryPayload },
    { input: GQL.AffiliateCreatorMessageHistoryInput }
  >(AFFILIATE_CREATOR_MESSAGE_HISTORY_QUERY, {
    variables: {
      input: {
        shopId: messageShopId ?? "",
        creatorRelationshipId: relationshipId ?? "",
        limit: AFFILIATE_TIMELINE_PAGE_SIZE,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId || !messageShopId,
  });
  const conversationHistory = messageHistoryData?.affiliateCreatorMessageHistory;
  const conversationMessages = conversationHistory?.items ?? [];
  const canLoadOlderConversation = Boolean(conversationHistory?.hasMore && conversationHistory.nextOffset != null);

  async function stageComposerFiles(files: FileList | null): Promise<void> {
    if (!files?.length || !relationshipId) return;
    setUploadingAttachments(true);
    try {
      const staged: StagedAffiliateAttachment[] = [];
      for (const file of Array.from(files)) {
        const response = await fetch("/api/cloud/ecommerce/affiliate/upload-draft-attachment", {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-Creator-Relationship-Id": relationshipId,
            "X-File-Name": encodeURIComponent(file.name),
            "X-Affiliate-Upload-Source": "HUMAN_UPLOAD",
          },
          body: file,
        });
        const payload = await response.json() as StagedAffiliateAttachment & { error?: string };
        if (!response.ok) throw new Error(payload.error || `Upload failed (${response.status})`);
        staged.push({ ...payload, inline: false });
      }
      setStagedAttachments((current) => [...current, ...staged].slice(0, 10));
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setUploadingAttachments(false);
    }
  }

  async function submitComposerMessage(): Promise<void> {
    if (!relationshipId || !messageShopId) return;
    const parts: GQL.AffiliateOutboundMessagePartInput[] = [];
    if (composerText.trim()) parts.push({ kind: GQL.AffiliateMessagePartKind.Text, text: composerText.trim() });
    parts.push(...stagedAttachments.map((asset) => ({
      kind: GQL.AffiliateMessagePartKind.Attachment,
      draftAssetId: asset.draftAssetId,
      emailDisposition: asset.inline
        ? GQL.AffiliateEmailAttachmentDisposition.Inline
        : GQL.AffiliateEmailAttachmentDisposition.Attachment,
    })));
    if (!parts.length) return;
    setSendingMessage(true);
    try {
      const result = await sendAffiliateCreatorMessage({ variables: { input: {
        shopId: messageShopId,
        creatorRelationshipId: relationshipId,
        parts,
        preferredChannel: composerChannel === "AUTO" ? undefined : composerChannel,
        emailSubject: composerSubject.trim() || undefined,
      } } });
      const delivery = result.data?.sendAffiliateCreatorMessage.delivery;
      if (delivery?.status === GQL.AffiliateDeliveryStatus.Failed || delivery?.status === GQL.AffiliateDeliveryStatus.PartiallySent) {
        throw new Error(delivery.errorMessage || `Delivery ${delivery.status}`);
      }
      setComposerText("");
      setComposerSubject("");
      setStagedAttachments([]);
      await refetchConversationMessages();
      showToast("Message submitted", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSendingMessage(false);
    }
  }
  const {
    data: relationshipHistoryData,
    loading: relationshipHistoryLoading,
    fetchMore: fetchMoreRelationshipHistory,
  } = useQuery<
    { affiliateRelationshipHistory: GQL.AffiliateRelationshipHistoryPayload },
    { input: GQL.AffiliateRelationshipHistoryInput }
  >(AFFILIATE_RELATIONSHIP_HISTORY_QUERY, {
    variables: {
      input: {
        shopId: messageShopId ?? "",
        creatorRelationshipId: relationshipId ?? "",
        limit: AFFILIATE_TIMELINE_PAGE_SIZE,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId || !messageShopId,
  });
  const relationshipHistory = relationshipHistoryData?.affiliateRelationshipHistory;
  const canLoadOlderActivity = Boolean(relationshipHistory?.hasMore && relationshipHistory.nextOffset != null);
  const relationshipSampleApplications = mergeById([
    ...workItems.flatMap((workItem) => [
      ...(workItem.primarySampleApplication ? [workItem.primarySampleApplication] : []),
      ...(workItem.relatedSampleApplications ?? []),
    ]),
    ...collaborationRecords.flatMap((record) => record.sampleApplicationRecords ?? []),
  ].map((sample) => affiliateSnapshot(sample) as GQL.SampleApplicationRecord))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const productSummaryForProductId = (productId: string | null | undefined) => {
    if (!productId) return null;
    const context = workItems.find((workItem) => workItem.productContext?.productId === productId)?.productContext;
    return productSummaryFromWorkContext(context);
  };
  const hydrateRelationshipProposal = (proposal: GQL.ActionProposal) => {
    const collaborationRecordId = proposal.collaborationRecord?.id ?? proposal.collaborationRecordId ?? null;
    const collaborationRecord = proposal.collaborationRecord
      ?? collaborationRecords.find((record) => record.id === collaborationRecordId)
      ?? null;
    const productId = collaborationRecord?.productId ?? getProposalActionProductId(proposal);
    return hydrateAffiliateProposalProjection({
      proposal,
      collaborationRecord,
      creatorProfile: profile,
      productSummary: proposal.productSummary ?? productSummaryForProductId(productId),
    });
  };
  const visiblePendingProposals = mergeById([
    ...pendingProposals,
  ])
    .map(hydrateRelationshipProposal)
    .filter((proposal) => proposal.status === GQL.ActionProposalStatus.Pending);
  const pendingProposalsForRecord = (record: GQL.AffiliateCollaborationRecord) =>
    visiblePendingProposals.filter((proposal) => {
      const proposalRecordId = proposal.collaborationRecord?.id ?? proposal.collaborationRecordId ?? null;
      return proposalRecordId === record.id;
    });
  const activityEntries = buildRelationshipHistoryTimelineEntries(
    relationshipHistory?.items ?? [],
    relationshipSampleApplications,
    t,
  );
  useEffect(() => {
    if (activeTab !== "activity") return;
    if (activityLoadedOlderRef.current) {
      activityLoadedOlderRef.current = false;
      return;
    }
    window.requestAnimationFrame(() => {
      activityBottomRef.current?.scrollIntoView({ block: "end" });
    });
  }, [activeTab, activityEntries.length]);
  const tabItems = [
    {
      id: "overview" as const,
      label: t("ecommerce.affiliateWorkspace.relationshipPanelCurrentWork"),
      count: visiblePendingProposals.length || (primaryWorkItem ? 1 : 0),
    },
    {
      id: "conversation" as const,
      label: t("ecommerce.affiliateWorkspace.relationshipPanelCommunication"),
      count: conversationMessages.length,
    },
    {
      id: "collaborations" as const,
      label: t("ecommerce.affiliateWorkspace.relationshipPanelCollaborations"),
      count: collaborationRecords.length,
    },
    {
      id: "activity" as const,
      label: t("ecommerce.affiliateWorkspace.relationshipPanelActivity"),
      count: activityEntries.length,
    },
  ];

  function loadOlderConversationMessages(): void {
    if (!conversationHistory?.hasMore || conversationHistory.nextOffset == null || !relationshipId || !messageShopId) return;
    void fetchMoreConversationMessages({
      variables: {
        input: {
          shopId: messageShopId,
          creatorRelationshipId: relationshipId,
          limit: AFFILIATE_TIMELINE_PAGE_SIZE,
          offset: conversationHistory.nextOffset,
        },
      },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult) return previous;
        return {
          affiliateCreatorMessageHistory: {
            ...fetchMoreResult.affiliateCreatorMessageHistory,
            items: mergeAffiliateCreatorMessageHistoryItems(
              previous.affiliateCreatorMessageHistory.items,
              fetchMoreResult.affiliateCreatorMessageHistory.items,
            ),
          },
        };
      },
    });
  }

  function loadOlderActivity(): void {
    if (!relationshipHistory?.hasMore || relationshipHistory.nextOffset == null || !relationshipId || !messageShopId) return;
    activityLoadedOlderRef.current = true;
    void fetchMoreRelationshipHistory({
      variables: {
        input: {
          shopId: messageShopId,
          creatorRelationshipId: relationshipId,
          limit: AFFILIATE_TIMELINE_PAGE_SIZE,
          offset: relationshipHistory.nextOffset,
        },
      },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult) return previous;
        return mergeAffiliateRelationshipHistoryPayload(previous, fetchMoreResult);
      },
    });
  }

  async function updateRelationshipOwner(nextOwnerId: string): Promise<void> {
    if (!relationshipId || ownershipBusy || nextOwnerId === relationshipOwnerId) return;
    if (!window.confirm(t("ecommerce.affiliateWorkspace.relationshipOwnerChangeConfirm"))) return;
    try {
      const result = nextOwnerId === "__AI_TEAM__"
        ? await unassignDeveloper({ variables: { creatorRelationshipId: relationshipId } })
        : await assignDeveloper({ variables: { input: { creatorRelationshipId: relationshipId, businessDeveloperId: nextOwnerId } } });
      const relationship = (result.data as any)?.unassignAffiliateBusinessDeveloper
        ?? (result.data as any)?.assignAffiliateBusinessDeveloper;
      if (relationship) affiliateWorkspace.upsertAffiliateCreatorRelationship(relationship);
      setRelationshipOwnerId(nextOwnerId);
      showToast(t("ecommerce.affiliateTeam.saved"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function updateRelationshipAiStatus(nextStatus: string): Promise<void> {
    if (!relationshipId || ownershipBusy || nextStatus === relationshipAiStatus) return;
    if (!window.confirm(t("ecommerce.affiliateWorkspace.relationshipAiChangeConfirm"))) return;
    try {
      const result = await setAiEngagement({ variables: { input: { creatorRelationshipId: relationshipId, status: nextStatus } } });
      const relationship = (result.data as any)?.setAffiliateRelationshipAiEngagement;
      if (relationship) affiliateWorkspace.upsertAffiliateCreatorRelationship(relationship);
      setRelationshipAiStatus(nextStatus as GQL.AffiliateRelationshipAiEngagementStatus);
      showToast(t("ecommerce.affiliateTeam.saved"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  return (
    <div className="modal-backdrop affiliate-creator-detail-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-content affiliate-collaboration-modal affiliate-relationship-detail-modal affiliate-relationship-work-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header affiliate-relationship-work-modal-header">
          <div className="affiliate-relationship-work-modal-heading">
            <CreatorAvatarImage
              avatarUrl={profile?.avatarUrl}
              className="affiliate-avatar affiliate-relationship-work-modal-avatar"
              fallbackClassName="affiliate-creator-avatar-empty"
              name={name}
            />
            <div className="affiliate-collaboration-modal-title-block">
              <h2 className="affiliate-relationship-detail-title">{name}</h2>
              <p>
                <span>{t("ecommerce.affiliateWorkspace.creatorRelationshipPrimaryObject")}</span>
                <CreatorPlatformId handle={handle} platformId={platformId} />
              </p>
              {relationshipId ? (
                <div className="affiliate-modal-id-actions">
                  <SystemIdCopy value={relationshipId} />
                </div>
              ) : null}
              <div className="affiliate-relationship-work-modal-subtitle">
                {t("ecommerce.affiliateWorkspace.relationshipWorkbenchSubtitle")}
              </div>
            </div>
          </div>
          <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>
        <div className="affiliate-collaboration-modal-body affiliate-relationship-workspace-body">
          <aside className="affiliate-collaboration-context-pane">
            <section className="affiliate-relationship-work-side-card affiliate-relationship-work-side-card-primary">
              <div className="affiliate-relationship-work-side-card-head">
                <span>{t("ecommerce.affiliateWorkspace.relationshipProfileSummary")}</span>
                {profile ? (
                  <button
                    className="affiliate-inline-link-button"
                    type="button"
                    onClick={() => setShowCreatorProfile(true)}
                  >
                    {t("ecommerce.affiliateWorkspace.openCreatorDetail")}
                  </button>
                ) : null}
              </div>
              <strong>{name}</strong>
              <div className="affiliate-relationship-work-side-meta">
                {handle ? <span>{handle}</span> : null}
                {marketplaceMetrics[0] ? <span>{marketplaceMetrics[0].value}</span> : null}
              </div>
              {marketplaceBio ? (
                <p className="affiliate-relationship-creator-bio">
                  {marketplaceBio}
                </p>
              ) : null}
              {management?.tags?.length ? (
                <div className="affiliate-creator-tag-list affiliate-relationship-tag-list">
                  {management.tags.map((tag) => (
                    <span className="affiliate-creator-tag" key={tag.id}>
                      <span>{creatorTagLabel(t, tag)}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
            <section className="affiliate-relationship-work-side-card affiliate-relationship-owner-card">
              <div className="affiliate-relationship-work-side-card-head">
                <span>{t("ecommerce.affiliateWorkspace.relationshipOwner")}</span>
                <strong>{effectiveAiLabel}</strong>
              </div>
              <label>
                <span>{t("ecommerce.affiliateWorkspace.relationshipOwnerLabel")}</span>
                <Select
                  value={relationshipOwnerId}
                  onChange={(value) => void updateRelationshipOwner(value)}
                  options={ownerOptions}
                  disabled={!relationshipId || ownershipBusy}
                />
              </label>
              <label>
                <span>{t("ecommerce.affiliateWorkspace.relationshipAiParticipation")}</span>
                <Select
                  value={relationshipAiStatus}
                  onChange={(value) => void updateRelationshipAiStatus(value)}
                  options={[
                    { value: GQL.AffiliateRelationshipAiEngagementStatus.Enabled, label: t("ecommerce.affiliateWorkspace.relationshipAiEnabled") },
                    { value: GQL.AffiliateRelationshipAiEngagementStatus.Protected, label: t("ecommerce.affiliateWorkspace.relationshipProtected") },
                  ]}
                  disabled={!relationshipId || ownershipBusy}
                />
              </label>
              {relationshipOwner?.agentAssistanceMode === GQL.AffiliateAgentAssistanceMode.HumanOnly ? (
                <small>{t("ecommerce.affiliateWorkspace.relationshipHumanOnlyHint", { name: relationshipOwner.displayName })}</small>
              ) : null}
            </section>
            <section className="affiliate-relationship-work-side-card">
              <div className="affiliate-relationship-work-side-card-head">
                <span>{t("ecommerce.affiliateWorkspace.relationshipCurrentDecision")}</span>
              </div>
              <RelationshipStatusBadge display={relationshipStatusDisplay} tone={relationshipTone} compact />
              <div className="affiliate-relationship-work-side-facts">
                <SampleApplicationFact
                  label={t("ecommerce.affiliateWorkspace.relationshipWorkPendingProposals")}
                  value={visiblePendingProposals.length}
                />
                <SampleApplicationFact
                  label={t("ecommerce.affiliateWorkspace.relationshipWorkActiveCollaborations")}
                  value={collaborationRecords.length}
                />
                <SampleApplicationFact
                  label={t("ecommerce.affiliateWorkspace.creatorBlocked")}
                  value={blocked ? t("common.yes") : t("common.no")}
                />
              </div>
            </section>
            {shopStates.length > 0 ? (
              <section className="affiliate-relationship-work-side-card">
                <div className="affiliate-relationship-work-side-card-head">
                  <span>{t("ecommerce.affiliateWorkspace.relationshipShopStates")}</span>
                </div>
                <div className="affiliate-relationship-shop-state-list">
                  {shopStates.slice(0, 4).map((state) => (
                    <div className="affiliate-relationship-shop-state" key={state.shopId}>
                      <strong>{t(`ecommerce.affiliateWorkspace.lifecycleStages.${state.lifecycleStage}`, {
                        defaultValue: state.lifecycleStage,
                      })}</strong>
                      <span>{state.lastContactedAt ? formatProposalTime(state.lastContactedAt) : t("ecommerce.affiliateWorkspace.noRecentContact")}</span>
                    </div>
                  ))}
                  {shopStates.length > 4 ? (
                    <div className="affiliate-relationship-shop-state affiliate-relationship-shop-state-more">
                      {t("ecommerce.affiliateWorkspace.relationshipMoreShopStates", { count: shopStates.length - 4 })}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
          </aside>
          <section className="affiliate-collaboration-work-pane">
            <div className="affiliate-collaboration-detail-tabs" role="tablist">
              {tabItems.map((tab) => (
                <button
                  key={tab.id}
                  className={`affiliate-collaboration-detail-tab${activeTab === tab.id ? " active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  <strong>{tab.count}</strong>
                </button>
              ))}
            </div>
            <div className="affiliate-collaboration-tab-panel">
              {activeTab === "overview" ? (
                <div className="affiliate-relationship-work-overview-panel">
                  {visiblePendingProposals.length === 0 ? (
                    <section className="affiliate-relationship-work-current-work">
                      <div className="affiliate-relationship-work-current-work-main">
                        <span>{t("ecommerce.affiliateWorkspace.relationshipCurrentDecision")}</span>
                        <h3>{currentTitle}</h3>
                        <p>{currentSummary}</p>
                      </div>
                      <div className="affiliate-relationship-work-current-work-status">
                        <RelationshipStatusBadge display={relationshipStatusDisplay} tone={relationshipTone} />
                      </div>
                      <div className="affiliate-relationship-work-current-work-actions">
                        <div>
                          <span>{t("ecommerce.affiliateWorkspace.relationshipPanelCollaborations")}</span>
                          <strong>{t("ecommerce.affiliateWorkspace.relationshipWorkActiveTitle", {
                            count: collaborationRecords.length,
                          })}</strong>
                          <small>{t("ecommerce.affiliateWorkspace.relationshipAcrossShops")}</small>
                        </div>
                        <div>
                          <span>{t("ecommerce.affiliateWorkspace.relationshipPanelCommunication")}</span>
                          <strong>{conversationMessages.length}</strong>
                          <small>{t("ecommerce.affiliateWorkspace.relationshipCommunicationHint")}</small>
                        </div>
                      </div>
                    </section>
                  ) : null}
                  {visiblePendingProposals.length > 0 ? (
                    <section className="affiliate-relationship-work-overview-section">
                      <h3>{t("ecommerce.affiliateWorkspace.relationshipWorkPendingProposals")}</h3>
                      <div className="affiliate-relationship-work-overview-proposal-list">
                        {visiblePendingProposals.slice(0, 2).map((proposal) => (
                          <ActionProposalCard
                            key={proposal.id}
                            proposal={proposal}
                            shopLabel={t("ecommerce.affiliateWorkspace.relationshipAcrossShops")}
                            variant="full"
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}
              {activeTab === "conversation" ? (
                <div className="affiliate-conversation-tab">
                  <div className="affiliate-conversation-preview">
                    {conversationLoading && conversationMessages.length === 0 ? (
                      <div className="affiliate-proposal-empty">{t("common.loading")}</div>
                    ) : conversationMessages.length === 0 ? (
                      <div className="affiliate-proposal-empty">
                        {t("ecommerce.affiliateWorkspace.conversation.noMessages")}
                      </div>
                    ) : (
                      conversationMessages.map((message) => (
                        <AffiliateCreatorMessageRow
                          key={affiliateCreatorMessageKey(message)}
                          message={message}
                          creatorRelationshipId={relationshipId!}
                        />
                      ))
                    )}
                    {canLoadOlderConversation ? (
                      <button
                        className="btn btn-secondary affiliate-conversation-load-more"
                        type="button"
                        disabled={conversationLoading}
                        onClick={loadOlderConversationMessages}
                      >
                        {conversationLoading
                          ? t("common.loading")
                          : t("ecommerce.affiliateWorkspace.conversation.loadOlder")}
                      </button>
                    ) : null}
                  </div>
                  <div className="affiliate-message-composer">
                    <textarea
                      className="form-input affiliate-message-composer-text"
                      value={composerText}
                      onChange={(event) => setComposerText(event.target.value)}
                      placeholder="Write a creator-facing message…"
                      rows={4}
                    />
                    <div className="affiliate-message-composer-controls">
                      <select
                        className="form-input"
                        value={composerChannel}
                        onChange={(event) => setComposerChannel(event.target.value as "AUTO" | GQL.AffiliateMessageChannel)}
                      >
                        <option value="AUTO">Reply/default channel</option>
                        <option value={GQL.AffiliateMessageChannel.Whatsapp}>WhatsApp</option>
                        <option value={GQL.AffiliateMessageChannel.Email}>Email</option>
                        <option value={GQL.AffiliateMessageChannel.PlatformChat}>Platform chat</option>
                      </select>
                      {composerChannel === GQL.AffiliateMessageChannel.Email ? (
                        <input
                          className="form-input"
                          value={composerSubject}
                          onChange={(event) => setComposerSubject(event.target.value)}
                          placeholder="Subject (required for a new thread)"
                        />
                      ) : null}
                      <label className="btn btn-secondary affiliate-message-file-button">
                        {uploadingAttachments ? "Uploading…" : "Add files"}
                        <input
                          type="file"
                          multiple
                          disabled={uploadingAttachments || stagedAttachments.length >= 10}
                          onChange={(event) => {
                            void stageComposerFiles(event.currentTarget.files);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {stagedAttachments.length ? (
                      <div className="affiliate-message-staged-list">
                        {stagedAttachments.map((asset) => (
                          <div className="affiliate-message-staged-item" key={asset.draftAssetId}>
                            <span>{asset.fileName} · {formatFileSize(asset.sizeBytes)}</span>
                            {composerChannel === GQL.AffiliateMessageChannel.Email && asset.mimeType.startsWith("image/") ? (
                              <label>
                                <input
                                  type="checkbox"
                                  checked={asset.inline}
                                  onChange={(event) => setStagedAttachments((current) => current.map((item) =>
                                    item.draftAssetId === asset.draftAssetId ? { ...item, inline: event.target.checked } : item))}
                                />
                                Inline
                              </label>
                            ) : null}
                            <button
                              className="btn btn-ghost"
                              type="button"
                              onClick={() => setStagedAttachments((current) => current.filter((item) => item.draftAssetId !== asset.draftAssetId))}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="affiliate-message-composer-footer">
                      <span>1–10 ordered text/file parts · no cross-channel fallback</span>
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={sendingMessage || uploadingAttachments || (!composerText.trim() && stagedAttachments.length === 0)}
                        onClick={() => void submitComposerMessage()}
                      >
                        {sendingMessage ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {activeTab === "collaborations" ? (
                <div className="affiliate-relationship-work-collaboration-detail-list">
                  {collaborationRecords.length > 0 ? (
                    collaborationRecords.map((record) => (
                      <CollaborationRecordSubcard
                        key={record.id}
                        record={record}
                        compact={false}
                        samples={relationshipSampleApplications.filter((sample) => sampleBelongsToCollaboration(sample, record))}
                        pendingProposals={pendingProposalsForRecord(record)}
                        shopLabel={t("ecommerce.affiliateWorkspace.relationshipAcrossShops")}
                      />
                    ))
                  ) : (
                    <div className="affiliate-proposal-empty">
                      {t("ecommerce.affiliateWorkspace.relationshipWorkNoCollaborations")}
                    </div>
                  )}
                </div>
              ) : null}
              {activeTab === "activity" ? (
                <div className="affiliate-collaboration-timeline">
                  {canLoadOlderActivity ? (
                    <button
                      className="btn btn-secondary affiliate-conversation-load-more"
                      type="button"
                      disabled={relationshipHistoryLoading}
                      onClick={loadOlderActivity}
                    >
                      {relationshipHistoryLoading
                        ? t("common.loading")
                        : t("ecommerce.affiliateWorkspace.activity.loadOlder")}
                    </button>
                  ) : null}
                  {relationshipHistoryLoading && activityEntries.length === 0 ? (
                    <div className="affiliate-proposal-empty">{t("common.loading")}</div>
                  ) : activityEntries.length > 0 ? (
                    activityEntries.map((entry) => (
                      <RelationshipTimelineEntry
                        key={entry.id}
                        entry={entry}
                      />
                    ))
                  ) : (
                    <div className="affiliate-proposal-empty">
                      {t("ecommerce.affiliateWorkspace.noActivityYet")}
                    </div>
                  )}
                  <div ref={activityBottomRef} aria-hidden="true" />
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      {showCreatorProfile && profile ? (
        <CreatorDetailModal
          profile={profile}
          onClose={() => setShowCreatorProfile(false)}
        />
      ) : null}
    </div>
  );
}

function CreatorDetailModal({
  profile,
  onClose,
}: {
  profile: GQL.AffiliateCreatorIdentity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const name = creatorPrimaryName(profile, t("ecommerce.affiliateWorkspace.unknownCreator"));
  const handle = creatorTikTokHandle(profile);
  const platformId = creatorPlatformIdentity(profile);
  const marketplace = parseMarketplaceCreatorSnapshot(profile.marketplaceSnapshotJson);
  const marketplaceBio = readMarketplaceCreatorBio(marketplace);
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
            <CreatorAvatarImage
              avatarUrl={profile.avatarUrl}
              className="affiliate-creator-detail-avatar"
              fallbackClassName="affiliate-creator-detail-avatar-empty"
              name={name}
            />
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
            {t("ecommerce.affiliateWorkspace.creatorDetail.bio")}
          </div>
          <div className="affiliate-creator-detail-copy affiliate-creator-detail-bio">
            {marketplaceBio || t("ecommerce.affiliateWorkspace.creatorDetail.noBio")}
          </div>
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
                copyLabelKey="ecommerce.affiliateWorkspace.copyCreatorHandle"
                copiedMessageKey="ecommerce.affiliateWorkspace.creatorHandleCopied"
              />
            ) : null}
            {platformId ? (
              <CreatorDetailCopyRow
                label={t("ecommerce.affiliateWorkspace.creatorPlatformIdLabel")}
                value={platformId}
                copyLabelKey="ecommerce.affiliateWorkspace.copyCreatorPlatformId"
                copiedMessageKey="ecommerce.affiliateWorkspace.creatorPlatformIdCopied"
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

function readMarketplaceCreatorBio(snapshot: MarketplaceCreatorSnapshot | null): string | null {
  if (!snapshot) return null;
  return readString(snapshot, "bioDescription") ?? readString(snapshot, "bio_description");
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
  copyLabelKey,
  copiedMessageKey,
  tone = "platform",
}: {
  label: string;
  value: string;
  muted?: boolean;
  copyLabelKey: string;
  copiedMessageKey: string;
  tone?: "platform" | "system";
}) {
  return (
    <div className={`affiliate-creator-detail-id-row${muted ? " affiliate-creator-detail-id-row-muted" : ""}`}>
      <span>{label}</span>
      <CopyInlineValue
        value={value}
        className={`affiliate-id-copy-button ${tone === "system" ? "affiliate-system-id-copy" : "affiliate-platform-id-copy"} affiliate-creator-detail-copy-button`}
        copiedMessageKey={copiedMessageKey}
        copyLabelKey={copyLabelKey}
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
  if (!handle && !platformId) return null;
  return (
    <span className="affiliate-creator-platform-row">
      {handle ? (
        <>
          <span className="affiliate-creator-platform-label">TikTok</span>
          <span className="affiliate-creator-handle">{handle}</span>
        </>
      ) : null}
      <PlatformIdCopy value={platformId} labelKey="ecommerce.affiliateWorkspace.copyCreatorPlatformId" />
    </span>
  );
}

function SystemIdCopy({
  value,
  labelKey = "ecommerce.affiliateWorkspace.copySystemId",
}: {
  value?: string | null;
  labelKey?: string;
}) {
  if (!value) return null;
  return (
    <CopyInlineValue
      value={value}
      className="affiliate-id-copy-button affiliate-system-id-copy"
      copiedMessageKey="ecommerce.affiliateWorkspace.systemIdCopied"
      copyLabelKey={labelKey}
    />
  );
}

function PlatformIdCopy({
  value,
  labelKey = "ecommerce.affiliateWorkspace.copyPlatformId",
}: {
  value?: string | null;
  labelKey?: string;
}) {
  if (!value) return null;
  return (
    <CopyInlineValue
      value={value}
      className="affiliate-id-copy-button affiliate-platform-id-copy"
      copiedMessageKey="ecommerce.affiliateWorkspace.platformIdCopied"
      copyLabelKey={labelKey}
    />
  );
}

function CopyInlineValue({
  value,
  className,
  copiedMessageKey,
  copyLabelKey,
}: {
  value: string;
  className: string;
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
      <CopyIcon />
      <span>{copied ? t(copiedMessageKey) : t(copyLabelKey)}</span>
    </button>
  );
}

function creatorPrimaryName(profile: GQL.AffiliateCreatorIdentity, fallback: string): string {
  const nickname = profile.nickname?.trim();
  const username = normalizeTikTokUsername(profile.username);
  if (nickname) return nickname;
  if (username) return `@${username}`;
  return fallback;
}

function creatorTikTokHandle(profile: GQL.AffiliateCreatorIdentity): string | null {
  const username = normalizeTikTokUsername(profile.username);
  if (!username) return null;
  const nickname = profile.nickname?.trim();
  if (!nickname || nickname === username || nickname === `@${username}`) return null;
  return `@${username}`;
}

function creatorPlatformIdentity(profile: GQL.AffiliateCreatorIdentity): string | null {
  return profile.creatorOpenId || profile.creatorImId || null;
}

function normalizeTikTokUsername(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^@+/, "");
}

function getProposalActionProductId(proposal: GQL.ActionProposal | null): string | null {
  if (!proposal) return null;
  const directProductId = proposal.messageIntent?.parts.find((part) => part.productId)?.productId
    ?? proposal.campaignProductUpdateIntent?.productId
    ?? null;
  if (directProductId) return directProductId;
  for (const step of proposal.steps ?? []) {
    const stepProductId = step.messageIntent?.parts.find((part) => part.productId)?.productId
      ?? step.campaignProductUpdateIntent?.productId
      ?? null;
    if (stepProductId) return stepProductId;
  }
  return null;
}

function findProposalPredictionSnapshot(
  proposal: GQL.ActionProposal,
): GQL.AffiliateCollaborationRecordPredictionSnapshot | null {
  const snapshots = proposal.collaborationRecord?.predictionSnapshots ?? [];
  if (!snapshots.length) return null;
  const cacheIds = new Set<string>();
  for (const cacheId of proposal.predictionCacheIds ?? []) {
    if (cacheId) cacheIds.add(cacheId);
  }
  for (const step of proposal.steps ?? []) {
    for (const cacheId of step.predictionCacheIds ?? []) {
      if (cacheId) cacheIds.add(cacheId);
    }
  }
  const matching = cacheIds.size
    ? snapshots.filter((snapshot) => snapshot.sourceCacheId && cacheIds.has(snapshot.sourceCacheId))
    : [];
  const candidates = matching.length
    ? matching
    : snapshots.filter((snapshot) => snapshot.scenario === GQL.AffiliateExpectedSalesPredictionScenario.SampleReview);
  return sortPredictionSnapshotsByCaptureTime(candidates.length ? candidates : snapshots)[0] ?? null;
}

function sortPredictionSnapshotsByCaptureTime(
  snapshots: GQL.AffiliateCollaborationRecordPredictionSnapshot[],
): GQL.AffiliateCollaborationRecordPredictionSnapshot[] {
  return [...snapshots].sort((a, b) => {
    const aTime = new Date(a.capturedAt ?? a.predictedAt).getTime();
    const bTime = new Date(b.capturedAt ?? b.predictedAt).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

function readPredictionSnapshotOutput(
  snapshot: GQL.AffiliateCollaborationRecordPredictionSnapshot | null,
): AffiliatePredictionSnapshotOutput | null {
  if (!snapshot || snapshot.status !== GQL.AffiliatePredictionStatus.Ok) return null;
  const output = snapshot.output as AffiliatePredictionSnapshotOutput | null | undefined;
  return output ?? null;
}

function getPredictionSalesJudgmentLabel(
  expectedSalesUnits: number | null,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (typeof expectedSalesUnits !== "number") {
    return t("ecommerce.affiliateWorkspace.predictionComparison.forecastAvailable");
  }
  if (expectedSalesUnits < 1) {
    return t("ecommerce.affiliateWorkspace.predictionComparison.lowExpectedSales");
  }
  if (expectedSalesUnits < 3) {
    return t("ecommerce.affiliateWorkspace.predictionComparison.modestExpectedSales");
  }
  return t("ecommerce.affiliateWorkspace.predictionComparison.strongExpectedSales");
}

function formatProposalTime(value: string | null | undefined): string {
  if (!value) return "—";
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

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value);
}

function formatAffiliateEnumLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCompactIdentifier(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 8) return value.slice(0, maxLength);
  const sideLength = Math.floor((maxLength - 1) / 2);
  const tailLength = maxLength - sideLength - 1;
  return `${value.slice(0, sideLength)}…${value.slice(-tailLength)}`;
}

function formatActionProposalTypeLabel(
  value: string | null | undefined,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (!value) return "—";
  return t(`ecommerce.shopDrawer.affiliate.proposalTypes.${value}`, {
    defaultValue: formatAffiliateEnumLabel(value),
  });
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
  const directText = proposal.messageIntent?.parts.find((part) => part.kind === GQL.AffiliateMessagePartKind.Text)?.text?.trim();
  if (directText) return directText;
  for (const step of proposal.steps ?? []) {
    const text = step.messageIntent?.parts.find((part) => part.kind === GQL.AffiliateMessagePartKind.Text)?.text?.trim();
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
  const proposalRevisionRequested =
    latestProposal?.status === GQL.ActionProposalStatus.RevisionRequested;
  const proposalPending = latestProposal?.status === GQL.ActionProposalStatus.Pending;

  if (record.lifecycleStage === GQL.AffiliateLifecycleStage.Blocked) {
    return {
      badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.blocked"),
      badgeTone: "blocked",
      stage,
      ownerLabel: t("ecommerce.affiliateWorkspace.labels.currentSituation"),
      title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.BLOCKED"),
      description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.BLOCKED"),
    };
  }

  if (record.processingStatus === GQL.AffiliateCollaborationRecordProcessingStatus.Idle) {
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

  if (proposalRevisionRequested) {
    return {
      badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.agent"),
      badgeTone: "waiting",
      stage,
      ownerLabel: t("ecommerce.affiliateWorkspace.labels.currentSituation"),
      title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.PROPOSAL_REVISION_REQUESTED"),
      description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.PROPOSAL_REVISION_REQUESTED"),
    };
  }

  if (
    proposalPending ||
    record.processingStatus === GQL.AffiliateCollaborationRecordProcessingStatus.StaffRequired ||
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
    case GQL.AffiliateCollaborationRequiredAction.FollowUpCreator:
      return {
        badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.agent"),
        badgeTone: "attention",
        stage,
        ownerLabel: t("ecommerce.affiliateWorkspace.labels.nextStep"),
        title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.CREATOR_ACTION_FOLLOW_UP_DUE"),
        description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.FOLLOW_UP_CREATOR"),
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

  if (record.processingStatus === GQL.AffiliateCollaborationRecordProcessingStatus.WaitingExternal) {
    return {
      badge: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.waitingExternal", {
        defaultValue: t("ecommerce.affiliateWorkspace.collaborationWorkBadges.waitingCreator"),
      }),
      badgeTone: "waiting",
      stage,
      ownerLabel: t("ecommerce.affiliateWorkspace.labels.currentSituation"),
      title: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.WAITING_EXTERNAL", {
        defaultValue: t("ecommerce.affiliateWorkspace.collaborationWorkTitles.WAITING_CREATOR"),
      }),
      description: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.WAITING_EXTERNAL", {
        defaultValue: t("ecommerce.affiliateWorkspace.collaborationWorkDescriptions.WAITING_CREATOR"),
      }),
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
    GQL.AffiliateCollaborationRecordProcessReason.SampleContentFollowUpDue,
    GQL.AffiliateCollaborationRecordProcessReason.CreatorActionFollowUpDue,
    GQL.AffiliateCollaborationRecordProcessReason.IdentityResolution,
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

function renderProposalPreview(
  proposal: GQL.ActionProposal,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (proposal.messageIntent) {
    const pending = proposal.status === GQL.ActionProposalStatus.Pending
      || proposal.status === GQL.ActionProposalStatus.RevisionRequested;
    const previews = proposal.messageIntent.parts.map((part) => {
      if (part.kind === GQL.AffiliateMessagePartKind.Text) {
        if (part.text?.trim()) return part.text.trim();
        return part.textHash
          ? `TEXT · ${part.textLength ?? 0} chars · SHA-256 ${part.textHash.slice(0, 12)}`
          : "TEXT";
      }
      if (part.kind === GQL.AffiliateMessagePartKind.Attachment) {
        return `${part.fileName ?? "Attachment"} · ${part.mimeType ?? "unknown"} · ${part.sizeBytes != null ? formatFileSize(part.sizeBytes) : "?"} · SHA-256 ${part.sha256?.slice(0, 12) ?? "—"}`;
      }
      return `${formatAffiliateEnumLabel(part.kind)} · ${part.productId ?? part.targetCollaborationId ?? part.sampleApplicationId ?? "—"}`;
    });
    if (!pending && previews.length > 0) {
      return `${t("ecommerce.affiliateWorkspace.proposalMessageCleared", {
        defaultValue: "Content cleared by retention policy",
      })}\n${previews.join("\n")}`;
    }
    return previews.join("\n") || t("ecommerce.shopDrawer.affiliate.messageIntentFallback", {
      type: "MESSAGE",
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
  if (proposal.executionResult?.deliveryStatus) {
    const selection = proposal.executionResult.channelSelectionSource
      ? t(`ecommerce.affiliateWorkspace.deliverySelection.${proposal.executionResult.channelSelectionSource}`, {
          defaultValue: formatAffiliateEnumLabel(proposal.executionResult.channelSelectionSource),
        })
      : "—";
    lines.push(t("ecommerce.affiliateWorkspace.deliveryAudit", {
      defaultValue: "{{selection}} · selected {{preferred}} · actual {{actual}} · {{status}}",
      selection,
      preferred: proposal.executionResult.preferredChannel
        ? formatAffiliateEnumLabel(proposal.executionResult.preferredChannel)
        : "—",
      actual: proposal.executionResult.actualChannel
        ? formatAffiliateEnumLabel(proposal.executionResult.actualChannel)
        : "—",
      status: formatAffiliateEnumLabel(proposal.executionResult.deliveryStatus),
    }));
  }
  return lines.join("\n");
}

function renderLifecycleEventDetail(
  event: AffiliateLifecycleEvent,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const payload = parseLifecycleDisplayPayload(event.displayPayloadJson);
  if (event.eventType === GQL.AffiliateLifecycleEventType.ProposalCreated && payload) {
    const lines: string[] = [];
    if (typeof payload.operatorSummary === "string" && payload.operatorSummary.trim()) {
      lines.push(payload.operatorSummary.trim());
    }
    if (typeof payload.actionType === "string" && payload.actionType.trim()) {
      lines.push(t("ecommerce.affiliateWorkspace.activity.proposalActionType", {
        actionType: formatActionProposalTypeLabel(payload.actionType, t),
      }));
    }
    if (typeof payload.stepCount === "number" && Number.isFinite(payload.stepCount)) {
      lines.push(t("ecommerce.affiliateWorkspace.activity.proposalStepCount", {
        count: payload.stepCount,
      }));
    }
    return lines.join("\n") || t("ecommerce.affiliateWorkspace.activity.eventRecorded");
  }
  if (event.eventType === GQL.AffiliateLifecycleEventType.ProposalRevisionRequested && payload) {
    const lines: string[] = [];
    if (typeof payload.note === "string" && payload.note.trim()) {
      lines.push(t("ecommerce.affiliateWorkspace.activity.staffDecision", {
        note: payload.note.trim(),
      }));
    }
    return lines.join("\n") || t("ecommerce.affiliateWorkspace.activity.eventRecorded");
  }
  if (event.fromStage || event.toStage) {
    return t("ecommerce.affiliateWorkspace.activity.stageTransition", {
      from: event.fromStage
        ? t(`ecommerce.affiliateWorkspace.lifecycleStages.${event.fromStage}`, { defaultValue: event.fromStage })
        : "—",
      to: event.toStage
        ? t(`ecommerce.affiliateWorkspace.lifecycleStages.${event.toStage}`, { defaultValue: event.toStage })
        : "—",
    });
  }
  return t("ecommerce.affiliateWorkspace.activity.eventRecorded");
}

function parseLifecycleDisplayPayload(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
