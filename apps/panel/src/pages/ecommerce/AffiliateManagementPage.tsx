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
  AFFILIATE_COLLABORATION_DETAIL_QUERY,
  AFFILIATE_COLLABORATIONS_QUERY,
  AFFILIATE_CREATOR_MESSAGE_HISTORY_QUERY,
  AFFILIATE_CREATOR_PROFILE_QUERY,
  AFFILIATE_CREATOR_RELATIONSHIP_DETAIL_QUERY,
  AFFILIATE_CREATORS_QUERY,
  AFFILIATE_RELATIONSHIP_PLATFORM_COLLABORATIONS_QUERY,
  AFFILIATE_RELATIONSHIP_SAMPLE_APPLICATIONS_QUERY,
  AFFILIATE_RELATIONSHIP_TIMELINE_QUERY,
  AFFILIATE_WORK_ITEMS_QUERY,
  AFFILIATE_POLICY_CONTEXT_QUERY,
  AFFILIATE_OPERATIONAL_PROJECTION_HEALTH_QUERY,
  AFFILIATE_PRODUCT_SUMMARIES_QUERY,
  APPLY_CREATOR_TAG_MUTATION,
  ASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION,
  DECIDE_ACTION_PROPOSAL_MUTATION,
  REMOVE_CREATOR_TAG_MUTATION,
  SEND_AFFILIATE_CREATOR_MESSAGE_MUTATION,
  PROTECT_AFFILIATE_CREATOR_RELATIONSHIP_MUTATION,
  REMOVE_AFFILIATE_CREATOR_RELATIONSHIP_PROTECTION_MUTATION,
} from "../../api/shops-queries.js";
import { creatorTagLabel } from "./affiliate-tag-labels.js";
import { AffiliateMetricLabel } from "./components/AffiliateMetricLabel.js";
import { ProductSummaryCard } from "./components/ProductSummaryCard.js";

type CreatorRelationshipWorkItem = {
  relationshipId: string;
  shopId: string;
  creatorId?: string | null;
  creatorOpenId?: string | null;
  creatorImId?: string | null;
  processingStatus: GQL.AffiliateRelationshipProcessingStatus;
  requiredAction: GQL.AffiliateRelationshipRequiredAction;
  processReasons: GQL.AffiliateWorkProcessReason[];
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  nextSellerActionAt?: string | null;
  stateUpdatedAt?: string | null;
  creatorProfile?: GQL.AffiliateCreatorIdentity | null;
  creatorRelation?: GQL.AffiliateCreatorRelationship | null;
  activeCollaborations: GQL.AffiliateCollaboration[];
  ambiguousCollaborations: GQL.AffiliateCollaboration[];
  focusCollaboration?: GQL.AffiliateCollaboration | null;
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
  GQL.AffiliateCollaborationStatus.Active,
  GQL.AffiliateCollaborationStatus.Paused,
  GQL.AffiliateCollaborationStatus.Expiring,
  GQL.AffiliateCollaborationStatus.Terminating,
  GQL.AffiliateCollaborationStatus.Expired,
  GQL.AffiliateCollaborationStatus.Cancelled,
  GQL.AffiliateCollaborationStatus.Failed,
] as const;

type HistoryStatusFilter = (typeof HISTORY_STATUS_FILTERS)[number];
type HistoryTypeFilter = "ALL" | GQL.AffiliateCollaborationType;
const NO_HISTORY_SUB_STATUS = "__NO_HISTORY_SUB_STATUS__";
const CREATOR_RELATIONSHIP_WORK_PAGE_SIZE = 24;
const AFFILIATE_TIMELINE_PAGE_SIZE = 25;
const AFFILIATE_CREATORS_PAGE_SIZE = 24;
const AFFILIATE_PROPOSAL_PAGE_SIZE = 20;
const ALL_CREATOR_TAGS_FILTER = "__ALL_CREATOR_TAGS__";
const PROJECTION_DATASET_I18N_KEY: Record<string, string> = {
  COLLABORATIONS: "ecommerce.affiliateWorkspace.projectionDataset.COLLABORATIONS",
  SAMPLE_APPLICATIONS: "ecommerce.affiliateWorkspace.projectionDataset.SAMPLE_APPLICATIONS",
};
const PROJECTION_STATUS_I18N_KEY: Record<string, string> = {
  NOT_STARTED: "ecommerce.affiliateWorkspace.projectionStatus.NOT_STARTED",
  SYNCING: "ecommerce.affiliateWorkspace.projectionStatus.SYNCING",
  READY: "ecommerce.affiliateWorkspace.projectionStatus.READY",
  DEGRADED: "ecommerce.affiliateWorkspace.projectionStatus.DEGRADED",
  BOOTSTRAPPING: "ecommerce.affiliateWorkspace.projectionStatus.BOOTSTRAPPING",
  PROVIDER_WINDOW_LIMITED: "ecommerce.affiliateWorkspace.projectionStatus.PROVIDER_WINDOW_LIMITED",
};
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
  expectedSalesStatus?: string | null;
  humanDecisionStatus?: string | null;
  modelStage?: "UNIFIED" | "EVENT_TIME" | "BOOTSTRAP" | null;
  featureTemporalBasis?: "BEST_AVAILABLE" | "DECISION_TIME" | "CURRENT_STATE_PROXY" | null;
  requestedTenantScope?: "USER" | "REGION" | "SHOP" | null;
  requestedTenantId?: string | null;
  effectiveTenantScope?: "USER" | "REGION" | "SHOP" | null;
  effectiveTenantId?: string | null;
  modelStatus?: string | null;
  expectedSalesSelection?: AffiliatePredictionModelSelection | null;
  humanDecisionSelection?: AffiliatePredictionModelSelection | null;
  humanDecision?: {
    wouldApprove?: boolean | null;
    humanApprovalProbability?: number | null;
    historicalApprovalRate?: number | null;
    status?: string | null;
    message?: string | null;
  } | null;
};

type AffiliatePredictionSnapshotView = {
  status: string;
  output?: unknown;
  sourceCacheId?: string | null;
  scenario?: string | null;
  capturedAt?: string | null;
  predictedAt?: string | null;
};

type AffiliatePredictionModelSelection = {
  modelStage?: "UNIFIED" | "EVENT_TIME" | "BOOTSTRAP" | null;
  featureTemporalBasis?: "BEST_AVAILABLE" | "DECISION_TIME" | "CURRENT_STATE_PROXY" | null;
  requestedTenantScope?: "USER" | "REGION" | "SHOP" | null;
  requestedTenantId?: string | null;
  effectiveTenantScope?: "USER" | "REGION" | "SHOP" | null;
  effectiveTenantId?: string | null;
  modelStatus?: string | null;
};

function affiliateSnapshot<T>(value: T | null | undefined): any {
  if (!value) return null;
  return isStateTreeNode(value as any) ? getSnapshot(value as any) : value;
}

function mergeById<T>(items: T[], identity: (item: T) => string | null | undefined = (item) =>
  (item as { id?: string | null }).id): T[] {
  const merged = new Map<string, T>();
  for (const item of items) {
    const id = identity(item);
    if (!id) continue;
    merged.set(id, item);
  }
  return [...merged.values()];
}

export function selectAffiliateProposalItems<T>(
  queryItems: T[] | undefined,
  storedItems: T[],
): T[] {
  return queryItems === undefined ? storedItems : queryItems;
}

function hydrateAffiliateProposalProjection(projection: {
  proposal: unknown;
  affiliateCollaboration?: unknown | null;
  sampleApplicationRecord?: unknown | null;
  creatorProfile?: unknown | null;
  productSummary?: unknown | null;
}): GQL.ActionProposal {
  const proposal = affiliateSnapshot(projection.proposal);
  return {
    ...proposal,
    affiliateCollaboration: affiliateSnapshot(
      projection.affiliateCollaboration ?? (proposal as any).affiliateCollaboration,
    ),
    sampleApplicationRecord: affiliateSnapshot(
      projection.sampleApplicationRecord ?? (proposal as any).sampleApplicationRecord,
    ),
    creatorProfile: affiliateSnapshot(projection.creatorProfile ?? (proposal as any).creatorProfile),
    productSummary: affiliateSnapshot(projection.productSummary ?? (proposal as any).productSummary),
  } as GQL.ActionProposal;
}

type AffiliateWorkspaceStore = {
  upsertAffiliateActionProposal?: (proposal: GQL.ActionProposal | null | undefined) => void;
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
] as const;

type ProposalFilter = (typeof PROPOSAL_FILTERS)[number];

const PROPOSAL_TYPE_FILTERS = [
  "ALL",
  GQL.ActionProposalType.SendMessage,
  GQL.ActionProposalType.ReviewSampleApplication,
  GQL.ActionProposalType.CreateTargetCollaboration,
] as const;

type ProposalTypeFilter = (typeof PROPOSAL_TYPE_FILTERS)[number];

type AffiliateActionProposalPageData = {
  affiliateActionProposalPage: {
    items: GQL.ActionProposal[];
    nextCursor?: string | null;
    hasMore: boolean;
  };
};

type ReadAffiliateActionProposalPageInput = GQL.ReadActionProposalsInput & {
  cursor?: string | null;
};

export function mergeAffiliateProposalPage(
  current: GQL.ActionProposal[],
  incoming: GQL.ActionProposal[],
): GQL.ActionProposal[] {
  return mergeById([...current, ...incoming]);
}

export function applyAffiliateProposalChange(
  current: GQL.ActionProposal[],
  proposal: GQL.ActionProposal,
  filters: {
    status?: GQL.ActionProposalStatus;
    type?: GQL.ActionProposalType;
    shopId?: string;
  },
): GQL.ActionProposal[] {
  const existingIndex = current.findIndex((candidate) => candidate.id === proposal.id);
  const matches = (
    (!filters.status || proposal.status === filters.status)
    && (!filters.type || proposal.type === filters.type)
    && (!filters.shopId || existingIndex >= 0 || proposal.focusShopId === filters.shopId)
  );
  if (!matches) {
    return existingIndex < 0
      ? current
      : current.filter((candidate) => candidate.id !== proposal.id);
  }
  if (existingIndex < 0) return [proposal, ...current];
  return current.map((candidate) => candidate.id === proposal.id ? proposal : candidate);
}

type AffiliateInsightSubject = {
  key: string;
  kind: "user" | "shop";
  label: string;
  shopId?: string;
};

type AffiliateInsightModelScope = "user" | "region" | "shop";

type AffiliateModelAvailabilityView = {
  modelFamily: string;
  modelStage: string;
  status: string;
  featureTemporalBasis: string;
  requestedTenantScope: string;
  requestedTenantId: string;
  effectiveTenantScope?: string | null;
  effectiveTenantId?: string | null;
  modelVersionKey?: string | null;
  bentomlTag?: string | null;
  contractHash?: string | null;
  contractStatus: string;
  trainedAt?: string | null;
  reason?: string | null;
  evaluationSummary?: GQL.AffiliateMlModelEfficiencySummary | null;
};

export function affiliateModelStagePresentation(
  availability: AffiliateModelAvailabilityView[],
  family: "EXPECTED_SALES" | "HUMAN_DECISION",
  stage: "UNIFIED",
) {
  const entry = availability.find(
    (candidate) =>
      candidate.modelFamily === family && candidate.modelStage === stage,
  ) ?? null;
  const ready = (
    (entry?.status === "READY" || entry?.status === "FALLBACK")
    && entry.contractStatus === "MATCH"
  );
  const rawEvaluation = entry?.evaluationSummary ?? null;
  const evaluationSummary =
    family === "EXPECTED_SALES"
    && stage === "UNIFIED"
    && ready
    && rawEvaluation?.comparisonAvailable === true
      ? rawEvaluation
      : null;
  return {
    entry,
    ready,
    evaluationSummary,
    isCurrent: ready,
    statusKey: ready ? "bestAvailableCurrentReview" : "modelDataAccumulating",
  };
}

export function affiliateExpectedSalesModelAvailabilityState(
  availability: AffiliateModelAvailabilityView[] | null | undefined,
): {
  status: "ready" | "fallback" | "unavailable";
  effectiveTenantScope: string | null;
} {
  const presentation = affiliateModelStagePresentation(
    availability ?? [], "EXPECTED_SALES", "UNIFIED");
  if (!presentation.ready || !presentation.entry) {
    return { status: "unavailable", effectiveTenantScope: null };
  }
  return {
    status: presentation.entry.status === "READY" ? "ready" : "fallback",
    effectiveTenantScope: presentation.entry.effectiveTenantScope ?? null,
  };
}

type AffiliateInsightRow = {
  key: string;
  subjectKey: string;
  kind: "user" | "shop";
  label: string;
  shopId?: string;
  modelScope: AffiliateInsightModelScope;
  availability: AffiliateModelAvailabilityView[];
  automaticSelection?: GQL.AffiliateExpectedSalesAutomaticSelection | null;
  failed?: boolean;
};

export function AffiliateManagementPage() {
  return <AffiliateCreatorsPage />;
}

export const AffiliateIntelligencePage = observer(function AffiliateIntelligencePage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops.filter((shop) => shop.services?.affiliateService?.enabled === true);
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
          availability: (
            cached?.availability ?? []
          ) as AffiliateModelAvailabilityView[],
          automaticSelection: (cached?.automaticSelection ?? null) as GQL.AffiliateExpectedSalesAutomaticSelection | null,
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
      <div className="affiliate-intelligence-hero" data-tutorial-id="affiliate-intelligence-header">
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
            data-tutorial-id="affiliate-intelligence-refresh"
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
  const [loadedProposals, setLoadedProposals] = useState<GQL.ActionProposal[]>([]);
  const [proposalCursor, setProposalCursor] = useState<string | null>(null);
  const [hasMoreProposals, setHasMoreProposals] = useState(false);
  const [loadingMoreProposals, setLoadingMoreProposals] = useState(false);
  const proposalLoadMoreRef = useRef<HTMLDivElement | null>(null);

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
    fetchMore: fetchMoreProposals,
  } = useQuery<
    AffiliateActionProposalPageData,
    { input: ReadAffiliateActionProposalPageInput }
  >(AFFILIATE_ACTION_PROPOSALS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || null,
        status: proposalStatus,
        type: proposalType,
        limit: AFFILIATE_PROPOSAL_PAGE_SIZE,
        cursor: null,
      },
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    skip: !user,
  });

  const [decideActionProposal, { loading: decidingProposal }] = useMutation<
    { decideActionProposal: GQL.ActionProposal },
    { input: GQL.DecideActionProposalInput }
  >(DECIDE_ACTION_PROPOSAL_MUTATION);

  useEffect(() => {
    const page = proposalData?.affiliateActionProposalPage as
      | AffiliateActionProposalPageData["affiliateActionProposalPage"]
      | undefined;
    if (!page) return;
    setLoadedProposals(page.items);
    setProposalCursor(page.nextCursor ?? null);
    setHasMoreProposals(page.hasMore);
    for (const proposal of page.items) {
      entityStore.affiliateWorkspace.upsertAffiliateActionProposal(proposal);
    }
  }, [entityStore.affiliateWorkspace, proposalData?.affiliateActionProposalPage]);

  useEffect(() => {
    setLoadedProposals([]);
    setProposalCursor(null);
    setHasMoreProposals(false);
  }, [selectedShopId, proposalStatus, proposalType]);

  const loadMoreProposals = useCallback(async () => {
    if (!proposalCursor || !hasMoreProposals || loadingMoreProposals) return;
    setLoadingMoreProposals(true);
    try {
      const result = await fetchMoreProposals({
        variables: {
          input: {
            shopId: selectedShopId || null,
            status: proposalStatus,
            type: proposalType,
            limit: AFFILIATE_PROPOSAL_PAGE_SIZE,
            cursor: proposalCursor,
          },
        },
        updateQuery: (current) => current,
      });
      const page = result.data?.affiliateActionProposalPage as
        | AffiliateActionProposalPageData["affiliateActionProposalPage"]
        | undefined;
      if (!page) return;
      setLoadedProposals((current) => mergeAffiliateProposalPage(current, page.items));
      setProposalCursor(page.nextCursor ?? null);
      setHasMoreProposals(page.hasMore);
      for (const proposal of page.items) {
        entityStore.affiliateWorkspace.upsertAffiliateActionProposal(proposal);
      }
    } finally {
      setLoadingMoreProposals(false);
    }
  }, [
    entityStore.affiliateWorkspace,
    fetchMoreProposals,
    hasMoreProposals,
    loadingMoreProposals,
    proposalCursor,
    proposalStatus,
    proposalType,
    selectedShopId,
  ]);

  useEffect(() => {
    const target = proposalLoadMoreRef.current;
    if (!target || !hasMoreProposals || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreProposals();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreProposals, loadMoreProposals]);

  useEffect(() => {
    const unsubscribeProposal = panelEventBus.subscribe("affiliate-action-proposal-changed", (payload) => {
      const proposal = (payload as { proposal?: GQL.ActionProposal } | null)?.proposal;
      if (!proposal?.id) return;
      entityStore.affiliateWorkspace.upsertAffiliateActionProposal(proposal);
      setLoadedProposals((current) => applyAffiliateProposalChange(current, proposal, {
        shopId: selectedShopId || undefined,
        status: proposalStatus,
        type: proposalType,
      }));
    });
    return unsubscribeProposal;
  }, [entityStore.affiliateWorkspace, proposalStatus, proposalType, selectedShopId]);

  const proposalItemsFromQuery = loadedProposals.map((proposal) =>
    hydrateAffiliateProposalProjection(
      proposalProjectionSnapshot(entityStore.affiliateWorkspace, proposal.id) ?? { proposal },
    ),
  );
  const visibleProposalItems = filterActionProposals(
    proposalItemsFromQuery
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
      const result = await decideActionProposal({
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
      const updatedProposal = result.data?.decideActionProposal;
      if (updatedProposal) {
        entityStore.affiliateWorkspace.upsertAffiliateActionProposal(updatedProposal);
        setLoadedProposals((current) => applyAffiliateProposalChange(current, updatedProposal, {
          shopId: selectedShopId || undefined,
          status: proposalStatus,
          type: proposalType,
        }));
      }
      showToast(
        status === GQL.ActionProposalStatus.Approved
          ? t("ecommerce.shopDrawer.affiliate.proposalApproveSuccess")
          : status === GQL.ActionProposalStatus.RevisionRequested
            ? t("ecommerce.shopDrawer.affiliate.proposalRevisionRequestSuccess")
          : t("ecommerce.shopDrawer.affiliate.proposalRejectSuccess"),
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function refetchActive() {
    setLoadedProposals([]);
    setProposalCursor(null);
    setHasMoreProposals(false);
    return refetchProposals({
      input: {
        shopId: selectedShopId || null,
        status: proposalStatus,
        type: proposalType,
        limit: AFFILIATE_PROPOSAL_PAGE_SIZE,
        cursor: null,
      },
    });
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
          {(hasMoreProposals || loadingMoreProposals) ? (
            <div className="affiliate-proposal-stream-footer" ref={proposalLoadMoreRef}>
              <button
                className="btn btn-secondary affiliate-proposal-load-more"
                type="button"
                onClick={() => void loadMoreProposals()}
                disabled={loadingMoreProposals}
              >
                {loadingMoreProposals
                  ? t("ecommerce.affiliateWorkspace.loadingMoreProposals")
                  : t("ecommerce.affiliateWorkspace.loadMoreProposals")}
              </button>
              <span>
                {t("ecommerce.affiliateWorkspace.loadedProposalCount", {
                  count: loadedProposals.length,
                })}
              </span>
            </div>
          ) : loadedProposals.length > 0 ? (
            <div className="affiliate-proposal-stream-footer affiliate-proposal-stream-complete">
              {t("ecommerce.affiliateWorkspace.allProposalsLoaded", {
                count: loadedProposals.length,
              })}
            </div>
          ) : null}
        </div>
      </div>

      {selectedRelationship ? (
        <CreatorRelationshipDetailModal
          item={selectedRelationship}
          selectedShopId={selectedShopId}
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
        shopId: selectedShopId || null,
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
          selectedShopId={selectedShopId}
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
  const [activeModelScope, setActiveModelScope] = useState<AffiliateInsightModelScope>("user");
  const selectedSubject =
    subjects.find((subject) => subject.key === selectedKey)
    ?? subjects.find((subject) =>
      rows.some(
        (row) => row.subjectKey === subject.key && row.availability.length > 0,
      ))
    ?? subjects[0]
    ?? null;
  const selectedRows = selectedSubject
    ? rows.filter((row) => row.subjectKey === selectedSubject.key)
    : [];
  const accountModelRow = selectedRows.find((row) => row.modelScope === "user") ?? null;
  const regionModelRow = selectedRows.find((row) => row.modelScope === "region") ?? null;
  const storeModelRow = selectedRows.find((row) => row.modelScope === "shop") ?? null;
  const selectedRow =
    (activeModelScope === "shop"
      ? storeModelRow
      : activeModelScope === "region"
        ? regionModelRow
        : accountModelRow)
    ?? selectedRows.find((row) => row.availability.length > 0)
    ?? selectedRows[0]
    ?? rows.find((row) => row.availability.length > 0)
    ?? rows[0]
    ?? null;
  const availability = selectedRow?.availability ?? [];
  const productionPresentation = affiliateModelStagePresentation(
    availability,
    "EXPECTED_SALES",
    "UNIFIED",
  );

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
            activeModelScope={activeModelScope}
            automaticSelection={selectedRows.find((row) => row.automaticSelection)?.automaticSelection ?? null}
            regionRow={regionModelRow}
            storeRow={storeModelRow}
            onChange={setActiveModelScope}
          />
        ) : null}
        {availability.length === 0 ? (
          <div className="affiliate-intelligence-empty" data-tutorial-id="affiliate-intelligence-analysis">
            <InfoIcon />
            <strong>{selectedSubject.label}</strong>
            <span>
              {selectedRows.some((row) => row.failed)
                ? t("ecommerce.affiliateWorkspace.intelligenceModelUnavailableHint")
                : t("ecommerce.affiliateWorkspace.modelAvailabilityEmpty")}
            </span>
          </div>
        ) : productionPresentation.evaluationSummary ? (
          <AffiliateProductionModelDashboard
            selectedSubject={selectedSubject}
            selectedRow={selectedRow}
            summary={productionPresentation.evaluationSummary}
          />
        ) : (
          <div className="affiliate-model-stage-grid" data-tutorial-id="affiliate-intelligence-analysis">
            <AffiliateModelStageCard
              availability={availability}
              stage="UNIFIED"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AffiliateProductionModelDashboard({
  selectedSubject,
  selectedRow,
  summary,
}: {
  selectedSubject: AffiliateInsightSubject;
  selectedRow: AffiliateInsightRow | null;
  summary: GQL.AffiliateMlModelEfficiencySummary;
}) {
  const { t } = useTranslation();
  const humanApprovedCount = summary.historicalSelectedCount;
  const humanExpectedUnits = summary.historicalExpectedUnits;
  const modelExpectedUnits = summary.modelExpectedUnits;
  const liftRatio = summary.expectedSalesLiftRatio;
  const sellerSafeMetrics = affiliateSellerSafeMetrics(summary);
  const outperformanceProbability = sellerSafeMetrics.outperformanceProbability;
  const dataFoundationLevel = sellerSafeMetrics.dataFoundationLevel;
  const rangeLevel = sellerSafeMetrics.primaryRangeLevel;
  const rangeLower = sellerSafeMetrics.primaryRangeLowerBound;
  const rangeUpper = sellerSafeMetrics.primaryRangeUpperBound;
  const maxUnits = Math.max(modelExpectedUnits ?? 0, humanExpectedUnits ?? 0, 1);
  const modelBarValue = Math.max(0, ((modelExpectedUnits ?? 0) / maxUnits) * 100);
  const humanBarValue = Math.max(0, ((humanExpectedUnits ?? 0) / maxUnits) * 100);
  const liftPercent = liftRatio == null ? null : (liftRatio - 1) * 100;
  const liftLabel = formatSignedPercent(liftPercent);
  const modelLabel = selectedRow?.modelScope === "shop"
    ? t("ecommerce.affiliateWorkspace.intelligenceStoreModel")
    : selectedRow?.modelScope === "region"
      ? t("ecommerce.affiliateWorkspace.intelligenceRegionModel")
      : t("ecommerce.affiliateWorkspace.intelligenceAccountModel");
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const claimBody = liftPercent != null && liftPercent > 0
    ? translate("ecommerce.affiliateWorkspace.intelligenceClaimPrecisionBody", {
        lift: liftLabel,
        count: formatInteger(humanApprovedCount),
      })
    : translate("ecommerce.affiliateWorkspace.intelligenceClaimPrecisionNeutral", {
        lift: liftLabel,
        count: formatInteger(humanApprovedCount),
      });

  if (!summary.comparisonAvailable) {
    return (
      <div className="affiliate-intelligence-empty" data-tutorial-id="affiliate-intelligence-analysis">
        <InfoIcon />
        <strong>{t("ecommerce.affiliateWorkspace.intelligenceClaimPrecisionTitle")}</strong>
        <span>{t("ecommerce.affiliateWorkspace.intelligenceComparisonUnavailable")}</span>
      </div>
    );
  }

  return (
    <>
      <div className="affiliate-intelligence-production-banner">
        <span>{t("ecommerce.affiliateWorkspace.intelligenceClaimPrecisionTitle")}</span>
        <strong>{modelLabel}</strong>
      </div>
      <div className="affiliate-intelligence-claim-section" data-tutorial-id="affiliate-intelligence-analysis">
        <div className="affiliate-intelligence-comparison">
          <div className="affiliate-intelligence-card-head">
            <div className="affiliate-intelligence-card-title">
              <span>{selectedSubject.kind === "shop"
                ? `${selectedSubject.label} · ${modelLabel}`
                : selectedSubject.label}</span>
              <strong>{t("ecommerce.affiliateWorkspace.intelligenceClaimPrecisionTitle")}</strong>
              <p>{claimBody}</p>
            </div>
            <div className="affiliate-intelligence-card-aside">
              {liftPercent != null ? (
                <div className={`affiliate-intelligence-lift-badge${liftPercent < 0 ? " affiliate-intelligence-lift-badge-negative" : ""}`}>
                  <strong>{liftLabel}</strong>
                  <span>{t("ecommerce.affiliateWorkspace.intelligenceChartSameBudget")}</span>
                </div>
              ) : null}
              <small>{translate("ecommerce.affiliateWorkspace.intelligenceSameBudgetStory", {
                count: formatInteger(humanApprovedCount),
              })}</small>
            </div>
          </div>

          <div className="affiliate-intelligence-race">
            <AffiliateRaceRow
              icon={<AffiliateSparkIcon />}
              label={t("ecommerce.affiliateWorkspace.intelligenceModelSelector")}
              value={formatNumber(modelExpectedUnits, 1)}
              barValue={modelBarValue}
              variant="model"
            />
            <AffiliateRaceRow
              icon={<UserIcon />}
              label={t("ecommerce.affiliateWorkspace.intelligenceHumanSelector")}
              value={formatNumber(humanExpectedUnits, 1)}
              barValue={humanBarValue}
              variant="human"
            />
          </div>

          <div className="affiliate-intelligence-evidence-grid">
            {outperformanceProbability != null ? (
              <div className="affiliate-intelligence-evidence-card affiliate-intelligence-evidence-card-probability">
                <strong>
                  <AffiliateMetricLabel
                    label={t("ecommerce.affiliateWorkspace.intelligenceOutperformanceProbability")}
                    tooltip={t("ecommerce.affiliateWorkspace.intelligenceOutperformanceProbabilityTooltip")}
                  />
                </strong>
                <span>{formatPercent(outperformanceProbability)}</span>
              </div>
            ) : null}
            {rangeLower != null && rangeUpper != null ? (
              <div className="affiliate-intelligence-evidence-card affiliate-intelligence-evidence-card-range">
                <strong>
                  <AffiliateMetricLabel
                    label={t("ecommerce.affiliateWorkspace.intelligencePrimaryRange", {
                      level: rangeLevel == null ? "" : Math.round(rangeLevel * 100),
                    })}
                    tooltip={t("ecommerce.affiliateWorkspace.intelligencePrimaryRangeTooltip")}
                  />
                </strong>
                <span>{formatLiftRatioRange(rangeLower, rangeUpper)}</span>
              </div>
            ) : null}
            {dataFoundationLevel ? (
              <div className="affiliate-intelligence-evidence-card affiliate-intelligence-evidence-card-foundation">
                <strong>
                  <AffiliateMetricLabel
                    label={t("ecommerce.affiliateWorkspace.intelligenceDataFoundation")}
                    tooltip={t("ecommerce.affiliateWorkspace.intelligenceDataFoundationTooltip")}
                  />
                </strong>
                <span>{t(`ecommerce.affiliateWorkspace.intelligenceDataFoundationLevels.${dataFoundationLevel.toLowerCase()}`)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {summary.sameBudgetComparison ? (
        <AffiliateBudgetDistributionPanel
          comparison={summary.sameBudgetComparison}
          historicalApplicationCount={summary.historicalApplicationCount}
          historicalSelectedCount={summary.historicalSelectedCount}
          historicalExpectedUnits={summary.historicalExpectedUnits}
          modelExpectedUnits={summary.modelExpectedUnits}
          modelSelectedCount={summary.modelSelectedCount}
        />
      ) : null}
      {summary.sameThresholdComparison ? (
        <AffiliateThresholdComparisonPanel
          comparison={summary.sameThresholdComparison}
          historicalApplicationCount={summary.historicalApplicationCount}
        />
      ) : null}
      <div className="affiliate-intelligence-footnote">
        <span
          className="affiliate-intelligence-disclaimer"
          title={t("ecommerce.affiliateWorkspace.intelligenceLegalDisclaimer")}
        >
          <InfoIcon />
        </span>
        <span>{t("ecommerce.affiliateWorkspace.intelligenceSellerSafeDisclaimer")}</span>
      </div>
    </>
  );
}

type AffiliateHistogramSeries = {
  key: string;
  label: string;
  buckets: GQL.AffiliateMlHistogramBucket[] | null | undefined;
  expectedTotal?: number | null;
};

function AffiliateBudgetDistributionPanel({
  comparison,
  historicalApplicationCount,
  historicalSelectedCount,
  historicalExpectedUnits,
  modelExpectedUnits,
  modelSelectedCount,
}: {
  comparison: GQL.AffiliateMlSameBudgetComparison;
  historicalApplicationCount: number;
  historicalSelectedCount: number;
  historicalExpectedUnits?: number | null;
  modelExpectedUnits?: number | null;
  modelSelectedCount: number;
}) {
  const { t } = useTranslation();
  return (
    <AffiliateClaimDistributionPanel
      title={t("ecommerce.affiliateWorkspace.intelligenceBudgetStatsTitle")}
      headline={t("ecommerce.affiliateWorkspace.intelligenceBudgetStatsHeadline")}
      hint={t("ecommerce.affiliateWorkspace.intelligenceBudgetStatsHint")}
      stats={[
        {
          label: t("ecommerce.affiliateWorkspace.intelligenceHistoricalApplications"),
          value: formatInteger(historicalApplicationCount),
        },
        {
          label: t("ecommerce.affiliateWorkspace.intelligenceHistoricalSelectedCount"),
          value: formatInteger(historicalSelectedCount),
        },
        {
          label: t("ecommerce.affiliateWorkspace.intelligenceHistoricalExpectedUnits"),
          value: formatNumber(historicalExpectedUnits, 1),
        },
        {
          label: t("ecommerce.affiliateWorkspace.intelligenceModelExpectedUnits"),
          value: formatNumber(modelExpectedUnits, 1),
        },
      ]}
      series={[
        {
          key: "actual",
          label: t("ecommerce.affiliateWorkspace.intelligenceHistoricalApprovedActual"),
          buckets: comparison.historicalActualUnitsHistogram,
          expectedTotal: comparison.historicalActualObservedCount,
        },
        {
          key: "historical",
          label: t("ecommerce.affiliateWorkspace.intelligenceHistoricalApprovedExpected"),
          buckets: comparison.historicalExpectedUnitsHistogram,
          expectedTotal: historicalSelectedCount,
        },
        {
          key: "model",
          label: t("ecommerce.affiliateWorkspace.intelligenceModelSelectedExpected"),
          buckets: comparison.modelExpectedUnitsHistogram,
          expectedTotal: modelSelectedCount,
        },
      ]}
    />
  );
}

function AffiliateThresholdComparisonPanel({
  comparison,
  historicalApplicationCount,
}: {
  comparison: GQL.AffiliateMlSameThresholdComparison;
  historicalApplicationCount: number;
}) {
  const { t } = useTranslation();
  const historicalQualifiedCount = comparison.historicalQualifiedCount;
  const modelQualifiedCount = comparison.modelQualifiedCount;
  const maximumCount = Math.max(
    historicalQualifiedCount ?? 0,
    modelQualifiedCount ?? 0,
    1,
  );
  const liftPercent = comparison.qualifiedCreatorLiftRatio == null
    ? null
    : (comparison.qualifiedCreatorLiftRatio - 1) * 100;
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;

  return (
    <section className="affiliate-intelligence-claim-section">
      <div className="affiliate-intelligence-comparison affiliate-intelligence-comparison-secondary">
        <div className="affiliate-intelligence-card-head">
          <div className="affiliate-intelligence-card-title">
            <span>{t("ecommerce.affiliateWorkspace.intelligenceChartSameSalesBar")}</span>
            <strong>{t("ecommerce.affiliateWorkspace.intelligenceClaimReachTitle")}</strong>
            <p>{translate("ecommerce.affiliateWorkspace.intelligenceClaimReachBody", {
              bar: formatNumber(comparison.minimumExpectedSalesUnits, 1),
              creators: formatInteger(modelQualifiedCount),
              overlooked: formatInteger(comparison.modelQualifiedHistoricalRejectedCount),
            })}</p>
          </div>
          {liftPercent != null ? (
            <div className="affiliate-intelligence-lift-badge">
              <strong>{formatSignedPercent(liftPercent)}</strong>
              <span>{t("ecommerce.affiliateWorkspace.intelligenceChartSameSalesBar")}</span>
            </div>
          ) : null}
        </div>
        <div className="affiliate-intelligence-race">
          <AffiliateRaceRow
            icon={<AffiliateTargetIcon />}
            label={t("ecommerce.affiliateWorkspace.intelligenceModelQualifiedCreators")}
            value={formatInteger(modelQualifiedCount)}
            barValue={Math.max(0, ((modelQualifiedCount ?? 0) / maximumCount) * 100)}
            variant="model"
          />
          <AffiliateRaceRow
            icon={<AffiliateShieldIcon />}
            label={t("ecommerce.affiliateWorkspace.intelligenceHumanQualifiedCreators")}
            value={formatInteger(historicalQualifiedCount)}
            barValue={Math.max(0, ((historicalQualifiedCount ?? 0) / maximumCount) * 100)}
            variant="human"
          />
        </div>
      </div>
      <AffiliateClaimDistributionPanel
        title={t("ecommerce.affiliateWorkspace.intelligenceReachStatsTitle")}
        headline={t("ecommerce.affiliateWorkspace.intelligenceReachStatsHeadline")}
        hint={translate("ecommerce.affiliateWorkspace.intelligenceClaimReachBody", {
          bar: formatNumber(comparison.minimumExpectedSalesUnits, 1),
          creators: formatInteger(modelQualifiedCount),
          overlooked: formatInteger(comparison.modelQualifiedHistoricalRejectedCount),
        })}
        stats={[
          {
            label: t("ecommerce.affiliateWorkspace.intelligenceApprovalBar"),
            value: formatNumber(comparison.minimumExpectedSalesUnits, 1),
          },
          {
            label: t("ecommerce.affiliateWorkspace.intelligenceHumanQualifiedCreators"),
            value: formatInteger(historicalQualifiedCount),
          },
          {
            label: t("ecommerce.affiliateWorkspace.intelligenceModelQualifiedCreators"),
            value: formatInteger(modelQualifiedCount),
          },
          {
            label: t("ecommerce.affiliateWorkspace.intelligenceOverlookedQualifiedCreators"),
            value: formatInteger(comparison.modelQualifiedHistoricalRejectedCount),
          },
        ]}
        series={[
          {
            key: "historical",
            label: t("ecommerce.affiliateWorkspace.intelligenceHumanQualifiedExpected"),
            buckets: comparison.historicalExpectedUnitsHistogram,
            expectedTotal: historicalQualifiedCount,
          },
          {
            key: "model",
            label: t("ecommerce.affiliateWorkspace.intelligenceModelQualifiedExpected"),
            buckets: comparison.modelExpectedUnitsHistogram,
            expectedTotal: modelQualifiedCount,
          },
          {
            key: "below",
            label: t("ecommerce.affiliateWorkspace.intelligenceBelowBarExpected"),
            buckets: comparison.belowThresholdModelExpectedUnitsHistogram,
            expectedTotal: comparison.belowThresholdCount
              ?? Math.max(0, historicalApplicationCount - (modelQualifiedCount ?? 0)),
          },
        ]}
      />
    </section>
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
  series: AffiliateHistogramSeries[];
}) {
  const { t } = useTranslation();
  const completeSeries = series.flatMap((item) => {
    const buckets = item.buckets ?? [];
    const total = histogramTotal(buckets);
    if (buckets.length === 0 || (item.expectedTotal != null && total !== item.expectedTotal)) {
      return [];
    }
    return [{ ...item, buckets, total }];
  });
  const hasCompleteData = completeSeries.length === series.length;

  return (
    <section className="affiliate-intelligence-distribution-card">
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
      {hasCompleteData ? (
        <AffiliateHistogramChart series={completeSeries} />
      ) : (
        <div className="affiliate-intelligence-distribution-empty">
          {t("ecommerce.affiliateWorkspace.intelligenceDistributionIncomplete")}
        </div>
      )}
    </section>
  );
}

function AffiliateHistogramChart({
  series,
}: {
  series: Array<AffiliateHistogramSeries & {
    buckets: GQL.AffiliateMlHistogramBucket[];
    total: number;
  }>;
}) {
  const labels = mergedHistogramLabels(series.map((item) => item.buckets));
  const shares = series.map((item) => ({
    ...item,
    values: labels.map((label) => {
      const count = item.buckets.find((bucket) => bucket.key === label.key)?.count ?? 0;
      return item.total > 0 ? count / item.total : 0;
    }),
  }));
  const maxShare = Math.max(0.01, ...shares.flatMap((item) => item.values));
  const chartWidth = 720;
  const chartHeight = 210;
  const plotTop = 12;
  const plotHeight = 150;
  const groupWidth = chartWidth / Math.max(labels.length, 1);
  const barWidth = Math.min(22, Math.max(8, (groupWidth - 20) / Math.max(series.length, 1)));
  const barsWidth = barWidth * series.length;

  return (
    <div className="affiliate-intelligence-histogram-panel">
      <div className="affiliate-intelligence-bucket-legend">
        {shares.map((item) => (
          <span key={item.key} className={`affiliate-bucket-legend-${salesBucketClass(item.key)}`}>
            <i />
            <strong>{item.label}</strong>
            <small>{formatInteger(item.total)}</small>
          </span>
        ))}
      </div>
      <div className="affiliate-intelligence-histogram-scroll">
        <svg
          className="affiliate-intelligence-histogram-svg"
          role="img"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          aria-label={shares.map((item) => item.label).join(" versus ")}
        >
          {[0, 0.5, 1].map((step) => {
            const y = plotTop + plotHeight - step * plotHeight;
            return (
              <line
                key={step}
                className="affiliate-intelligence-histogram-grid"
                x1="0"
                x2={chartWidth}
                y1={y}
                y2={y}
              />
            );
          })}
          {labels.map((label, labelIndex) => {
            const groupX = labelIndex * groupWidth + (groupWidth - barsWidth) / 2;
            return (
              <g key={label.key}>
                {shares.map((item, seriesIndex) => {
                  const share = item.values[labelIndex] ?? 0;
                  const height = Math.max(2, (share / maxShare) * plotHeight);
                  const x = groupX + seriesIndex * barWidth;
                  const y = plotTop + plotHeight - height;
                  const count = item.buckets.find((bucket) => bucket.key === label.key)?.count ?? 0;
                  return (
                    <rect
                      key={item.key}
                      className={`affiliate-intelligence-histogram-bar affiliate-intelligence-histogram-bar-${salesBucketClass(item.key)}`}
                      x={x}
                      y={y}
                      width={Math.max(4, barWidth - 3)}
                      height={height}
                      rx="3"
                    >
                      <title>{`${item.label} · ${label.label}: ${formatPercent(share)} (${formatInteger(count)})`}</title>
                    </rect>
                  );
                })}
                <text
                  className="affiliate-intelligence-histogram-label"
                  x={labelIndex * groupWidth + groupWidth / 2}
                  y={chartHeight - 18}
                  textAnchor="middle"
                >
                  {label.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function AffiliateTinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="affiliate-intelligence-tiny-stat">
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function histogramTotal(buckets: GQL.AffiliateMlHistogramBucket[]): number {
  return buckets.reduce((total, bucket) => total + bucket.count, 0);
}

function mergedHistogramLabels(
  bucketLists: GQL.AffiliateMlHistogramBucket[][],
): GQL.AffiliateMlHistogramBucket[] {
  const labels = new Map<string, GQL.AffiliateMlHistogramBucket>();
  for (const buckets of bucketLists) {
    for (const bucket of buckets) {
      if (!labels.has(bucket.key)) {
        labels.set(bucket.key, { key: bucket.key, label: bucket.label, count: 0 });
      }
    }
  }
  return Array.from(labels.values());
}

function salesBucketClass(key: string): string {
  return key.replace(/\+/g, "_plus").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function AffiliateModelStageCard({
  availability,
  stage,
}: {
  availability: AffiliateModelAvailabilityView[];
  stage: "UNIFIED";
}) {
  const { t } = useTranslation();
  const stageTitle = t("ecommerce.affiliateWorkspace.bestAvailableModel");
  const presentation = affiliateModelStagePresentation(
    availability,
    "EXPECTED_SALES",
    stage,
  );
  const summary = presentation.evaluationSummary;
  const comparisonAvailable = Boolean(
    presentation.ready && summary?.comparisonAvailable,
  );
  return (
    <section className={`affiliate-model-stage-card affiliate-model-stage-card-${stage.toLowerCase()}`}>
      <header>
        <div>
          <span className="affiliate-model-stage-eyebrow">Expected Sales</span>
          <h2>{stageTitle}</h2>
        </div>
      </header>
      <p className="affiliate-model-stage-note">
        {t("ecommerce.affiliateWorkspace.bestAvailableExplanation")}
      </p>
      <div className="affiliate-model-family-list">
        <article className="affiliate-model-family-row">
          {comparisonAvailable && summary ? (
            <div className="affiliate-model-evaluation-strip">
              <div>
                <span>{t("ecommerce.affiliateWorkspace.evaluationSamples")}</span>
                <strong>{formatInteger(summary.historicalApplicationCount)}</strong>
              </div>
              <div>
                <span>{t("ecommerce.affiliateWorkspace.intelligenceHistoricalSelectedCount")}</span>
                <strong>{formatInteger(summary.historicalSelectedCount)}</strong>
              </div>
              <div>
                <span>{t("ecommerce.affiliateWorkspace.intelligenceModelSelectedCount")}</span>
                <strong>{formatInteger(summary.modelSelectedCount)}</strong>
              </div>
              <div>
                <span>{t("ecommerce.affiliateWorkspace.evaluationLift")}</span>
                <strong>{formatSignedPercent(
                  summary.expectedSalesLiftRatio == null
                    ? null
                    : (summary.expectedSalesLiftRatio - 1) * 100,
                )}</strong>
              </div>
            </div>
          ) : (
            <p className="affiliate-model-no-evaluation">
              {t("ecommerce.affiliateWorkspace.intelligenceComparisonUnavailable")}
            </p>
          )}
        </article>
      </div>
    </section>
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
    <div className="affiliate-intelligence-scope-rail" data-tutorial-id="affiliate-intelligence-scopes">
      {subjects.map((subject) => {
        const subjectRows = rows.filter((row) => row.subjectKey === subject.key);
        const modelStates = subjectRows.map((row) =>
          affiliateExpectedSalesModelAvailabilityState(row.availability));
        const ready = modelStates.some((state) => state.status === "ready");
        const fallback = !ready
          ? modelStates.find((state) => state.status === "fallback") ?? null
          : null;
        const available = ready || Boolean(fallback);
        const failed = !available && subjectRows.some((row) => row.failed);
        const status = ready
          ? t("ecommerce.affiliateWorkspace.modelReady")
          : fallback
            ? affiliateModelFallbackLabel(fallback.effectiveTenantScope, t)
          : failed
            ? t("ecommerce.affiliateWorkspace.intelligenceModelUnavailable")
            : t("ecommerce.affiliateWorkspace.intelligenceNoModel");
        return (
          <button
            key={subject.key}
            type="button"
            className={`affiliate-intelligence-scope${selectedKey === subject.key ? " affiliate-intelligence-scope-active" : ""}${available ? "" : " affiliate-intelligence-scope-empty"}`}
            onClick={() => onSelect(subject.key)}
          >
            <span className="affiliate-intelligence-scope-icon">
              {subject.kind === "user" ? <UserIcon /> : <ShopIcon />}
            </span>
            <span className="affiliate-intelligence-scope-copy">
              <strong>{subject.label}</strong>
              <small>{status}</small>
            </span>
            {available ? <CheckIcon /> : <InfoIcon />}
          </button>
        );
      })}
    </div>
  );
}

function AffiliateModelSourceSwitch({
  accountRow,
  activeModelScope,
  automaticSelection,
  regionRow,
  storeRow,
  onChange,
}: {
  accountRow: AffiliateInsightRow | null;
  activeModelScope: AffiliateInsightModelScope;
  automaticSelection: GQL.AffiliateExpectedSalesAutomaticSelection | null;
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
  return (
    <div className="affiliate-intelligence-model-source" role="tablist">
      <span className="affiliate-intelligence-model-source-label">
        {t("ecommerce.affiliateWorkspace.intelligenceModelSourceSelector")}
      </span>
      <div className="affiliate-intelligence-model-source-options">
        {rows.map((item) => {
          const modelState = affiliateExpectedSalesModelAvailabilityState(
            item.row?.availability,
          );
          const active = activeModelScope === item.key;
          const automaticallySelected = automaticSelection?.requestedTenantScope?.toLowerCase() === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`affiliate-intelligence-model-source-option${active ? " affiliate-intelligence-model-source-option-active" : ""}`}
              disabled={!item.row}
              onClick={() => onChange(item.key)}
            >
              <strong>{item.label}</strong>
              {automaticallySelected ? (
                <em>{t("ecommerce.affiliateWorkspace.intelligenceAutomaticallySelected")}</em>
              ) : null}
              <span>
                {modelState.status === "ready"
                  ? t("ecommerce.affiliateWorkspace.modelReady")
                  : modelState.status === "fallback"
                    ? affiliateModelFallbackLabel(
                      modelState.effectiveTenantScope,
                      t,
                    )
                  : item.row?.failed
                    ? t("ecommerce.affiliateWorkspace.intelligenceModelUnavailable")
                    : t("ecommerce.affiliateWorkspace.intelligenceNoModel")}
              </span>
              <small>{item.description}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function affiliateModelFallbackLabel(
  effectiveTenantScope: string | null,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const scope = effectiveTenantScope === "SHOP"
    ? t("ecommerce.affiliateWorkspace.intelligenceStoreModel")
    : effectiveTenantScope === "REGION"
      ? t("ecommerce.affiliateWorkspace.intelligenceRegionModel")
      : t("ecommerce.affiliateWorkspace.intelligenceAccountModel");
  return t("ecommerce.affiliateWorkspace.modelFallback", { scope });
}

function AffiliateRaceRow({
  icon,
  label,
  value,
  barValue,
  variant,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  barValue: number;
  variant: "model" | "human";
}) {
  return (
    <div className={`affiliate-intelligence-race-row affiliate-intelligence-race-${variant}`}>
      <span className="affiliate-intelligence-race-icon">{icon}</span>
      <span className="affiliate-intelligence-race-label">{label}</span>
      <progress
        className="affiliate-intelligence-race-track"
        max={100}
        value={Math.min(100, Math.max(0, barValue))}
      />
      <strong>{value}</strong>
    </div>
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

function AffiliateSparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" />
    </svg>
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

function formatSignedPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Object.is(value, -0) || Math.abs(value) < 0.05) return "0.0%";
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)}%`;
}

function formatLiftRatioRange(lower: number, upper: number): string {
  return `${formatSignedPercent((lower - 1) * 100)} – ${formatSignedPercent((upper - 1) * 100)}`;
}

export function affiliateSellerSafeMetrics(summary: GQL.AffiliateMlModelEfficiencySummary) {
  return {
    outperformanceProbability: summary.outperformanceProbability ?? null,
    dataFoundationLevel: summary.dataFoundationLevel ?? null,
    primaryRangeLevel: summary.expectedSalesLiftRatioPrimaryRangeLevel ?? null,
    primaryRangeLowerBound: summary.expectedSalesLiftRatioPrimaryRangeLowerBound ?? null,
    primaryRangeUpperBound: summary.expectedSalesLiftRatioPrimaryRangeUpperBound ?? null,
  };
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
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
  const collaboration = proposal.affiliateCollaboration;
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
    proposal.affiliateCollaborationId,
    proposal.sampleApplicationRecordId,
    collaboration?.id,
    ...(collaboration?.creatorIds ?? []),
    ...(collaboration?.creatorOpenIds ?? []),
    ...(collaboration?.productIds ?? []),
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
      ...record.productIds,
      record.platformCollaborationId,
      record.status,
      record.type,
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

function filterAffiliateCollaborations(
  records: GQL.AffiliateCollaboration[],
  search: string,
  shopLabel: (shopId: string) => string,
): GQL.AffiliateCollaboration[] {
  const query = search.trim().toLowerCase();
  if (!query) return records;
  return records.filter((record) => affiliateCollaborationSearchText(record, shopLabel).includes(query));
}

function affiliateCollaborationSearchText(
  record: GQL.AffiliateCollaboration,
  shopLabel: (shopId: string) => string,
): string {
  const values = [
    record.id,
    record.shopId,
    shopLabel(record.shopId),
    ...record.creatorIds,
    ...record.creatorOpenIds,
    ...record.productIds,
    record.platformCollaborationId,
    record.campaignId,
    record.status,
    record.type,
  ];
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function affiliateCollaborationMatchesHistoryStatusFilter(
  record: GQL.AffiliateCollaboration,
  filter: HistoryStatusFilter,
): boolean {
  if (filter === "ALL") return true;
  return record.status === filter;
}

function isAffiliateStaffHandlingWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
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

function AffiliateLoadingState() {
  const { t } = useTranslation();
  return (
    <div className="affiliate-loading-state" role="status" aria-live="polite">
      <div className="affiliate-loading-spinner" aria-hidden="true" />
      <span>{t("ecommerce.affiliateWorkspace.loadingEntities")}</span>
    </div>
  );
}

function AffiliateQueryErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="affiliate-proposal-empty affiliate-query-error" role="alert">
      <strong>{t("common.error", { defaultValue: "Unable to load data" })}</strong>
      <span>{message}</span>
      <button className="btn btn-secondary" type="button" onClick={onRetry}>
        {t("common.retry", { defaultValue: "Retry" })}
      </button>
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
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedTagId, setSelectedTagId] = useState(ALL_CREATOR_TAGS_FILTER);
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [debouncedCreatorSearch, setDebouncedCreatorSearch] = useState("");
  const [creatorPage, setCreatorPage] = useState(1);
  const [creatorPageInput, setCreatorPageInput] = useState("1");
  const [selectedRelationship, setSelectedRelationship] = useState<CreatorRelationshipDetailItem | null>(null);
  const [updatingTagKey, setUpdatingTagKey] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  const shopOptions = [
    { value: "", label: t("ecommerce.affiliateWorkspace.allShops") },
    ...affiliateShops.map((shop) => ({
      value: shop.id,
      label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
    })),
  ];
  function shopLabel(shopId: string): string {
    const shop = entityStore.shops.find((candidate) => candidate.id === shopId);
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

  const { data: projectionHealthData, refetch: refetchProjectionHealth } = useQuery<
    { affiliateOperationalProjectionHealth: GQL.AffiliateOperationalProjectionHealthPayload },
    { shopId: string }
  >(AFFILIATE_OPERATIONAL_PROJECTION_HEALTH_QUERY, {
    variables: { shopId: selectedShopId },
    fetchPolicy: "cache-and-network",
    skip: !user || !selectedShopId,
  });
  const projectionHealth = projectionHealthData?.affiliateOperationalProjectionHealth;
  const projectionHistoryIncomplete = projectionHealth?.datasets.some(
    (dataset) => !dataset.complete,
  ) ?? false;
  const projectionDatasetLabel = (dataset: string) => t(
    PROJECTION_DATASET_I18N_KEY[dataset] ?? dataset,
    { defaultValue: dataset },
  );
  const projectionStatusLabel = (status: string) => t(
    PROJECTION_STATUS_I18N_KEY[status] ?? status,
    { defaultValue: status },
  );

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedCreatorSearch(creatorSearch.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [creatorSearch]);

  const { data, loading, refetch } = useQuery<
    { affiliateCreators: GQL.AffiliateCreatorManagementPage },
    { input: GQL.ReadAffiliateCreatorsInput }
  >(AFFILIATE_CREATORS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || null,
        tagIds: selectedTagId === ALL_CREATOR_TAGS_FILTER ? undefined : [selectedTagId],
        needsAttentionOnly,
        search: debouncedCreatorSearch || undefined,
        offset: (creatorPage - 1) * AFFILIATE_CREATORS_PAGE_SIZE,
        limit: AFFILIATE_CREATORS_PAGE_SIZE,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !user,
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
    });
    const unsubscribeWorkItem = panelEventBus.subscribe("affiliate-work-item-changed", () => {
      void refetch();
    });
    return () => {
      unsubscribeProposal();
      unsubscribeWorkItem();
    };
  }, [refetch]);

  const creatorPageResult = data?.affiliateCreators;
  const creatorItems = creatorPageResult?.items ?? [];
  const [stableCreatorTotalCount, setStableCreatorTotalCount] = useState(0);
  useEffect(() => {
    if (creatorPageResult) setStableCreatorTotalCount(creatorPageResult.totalCount);
  }, [creatorPageResult]);
  const totalCreatorCount = creatorPageResult?.totalCount ?? stableCreatorTotalCount;
  const allTags = policyContextData?.creatorTags ?? [];
  const creatorPageCount = Math.max(1, Math.ceil(totalCreatorCount / AFFILIATE_CREATORS_PAGE_SIZE));
  const creatorPageStart = totalCreatorCount === 0
    ? 0
    : (creatorPage - 1) * AFFILIATE_CREATORS_PAGE_SIZE + 1;
  const creatorPageEnd = Math.min(creatorPage * AFFILIATE_CREATORS_PAGE_SIZE, totalCreatorCount);

  useEffect(() => {
    setCreatorPage(1);
  }, [debouncedCreatorSearch, needsAttentionOnly, selectedShopId, selectedTagId]);

  useEffect(() => {
    if (!creatorPageResult) return;
    setCreatorPage((page) => Math.min(page, creatorPageCount));
  }, [creatorPageCount, creatorPageResult]);

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
    if (!selectedShopId) return;
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
              if (selectedShopId) void refetchProjectionHealth();
            }}
            disabled={loading}
          >
            {loading
              ? t("common.loading")
              : t("ecommerce.shopDrawer.affiliate.refreshProposals")}
          </button>
        </div>
      </div>

      {projectionHealth && !projectionHealth.ready ? (
        <div className="affiliate-projection-health-banner" role="status">
          <strong>{t("ecommerce.affiliateWorkspace.projectionSyncing")}</strong>
          <span>
            {projectionHealth.datasets.map((dataset) => (
              `${projectionDatasetLabel(dataset.dataset)}: ${projectionStatusLabel(dataset.status)}`
            )).join(" · ")}
          </span>
        </div>
      ) : projectionHealth?.ready ? (
        <div className={projectionHistoryIncomplete
          ? "affiliate-projection-health-banner"
          : "affiliate-projection-health-meta"}
        >
          <strong>
            {projectionHistoryIncomplete
                ? t("ecommerce.affiliateWorkspace.projectionHistorySyncing")
              : t("ecommerce.affiliateWorkspace.projectionCurrentReady")}
          </strong>
          <span>
            {t("ecommerce.affiliateWorkspace.projectionLastSynced")}: {formatDate(
              projectionHealth.datasets
                .map((dataset) => dataset.lastHeadSyncAt ?? dataset.lastSuccessfulSyncAt)
                .filter((value): value is string => Boolean(value))
                .sort()
                .at(0) ?? null,
            )}
            {projectionHistoryIncomplete
              ? ` · ${projectionHealth.datasets.map((dataset) => (
                `${projectionDatasetLabel(dataset.dataset)}: ${projectionStatusLabel(dataset.historyStatus)}`
              )).join(" · ")}`
              : ""}
          </span>
        </div>
      ) : null}

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

        {loading && creatorItems.length === 0 ? (
          <AffiliateLoadingState />
        ) : creatorItems.length === 0 ? (
          <div className="affiliate-proposal-empty">
            {t("ecommerce.affiliateWorkspace.emptyCreators")}
          </div>
        ) : (
          <div className="affiliate-creator-roster">
            {creatorItems.map((item) => (
              <CreatorRelationshipCard
                key={item.creatorId}
                item={item}
                allTags={allTags}
                shopLabel={shopLabel}
                updatingTagKey={updatingTagKey}
                onOpenRelationship={(relationship) => setSelectedRelationship(relationship)}
                onUpdateTag={(creatorId, tagId, mode) => void updateCreatorTag(creatorId, tagId, mode)}
              />
            ))}
            {totalCreatorCount > AFFILIATE_CREATORS_PAGE_SIZE ? (
              <div className="affiliate-collaboration-pagination affiliate-creator-pagination" aria-label={t("ecommerce.affiliateWorkspace.creatorsTitle")}>
                <span className="affiliate-collaboration-pagination-summary">
                  {t("ecommerce.affiliateWorkspace.pageSummary", {
                    start: creatorPageStart,
                    end: creatorPageEnd,
                    total: totalCreatorCount,
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
                      aria-label={t("ecommerce.affiliateWorkspace.creatorsTitle")}
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
          selectedShopId={selectedShopId}
          onClose={() => setSelectedRelationship(null)}
        />
      ) : null}
    </div>
  );
});

function CreatorRelationshipCard({
  item,
  allTags,
  shopLabel,
  updatingTagKey,
  onOpenRelationship,
  onUpdateTag,
}: {
  item: AffiliateCreatorManagementItem;
  allTags: GQL.CreatorTag[];
  shopLabel: (shopId: string) => string;
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
  const platformId = profile
    ? creatorPlatformIdentity(profile)
    : item.latestAffiliateCollaboration?.creatorOpenIds[0] ?? null;
  const missingTags = allTags.filter((tag) => !item.tagIds.includes(tag.id));
  const latestRecord = item.latestAffiliateCollaboration;
  const latestStatus = latestRecord?.status
    ? t(`ecommerce.affiliateWorkspace.collaborationFilters.${latestRecord.status}`, {
      defaultValue: latestRecord.status,
    })
    : t("ecommerce.affiliateWorkspace.creatorStable");
  const lifecycleStage = latestRecord?.type ?? null;
  const lifecycleLabel = lifecycleStage
    ? t(`ecommerce.affiliateWorkspace.collaborationTypes.${lifecycleStage}`, { defaultValue: lifecycleStage })
    : t("ecommerce.affiliateWorkspace.creatorNotInCollaboration");
  const pendingProposal = item.latestPendingProposal;
  const nextAction = pendingProposal
    ? renderProposalRecommendationTitle(pendingProposal, t)
    : latestStatus;
  const nextActionContext = pendingProposal
    ? t("ecommerce.affiliateWorkspace.creatorPendingProposal")
    : latestRecord?.productIds.length
      ? t("ecommerce.affiliateWorkspace.productContextConfirmed")
      : null;
  const sampleStatus = item.latestSampleApplicationRecord?.sampleWorkStatus ?? null;
  const sampleStatusLabel = sampleStatus
    ? t(`ecommerce.affiliateWorkspace.sampleWorkStatusLabels.${sampleStatus}`, {
      defaultValue: formatAffiliateEnumLabel(sampleStatus),
    })
    : "—";
  const sampleStatusDescription = sampleStatus
    ? t(`ecommerce.affiliateWorkspace.sampleWorkStatusDescriptions.${sampleStatus}`, {
      defaultValue: t("ecommerce.affiliateWorkspace.sampleWorkStatusDescriptions.DEFAULT"),
    })
    : null;
  const relationshipShopIds = Array.from(new Set([
    ...(item.creatorRelation?.shopStates ?? []).map((state) => state.shopId),
    item.shopState?.shopId,
    latestRecord?.shopId,
  ].filter((shopId): shopId is string => Boolean(shopId))));
  const followerCount = formatCount(item.creatorPerformance?.followerCount);
  const relationshipDetail = relationshipDetailFromManagementItem(item);

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
            <span>
              {followerCount
                ? t("ecommerce.affiliateWorkspace.creatorFollowerCount", {
                  value: followerCount,
                  defaultValue: "{{value}} followers",
                })
                : t("ecommerce.affiliateWorkspace.creatorFollowerDataPending")}
            </span>
            {item.market ? <span className="affiliate-creator-market-pill">{item.market}</span> : null}
            <span>{t("ecommerce.affiliateWorkspace.creatorActiveSamples", { count: item.activeSampleApplicationCount, defaultValue: "{{count}} active samples" })}</span>
            <span>{t("ecommerce.affiliateWorkspace.creatorActivePlatformCollaborations", { count: item.activeCollaborationCount, defaultValue: "{{count}} active platform collaborations" })}</span>
          </div>
          {relationshipShopIds.length ? (
            <div className="affiliate-creator-shop-list">
              <span className="affiliate-creator-shop-label">
                {t("ecommerce.affiliateWorkspace.creatorCooperationShops")}
              </span>
              {relationshipShopIds.map((shopId) => (
                <span className="affiliate-creator-shop-pill" key={shopId}>
                  {shopLabel(shopId)}
                </span>
              ))}
            </div>
          ) : null}
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
        <div className="affiliate-creator-work-summary-item affiliate-creator-work-summary-item-primary">
          <span>{t("ecommerce.affiliateWorkspace.labels.nextStep")}</span>
          <strong>{nextAction}</strong>
          {nextActionContext ? <small>{nextActionContext}</small> : null}
        </div>
        <div className="affiliate-creator-work-summary-item">
          <span>{t("ecommerce.affiliateWorkspace.creatorLifecycle")}</span>
          <strong>{lifecycleLabel}</strong>
          <small>{t("ecommerce.affiliateWorkspace.creatorActivePlatformCollaborations", { count: item.activeCollaborationCount, defaultValue: "{{count}} active platform collaborations" })}</small>
        </div>
        <div className="affiliate-creator-work-summary-item">
          <span>{t("ecommerce.affiliateWorkspace.creatorSampleStatus")}</span>
          <strong>{sampleStatusLabel}</strong>
          {sampleStatusDescription ? <small>{sampleStatusDescription}</small> : null}
          {item.latestSampleApplicationRecord?.observedContentCount ? (
            <small>{formatCount(item.latestSampleApplicationRecord.observedContentCount)}</small>
          ) : null}
        </div>
        <div className="affiliate-creator-work-summary-item">
          <span>{t("ecommerce.affiliateWorkspace.creatorLastInteraction")}</span>
          <strong>{item.lastInteractionAt ? formatProposalTime(item.lastInteractionAt) : "—"}</strong>
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

function AffiliateCollaborationCard({
  collaboration,
  shopLabel,
  productSummary,
  onOpen,
}: {
  collaboration: GQL.AffiliateCollaboration;
  shopLabel: string;
  productSummary?: GQL.EcomProductSummary | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const creatorCount = collaboration.creatorIds.length || collaboration.creatorOpenIds.length;
  const productCount = collaboration.productIds.length;
  const statusDisplay = {
    primary: formatAffiliateEnumLabel(collaboration.status),
    secondary: formatAffiliateEnumLabel(collaboration.type),
  };
  const tone: CollaborationWorkViewModel["badgeTone"] =
    collaboration.status === GQL.AffiliateCollaborationStatus.Active
      ? "done"
      : collaboration.status === GQL.AffiliateCollaborationStatus.Expiring ||
          collaboration.status === GQL.AffiliateCollaborationStatus.Terminating
        ? "attention"
        : "waiting";

  return (
    <article
      className="affiliate-collaboration-card affiliate-collaboration-record-card affiliate-collaboration-card-interactive"
      onClick={onOpen}
    >
      <div className="affiliate-work-item-head">
        <div className="affiliate-creator-text">
          <div className="affiliate-creator-name-static">
            {formatAffiliateEnumLabel(collaboration.type)} · {shopLabel}
          </div>
          <div className="affiliate-work-item-meta">
            <span>{formatProposalTime(collaboration.platformUpdatedAt ?? collaboration.lastObservedAt)}</span>
            <SystemIdCopy value={collaboration.id} />
            <PlatformIdCopy value={collaboration.platformCollaborationId} />
          </div>
        </div>
        <RelationshipStatusBadge display={statusDisplay} tone={tone} />
      </div>

      <div className="affiliate-collaboration-card-body affiliate-collaboration-record-card-body">
        <section className="affiliate-card-section affiliate-card-section-primary">
          <div className="affiliate-card-section-label">
            {t("ecommerce.affiliateWorkspace.historyTitle")}
          </div>
          <div className="affiliate-card-section-title">
            {collaboration.productIds[0]
              ? t("ecommerce.affiliateWorkspace.productIdShort", {
                  productId: formatCompactIdentifier(collaboration.productIds[0], 28),
                })
              : collaboration.platformCollaborationId}
          </div>
          <div className="affiliate-card-section-copy">
            {formatAffiliateEnumLabel(collaboration.status)} · {formatAffiliateEnumLabel(collaboration.type)}
          </div>
        </section>

        <ProductSummaryCard
          product={productSummary}
          productId={collaboration.productIds[0]}
          shopId={collaboration.shopId}
          label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
          allowInlineLoad={false}
        />

        <div className="affiliate-relationship-work-card-priority">
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.statusFilter")}
            value={formatAffiliateEnumLabel(collaboration.status)}
          />
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.creatorActiveCollaborations", { count: creatorCount })}
            value={formatInteger(creatorCount)}
          />
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
            value={formatInteger(productCount)}
          />
          <RelationshipMetric
            label="Commission"
            value={collaboration.commissionRate == null ? "—" : formatPercent(collaboration.commissionRate)}
          />
        </div>
      </div>
      <div className="affiliate-collaboration-card-footer">
        <span>{t("ecommerce.affiliateWorkspace.openPlatformCollaborationDetail", { defaultValue: "Open platform collaboration details" })}</span>
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
    </article>
  );
}

type AffiliateCollaborationDetailQueryData = {
  affiliateCollaborationDetail: {
    collaboration: GQL.AffiliateCollaboration;
    creators: GQL.AffiliateCreatorIdentity[];
    sampleApplications: GQL.SampleApplicationRecord[];
    productSummaries: GQL.AffiliateRelationshipProductSummary[];
  };
};

function AffiliateCollaborationDetailModal({
  collaborationId,
  shopLabel,
  onClose,
}: {
  collaborationId: string;
  shopLabel: (shopId: string) => string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useQuery<
    AffiliateCollaborationDetailQueryData,
    { input: { id: string } }
  >(AFFILIATE_COLLABORATION_DETAIL_QUERY, {
    variables: { input: { id: collaborationId } },
    fetchPolicy: "cache-and-network",
  });
  const detail = data?.affiliateCollaborationDetail;
  const collaboration = detail?.collaboration;

  return (
    <div className="modal-backdrop affiliate-creator-detail-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-content affiliate-collaboration-modal affiliate-platform-collaboration-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("ecommerce.affiliateWorkspace.platformCollaborationDetail", { defaultValue: "Platform collaboration details" })}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="affiliate-collaboration-modal-title-block">
            <h2>{t("ecommerce.affiliateWorkspace.platformCollaborationDetail", { defaultValue: "Platform collaboration details" })}</h2>
            {collaboration ? (
              <p>
                <span>{formatAffiliateEnumLabel(collaboration.type)}</span>
                <span>·</span>
                <span>{shopLabel(collaboration.shopId)}</span>
                <PlatformIdCopy value={collaboration.platformCollaborationId} />
              </p>
            ) : null}
          </div>
          <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t("common.close")}>×</button>
        </div>
        <div className="affiliate-platform-collaboration-detail-body">
          {error ? (
            <AffiliateQueryErrorState error={error} onRetry={() => void refetch()} />
          ) : loading && !detail ? (
            <AffiliateLoadingState />
          ) : collaboration && detail ? (
            <>
              <section className="affiliate-platform-collaboration-detail-summary">
                <RelationshipMetric label={t("account.status")} value={formatAffiliateEnumLabel(collaboration.status)} />
                <RelationshipMetric label={t("ecommerce.affiliateWorkspace.collaborationType", { defaultValue: "Collaboration type" })} value={formatAffiliateEnumLabel(collaboration.type)} />
                <RelationshipMetric label={t("ecommerce.affiliateWorkspace.creatorCount", { defaultValue: "Creators" })} value={formatInteger(detail.creators.length)} />
                <RelationshipMetric label={t("ecommerce.affiliateWorkspace.sampleApplication.count", { defaultValue: "Sample applications" })} value={formatInteger(detail.sampleApplications.length)} />
                <RelationshipMetric label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")} value={formatInteger(collaboration.productIds.length)} />
                <RelationshipMetric label={t("ecommerce.affiliateWorkspace.lastObservedAt", { defaultValue: "Last observed" })} value={formatProposalTime(collaboration.lastObservedAt)} />
              </section>

              <section>
                <h3 className="affiliate-collaboration-modal-section-title">
                  {t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
                </h3>
                <div className="affiliate-platform-collaboration-detail-grid">
                  {collaboration.productIds.map((productId) => (
                    <ProductSummaryCard
                      key={`${collaboration.shopId}:${productId}`}
                      product={detail.productSummaries.find((entry) => entry.product.productId === productId)?.product ?? null}
                      productId={productId}
                      shopId={collaboration.shopId}
                      label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
                      allowInlineLoad={false}
                    />
                  ))}
                </div>
              </section>

              <section>
                <h3 className="affiliate-collaboration-modal-section-title">
                  {t("ecommerce.affiliateWorkspace.creatorsTitle", { defaultValue: "Creators" })}
                </h3>
                {detail.creators.length > 0 ? (
                  <div className="affiliate-platform-collaboration-identity-list">
                    {detail.creators.map((creator) => (
                      <div className="affiliate-platform-collaboration-identity" key={creator.id}>
                        <CreatorAvatarImage
                          avatarUrl={creator.avatarUrl}
                          className="affiliate-avatar"
                          fallbackClassName="affiliate-creator-avatar-empty"
                          name={creatorPrimaryName(creator, t("ecommerce.affiliateWorkspace.unknownCreator"))}
                        />
                        <div>
                          <strong>{creatorPrimaryName(creator, t("ecommerce.affiliateWorkspace.unknownCreator"))}</strong>
                          <span>{creatorTikTokHandle(creator) ?? creator.creatorOpenId}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="affiliate-proposal-empty">
                    {collaboration.type === GQL.AffiliateCollaborationType.Open
                      ? t("ecommerce.affiliateWorkspace.openCollaborationNoExpandedCreators", { defaultValue: "Open collaborations are not expanded into creator-level records. Creators appear here only when referenced by a sample application." })
                      : t("ecommerce.affiliateWorkspace.noCreators", { defaultValue: "No creators" })}
                  </div>
                )}
              </section>

              <section>
                <h3 className="affiliate-collaboration-modal-section-title">
                  {t("ecommerce.affiliateWorkspace.relationshipPanelSamples", { defaultValue: "Samples and fulfillment" })}
                </h3>
                {detail.sampleApplications.length > 0 ? (
                  <div className="affiliate-platform-collaboration-detail-grid">
                    {detail.sampleApplications.map((sample) => (
                      <div className="affiliate-relationship-work-side-card" key={sample.id}>
                        <strong>{sample.platformApplicationId}</strong>
                        <span>{formatAffiliateEnumLabel(sample.sampleWorkStatus)}</span>
                        <span>{formatProposalTime(sample.updatedAt)}</span>
                        <SystemIdCopy value={sample.id} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="affiliate-proposal-empty">
                    {t("ecommerce.affiliateWorkspace.emptySampleApplications", { defaultValue: "No linked sample applications" })}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RelationshipPlatformCollaborationCard({
  item,
  shopLabel,
  productSummaries,
}: {
  item: GQL.AffiliateRelationshipPlatformCollaborationItem;
  shopLabel: string;
  productSummaries: GQL.EcomProductSummary[];
}) {
  const { t } = useTranslation();
  const collaboration = item.collaboration;
  const sourceLabels = item.sources.map((source) =>
    source === GQL.AffiliateRelationshipPlatformCollaborationSource.TargetMembership
      ? t("ecommerce.affiliateWorkspace.platformCollaborationTargetMembership", { defaultValue: "Target membership" })
      : t("ecommerce.affiliateWorkspace.platformCollaborationSampleReference", { defaultValue: "Referenced by a sample application" }),
  );

  return (
    <article className="affiliate-collaboration-card affiliate-collaboration-record-card">
      <div className="affiliate-work-item-head">
        <div className="affiliate-creator-text">
          <div className="affiliate-creator-name-static">
            {formatAffiliateEnumLabel(collaboration.type)} · {shopLabel}
          </div>
          <div className="affiliate-work-item-meta">
            <span>{sourceLabels.join(" · ")}</span>
            <SystemIdCopy value={collaboration.id} />
            <PlatformIdCopy value={collaboration.platformCollaborationId} />
          </div>
        </div>
        <RelationshipStatusBadge
          display={{ primary: formatAffiliateEnumLabel(collaboration.status), secondary: formatAffiliateEnumLabel(collaboration.type) }}
          tone={collaboration.status === GQL.AffiliateCollaborationStatus.Active
            ? "done"
            : collaboration.status === GQL.AffiliateCollaborationStatus.Expiring || collaboration.status === GQL.AffiliateCollaborationStatus.Terminating
              ? "attention"
              : "waiting"}
        />
      </div>
      <div className="affiliate-collaboration-card-body affiliate-collaboration-record-card-body">
        <div className="affiliate-relationship-work-card-priority">
          <RelationshipMetric label={t("account.status")} value={formatAffiliateEnumLabel(collaboration.status)} />
          <RelationshipMetric label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")} value={formatInteger(collaboration.productIds.length)} />
        </div>
        {collaboration.productIds.map((productId) => (
          <ProductSummaryCard
            key={`${collaboration.shopId}:${productId}`}
            product={productSummaries.find((product) => product.productId === productId) ?? null}
            productId={productId}
            shopId={collaboration.shopId}
            label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
            allowInlineLoad={false}
          />
        ))}
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

type RelationshipTimelineEntryModel =
  {
    id: string;
    type: "event" | "time-passed";
    time: string;
    kind: string;
    title: string;
    detail: string;
    cardPayload?: AffiliateCreatorMessageRawCardPayload | null;
    sampleApplication?: GQL.SampleApplicationRecord | null;
  };

function buildRelationshipTimelineEntries(
  items: GQL.AffiliateRelationshipTimelineItem[],
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
      const cardPayload = relationshipTimelineCardPayload(item);
      const sampleApplication = item.relatedIds.sampleApplicationRecordId
        ? sampleById.get(item.relatedIds.sampleApplicationRecordId) ?? null
        : cardPayload?.kind === "sample" && cardPayload.id
          ? sampleByPlatformId.get(cardPayload.id) ?? null
          : null;
      return {
        id: item.id,
        type: item.kind === GQL.AffiliateRelationshipTimelineItemKind.TimePassed
          ? "time-passed" as const
          : "event" as const,
        time: item.occurredAt,
        kind: relationshipTimelineKindLabel(item, t),
        title: relationshipTimelineTitle(item, t),
        detail: relationshipTimelineDetail(item, t),
        cardPayload,
        sampleApplication,
      };
    });
}

function relationshipTimelineKindLabel(
  item: GQL.AffiliateRelationshipTimelineItem,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (item.kind === GQL.AffiliateRelationshipTimelineItemKind.TimePassed) {
    return t("ecommerce.affiliateWorkspace.timePassed", { defaultValue: "Time passed" });
  }
  const event = item.businessEvent ?? item.actionEvent;
  const actorKey = relationshipHistoryActorRoleKey(item.actorRole ?? event?.actorRole);
  return t(`ecommerce.affiliateWorkspace.historyActors.${actorKey}`, {
    defaultValue: formatAffiliateEnumLabel(actorKey),
  });
}

function relationshipTimelineTitle(
  item: GQL.AffiliateRelationshipTimelineItem,
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
  if (item.timePassed) {
    return t("ecommerce.affiliateWorkspace.timePassedDuration", {
      defaultValue: "{{duration}} passed",
      duration: relationshipTimelineDuration(item.timePassed.durationSeconds, t),
    });
  }
  const event = item.businessEvent ?? item.actionEvent;
  if (event) {
    return t(`ecommerce.affiliateWorkspace.lifecycleEvents.${event.eventType}`, {
      defaultValue: formatAffiliateEnumLabel(event.eventType),
    });
  }
  return item.summary;
}

function relationshipTimelineDetail(
  item: GQL.AffiliateRelationshipTimelineItem,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const lines: string[] = [];
  if (item.message?.subject) lines.push(item.message.subject);
  if (item.message?.textPreview && !parsePlatformCardPayload(item.message.textPreview)) {
    lines.push(item.message.textPreview);
  }
  const event = item.businessEvent ?? item.actionEvent;
  if (event?.displaySummary) lines.push(event.displaySummary);
  if (item.timePassed) {
    lines.push(t("ecommerce.affiliateWorkspace.timePassedHint", {
      defaultValue: "Elapsed time between timeline items; filtered-out events may exist.",
    }));
  }
  if (!lines.length && item.summary && !event) lines.push(item.summary);
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

function relationshipTimelineDuration(
  durationSeconds: number,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const totalHours = Math.max(Math.floor(durationSeconds / 3600), 1);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0 && hours > 0) {
    return t("ecommerce.affiliateWorkspace.timePassedDaysHours", {
      defaultValue: "{{days}}d {{hours}}h",
      days,
      hours,
    });
  }
  if (days > 0) {
    return t("ecommerce.affiliateWorkspace.timePassedDays", {
      defaultValue: "{{days}}d",
      days,
    });
  }
  return t("ecommerce.affiliateWorkspace.timePassedHours", {
    defaultValue: "{{hours}}h",
    hours: totalHours,
  });
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
  message: GQL.AffiliateRelationshipTimelineMessage,
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

function relationshipTimelineCardPayload(
  item: GQL.AffiliateRelationshipTimelineItem,
): AffiliateCreatorMessageRawCardPayload | null {
  if (item.message?.textPreview) return parsePlatformCardPayload(item.message.textPreview);
  return null;
}

function RelationshipTimelineEntry({
  entry,
}: {
  entry: RelationshipTimelineEntryModel;
}) {
  if (entry.type === "time-passed") {
    return (
      <div className="affiliate-timeline-time-passed" key={entry.id}>
        <span className="affiliate-timeline-time-passed-line" aria-hidden="true" />
        <span className="affiliate-timeline-time-passed-label" title={entry.detail}>
          {entry.title}
        </span>
        <span className="affiliate-timeline-time-passed-line" aria-hidden="true" />
      </div>
    );
  }
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
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>(GQL.AffiliateCollaborationType.Open);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageInput, setHistoryPageInput] = useState("1");
  const [selectedCollaborationId, setSelectedCollaborationId] = useState<string | null>(null);

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

  const collaborationStatus = useMemo(() => {
    if (historyStatusFilter === "ALL") return undefined;
    return historyStatusFilter;
  }, [historyStatusFilter]);
  const { data: collaborationsData, loading, error, refetch } = useQuery<
    { affiliateCollaborations: GQL.AffiliateCollaboration[] },
    { input: GQL.ReadAffiliateCollaborationsInput }
  >(AFFILIATE_COLLABORATIONS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || null,
        type: historyTypeFilter === "ALL" ? null : historyTypeFilter,
        status: collaborationStatus,
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

  const collaborations = collaborationsData?.affiliateCollaborations ?? [];
  const searchedItems = filterAffiliateCollaborations(collaborations, historySearch, shopLabel)
    .filter((record) => affiliateCollaborationMatchesHistoryStatusFilter(record, historyStatusFilter));
  const historyTypeOptions = useMemo(() => [
    { value: GQL.AffiliateCollaborationType.Open, label: formatAffiliateEnumLabel(GQL.AffiliateCollaborationType.Open) },
    { value: GQL.AffiliateCollaborationType.Target, label: formatAffiliateEnumLabel(GQL.AffiliateCollaborationType.Target) },
    { value: "ALL", label: t("ecommerce.affiliateWorkspace.allCollaborationTypes", { defaultValue: "All collaboration types" }) },
  ], [t]);
  const visibleItems = searchedItems;
  const historyPageCount = Math.max(1, Math.ceil(visibleItems.length / CREATOR_RELATIONSHIP_WORK_PAGE_SIZE));
  const pagedVisibleItems = useMemo(() => {
    const start = (historyPage - 1) * CREATOR_RELATIONSHIP_WORK_PAGE_SIZE;
    return visibleItems.slice(start, start + CREATOR_RELATIONSHIP_WORK_PAGE_SIZE);
  }, [historyPage, visibleItems]);
  const pageProductRefs = useMemo(() => mergeById(
    pagedVisibleItems.flatMap((collaboration) => collaboration.productIds.map((productId) => ({
      shopId: collaboration.shopId,
      productId,
    }))),
    (ref) => `${ref.shopId}:${ref.productId}`,
  ), [pagedVisibleItems]);
  const { data: pageProductData } = useQuery<
    { affiliateProductSummaries: GQL.AffiliateRelationshipProductSummary[] },
    { input: GQL.AffiliateProductSummaryBatchInput }
  >(AFFILIATE_PRODUCT_SUMMARIES_QUERY, {
    variables: { input: { refs: pageProductRefs } },
    skip: !user || pageProductRefs.length === 0,
    fetchPolicy: "cache-first",
  });
  const pageProductSummaries = pageProductData?.affiliateProductSummaries ?? [];
  const pageStart = visibleItems.length === 0
    ? 0
    : (historyPage - 1) * CREATOR_RELATIONSHIP_WORK_PAGE_SIZE + 1;
  const pageEnd = Math.min(historyPage * CREATOR_RELATIONSHIP_WORK_PAGE_SIZE, visibleItems.length);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyStatusFilter, historyTypeFilter, historySearch, selectedShopId]);

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
              {t("ecommerce.affiliateWorkspace.historyTitle")}
            </div>
            <button
              className="affiliate-panel-info-button"
              type="button"
              aria-label={t("ecommerce.affiliateWorkspace.historySubtitle")}
              data-tooltip={t("ecommerce.affiliateWorkspace.historySubtitle")}
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
                }}
                options={historyStatusFilterOptions}
                className="affiliate-status-select"
                ariaLabel={t("ecommerce.affiliateWorkspace.statusFilter")}
              />
            </label>
            <label className="affiliate-filter-field">
              <span>{t("ecommerce.affiliateWorkspace.collaborationType", { defaultValue: "Collaboration type" })}</span>
              <Select
                value={historyTypeFilter}
                onChange={(value) => setHistoryTypeFilter(value as HistoryTypeFilter)}
                options={historyTypeOptions}
                className="affiliate-status-select"
                ariaLabel={t("ecommerce.affiliateWorkspace.collaborationType", { defaultValue: "Collaboration type" })}
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

        {error ? (
          <AffiliateQueryErrorState error={error} onRetry={() => void refetch()} />
        ) : loading && visibleItems.length === 0 ? (
          <AffiliateLoadingState />
        ) : visibleItems.length === 0 ? (
          <div className="affiliate-proposal-empty">
            {t("ecommerce.affiliateWorkspace.emptyHistory")}
          </div>
        ) : (
          <>
            <div className="affiliate-collaboration-list">
              {pagedVisibleItems.map((record) => (
                <AffiliateCollaborationCard
                  key={record.id}
                  collaboration={record}
                  shopLabel={shopLabel(record.shopId)}
                  productSummary={pageProductSummaries.find((entry) =>
                    entry.shopId === record.shopId && entry.product.productId === record.productIds[0],
                  )?.product ?? null}
                  onOpen={() => setSelectedCollaborationId(record.id)}
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

      {selectedCollaborationId ? (
        <AffiliateCollaborationDetailModal
          collaborationId={selectedCollaborationId}
          shopLabel={shopLabel}
          onClose={() => setSelectedCollaborationId(null)}
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

function mergeAffiliateRelationshipTimelinePayload(
  previous: { affiliateRelationshipTimeline: GQL.AffiliateRelationshipTimelinePayload },
  next: { affiliateRelationshipTimeline: GQL.AffiliateRelationshipTimelinePayload },
): { affiliateRelationshipTimeline: GQL.AffiliateRelationshipTimelinePayload } {
  return {
    affiliateRelationshipTimeline: {
      ...next.affiliateRelationshipTimeline,
      items: mergeById([
        ...previous.affiliateRelationshipTimeline.items,
        ...next.affiliateRelationshipTimeline.items,
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
            {proposal.humanReviewRequest ? (
              <div className="affiliate-card-section affiliate-card-section-primary">
                <div className="affiliate-card-section-label">
                  {t("ecommerce.affiliateWorkspace.labels.needsYourAction")}
                </div>
                <div className="affiliate-card-section-copy">
                  {proposal.humanReviewRequest.question}
                </div>
              </div>
            ) : null}
            <div className="affiliate-proposal-row-context">
              <ProposalPredictionComparison
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
          {proposal.humanReviewRequest ? (
            <div className="affiliate-card-section-copy">
              {proposal.humanReviewRequest.question}
            </div>
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
  snapshot,
}: {
  snapshot: AffiliatePredictionSnapshotView | null;
}) {
  const { t } = useTranslation();
  const output = readPredictionSnapshotOutput(snapshot);
  if (!snapshot) return null;
  if (!output) {
    return (
      <section className="affiliate-prediction-comparison" aria-label={t("ecommerce.affiliateWorkspace.predictionComparison.title")}>
        <div className="affiliate-prediction-comparison-head">
          <span>{t("ecommerce.affiliateWorkspace.predictionComparison.title")}</span>
        </div>
        <div className="td-meta">
          {t("ecommerce.affiliateWorkspace.predictionComparison.modelUnavailable")}
          {snapshot.status ? ` · ${formatAffiliateEnumLabel(snapshot.status)}` : ""}
        </div>
      </section>
    );
  }
  const humanDecision = output?.humanDecision ?? null;
  const expectedSalesUnits = output?.expectedSalesUnits ?? null;
  const expectedSalesSelection = output.expectedSalesSelection ?? output;
  const humanDecisionSelection = output.humanDecisionSelection ?? null;
  const availability = predictionFamilyAvailability(output);
  const isHumanDecisionBootstrap =
    availability.humanDecisionReady &&
    isBootstrapModelSelection(humanDecisionSelection);
  const hasHumanDecision = typeof humanDecision?.wouldApprove === "boolean";
  if (!availability.hasFamilyResult) return null;

  const predictionJudgmentLabel = getPredictionSalesJudgmentLabel(expectedSalesUnits, t);
  const humanDecisionLabel = availability.humanDecisionReady && hasHumanDecision
    ? humanDecision?.wouldApprove
      ? t("ecommerce.affiliateWorkspace.predictionComparison.humanWouldApprove")
      : t("ecommerce.affiliateWorkspace.predictionComparison.humanWouldReject")
    : availability.humanDecisionReady
      ? t("ecommerce.affiliateWorkspace.predictionComparison.humanInsufficient")
      : t("ecommerce.affiliateWorkspace.predictionComparison.modelUnavailable");
  const probability = availability.humanDecisionReady &&
    typeof humanDecision?.humanApprovalProbability === "number"
    ? formatPercent(humanDecision.humanApprovalProbability)
    : null;

  return (
    <section className="affiliate-prediction-comparison" aria-label={t("ecommerce.affiliateWorkspace.predictionComparison.title")}>
      <div className="affiliate-prediction-comparison-head">
        <span>{t("ecommerce.affiliateWorkspace.predictionComparison.title")}</span>
        {isHumanDecisionBootstrap ? (
          <span className="badge" data-model-family="HUMAN_DECISION">
            {t("ecommerce.affiliateWorkspace.predictionComparison.bootstrapBadge")}
          </span>
        ) : null}
      </div>
      {isHumanDecisionBootstrap ? (
        <div className="td-meta" data-model-family="HUMAN_DECISION">
          {t("ecommerce.affiliateWorkspace.predictionComparison.humanBootstrapExplanation")}
        </div>
      ) : null}
      <div className="affiliate-prediction-comparison-grid">
        <div className="affiliate-prediction-metric">
          <span>{t("ecommerce.affiliateWorkspace.predictionComparison.predictionJudgment")}</span>
          <strong>{predictionJudgmentLabel}</strong>
        </div>
        <div className="affiliate-prediction-metric">
          <span>
            {t(
              isHumanDecisionBootstrap
                ? "ecommerce.affiliateWorkspace.predictionComparison.humanBootstrapEstimate"
                : "ecommerce.affiliateWorkspace.predictionComparison.humanDecision",
            )}
          </span>
          <strong>{humanDecisionLabel}</strong>
          {probability ? (
            <small>
              {t("ecommerce.affiliateWorkspace.predictionComparison.humanApprovalProbability", { probability })}
            </small>
          ) : null}
          {humanDecisionSelection?.effectiveTenantScope ? (
            <small>
              {t("ecommerce.affiliateWorkspace.predictionComparison.effectiveScope", {
                scope: humanDecisionSelection.effectiveTenantScope,
              })}
            </small>
          ) : null}
        </div>
        <div className="affiliate-prediction-metric">
          <span>
            {t("ecommerce.affiliateWorkspace.predictionComparison.expectedSales")}
          </span>
          <strong>
            {availability.expectedSalesReady &&
            typeof expectedSalesUnits === "number"
              ? t("ecommerce.affiliateWorkspace.predictionComparison.expectedSalesValue", {
                  units: formatCompactNumber(expectedSalesUnits),
                })
              : availability.expectedSalesReady
                ? t("ecommerce.affiliateWorkspace.predictionComparison.unknown")
                : t("ecommerce.affiliateWorkspace.predictionComparison.modelUnavailable")}
          </strong>
          {expectedSalesSelection.effectiveTenantScope ? (
            <small>
              {t("ecommerce.affiliateWorkspace.predictionComparison.effectiveScope", {
                scope: expectedSalesSelection.effectiveTenantScope,
              })}
            </small>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function predictionFamilyAvailability(
  output: Pick<
    AffiliatePredictionSnapshotOutput,
    | "expectedSalesStatus"
    | "humanDecisionStatus"
    | "expectedSalesUnits"
    | "humanDecision"
  >,
): {
  expectedSalesReady: boolean;
  humanDecisionReady: boolean;
  hasFamilyResult: boolean;
} {
  const expectedSalesReady =
    output.expectedSalesStatus === "OK" ||
    (output.expectedSalesStatus == null &&
      typeof output.expectedSalesUnits === "number");
  const humanDecisionReady =
    output.humanDecisionStatus === "OK" ||
    (output.humanDecisionStatus == null &&
      typeof output.humanDecision?.wouldApprove === "boolean");
  return {
    expectedSalesReady,
    humanDecisionReady,
    hasFamilyResult:
      output.expectedSalesStatus != null ||
      output.humanDecisionStatus != null ||
      typeof output.expectedSalesUnits === "number" ||
      typeof output.humanDecision?.wouldApprove === "boolean",
  };
}

export function isBootstrapExpectedSalesOutput(
  output: Pick<
    AffiliatePredictionSnapshotOutput,
    "modelStage" | "featureTemporalBasis"
  >,
): boolean {
  return (
    output.modelStage === "BOOTSTRAP" ||
    output.featureTemporalBasis === "CURRENT_STATE_PROXY"
  );
}

export function isBootstrapModelSelection(
  selection: Pick<
    AffiliatePredictionModelSelection,
    "modelStage" | "featureTemporalBasis"
  > | null | undefined,
): boolean {
  return Boolean(
    selection?.modelStage === "BOOTSTRAP" ||
      selection?.featureTemporalBasis === "CURRENT_STATE_PROXY",
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
        allowInlineLoad={false}
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
  const productId = proposal.productId
    ?? proposal.affiliateCollaboration?.productIds[0]
    ?? proposal.sampleApplicationRecord?.productId
    ?? getProposalActionProductId(proposal);
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
    proposal.productId ||
    proposal.affiliateCollaboration?.productIds[0] ||
    proposal.sampleApplicationRecord?.productId ||
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
  const projectionCollaborations = (projection?.affiliateCollaborations ?? []) as GQL.AffiliateCollaboration[];
  const projectionPendingProposals = ((projection?.actionProposals ?? []) as GQL.ActionProposal[])
    .filter((item) => item.status === GQL.ActionProposalStatus.Pending);
  const focusCollaboration = (
    hydratedProposal.affiliateCollaboration ??
    projectionCollaborations.find((record) => record.id === hydratedProposal.affiliateCollaborationId) ??
    projectionCollaborations[0] ??
    null
  ) as GQL.AffiliateCollaboration | null;
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
    creatorId: relationship?.creatorId ?? hydratedProposal.creatorId ?? null,
    creatorOpenId: hydratedProposal.creatorProfile?.creatorOpenId ?? null,
    creatorImId: hydratedProposal.creatorProfile?.creatorImId ?? null,
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.StaffRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.NoAction,
    processReasons: [],
    lastInboundAt: relationship?.lastInboundAt ?? null,
    lastOutboundAt: relationship?.lastOutboundAt ?? null,
    nextSellerActionAt: relationship?.workSummary?.nextActionAt ?? null,
    stateUpdatedAt: relationship?.stateUpdatedAt ?? hydratedProposal.updatedAt ?? hydratedProposal.createdAt,
    creatorProfile: projection?.creatorProfile ?? hydratedProposal.creatorProfile ?? null,
    creatorRelation: relationship,
    activeCollaborations,
    ambiguousCollaborations: [],
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
  const projectionCollaborations = (projection?.affiliateCollaborations ?? []) as GQL.AffiliateCollaboration[];
  const projectionPendingProposals = ((projection?.actionProposals ?? []) as GQL.ActionProposal[])
    .filter((proposal) => proposal.status === GQL.ActionProposalStatus.Pending);
  const pendingProposals = mergeById(projectionPendingProposals);
  const focusCollaboration = (
    context.focusCollaboration ??
    workItem.affiliateCollaboration ??
    projectionCollaborations.find((record) => record.id === workItem.affiliateCollaborationId) ??
    null
  ) as GQL.AffiliateCollaboration | null;
  const relationship = workItem.creatorRelationship ?? context.creatorRelation ?? projection?.creatorRelationship ?? null;
  const primaryAgenda = relationship?.agendaItems?.find(
    (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.Agent,
  ) ?? relationship?.agendaItems?.find(
    (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.Staff,
  ) ?? relationship?.agendaItems?.find(
    (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.External,
  ) ?? null;
  const activeCollaborations = mergeById([
    ...((context.activeCollaborations ?? []) as GQL.AffiliateCollaboration[]),
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
    shopId: workItem.triggerShopId,
    creatorId: relationship?.creatorId ?? null,
    creatorOpenId: context.creatorProfile?.creatorOpenId ?? null,
    creatorImId: context.creatorProfile?.creatorImId ?? null,
    processingStatus: primaryAgenda
      ? relationshipProcessingStatusFromAgendaOwner(primaryAgenda.owner)
      : workItem.processingStatus,
    requiredAction: primaryAgenda?.requiredAction ?? workItem.requiredAction,
    processReasons: primaryAgenda?.reasons ?? workItem.processReasons ?? [],
    lastInboundAt: relationship?.lastInboundAt ?? null,
    lastOutboundAt: relationship?.lastOutboundAt ?? null,
    nextSellerActionAt: relationship?.workSummary?.nextActionAt ?? null,
    stateUpdatedAt: relationship?.stateUpdatedAt ?? workItem.versionAt,
    creatorProfile: context.creatorProfile ?? projection?.creatorProfile ?? null,
    creatorRelation: relationship,
    activeCollaborations,
    ambiguousCollaborations: (context.ambiguousCollaborationCandidates ?? []) as GQL.AffiliateCollaboration[],
    focusCollaboration,
    pendingProposals,
    focusedProposal: pendingProposals[0] ?? null,
    productContext: context.productContext ?? productContextFromProjection(projection),
    primarySampleApplication: context.primarySampleApplication ?? workItem.sampleApplicationRecord ?? sampleApplications[0] ?? null,
    relatedSampleApplications: sampleApplications,
    workItem,
  };
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
  const productId = proposal.affiliateCollaboration?.productIds[0] ?? getProposalActionProductId(proposal);
  if (!productId) return null;
  return {
    productId,
    title: proposal.productSummary?.title ?? null,
    imageUrl: proposal.productSummary?.coverImage ?? null,
    source: proposal.affiliateCollaboration?.productIds[0] ? "collaboration" : "proposal",
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
    affiliateCollaboration: proposal.affiliateCollaboration ?? item.focusCollaboration ?? null,
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

function relationshipSubStatusKey(item: CreatorRelationshipWorkItem): string | null {
  return firstStatusDetailKey(
    item.processReasons,
    item.workItem?.workKind,
    item.requiredAction,
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
    ) ?? null,
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
    action === GQL.AffiliateRelationshipRequiredAction.NoAction ||
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
  return t("ecommerce.affiliateWorkspace.creatorRelationshipObject");
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
  return t("ecommerce.affiliateWorkspace.relationshipNoCurrentWorkHint");
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
  selectedShopId,
  onClose,
}: {
  item: CreatorRelationshipDetailItem;
  selectedShopId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const affiliateWorkspace = entityStore.affiliateWorkspace;
  const [activeTab, setActiveTab] = useState<"profile" | "overview" | "samples" | "platform" | "conversation" | "activity">("overview");
  const [composerText, setComposerText] = useState("");
  const [composerChannel, setComposerChannel] = useState<"AUTO" | GQL.AffiliateMessageChannel>("AUTO");
  const [composerShopId, setComposerShopId] = useState(selectedShopId);
  const [composerSubject, setComposerSubject] = useState("");
  const [stagedAttachments, setStagedAttachments] = useState<StagedAffiliateAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const activityBottomRef = useRef<HTMLDivElement | null>(null);
  const activityLoadedOlderRef = useRef(false);
  const fallbackProfile = item.creatorProfile ?? null;
  const management = item.managementItem ?? null;
  const relationshipId = item.creatorRelation?.id ?? item.workItems?.[0]?.relationshipId ?? null;
  const {
    data: relationshipDetailData,
    loading: relationshipDetailLoading,
    error: relationshipDetailError,
    refetch: refetchRelationshipDetail,
  } = useQuery<
    { affiliateCreatorRelationshipDetail: GQL.AffiliateCreatorRelationshipDetailPayload },
    { input: GQL.AffiliateCreatorRelationshipDetailInput }
  >(AFFILIATE_CREATOR_RELATIONSHIP_DETAIL_QUERY, {
    variables: { input: { creatorRelationshipId: relationshipId ?? "" } },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
  });
  useEffect(() => {
    const unsubscribeProposal = panelEventBus.subscribe("affiliate-action-proposal-changed", () => {
      void refetchRelationshipDetail();
    });
    const unsubscribeWorkItem = panelEventBus.subscribe("affiliate-work-item-changed", () => {
      void refetchRelationshipDetail();
    });
    return () => {
      unsubscribeProposal();
      unsubscribeWorkItem();
    };
  }, [refetchRelationshipDetail]);
  const relationshipDetail = relationshipDetailData?.affiliateCreatorRelationshipDetail ?? null;
  const relationship = relationshipDetail?.creatorRelationship ?? item.creatorRelation ?? null;
  const {
    data: creatorProfileData,
    loading: creatorProfileLoading,
    refetch: refetchCreatorProfile,
  } = useQuery<
    { affiliateCreatorProfile: GQL.AffiliateCreatorProfilePayload },
    { input: GQL.AffiliateCreatorProfileInput }
  >(AFFILIATE_CREATOR_PROFILE_QUERY, {
    variables: {
      input: {
        creatorRelationshipId: relationshipId ?? "",
        preferredShopId: selectedShopId || undefined,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
  });
  const authoritativeProfile = creatorProfileData?.affiliateCreatorProfile ?? null;
  const profile = authoritativeProfile?.creator ?? relationshipDetail?.creator ?? fallbackProfile;
  const name = profile
    ? creatorPrimaryName(profile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : item.creatorId;
  const handle = profile ? creatorTikTokHandle(profile) : null;
  const platformId = profile ? creatorPlatformIdentity(profile) : null;
  const performance = authoritativeProfile?.performance
    ?? relationshipDetail?.performance
    ?? management?.creatorPerformance
    ?? (profile ? latestCreatorPerformance(profile) : null);
  const marketplaceBio = profile?.bioDescription?.trim() || null;
  const blocked = Boolean(relationship?.blocked);
  const rawShopStates = relationship?.shopStates ?? (item.shopState ? [item.shopState] : []);
  const relationshipShopName = (shopId: string) => {
    const shop = entityStore.shops.find((candidate) => candidate.id === shopId);
    return shop?.alias || shop?.shopName || shop?.platformShopId || shopId;
  };
  const [relationshipOwnerId, setRelationshipOwnerId] = useState(relationship?.businessDeveloperId ?? "");
  useEffect(() => {
    setRelationshipOwnerId(relationship?.businessDeveloperId ?? "");
  }, [relationship?.businessDeveloperId]);
  const relationshipProtection = relationshipDetail?.protection ?? null;
  const { data: developerData } = useQuery<{ affiliateBusinessDevelopers: GQL.AffiliateBusinessDeveloper[] }>(
    AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
    { variables: { includeArchived: false }, fetchPolicy: "cache-and-network" },
  );
  useEffect(() => {
    if (developerData) affiliateWorkspace.replaceAffiliateBusinessDevelopers(developerData.affiliateBusinessDevelopers);
  }, [affiliateWorkspace, developerData]);
  const [assignDeveloper, assignDeveloperState] = useMutation(ASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION);
  const [protectRelationship, protectRelationshipState] = useMutation(PROTECT_AFFILIATE_CREATOR_RELATIONSHIP_MUTATION);
  const [removeRelationshipProtection, removeRelationshipProtectionState] = useMutation(REMOVE_AFFILIATE_CREATOR_RELATIONSHIP_PROTECTION_MUTATION);
  const ownerOptions = affiliateWorkspace.businessDevelopers
    .filter((developer) => !developer.archivedAt)
    .map((developer) => ({ value: developer.id, label: developer.displayName }));
  const relationshipOwner = relationshipOwnerId
    ? affiliateWorkspace.getBusinessDeveloper(relationshipOwnerId)
    : null;
  const effectiveAiLabel = relationshipProtection
    ? t("ecommerce.affiliateWorkspace.relationshipProtected")
    : relationshipOwner?.agentAssistanceMode === GQL.AffiliateAgentAssistanceMode.HumanOnly
      ? t("ecommerce.affiliateTeam.humanOnly")
      : t("ecommerce.affiliateTeam.aiAssisted");
  const ownershipBusy = assignDeveloperState.loading
    || protectRelationshipState.loading || removeRelationshipProtectionState.loading;
  const includedShopIds = relationshipDetail?.includedShopIds ?? rawShopStates.map((state) => state.shopId);
  const shopActivitySummaries = relationshipDetail?.shopActivitySummaries
    ?? includedShopIds.map((shopId) => ({
      shopId,
      lastContactedAt: rawShopStates.find((state) => state.shopId === shopId)?.lastContactedAt ?? null,
      lastBusinessActivityAt: null,
      agendaItemCount: 0,
      sampleApplicationCount: 0,
      platformCollaborationCount: 0,
      pendingProposalCount: 0,
    }));
  useEffect(() => {
    if (selectedShopId && includedShopIds.includes(selectedShopId)) {
      setComposerShopId(selectedShopId);
    } else if (includedShopIds.length === 1) {
      setComposerShopId(includedShopIds[0]);
    } else if (!includedShopIds.includes(composerShopId)) {
      setComposerShopId("");
    }
  }, [composerShopId, includedShopIds, selectedShopId]);
  const [sendAffiliateCreatorMessage] = useMutation<
    { sendAffiliateCreatorMessage: GQL.SendAffiliateCreatorMessagePayload },
    { input: GQL.SendAffiliateCreatorMessageInput }
  >(SEND_AFFILIATE_CREATOR_MESSAGE_MUTATION);
  const sampleQuery = useQuery<
    { affiliateRelationshipSampleApplications: GQL.AffiliateRelationshipSampleApplicationPage },
    { input: GQL.AffiliateRelationshipEntityPageInput }
  >(AFFILIATE_RELATIONSHIP_SAMPLE_APPLICATIONS_QUERY, {
    variables: { input: { creatorRelationshipId: relationshipId ?? "", limit: 25 } },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
  });
  const platformQuery = useQuery<
    { affiliateRelationshipPlatformCollaborations: GQL.AffiliateRelationshipPlatformCollaborationPage },
    { input: GQL.AffiliateRelationshipEntityPageInput }
  >(AFFILIATE_RELATIONSHIP_PLATFORM_COLLABORATIONS_QUERY, {
    variables: { input: { creatorRelationshipId: relationshipId ?? "", limit: 25 } },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
  });
  const proposalQuery = useQuery<
    { affiliateActionProposalPage: GQL.AffiliateActionProposalPage },
    { input: GQL.ReadActionProposalsInput }
  >(AFFILIATE_ACTION_PROPOSALS_QUERY, {
    variables: { input: { creatorRelationshipId: relationshipId ?? "", limit: 25 } },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
  });
  const samplePage = sampleQuery.data?.affiliateRelationshipSampleApplications;
  const platformPage = platformQuery.data?.affiliateRelationshipPlatformCollaborations;
  const proposalPage = proposalQuery.data?.affiliateActionProposalPage;
  const relationshipSampleApplications = samplePage?.items ?? [];
  const platformCollaborations = platformPage?.items ?? [];
  const relationshipProposals = proposalPage?.items ?? [];
  const visiblePendingProposals = relationshipProposals.filter(
    (proposal) => proposal.status === GQL.ActionProposalStatus.Pending,
  );
  const productSummaries = mergeById([
    ...(samplePage?.productSummaries ?? []),
    ...(platformPage?.productSummaries ?? []),
  ], (entry) => `${entry.shopId}:${entry.product.productId}`);
  const productSummaryFor = (shopId: string, productId: string | null | undefined) =>
    productSummaries.find((entry) => entry.shopId === shopId && entry.product.productId === productId)?.product ?? null;
  const relationshipSummary = relationship?.workSummary;
  const relationshipAgenda = (relationship?.agendaItems ?? []).filter((agenda) =>
    !agenda.shopId || includedShopIds.includes(agenda.shopId),
  );
  const relationshipAggregateStatus =
    (relationshipSummary?.agentRequiredCount ?? 0) > 0
      ? GQL.AffiliateRelationshipProcessingStatus.AgentRequired
      : (relationshipSummary?.staffRequiredCount ?? 0) > 0
        ? GQL.AffiliateRelationshipProcessingStatus.StaffRequired
        : (relationshipSummary?.externalWaitingCount ?? 0) > 0
          ? GQL.AffiliateRelationshipProcessingStatus.ExternalWaiting
          : GQL.AffiliateRelationshipProcessingStatus.Idle;
  const relationshipStatusDisplay = relationship
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
  const relationshipTone = relationship
      ? relationshipStatusTone(relationshipAggregateStatus)
      : management?.needsAttention
        ? "attention"
        : "done";
  const currentTitle = visiblePendingProposals[0]
      ? renderProposalRecommendationTitle(visiblePendingProposals[0], t)
      : relationshipAgenda[0]
        ? t(`ecommerce.affiliateWorkspace.workKinds.${relationshipAgenda[0].workKind}`, {
            defaultValue: formatAffiliateEnumLabel(relationshipAgenda[0].workKind),
          })
      : management?.needsAttention
        ? t("ecommerce.affiliateWorkspace.creatorNeedsAttention")
        : t("ecommerce.affiliateWorkspace.relationshipNoCurrentWork");
  const currentSummary = relationshipAgenda[0]?.reasons?.length
    ? relationshipAgenda[0].reasons.map(formatAffiliateEnumLabel).join(" · ")
    : management?.needsAttention
      ? t("ecommerce.affiliateWorkspace.relationshipNeedsManualReview")
      : t("ecommerce.affiliateWorkspace.relationshipNoCurrentWorkHint");

  const {
    data: messageHistoryData,
    loading: conversationLoading,
    fetchMore: fetchMoreConversationMessages,
    refetch: refetchConversationMessages,
    error: conversationError,
  } = useQuery<
    { affiliateCreatorMessageHistory: GQL.AffiliateCreatorMessageHistoryPayload },
    { input: GQL.AffiliateCreatorMessageHistoryInput }
  >(AFFILIATE_CREATOR_MESSAGE_HISTORY_QUERY, {
    variables: {
      input: {
        creatorRelationshipId: relationshipId ?? "",
        limit: AFFILIATE_TIMELINE_PAGE_SIZE,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
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
    if (!relationshipId || !composerShopId) return;
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
        shopId: composerShopId,
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
      showToast(t("ecommerce.affiliateWorkspace.messageSubmitted"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSendingMessage(false);
    }
  }
  const {
    data: relationshipTimelineData,
    loading: relationshipTimelineLoading,
    error: relationshipTimelineError,
    fetchMore: fetchMoreRelationshipTimeline,
    refetch: refetchRelationshipTimeline,
  } = useQuery<
    { affiliateRelationshipTimeline: GQL.AffiliateRelationshipTimelinePayload },
    { input: GQL.AffiliateRelationshipTimelineInput }
  >(AFFILIATE_RELATIONSHIP_TIMELINE_QUERY, {
    variables: {
      input: {
        creatorRelationshipId: relationshipId ?? "",
        limit: AFFILIATE_TIMELINE_PAGE_SIZE,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
  });
  const relationshipTimeline = relationshipTimelineData?.affiliateRelationshipTimeline;
  const canLoadOlderActivity = Boolean(relationshipTimeline?.hasOlder && relationshipTimeline.olderCursor);
  const activityEntries = buildRelationshipTimelineEntries(
    relationshipTimeline?.items ?? [],
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
      id: "profile" as const,
      label: t("ecommerce.affiliateWorkspace.relationshipPanelProfile", { defaultValue: "Creator profile" }),
      count: performance ? 1 : 0,
    },
    {
      id: "overview" as const,
      label: t("ecommerce.affiliateWorkspace.relationshipPanelCurrentWork"),
      count: relationshipAgenda.length + visiblePendingProposals.length,
    },
    {
      id: "samples" as const,
      label: t("ecommerce.affiliateWorkspace.relationshipPanelSamples", { defaultValue: "Samples & fulfillment" }),
      count: relationshipDetail?.counts.sampleApplicationCount ?? relationshipSampleApplications.length,
    },
    {
      id: "platform" as const,
      label: t("ecommerce.affiliateWorkspace.relationshipPanelPlatformCollaborations", { defaultValue: "Platform collaborations" }),
      count: relationshipDetail?.counts.platformCollaborationCount ?? platformCollaborations.length,
    },
    {
      id: "conversation" as const,
      label: t("ecommerce.affiliateWorkspace.relationshipPanelCommunication"),
      count: conversationMessages.length,
    },
    {
      id: "activity" as const,
      label: t("ecommerce.affiliateWorkspace.relationshipPanelActivity"),
      count: relationshipDetail?.counts.lifecycleEventCount ?? activityEntries.length,
    },
  ];

  function loadOlderConversationMessages(): void {
    if (!conversationHistory?.hasMore || conversationHistory.nextOffset == null || !relationshipId) return;
    void fetchMoreConversationMessages({
      variables: {
        input: {
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
    if (!relationshipTimeline?.hasOlder || !relationshipTimeline.olderCursor || !relationshipId) return;
    activityLoadedOlderRef.current = true;
    void fetchMoreRelationshipTimeline({
      variables: {
        input: {
          creatorRelationshipId: relationshipId,
          limit: AFFILIATE_TIMELINE_PAGE_SIZE,
          cursor: relationshipTimeline.olderCursor,
        },
      },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult) return previous;
        return mergeAffiliateRelationshipTimelinePayload(previous, fetchMoreResult);
      },
    });
  }

  function loadMoreSamples(): void {
    if (!samplePage?.hasMore || !samplePage.nextCursor || !relationshipId) return;
    void sampleQuery.fetchMore({
      variables: { input: { creatorRelationshipId: relationshipId, limit: 25, cursor: samplePage.nextCursor } },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult) return previous;
        return { affiliateRelationshipSampleApplications: {
          ...fetchMoreResult.affiliateRelationshipSampleApplications,
          items: mergeById([
            ...previous.affiliateRelationshipSampleApplications.items,
            ...fetchMoreResult.affiliateRelationshipSampleApplications.items,
          ]),
          productSummaries: mergeById([
            ...previous.affiliateRelationshipSampleApplications.productSummaries,
            ...fetchMoreResult.affiliateRelationshipSampleApplications.productSummaries,
          ], (entry) => `${entry.shopId}:${entry.product.productId}`),
        } };
      },
    });
  }

  function loadMorePlatformCollaborations(): void {
    if (!platformPage?.hasMore || !platformPage.nextCursor || !relationshipId) return;
    void platformQuery.fetchMore({
      variables: { input: { creatorRelationshipId: relationshipId, limit: 25, cursor: platformPage.nextCursor } },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult) return previous;
        return { affiliateRelationshipPlatformCollaborations: {
          ...fetchMoreResult.affiliateRelationshipPlatformCollaborations,
          items: mergeById([
            ...previous.affiliateRelationshipPlatformCollaborations.items,
            ...fetchMoreResult.affiliateRelationshipPlatformCollaborations.items,
          ], (entry) => entry.collaboration.id),
          productSummaries: mergeById([
            ...previous.affiliateRelationshipPlatformCollaborations.productSummaries,
            ...fetchMoreResult.affiliateRelationshipPlatformCollaborations.productSummaries,
          ], (entry) => `${entry.shopId}:${entry.product.productId}`),
        } };
      },
    });
  }

  function loadMoreProposals(): void {
    if (!proposalPage?.hasMore || !proposalPage.nextCursor || !relationshipId) return;
    void proposalQuery.fetchMore({
      variables: { input: { creatorRelationshipId: relationshipId, limit: 25, cursor: proposalPage.nextCursor } },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult) return previous;
        return { affiliateActionProposalPage: {
          ...fetchMoreResult.affiliateActionProposalPage,
          items: mergeById([
            ...previous.affiliateActionProposalPage.items,
            ...fetchMoreResult.affiliateActionProposalPage.items,
          ]),
        } };
      },
    });
  }

  async function updateRelationshipOwner(nextOwnerId: string): Promise<void> {
    if (!relationshipId || ownershipBusy || nextOwnerId === relationshipOwnerId) return;
    if (!window.confirm(t("ecommerce.affiliateWorkspace.relationshipOwnerChangeConfirm"))) return;
    try {
      const result = await assignDeveloper({
        variables: {
          input: { creatorRelationshipId: relationshipId, businessDeveloperId: nextOwnerId },
        },
      });
      const relationship = (result.data as any)?.assignAffiliateBusinessDeveloper;
      if (relationship) affiliateWorkspace.upsertAffiliateCreatorRelationship(relationship);
      setRelationshipOwnerId(nextOwnerId);
      showToast(t("ecommerce.affiliateTeam.saved"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function toggleRelationshipProtection(): Promise<void> {
    if (!relationshipId || ownershipBusy) return;
    if (!window.confirm(t("ecommerce.affiliateWorkspace.relationshipProtectionChangeConfirm"))) return;
    try {
      if (relationshipProtection) {
        await removeRelationshipProtection({ variables: { creatorRelationshipId: relationshipId } });
      } else {
        await protectRelationship({
          variables: {
            input: {
              creatorRelationshipId: relationshipId,
              businessDeveloperId: relationshipOwnerId || null,
            },
          },
        });
      }
      await refetchRelationshipDetail();
      showToast(t("ecommerce.affiliateTeam.saved"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  if (relationshipDetailError && !relationshipDetail) {
    return (
      <div className="modal-backdrop affiliate-creator-detail-backdrop" role="presentation" onClick={onClose}>
        <div className="modal-content affiliate-collaboration-modal" role="dialog" onClick={(event) => event.stopPropagation()}>
          <AffiliateQueryErrorState error={relationshipDetailError} onRetry={() => void refetchRelationshipDetail()} />
        </div>
      </div>
    );
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
                    onClick={() => setActiveTab("profile")}
                  >
                    {t("ecommerce.affiliateWorkspace.openCreatorDetail")}
                  </button>
                ) : null}
              </div>
              <strong>{name}</strong>
              <div className="affiliate-relationship-work-side-meta">
                {handle ? <span>{handle}</span> : null}
                <span>
                  {t("ecommerce.affiliateWorkspace.creatorDetail.followers")}: {formatCount(performance?.followerCount)}
                </span>
                {authoritativeProfile?.market ?? management?.market ? (
                  <span className="affiliate-creator-market-pill">
                    {authoritativeProfile?.market ?? management?.market}
                  </span>
                ) : null}
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
                  placeholder={t("ecommerce.affiliateTeam.aiTeam")}
                  disabled={!relationshipId || ownershipBusy}
                />
              </label>
              <div className="affiliate-relationship-protection-control">
                <span>{t("ecommerce.affiliateWorkspace.relationshipAiParticipation")}</span>
                <strong>{relationshipProtection
                  ? t("ecommerce.affiliateWorkspace.relationshipProtected")
                  : t("ecommerce.affiliateWorkspace.relationshipAiEnabled")}</strong>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() => void toggleRelationshipProtection()}
                  disabled={!relationshipId || ownershipBusy}
                >
                  {relationshipProtection
                    ? t("ecommerce.affiliateTeam.removeProtection", { defaultValue: "Remove protection" })
                    : t("ecommerce.affiliateTeam.addProtectedCreator")}
                </button>
                {relationshipProtection?.note ? <small>{relationshipProtection.note}</small> : null}
              </div>
              {relationshipOwner?.agentAssistanceMode === GQL.AffiliateAgentAssistanceMode.HumanOnly ? (
                <small>{t("ecommerce.affiliateWorkspace.relationshipHumanOnlyHint", { name: relationshipOwner.displayName })}</small>
              ) : null}
            </section>
            <section className="affiliate-relationship-work-side-card">
              <div className="affiliate-relationship-work-side-card-head">
                <span>{t("ecommerce.affiliateWorkspace.relationshipCurrentDecision")}</span>
              </div>
              {relationshipProtection ? (
                <div className="affiliate-relationship-protection-banner">
                  {t("ecommerce.affiliateWorkspace.protectionDispatchBlocked", {
                    defaultValue: "This Creator is protected. The work remains visible for staff, but AI dispatch is blocked.",
                  })}
                </div>
              ) : null}
              <RelationshipStatusBadge display={relationshipStatusDisplay} tone={relationshipTone} compact />
              <div className="affiliate-relationship-work-side-facts">
                <SampleApplicationFact
                  label={t("ecommerce.affiliateWorkspace.relationshipWorkPendingProposals")}
                  value={relationshipDetail?.counts.pendingProposalCount ?? visiblePendingProposals.length}
                />
                <SampleApplicationFact
                  label={t("ecommerce.affiliateWorkspace.relationshipPanelSamples", { defaultValue: "Active samples" })}
                  value={relationshipDetail?.counts.activeSampleApplicationCount ?? 0}
                />
                <SampleApplicationFact
                  label={t("ecommerce.affiliateWorkspace.relationshipPanelPlatformCollaborations", { defaultValue: "Active platform collaborations" })}
                  value={relationshipDetail?.counts.activePlatformCollaborationCount ?? 0}
                />
                <SampleApplicationFact
                  label={t("ecommerce.affiliateWorkspace.creatorBlocked")}
                  value={blocked ? t("common.yes") : t("common.no")}
                />
                <SampleApplicationFact
                  label={t("ecommerce.affiliateWorkspace.creatorLastContactedAt", { defaultValue: "Last contacted" })}
                  value={relationshipDetail?.lastContactedAt ? formatProposalTime(relationshipDetail.lastContactedAt) : "—"}
                />
                <SampleApplicationFact
                  label={t("ecommerce.affiliateWorkspace.creatorLastBusinessActivityAt", { defaultValue: "Last business activity" })}
                  value={relationshipDetail?.lastBusinessActivityAt ? formatProposalTime(relationshipDetail.lastBusinessActivityAt) : "—"}
                />
              </div>
            </section>
            {shopActivitySummaries.length > 0 ? (
              <section className="affiliate-relationship-work-side-card">
                <div className="affiliate-relationship-work-side-card-head">
                  <span>{t("ecommerce.affiliateWorkspace.relationshipShopStates")}</span>
                </div>
                <div className="affiliate-relationship-shop-state-list">
                  {shopActivitySummaries.slice(0, 4).map((summary) => (
                    <div className="affiliate-relationship-shop-state" key={summary.shopId}>
                      <strong>{relationshipShopName(summary.shopId)}</strong>
                      <span>
                        {t("ecommerce.affiliateWorkspace.creatorLastContactedAt", { defaultValue: "Last contacted" })}: {summary.lastContactedAt
                          ? formatProposalTime(summary.lastContactedAt)
                          : t("ecommerce.affiliateWorkspace.noRecentContact")}
                      </span>
                      <span>
                        {t("ecommerce.affiliateWorkspace.creatorLastBusinessActivityAt", { defaultValue: "Last business activity" })}: {summary.lastBusinessActivityAt
                          ? formatProposalTime(summary.lastBusinessActivityAt)
                          : t("ecommerce.affiliateWorkspace.noRecentBusinessActivity", { defaultValue: "No recent business activity" })}
                      </span>
                      <span>
                        {t("ecommerce.affiliateWorkspace.shopActivitySummaryCounts", {
                          defaultValue: "{{agenda}} tasks · {{samples}} samples · {{collaborations}} platform collaborations · {{proposals}} pending proposals",
                          agenda: summary.agendaItemCount,
                          samples: summary.sampleApplicationCount,
                          collaborations: summary.platformCollaborationCount,
                          proposals: summary.pendingProposalCount,
                        })}
                      </span>
                    </div>
                  ))}
                  {shopActivitySummaries.length > 4 ? (
                    <div className="affiliate-relationship-shop-state affiliate-relationship-shop-state-more">
                      {t("ecommerce.affiliateWorkspace.relationshipMoreShopStates", { count: shopActivitySummaries.length - 4 })}
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
              {activeTab === "profile" ? (
                <CreatorProfilePanel
                  profile={profile}
                  performance={performance}
                  payload={authoritativeProfile}
                  loading={creatorProfileLoading}
                  onRefresh={() => void refetchCreatorProfile()}
                />
              ) : null}
              {activeTab === "overview" ? (
                <div className="affiliate-relationship-work-overview-panel">
                  {relationshipDetailLoading && !relationshipDetail ? <AffiliateLoadingState /> : null}
                  {proposalQuery.error ? <AffiliateQueryErrorState error={proposalQuery.error} onRetry={() => void proposalQuery.refetch()} /> : null}
                  {relationshipAgenda.length === 0 && visiblePendingProposals.length === 0 ? (
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
                          <span>{t("ecommerce.affiliateWorkspace.relationshipPanelSamples", { defaultValue: "Samples & fulfillment" })}</span>
                          <strong>{relationshipDetail?.counts.activeSampleApplicationCount ?? 0}</strong>
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
                  {relationshipAgenda.length > 0 ? (
                    <section className="affiliate-relationship-work-overview-section">
                      <h3>{t("ecommerce.affiliateWorkspace.relationshipPanelCurrentWork")}</h3>
                      <div className="affiliate-relationship-work-overview-proposal-list">
                        {relationshipAgenda.map((agenda) => (
                          <article className="affiliate-relationship-work-current-work" key={agenda.key}>
                            <div className="affiliate-relationship-work-current-work-main">
                              <span>{agenda.shopId ? relationshipShopName(agenda.shopId) : t("ecommerce.affiliateWorkspace.relationshipAcrossShops")} · {formatAffiliateEnumLabel(agenda.owner)}</span>
                              <h3>{t(`ecommerce.affiliateWorkspace.workKinds.${agenda.workKind}`, { defaultValue: formatAffiliateEnumLabel(agenda.workKind) })}</h3>
                              <p>{agenda.reasons.map(formatAffiliateEnumLabel).join(" · ") || formatAffiliateEnumLabel(agenda.requiredAction)}</p>
                            </div>
                            <RelationshipStatusBadge
                              display={{ primary: formatAffiliateEnumLabel(agenda.requiredAction), secondary: formatAffiliateEnumLabel(agenda.sourceType) }}
                              tone={relationshipStatusTone(relationshipProcessingStatusFromAgendaOwner(agenda.owner))}
                            />
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {visiblePendingProposals.length > 0 ? (
                    <section className="affiliate-relationship-work-overview-section">
                      <h3>{t("ecommerce.affiliateWorkspace.relationshipWorkPendingProposals")}</h3>
                      <div className="affiliate-relationship-work-overview-proposal-list">
                        {visiblePendingProposals.map((proposal) => (
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
                  {relationshipProposals.some((proposal) => proposal.status !== GQL.ActionProposalStatus.Pending) ? (
                    <section className="affiliate-relationship-work-overview-section">
                      <h3>{t("ecommerce.affiliateWorkspace.relationshipProposalHistory", { defaultValue: "Proposal history" })}</h3>
                      <div className="affiliate-relationship-work-overview-proposal-list">
                        {relationshipProposals.filter((proposal) => proposal.status !== GQL.ActionProposalStatus.Pending).map((proposal) => (
                          <ActionProposalCard key={proposal.id} proposal={proposal} shopLabel={relationshipShopName(proposal.focusShopId)} variant="compact" />
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {proposalPage?.hasMore ? <button className="btn btn-secondary" type="button" onClick={loadMoreProposals}>{t("common.loadMore", { defaultValue: "Load more" })}</button> : null}
                </div>
              ) : null}
              {activeTab === "samples" ? (
                <div className="affiliate-relationship-work-collaboration-detail-list">
                  {sampleQuery.error ? <AffiliateQueryErrorState error={sampleQuery.error} onRetry={() => void sampleQuery.refetch()} /> : null}
                  {sampleQuery.loading && relationshipSampleApplications.length === 0 ? <AffiliateLoadingState /> : null}
                  {relationshipSampleApplications.map((sample) => (
                    <SampleApplicationSummaryCard
                      key={sample.id}
                      sampleApplication={sample}
                      productSummary={productSummaryFor(sample.shopId, sample.productId)}
                      shopId={sample.shopId}
                    />
                  ))}
                  {!sampleQuery.loading && !sampleQuery.error && relationshipSampleApplications.length === 0 ? <div className="affiliate-proposal-empty">{t("ecommerce.affiliateWorkspace.sampleApplication.none")}</div> : null}
                  {samplePage?.hasMore ? <button className="btn btn-secondary" type="button" onClick={loadMoreSamples}>{t("common.loadMore", { defaultValue: "Load more" })}</button> : null}
                </div>
              ) : null}
              {activeTab === "platform" ? (
                <div className="affiliate-relationship-work-collaboration-detail-list">
                  {platformQuery.error ? <AffiliateQueryErrorState error={platformQuery.error} onRetry={() => void platformQuery.refetch()} /> : null}
                  {platformQuery.loading && platformCollaborations.length === 0 ? <AffiliateLoadingState /> : null}
                  {platformCollaborations.map((entry) => (
                    <RelationshipPlatformCollaborationCard
                      key={entry.collaboration.id}
                      item={entry}
                      shopLabel={relationshipShopName(entry.collaboration.shopId)}
                      productSummaries={entry.collaboration.productIds.map((productId) => productSummaryFor(entry.collaboration.shopId, productId)).filter((product): product is GQL.EcomProductSummary => Boolean(product))}
                    />
                  ))}
                  {!platformQuery.loading && !platformQuery.error && platformCollaborations.length === 0 ? <div className="affiliate-proposal-empty">{t("ecommerce.affiliateWorkspace.relationshipWorkNoCollaborations")}</div> : null}
                  {platformPage?.hasMore ? <button className="btn btn-secondary" type="button" onClick={loadMorePlatformCollaborations}>{t("common.loadMore", { defaultValue: "Load more" })}</button> : null}
                </div>
              ) : null}
              {activeTab === "conversation" ? (
                <div className="affiliate-conversation-tab">
                  <div className="affiliate-conversation-preview">
                    {conversationError ? <AffiliateQueryErrorState error={conversationError} onRetry={() => void refetchConversationMessages()} /> : null}
                    {conversationError ? null : conversationLoading && conversationMessages.length === 0 ? (
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
                    <Select
                      value={composerShopId}
                      onChange={setComposerShopId}
                      options={includedShopIds.map((shopId) => ({ value: shopId, label: relationshipShopName(shopId) }))}
                      placeholder={t("ecommerce.affiliateWorkspace.selectMessageShop", { defaultValue: "Select a shop before sending" })}
                    />
                    <textarea
                      className="form-input affiliate-message-composer-text"
                      value={composerText}
                      onChange={(event) => setComposerText(event.target.value)}
                      placeholder={t("ecommerce.affiliateWorkspace.messageComposerPlaceholder")}
                      rows={4}
                    />
                    <div className="affiliate-message-composer-controls">
                      <select
                        className="form-input"
                        value={composerChannel}
                        onChange={(event) => setComposerChannel(event.target.value as "AUTO" | GQL.AffiliateMessageChannel)}
                      >
                        <option value="AUTO">{t("ecommerce.affiliateWorkspace.messageComposerDefaultChannel")}</option>
                        <option value={GQL.AffiliateMessageChannel.Whatsapp}>WhatsApp</option>
                        <option value={GQL.AffiliateMessageChannel.Email}>Email</option>
                        <option value={GQL.AffiliateMessageChannel.PlatformChat}>Platform chat</option>
                      </select>
                      {composerChannel === GQL.AffiliateMessageChannel.Email ? (
                        <input
                          className="form-input"
                          value={composerSubject}
                          onChange={(event) => setComposerSubject(event.target.value)}
                          placeholder={t("ecommerce.affiliateWorkspace.messageComposerEmailSubject")}
                        />
                      ) : null}
                      <label className="btn btn-secondary affiliate-message-file-button">
                        {uploadingAttachments ? t("common.loading") : t("ecommerce.affiliateWorkspace.messageComposerAddFiles")}
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
                                {t("ecommerce.affiliateWorkspace.messageComposerInline")}
                              </label>
                            ) : null}
                            <button
                              className="btn btn-ghost"
                              type="button"
                              onClick={() => setStagedAttachments((current) => current.filter((item) => item.draftAssetId !== asset.draftAssetId))}
                            >
                              {t("common.remove")}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="affiliate-message-composer-footer">
                      <span>{t("ecommerce.affiliateWorkspace.messageComposerPartsHint")}</span>
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={!composerShopId || sendingMessage || uploadingAttachments || (!composerText.trim() && stagedAttachments.length === 0)}
                        onClick={() => void submitComposerMessage()}
                      >
                        {sendingMessage ? t("common.loading") : t("chat.send")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {activeTab === "activity" ? (
                <div className="affiliate-collaboration-timeline">
                  {relationshipTimelineError ? <AffiliateQueryErrorState error={relationshipTimelineError} onRetry={() => void refetchRelationshipTimeline()} /> : null}
                  {canLoadOlderActivity ? (
                    <button
                      className="btn btn-secondary affiliate-conversation-load-more"
                      type="button"
                      disabled={relationshipTimelineLoading}
                      onClick={loadOlderActivity}
                    >
                      {relationshipTimelineLoading
                        ? t("common.loading")
                        : t("ecommerce.affiliateWorkspace.activity.loadOlder")}
                    </button>
                  ) : null}
                  {relationshipTimelineLoading && activityEntries.length === 0 ? (
                    <div className="affiliate-proposal-empty">{t("common.loading")}</div>
                  ) : relationshipTimelineError ? null : activityEntries.length > 0 ? (
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
    </div>
  );
}

function CreatorProfilePanel({
  profile,
  performance,
  payload,
  loading,
  onRefresh,
}: {
  profile: GQL.AffiliateCreatorIdentity | null;
  performance: GQL.AffiliateCreatorPerformanceCurrent | null;
  payload: GQL.AffiliateCreatorProfilePayload | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  if (!profile) {
    return (
      <div className="affiliate-proposal-empty">
        {loading
          ? t("common.loading")
          : t("ecommerce.affiliateWorkspace.creatorDetail.profileUnavailable", {
              defaultValue: "Creator profile is not available yet.",
            })}
      </div>
    );
  }
  const name = creatorPrimaryName(profile, t("ecommerce.affiliateWorkspace.unknownCreator"));
  const handle = creatorTikTokHandle(profile);
  const platformId = creatorPlatformIdentity(profile);
  const marketplaceBio = profile.bioDescription?.trim() || null;
  const marketplaceMetrics = buildMarketplaceMetricRows(performance, t);
  const categoryIds = performance?.categoryIds ?? [];
  const categorySummary = categoryIds?.length
    ? categoryIds.slice(0, 8).join(", ")
    : null;

  const freshnessLabel = payload
    ? t(`ecommerce.affiliateWorkspace.creatorDetail.freshness.${payload.freshnessStatus}`, {
        defaultValue: formatAffiliateEnumLabel(payload.freshnessStatus),
      })
    : t("ecommerce.affiliateWorkspace.creatorDetail.cachedData", { defaultValue: "Cached data" });

  return (
    <div className="affiliate-creator-profile-panel">
      <div className="affiliate-creator-profile-panel-hero">
        <div className="affiliate-creator-detail-header">
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
        </div>
        <div className="affiliate-creator-profile-freshness">
          <span className={`affiliate-creator-freshness-badge${payload?.refreshErrorCode ? " warning" : ""}`}>
            {freshnessLabel}
          </span>
          <button className="btn btn-secondary btn-sm" type="button" disabled={loading} onClick={onRefresh}>
            {loading
              ? t("common.loading")
              : t("ecommerce.affiliateWorkspace.creatorDetail.refresh", { defaultValue: "Refresh profile" })}
          </button>
        </div>
      </div>

        <div className="affiliate-creator-detail-grid affiliate-creator-profile-fact-grid">
          <CreatorDetailMetric
            label={t("ecommerce.affiliateWorkspace.creatorDetail.followers")}
            value={formatCount(performance?.followerCount)}
          />
          <CreatorDetailMetric
            label={t("ecommerce.affiliateWorkspace.creatorDetail.platform")}
            value={t(`platforms.${profile.platform}`, { defaultValue: profile.platform })}
          />
          <CreatorDetailMetric
            label={t("ecommerce.affiliateWorkspace.creatorDetail.lastUpdated")}
            value={performance?.observedAt
              ? formatProposalTime(performance.observedAt)
              : profile.lastObservedAt
                ? formatProposalTime(profile.lastObservedAt)
                : null}
          />
          <CreatorDetailMetric
            label={t("ecommerce.affiliateWorkspace.creatorDetail.market", { defaultValue: "Market" })}
            value={payload?.market ?? performance?.market}
          />
          <CreatorDetailMetric
            label={t("ecommerce.affiliateWorkspace.creatorDetail.source", { defaultValue: "Data source" })}
            value={performance?.sourceType
              ? formatAffiliateEnumLabel(performance.sourceType)
              : null}
          />
          <CreatorDetailMetric
            label={t("ecommerce.affiliateWorkspace.creatorDetail.sourceShop", { defaultValue: "Performance source shop" })}
            value={performance?.sourceShopId ?? payload?.refreshShopId ?? null}
          />
          <CreatorDetailMetric
            label={t("ecommerce.affiliateWorkspace.creatorDetail.preciseData", { defaultValue: "Precise data" })}
            value={performance
              ? performance.preciseDataAuthorized
                ? t("common.yes")
                : t("common.no")
              : null}
          />
        </div>

        {payload?.refreshErrorMessage ? (
          <div className="affiliate-creator-profile-warning">
            <strong>{t("ecommerce.affiliateWorkspace.creatorDetail.refreshFailed", { defaultValue: "Refresh failed" })}</strong>
            <span>{payload.refreshErrorMessage}</span>
          </div>
        ) : null}

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
            {profile.creatorImId ? (
              <CreatorDetailCopyRow
                label={t("ecommerce.affiliateWorkspace.creatorDetail.creatorImId", { defaultValue: "Creator IM ID" })}
                value={profile.creatorImId}
                copyLabelKey="ecommerce.affiliateWorkspace.copyCreatorPlatformId"
                copiedMessageKey="ecommerce.affiliateWorkspace.creatorPlatformIdCopied"
              />
            ) : null}
            {profile.profileTtUri ? (
              <CreatorDetailCopyRow
                label={t("ecommerce.affiliateWorkspace.creatorDetail.profileUri", { defaultValue: "Profile URI" })}
                value={profile.profileTtUri}
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
  );
}

function latestCreatorPerformance(
  profile: GQL.AffiliateCreatorIdentity,
): GQL.AffiliateCreatorPerformanceCurrent | null {
  const projections = profile.currentPerformance ?? [];
  return [...projections].sort(
    (left, right) =>
      new Date(right.observedAt).getTime() - new Date(left.observedAt).getTime(),
  )[0] ?? null;
}

function buildMarketplaceMetricRows(
  performance: GQL.AffiliateCreatorPerformanceCurrent | null,
  t: ReturnType<typeof useTranslation>["t"],
): Array<{ label: string; value: string }> {
  if (!performance) return [];
  const rows: Array<{ label: string; value: string | null }> = [
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.totalGmv"),
      value: formatPerformanceMoney(performance.gmv),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.videoGmv"),
      value: formatPerformanceMoney(performance.videoGmv),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.liveGmv"),
      value: formatPerformanceMoney(performance.liveGmv),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.gpm"),
      value: formatPerformanceMoney(performance.gpm),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.unitsSold"),
      value: formatCount(performance.unitsSold),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.ecVideos"),
      value: formatCount(performance.videoCount),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.ecLives"),
      value: formatCount(performance.liveCount),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.avgVideoViews"),
      value: formatCount(performance.averageVideoViews),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.rating"),
      value: performance.ratingScore == null ? null : String(performance.ratingScore),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.pps"),
      value: performance.pps == null ? null : String(performance.pps),
    },
    {
      label: t("ecommerce.affiliateWorkspace.creatorDetail.postRate"),
      value: formatPerformanceRate(performance.engagementRate),
    },
  ];
  return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
}

function formatPerformanceMoney(
  metric: GQL.AffiliateCreatorPerformanceMoneyMetric | null | undefined,
): string | null {
  if (!metric) return null;
  if (metric.amount != null) {
    return formatCreatorMoney(String(metric.amount), metric.currency);
  }
  if (metric.minimumAmount != null && metric.maximumAmount != null) {
    const minText = formatCreatorMoney(String(metric.minimumAmount), metric.currency)
      ?? String(metric.minimumAmount);
    const maxText = formatCreatorMoney(String(metric.maximumAmount), metric.currency)
      ?? String(metric.maximumAmount);
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

function formatPerformanceRate(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const percentage = value <= 1 ? value * 100 : value;
  return `${percentage.toFixed(1)}%`;
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
): AffiliatePredictionSnapshotView | null {
  const snapshots = proposal.predictionSnapshots ?? [];
  if (!snapshots.length) return null;
  return sortPredictionSnapshotsByCaptureTime(
    snapshots as AffiliatePredictionSnapshotView[],
  )[0] ?? null;
}

function sortPredictionSnapshotsByCaptureTime(
  snapshots: AffiliatePredictionSnapshotView[],
): AffiliatePredictionSnapshotView[] {
  return [...snapshots].sort((a, b) => {
    const aTime = new Date(a.capturedAt ?? a.predictedAt ?? 0).getTime();
    const bTime = new Date(b.capturedAt ?? b.predictedAt ?? 0).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

function readPredictionSnapshotOutput(
  snapshot: AffiliatePredictionSnapshotView | null,
): AffiliatePredictionSnapshotOutput | null {
  if (!snapshot || snapshot.status !== "OK") return null;
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

function renderCollaborationWorkTitle({
  processReasons,
  sampleApplicationRecord,
  fallback,
  t,
}: {
  processReasons: GQL.AffiliateWorkProcessReason[];
  sampleApplicationRecord?: GQL.SampleApplicationRecord | null;
  fallback?: string | null;
  t: ReturnType<typeof useTranslation>["t"];
}): string {
  if (sampleApplicationRecord?.sampleWorkStatus === GQL.SampleWorkStatus.RequestPendingReview) {
    return t("ecommerce.affiliateWorkspace.collaborationWorkTitles.SAMPLE_REVIEW");
  }
  const priority = [
    GQL.AffiliateWorkProcessReason.CreatorMessageNeedsHandling,
    GQL.AffiliateWorkProcessReason.SamplePendingReview,
    GQL.AffiliateWorkProcessReason.SampleAwaitingShipment,
    GQL.AffiliateWorkProcessReason.SampleContentFollowUpDue,
    GQL.AffiliateWorkProcessReason.CreatorActionFollowUpDue,
    GQL.AffiliateWorkProcessReason.IdentityResolution,
    GQL.AffiliateWorkProcessReason.AgentRunFailed,
    GQL.AffiliateWorkProcessReason.ProposalRevisionRequested,
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
