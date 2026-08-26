import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useMutation, useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import type { AffiliateLifecycleEvent } from "@rivonclaw/core/models";
import { getSnapshot, isStateTreeNode } from "mobx-state-tree";
import { Select } from "../../components/inputs/Select.js";
import { ConfirmDialog } from "../../components/modals/ConfirmDialog.js";
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
  AFFILIATE_OPERATIONAL_PROJECTION_HEALTH_QUERY,
  AFFILIATE_OPEN_COLLABORATION_SETTINGS_QUERY,
  AFFILIATE_PRODUCT_SUMMARIES_QUERY,
  ASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION,
  CREATOR_MANUAL_TAGS_QUERY,
  CREATE_AFFILIATE_OPEN_COLLABORATION_MUTATION,
  CREATE_AFFILIATE_TARGET_COLLABORATION_MUTATION,
  DECIDE_ACTION_PROPOSAL_MUTATION,
  EDIT_AFFILIATE_OPEN_COLLABORATION_SAMPLE_RULE_MUTATION,
  EDIT_AFFILIATE_OPEN_COLLABORATION_SETTINGS_MUTATION,
  REMOVE_AFFILIATE_OPEN_COLLABORATION_MUTATION,
  REMOVE_AFFILIATE_TARGET_COLLABORATION_MUTATION,
  SEND_AFFILIATE_CREATOR_MESSAGE_MUTATION,
  PROTECT_AFFILIATE_CREATOR_RELATIONSHIP_MUTATION,
  REMOVE_AFFILIATE_CREATOR_RELATIONSHIP_PROTECTION_MUTATION,
  UPDATE_AFFILIATE_TARGET_COLLABORATION_MUTATION,
} from "../../api/shops-queries.js";
import { creatorSampleTierDisplay } from "./affiliate-creator-tiers.js";
import { AffiliateCreatorFilterGroups } from "./components/AffiliateCreatorFilterGroups.js";
import {
  AffiliateCreatorManualTagEditor,
  type CreatorManualTagChange,
} from "./components/AffiliateCreatorManualTagEditor.js";
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

export type CreatorRelationshipDetailItem = {
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
/** Chips beyond this many collapse into a single "+N" chip. */
const CREATOR_MANUAL_TAG_CHIP_LIMIT = 3;
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

/**
 * Canonical backend-frozen prediction evidence (ADR-058 cutover): the typed
 * `predictionEvidence` field on a snapshot, written verbatim by the backend.
 * Null evidence means the prediction request itself failed (rendered from the
 * snapshot's own status/message); a snapshot with status OK but no evidence
 * is a data-contract violation and renders an explicit error state. There is
 * no legacy-shape fallback.
 */
export type AffiliatePredictionEvidenceState =
  | { kind: "EVIDENCE"; evidence: GQL.AffiliatePredictionEvidence }
  | { kind: "REQUEST_FAILED"; status: string; message: string | null }
  | { kind: "CONTRACT_VIOLATION" };

type AffiliatePredictionSignalLike = {
  status: GQL.AffiliateModelSignalStatus;
  error?: {
    code: GQL.AffiliatePredictionErrorCode;
    message?: string | null;
  } | null;
};

type AffiliatePredictionSnapshotView = {
  status: string;
  message?: string | null;
  predictionEvidence?: GQL.AffiliatePredictionEvidence | null;
  output?: unknown;
  sourceCacheId?: string | null;
  scenario?: string | null;
  capturedAt?: string | null;
  predictedAt?: string | null;
  subject?: {
    sampleApplicationRecordId?: string | null;
    platformApplicationId?: string | null;
    productId?: string | null;
  } | null;
  resolvedContext?: {
    shopId?: string | null;
    sampleApplicationRecordId?: string | null;
    platformApplicationId?: string | null;
    productId?: string | null;
    productTitle?: string | null;
  } | null;
};

export type AffiliateSampleProposalReviewRow = {
  stepId: string;
  shopId: string | null;
  sampleApplicationRecordId: string | null;
  platformApplicationId: string | null;
  productId: string | null;
  productTitle: string | null;
  productSellerSku: string | null;
  decision: GQL.AffiliateSampleReviewDecision;
  rejectReason: string | null;
  rejectReasonExplanation: string | null;
  predictionSnapshot: AffiliatePredictionSnapshotView | null;
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

export function hydrateAffiliateProposalProjection(projection: {
  proposal: unknown;
  affiliateCollaboration?: unknown | null;
  sampleApplicationRecord?: unknown | null;
  creatorProfile?: unknown | null;
  productSummary?: unknown | null;
}, authoritativeProposal?: GQL.ActionProposal): GQL.ActionProposal {
  const storedProposal = affiliateSnapshot(projection.proposal) ?? {};
  const proposal = authoritativeProposal
    ? { ...storedProposal, ...affiliateSnapshot(authoritativeProposal) }
    : storedProposal;
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
  GQL.ActionProposalType.NoActionNeeded,
  GQL.ActionProposalType.SendMessage,
  GQL.ActionProposalType.ReviewSampleApplication,
  GQL.ActionProposalType.ManageCreatorTag,
] as const;

type ProposalTypeFilter = (typeof PROPOSAL_TYPE_FILTERS)[number];

type AgentWorkspaceView = "PENDING" | "ALL";

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

type AffiliateProposalPageBuffer = {
  queryKey: string;
  items: GQL.ActionProposal[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function affiliateProposalPageQueryKey(filters: {
  userId?: string | null;
  shopId?: string | null;
  businessDeveloperId?: string | null;
  status?: GQL.ActionProposalStatus;
  type?: GQL.ActionProposalType;
}): string {
  return JSON.stringify([
    filters.userId ?? "",
    filters.shopId ?? "",
    filters.businessDeveloperId ?? "",
    filters.status ?? "ALL",
    filters.type ?? "ALL",
  ]);
}

export function emptyAffiliateProposalPageBuffer(queryKey: string): AffiliateProposalPageBuffer {
  return {
    queryKey,
    items: [],
    nextCursor: null,
    hasMore: false,
  };
}

export function replaceAffiliateProposalPageBuffer(
  queryKey: string,
  page: AffiliateActionProposalPageData["affiliateActionProposalPage"],
): AffiliateProposalPageBuffer {
  return {
    queryKey,
    items: page.items,
    nextCursor: page.nextCursor ?? null,
    hasMore: page.hasMore,
  };
}

export function appendAffiliateProposalPageBuffer(
  current: AffiliateProposalPageBuffer,
  queryKey: string,
  page: AffiliateActionProposalPageData["affiliateActionProposalPage"],
): AffiliateProposalPageBuffer {
  if (current.queryKey !== queryKey) return current;
  return {
    queryKey,
    items: mergeAffiliateProposalPage(current.items, page.items),
    nextCursor: page.nextCursor ?? null,
    hasMore: page.hasMore,
  };
}

export function mergeAffiliateProposalPage(
  current: GQL.ActionProposal[],
  incoming: GQL.ActionProposal[],
): GQL.ActionProposal[] {
  return mergeById([...current, ...incoming]);
}

export function sortAffiliateProposalsNewestFirst(
  proposals: GQL.ActionProposal[],
): GQL.ActionProposal[] {
  return [...proposals].sort((left, right) => {
    const createdDifference = proposalTimestamp(right.createdAt) - proposalTimestamp(left.createdAt);
    if (createdDifference !== 0) return createdDifference;
    return right.id.localeCompare(left.id);
  });
}

export type AgentWorkBundle = {
  rootProposalId: string;
  proposal: GQL.ActionProposal;
  revisionHistory: GQL.ActionProposalRevisionSummary[];
};

export function groupAgentWorkBundles(
  proposals: GQL.ActionProposal[],
): AgentWorkBundle[] {
  const bundles = new Map<string, AgentWorkBundle>();
  for (const proposal of proposals) {
    const rootProposalId = proposal.revisionRootProposalId || proposal.id;
    const existing = bundles.get(rootProposalId);
    const historyById = new Map<string, GQL.ActionProposalRevisionSummary>();
    for (const version of [
      ...(existing?.revisionHistory ?? []),
      ...(proposal.revisionHistory ?? []),
    ]) {
      historyById.set(version.id, version);
    }
    const current = !existing || proposal.revisionNumber > existing.proposal.revisionNumber
      ? proposal
      : existing.proposal;
    bundles.set(rootProposalId, {
      rootProposalId,
      proposal: current,
      revisionHistory: [...historyById.values()].sort((left, right) =>
        left.revisionNumber - right.revisionNumber ||
        Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    });
  }
  return [...bundles.values()].sort((left, right) =>
    Date.parse(right.proposal.createdAt) - Date.parse(left.proposal.createdAt));
}

function proposalTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function applyAffiliateProposalChange(
  current: GQL.ActionProposal[],
  proposal: GQL.ActionProposal,
  filters: {
    status?: GQL.ActionProposalStatus;
    type?: GQL.ActionProposalType;
    shopId?: string;
    businessDeveloperId?: string;
  },
): GQL.ActionProposal[] {
  const existingIndex = current.findIndex((candidate) => candidate.id === proposal.id);
  const targetsShop = !filters.shopId || (
    // Honest per-shop membership: the proposal's own acted-on shop set. The
    // steps and relationship clauses keep transitional coverage for change
    // payloads that do not yet carry shopIds (Desktop SSE mirror).
    (proposal.shopIds ?? []).includes(filters.shopId)
    || proposal.steps.some((step) => step.shopId === filters.shopId)
    || proposal.creatorRelationship?.shopStates.some((state) => state.shopId === filters.shopId)
  );
  const hasBusinessDeveloperSnapshot = proposal.businessDeveloperIdSnapshot != null;
  const targetsBusinessDeveloper = !filters.businessDeveloperId
    || proposal.businessDeveloperIdSnapshot === filters.businessDeveloperId
    || (existingIndex >= 0 && !hasBusinessDeveloperSnapshot);
  const matches = (
    (!filters.status || proposal.status === filters.status)
    && (!filters.type || proposal.type === filters.type)
    && targetsBusinessDeveloper
    && (targetsShop || existingIndex >= 0)
  );
  if (!matches) {
    return existingIndex < 0
      ? current
      : current.filter((candidate) => candidate.id !== proposal.id);
  }
  if (existingIndex < 0) return [proposal, ...current];
  return [proposal, ...current.filter((candidate) => candidate.id !== proposal.id)];
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
  const [selectedBusinessDeveloperId, setSelectedBusinessDeveloperId] = useState("");
  const [agentWorkspaceView, setAgentWorkspaceView] = useState<AgentWorkspaceView>("PENDING");
  const [proposalFilter, setProposalFilter] = useState<ProposalFilter>("ALL");
  const [proposalTypeFilter, setProposalTypeFilter] = useState<ProposalTypeFilter>("ALL");
  const [attentionSearch, setAttentionSearch] = useState("");
  const [selectedAgentWorkBundle, setSelectedAgentWorkBundle] = useState<AgentWorkBundle | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<CreatorRelationshipDetailItem | null>(null);
  const [loadingMoreProposalQueryKey, setLoadingMoreProposalQueryKey] = useState<string | null>(null);
  const proposalLoadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user) {
      entityStore.fetchShops().catch(() => {});
    }
  }, [entityStore, user]);

  const {
    data: businessDeveloperData,
    loading: businessDevelopersLoading,
  } = useQuery<{ affiliateBusinessDevelopers: GQL.AffiliateBusinessDeveloper[] }>(
    AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
    {
      variables: { includeArchived: false },
      fetchPolicy: "cache-and-network",
      skip: !user,
    },
  );

  useEffect(() => {
    if (businessDeveloperData) {
      entityStore.affiliateWorkspace.replaceAffiliateBusinessDevelopers(
        businessDeveloperData.affiliateBusinessDevelopers,
      );
    }
  }, [businessDeveloperData, entityStore.affiliateWorkspace]);

  const shopOptions = [
    { value: "", label: t("ecommerce.affiliateWorkspace.allShops") },
    ...shops
      .filter((shop) => shop.services?.affiliateService?.enabled)
      .map((shop) => ({
        value: shop.id,
        label: shop.alias || shop.shopName || shop.platformShopId || shop.id,
      })),
  ];
  const businessDeveloperOptions = [
    { value: "", label: t("ecommerce.affiliateWorkspace.allBusinessDevelopers") },
    ...[...(businessDeveloperData?.affiliateBusinessDevelopers ?? [])]
      .filter((developer) => !developer.archivedAt)
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map((developer) => ({
        value: developer.id,
        label: developer.displayName,
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
    if (agentWorkspaceView === "PENDING") return GQL.ActionProposalStatus.Pending;
    return proposalFilter === "ALL" ? undefined : proposalFilter;
  }, [agentWorkspaceView, proposalFilter]);
  const proposalType = useMemo(() => {
    return proposalTypeFilter === "ALL" ? undefined : proposalTypeFilter;
  }, [proposalTypeFilter]);
  const proposalQueryKey = affiliateProposalPageQueryKey({
    userId: user?.userId,
    shopId: selectedShopId,
    businessDeveloperId: selectedBusinessDeveloperId,
    status: proposalStatus,
    type: proposalType,
  });
  const activeProposalQueryKeyRef = useRef(proposalQueryKey);
  activeProposalQueryKeyRef.current = proposalQueryKey;
  const [proposalPageBuffer, setProposalPageBuffer] = useState<AffiliateProposalPageBuffer>(() =>
    emptyAffiliateProposalPageBuffer(proposalQueryKey));
  const activeProposalPageBuffer = proposalPageBuffer.queryKey === proposalQueryKey
    ? proposalPageBuffer
    : emptyAffiliateProposalPageBuffer(proposalQueryKey);
  const loadedProposals = activeProposalPageBuffer.items;
  const proposalCursor = activeProposalPageBuffer.nextCursor;
  const hasMoreProposals = activeProposalPageBuffer.hasMore;
  const loadingMoreProposals = loadingMoreProposalQueryKey === proposalQueryKey;

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
        businessDeveloperId: selectedBusinessDeveloperId || null,
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

  const replaceProposalPage = useCallback((
    queryKey: string,
    page: AffiliateActionProposalPageData["affiliateActionProposalPage"],
  ) => {
    if (activeProposalQueryKeyRef.current !== queryKey) return;
    setProposalPageBuffer(replaceAffiliateProposalPageBuffer(queryKey, page));
    for (const proposal of page.items) {
      entityStore.affiliateWorkspace.upsertAffiliateActionProposal(proposal);
    }
  }, [entityStore.affiliateWorkspace]);

  useEffect(() => {
    const page = proposalData?.affiliateActionProposalPage as
      | AffiliateActionProposalPageData["affiliateActionProposalPage"]
      | undefined;
    if (!page) return;
    replaceProposalPage(proposalQueryKey, page);
  }, [proposalData?.affiliateActionProposalPage, proposalQueryKey, proposalsLoading, replaceProposalPage]);

  const loadMoreProposals = useCallback(async () => {
    if (!proposalCursor || !hasMoreProposals || loadingMoreProposals) return;
    const requestQueryKey = proposalQueryKey;
    setLoadingMoreProposalQueryKey(requestQueryKey);
    try {
      const result = await fetchMoreProposals({
        variables: {
          input: {
            shopId: selectedShopId || null,
            businessDeveloperId: selectedBusinessDeveloperId || null,
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
      if (!page || activeProposalQueryKeyRef.current !== requestQueryKey) return;
      setProposalPageBuffer((current) =>
        appendAffiliateProposalPageBuffer(current, requestQueryKey, page));
      for (const proposal of page.items) {
        entityStore.affiliateWorkspace.upsertAffiliateActionProposal(proposal);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    } finally {
      setLoadingMoreProposalQueryKey((current) => current === requestQueryKey ? null : current);
    }
  }, [
    entityStore.affiliateWorkspace,
    fetchMoreProposals,
    hasMoreProposals,
    loadingMoreProposals,
    proposalCursor,
    proposalQueryKey,
    proposalStatus,
    proposalType,
    selectedBusinessDeveloperId,
    selectedShopId,
    showToast,
    t,
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
      setProposalPageBuffer((current) => current.queryKey !== proposalQueryKey
        ? current
        : {
            ...current,
            items: applyAffiliateProposalChange(current.items, proposal, {
              shopId: selectedShopId || undefined,
              businessDeveloperId: selectedBusinessDeveloperId || undefined,
              status: proposalStatus,
              type: proposalType,
            }),
          });
    });
    return unsubscribeProposal;
  }, [
    entityStore.affiliateWorkspace,
    proposalQueryKey,
    proposalStatus,
    proposalType,
    selectedBusinessDeveloperId,
    selectedShopId,
  ]);

  const proposalItemsFromQuery = loadedProposals.map((proposal) =>
    hydrateAffiliateProposalProjection(
      proposalProjectionSnapshot(entityStore.affiliateWorkspace, proposal.id) ?? { proposal },
      proposal,
    ),
  );
  const visibleProposalItems = sortAffiliateProposalsNewestFirst(filterActionProposals(
    proposalItemsFromQuery
      .filter((proposal) => !proposalType || proposal.type === proposalType),
    attentionSearch,
    shopLabel,
  ));
  const visibleAgentWorkBundles = groupAgentWorkBundles(visibleProposalItems);

  async function decideProposal(
    proposal: GQL.ActionProposal,
    status: GQL.ActionProposalStatus,
    note?: string,
  ): Promise<boolean> {
    let optimisticApplied = false;
    const decisionFilters = {
      shopId: selectedShopId || undefined,
      businessDeveloperId: selectedBusinessDeveloperId || undefined,
      status: proposalStatus,
      type: proposalType,
    };
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
          : proposalSampleDecisionOverrideTarget(proposal) != null
            ? t("ecommerce.affiliateWorkspace.sampleDecisionBundle.overrideNote")
            : t("ecommerce.shopDrawer.affiliate.proposalRejectedNote")
      );
      const decidedAt = new Date().toISOString();
      const optimisticProposal = {
        ...proposal,
        status,
        updatedAt: decidedAt,
      } as GQL.ActionProposal;
      setProposalPageBuffer((current) => current.queryKey !== proposalQueryKey
        ? current
        : {
            ...current,
            items: applyAffiliateProposalChange(current.items, optimisticProposal, decisionFilters),
          });
      optimisticApplied = true;
      const result = await decideActionProposal({
        variables: {
          input: {
            id: proposal.id,
            creatorRelationshipId,
            status,
            decision: {
              decidedAt,
              note: decisionNote,
            },
          },
        },
      });
      const updatedProposal = result.data?.decideActionProposal;
      if (updatedProposal) {
        entityStore.affiliateWorkspace.upsertAffiliateActionProposal(updatedProposal);
        setSelectedAgentWorkBundle((current) => {
          if (!current) return current;
          const updatedRootProposalId = updatedProposal.revisionRootProposalId || updatedProposal.id;
          if (current.rootProposalId !== updatedRootProposalId) return current;
          return {
            ...current,
            proposal: updatedProposal,
            revisionHistory: updatedProposal.revisionHistory ?? current.revisionHistory,
          };
        });
        setProposalPageBuffer((current) => current.queryKey !== proposalQueryKey
          ? current
          : {
              ...current,
              items: applyAffiliateProposalChange(current.items, updatedProposal, decisionFilters),
            });
      }
      showToast(
        status === GQL.ActionProposalStatus.Approved
          ? t("ecommerce.shopDrawer.affiliate.proposalApproveSuccess")
          : status === GQL.ActionProposalStatus.RevisionRequested
            ? t("ecommerce.shopDrawer.affiliate.proposalRevisionRequestSuccess")
          : proposalSampleDecisionOverrideTarget(proposal) != null
            ? t("ecommerce.affiliateWorkspace.sampleDecisionBundle.overrideSuccess")
          : t("ecommerce.shopDrawer.affiliate.proposalRejectSuccess"),
        "success",
      );
      return true;
    } catch (err) {
      if (optimisticApplied) {
        setProposalPageBuffer((current) => current.queryKey !== proposalQueryKey
          ? current
          : {
              ...current,
              items: applyAffiliateProposalChange(current.items, proposal, decisionFilters),
            });
      }
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
      return false;
    }
  }

  async function refetchActive() {
    const requestQueryKey = proposalQueryKey;
    try {
      const result = await refetchProposals({
        input: {
          shopId: selectedShopId || null,
          businessDeveloperId: selectedBusinessDeveloperId || null,
          status: proposalStatus,
          type: proposalType,
          limit: AFFILIATE_PROPOSAL_PAGE_SIZE,
          cursor: null,
        },
      });
      const page = result.data?.affiliateActionProposalPage as
        | AffiliateActionProposalPageData["affiliateActionProposalPage"]
        | undefined;
      if (page) replaceProposalPage(requestQueryKey, page);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  function shopLabel(shopId: string): string {
    const shop = shops.find((candidate) => candidate.id === shopId);
    return shop?.alias || shop?.shopName || t("ecommerce.affiliateWorkspace.sampleDecisionBundle.unknownShop");
  }

  function openCreatorDetail(proposal: GQL.ActionProposal): void {
    const detailItem = relationshipWorkItemFromProposal(
      proposal,
      entityStore.affiliateWorkspace,
    );
    const detail = detailItem
      ? relationshipDetailFromWorkItem(detailItem)
      : proposal.creatorProfile
        ? relationshipDetailFromProfile(proposal.creatorProfile)
        : null;
    if (!detail) return;
    setSelectedRelationship(detail);
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
      <div
        className="ecommerce-page-header affiliate-workbench-header"
        data-tutorial-id="affiliate-attention-header"
      >
        <div>
          <h1>{t("ecommerce.affiliateWorkspace.pageTitles.NEEDS_ATTENTION")}</h1>
          <p className="ecommerce-page-subtitle">
            {t("ecommerce.affiliateWorkspace.pageSubtitles.NEEDS_ATTENTION")}
          </p>
        </div>
        <div
          className="affiliate-workbench-controls"
          data-tutorial-id="affiliate-attention-controls"
        >
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
        <div className="affiliate-workbench-panel-head affiliate-attention-panel-head affiliate-agent-workspace-controls">
          <div
            className="affiliate-agent-workspace-view-control"
            data-tutorial-id="affiliate-attention-scope"
          >
            <span className="affiliate-agent-workspace-view-label">
              {t("ecommerce.affiliateWorkspace.agentWorkspaceViews.label")}
            </span>
            <button
              type="button"
              aria-pressed={agentWorkspaceView === "PENDING"}
              className={`affiliate-agent-workspace-scope-toggle${agentWorkspaceView === "PENDING" ? " affiliate-agent-workspace-scope-toggle-active" : ""}`}
              onClick={() => setAgentWorkspaceView((view) => view === "PENDING" ? "ALL" : "PENDING")}
            >
              <span className="affiliate-agent-workspace-scope-check" aria-hidden="true" />
              <span>{t("ecommerce.affiliateWorkspace.agentWorkspaceViews.PENDING")}</span>
            </button>
          </div>
          <div
            className={`affiliate-attention-toolbar${agentWorkspaceView === "PENDING" ? " affiliate-attention-toolbar-compact" : ""}`}
            data-tutorial-id="affiliate-attention-filters"
          >
            <label className="affiliate-filter-field">
              <span>{t("ecommerce.affiliateWorkspace.businessDeveloperFilter")}</span>
              <Select
                value={selectedBusinessDeveloperId}
                onChange={setSelectedBusinessDeveloperId}
                options={businessDeveloperOptions}
                className="affiliate-status-select"
                ariaLabel={t("ecommerce.affiliateWorkspace.businessDeveloperFilter")}
                searchable
                searchPlaceholder={t("ecommerce.affiliateWorkspace.businessDeveloperSearchPlaceholder")}
                disabled={businessDevelopersLoading && businessDeveloperOptions.length === 1}
              />
            </label>
            {agentWorkspaceView === "ALL" ? (
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
            ) : null}
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
          {proposalsLoading && visibleAgentWorkBundles.length === 0 ? (
            <div data-tutorial-id="affiliate-attention-queue">
              <AffiliateLoadingState />
            </div>
          ) : visibleAgentWorkBundles.length === 0 ? (
            <div
              className="affiliate-proposal-empty"
              data-tutorial-id="affiliate-attention-queue"
            >
              {agentWorkspaceView === "PENDING"
                ? t("ecommerce.affiliateWorkspace.emptyApprovals")
                : t("ecommerce.affiliateWorkspace.emptyProposalEntities")}
            </div>
          ) : (
            <AgentWorkBundleTable
              bundles={visibleAgentWorkBundles}
              shopLabelForId={shopLabel}
              onOpen={setSelectedAgentWorkBundle}
              onOpenCreator={(bundle) => openCreatorDetail(bundle.proposal)}
            />
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

      {selectedAgentWorkBundle ? (
        <AgentWorkBundleDetailModal
          bundle={selectedAgentWorkBundle}
          shopLabelForId={shopLabel}
          decidingProposal={decidingProposal}
          affiliateWorkspace={entityStore.affiliateWorkspace}
          covered={Boolean(selectedRelationship)}
          onClose={() => setSelectedAgentWorkBundle(null)}
          onOpenCreator={() => openCreatorDetail(selectedAgentWorkBundle.proposal)}
          onApprove={(item) => decideProposal(item, GQL.ActionProposalStatus.Approved)}
          onReject={(item) => decideProposal(item, GQL.ActionProposalStatus.Rejected)}
          onRequestRevision={(item, revisionNote) =>
            decideProposal(item, GQL.ActionProposalStatus.RevisionRequested, revisionNote)}
        />
      ) : null}

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
              <div className="affiliate-intelligence-evidence-card data-card-hover affiliate-intelligence-evidence-card-probability">
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
              <div className="affiliate-intelligence-evidence-card data-card-hover affiliate-intelligence-evidence-card-range">
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
              <div className="affiliate-intelligence-evidence-card data-card-hover affiliate-intelligence-evidence-card-foundation">
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
    <section className="affiliate-intelligence-distribution-card data-card-hover">
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
  const displayShopIds = actionProposalDisplayShopIds(proposal);
  const values = [
    proposal.id,
    ...displayShopIds.flatMap((shopId) => [shopId, shopLabel(shopId)]),
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

function actionProposalDisplayShopIds(proposal: GQL.ActionProposal): string[] {
  const actedOnShopIds = [
    ...(proposal.shopIds ?? []),
    ...(proposal.steps ?? []).map((step) => step.shopId),
  ].filter((shopId): shopId is string => Boolean(shopId));
  if (actedOnShopIds.length > 0) return [...new Set(actedOnShopIds)];

  const relationshipShopIds = (proposal.creatorRelationship?.shopStates ?? [])
    .map((state) => state.shopId)
    .filter(Boolean);
  if (relationshipShopIds.length > 0) return [...new Set(relationshipShopIds)];

  // FROZEN-LEGACY (focusShopId): only proposals from before shopIds/steps need
  // the old single-shop anchor as a display fallback.
  return proposal.focusShopId ? [proposal.focusShopId] : [];
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
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const affiliateShops = entityStore.shops.filter((shop) => shop.services?.affiliateService?.enabled);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedManualTagIds, setSelectedManualTagIds] = useState<string[]>([]);
  const [manualTagMatchMode, setManualTagMatchMode] = useState<GQL.TagMatchMode>(GQL.TagMatchMode.Any);
  const [selectedSampleTiers, setSelectedSampleTiers] = useState<GQL.CreatorSampleTier[]>([]);
  const [selectedShopSampleTiers, setSelectedShopSampleTiers] = useState<GQL.CreatorSampleTier[]>([]);
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [debouncedCreatorSearch, setDebouncedCreatorSearch] = useState("");
  const [creatorPage, setCreatorPage] = useState(1);
  const [creatorPageInput, setCreatorPageInput] = useState("1");
  const [selectedRelationship, setSelectedRelationship] = useState<CreatorRelationshipDetailItem | null>(null);

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

  // Manual tags are seller-scoped, so this catalog takes no shop and no campaign
  // input. The previous read went through the policy-context query, which never
  // returned a top-level `creatorTags` field, leaving the dropdown permanently empty.
  const { data: manualTagCatalogData } = useQuery<
    { creatorManualTags: GQL.CreatorManualTag[] },
    { input: GQL.ReadCreatorManualTagsInput }
  >(CREATOR_MANUAL_TAGS_QUERY, {
    variables: { input: {} },
    fetchPolicy: "cache-and-network",
    skip: !user,
  });
  const manualTagCatalog = manualTagCatalogData?.creatorManualTags ?? [];

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

  const manualTagCatalogSignature = manualTagCatalog.map((tag) => tag.id).join(",");
  useEffect(() => {
    // A deleted or renamed-away catalog row must not keep filtering the list.
    const available = new Set(manualTagCatalogSignature ? manualTagCatalogSignature.split(",") : []);
    setSelectedManualTagIds((current) => {
      const next = current.filter((tagId) => available.has(tagId));
      return next.length === current.length ? current : next;
    });
  }, [manualTagCatalogSignature]);

  useEffect(() => {
    // The per-shop tier filter only exists while a shop is selected.
    if (!selectedShopId) setSelectedShopSampleTiers([]);
  }, [selectedShopId]);

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
        manualTagIds: selectedManualTagIds.length ? selectedManualTagIds : undefined,
        manualTagMatchMode: selectedManualTagIds.length ? manualTagMatchMode : undefined,
        sampleTiers: selectedSampleTiers.length ? selectedSampleTiers : undefined,
        shopSampleTiers: selectedShopId && selectedShopSampleTiers.length
          ? selectedShopSampleTiers
          : undefined,
        needsAttentionOnly,
        search: debouncedCreatorSearch || undefined,
        offset: (creatorPage - 1) * AFFILIATE_CREATORS_PAGE_SIZE,
        limit: AFFILIATE_CREATORS_PAGE_SIZE,
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

  const creatorPageResult = data?.affiliateCreators;
  const creatorItems = creatorPageResult?.items ?? [];
  const [stableCreatorTotalCount, setStableCreatorTotalCount] = useState(0);
  useEffect(() => {
    if (creatorPageResult) setStableCreatorTotalCount(creatorPageResult.totalCount);
  }, [creatorPageResult]);
  const totalCreatorCount = creatorPageResult?.totalCount ?? stableCreatorTotalCount;
  const creatorPageCount = Math.max(1, Math.ceil(totalCreatorCount / AFFILIATE_CREATORS_PAGE_SIZE));
  const creatorPageStart = totalCreatorCount === 0
    ? 0
    : (creatorPage - 1) * AFFILIATE_CREATORS_PAGE_SIZE + 1;
  const creatorPageEnd = Math.min(creatorPage * AFFILIATE_CREATORS_PAGE_SIZE, totalCreatorCount);

  useEffect(() => {
    setCreatorPage(1);
  }, [
    debouncedCreatorSearch,
    manualTagMatchMode,
    needsAttentionOnly,
    selectedManualTagIds,
    selectedSampleTiers,
    selectedShopId,
    selectedShopSampleTiers,
  ]);

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
      <div
        className="ecommerce-page-header affiliate-workbench-header"
        data-tutorial-id="affiliate-creators-header"
      >
        <div>
          <h1>{t("ecommerce.affiliateWorkspace.creatorsTitle")}</h1>
          <p className="ecommerce-page-subtitle">
            {t("ecommerce.affiliateWorkspace.creatorsSubtitle")}
          </p>
        </div>
        <div
          className="affiliate-workbench-controls"
          data-tutorial-id="affiliate-creators-controls"
        >
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
          <div
            className="affiliate-attention-toolbar"
            data-tutorial-id="affiliate-creators-filters"
          >
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

        <AffiliateCreatorFilterGroups
          manualTagCatalog={manualTagCatalog}
          manualTagMatchMode={manualTagMatchMode}
          selectedManualTagIds={selectedManualTagIds}
          selectedSampleTiers={selectedSampleTiers}
          selectedShopSampleTiers={selectedShopSampleTiers}
          shopSelected={Boolean(selectedShopId)}
          onManualTagMatchModeChange={setManualTagMatchMode}
          onSelectedManualTagIdsChange={setSelectedManualTagIds}
          onSelectedSampleTiersChange={setSelectedSampleTiers}
          onSelectedShopSampleTiersChange={setSelectedShopSampleTiers}
        />

        {loading && creatorItems.length === 0 ? (
          <div data-tutorial-id="affiliate-creators-results">
            <AffiliateLoadingState />
          </div>
        ) : creatorItems.length === 0 ? (
          <div
            className="affiliate-proposal-empty"
            data-tutorial-id="affiliate-creators-results"
          >
            {t("ecommerce.affiliateWorkspace.emptyCreators")}
          </div>
        ) : (
          <div className="affiliate-creator-roster">
            {creatorItems.map((item) => (
              <CreatorRelationshipCard
                key={item.creatorId}
                item={item}
                shopLabel={shopLabel}
                onOpenRelationship={(relationship) => setSelectedRelationship(relationship)}
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
  shopLabel,
  onOpenRelationship,
}: {
  item: AffiliateCreatorManagementItem;
  shopLabel: (shopId: string) => string;
  onOpenRelationship: (item: CreatorRelationshipDetailItem) => void;
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
  const manualTags = item.creatorRelation?.manualTags ?? [];
  const visibleManualTags = manualTags.slice(0, CREATOR_MANUAL_TAG_CHIP_LIMIT);
  const hiddenManualTagCount = manualTags.length - visibleManualTags.length;
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
      data-tutorial-id="affiliate-creators-results"
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
            {visibleManualTags.length ? (
              <>
                {visibleManualTags.map((tag) => (
                  <span className="affiliate-creator-tag" key={tag.id}>
                    <span>{tag.name}</span>
                  </span>
                ))}
                {hiddenManualTagCount > 0 ? (
                  <span
                    className="affiliate-creator-tag affiliate-creator-tag-overflow"
                    title={manualTags.map((tag) => tag.name).join(", ")}
                  >
                    <span>+{hiddenManualTagCount}</span>
                  </span>
                ) : null}
              </>
            ) : (
              <span className="affiliate-creator-tag-empty">
                {t("ecommerce.affiliateWorkspace.manualTagsEmpty")}
              </span>
            )}
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
          <span>{t("ecommerce.affiliateWorkspace.sampleTierColumnLabel")}</span>
          <strong>{creatorSampleTierDisplay(t, item.creatorRelation?.highestSampleTier)}</strong>
          <small>{t("ecommerce.affiliateWorkspace.sampleTierColumnHint")}</small>
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
  const targetCommissionRates = collaboration.products
    .filter((product) => !["DELETED", "DELETING"].includes(product.collaborationStatus?.toUpperCase() ?? ""))
    .map((product) => affiliateBpsPercentValue(product.commission?.rate));
  const targetAdsCommissionRates = collaboration.products
    .filter((product) => !["DELETED", "DELETING"].includes(product.collaborationStatus?.toUpperCase() ?? ""))
    .map((product) => affiliateBpsPercentValue(product.commission?.shopAdsCommissionRate));
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
      data-tutorial-id="affiliate-history-results"
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
            label={t("ecommerce.affiliateWorkspace.collaborationOperations.creators")}
            value={formatInteger(creatorCount)}
          />
          <RelationshipMetric
            label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")}
            value={formatInteger(productCount)}
          />
          {collaboration.type === GQL.AffiliateCollaborationType.Target ? (
            <>
              <RelationshipMetric
                label={t("ecommerce.affiliateWorkspace.collaborationOperations.commissionPercent")}
                value={affiliateCommissionPercentRange(targetCommissionRates)}
              />
              <RelationshipMetric
                label={t("ecommerce.affiliateWorkspace.collaborationOperations.adsCommissionPercent")}
                value={affiliateCommissionPercentRange(targetAdsCommissionRates)}
              />
            </>
          ) : (
            <RelationshipMetric
              label={t("ecommerce.affiliateWorkspace.collaborationOperations.commissionRate")}
              value={collaboration.commissionRate == null ? "—" : formatPercent(collaboration.commissionRate)}
            />
          )}
        </div>
      </div>
      <div className="affiliate-collaboration-card-footer">
        <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.detailsSummary")}</span>
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
  onChanged,
}: {
  collaborationId: string;
  shopLabel: (shopId: string) => string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const { data, loading, error, refetch } = useQuery<
    AffiliateCollaborationDetailQueryData,
    { input: { id: string } }
  >(AFFILIATE_COLLABORATION_DETAIL_QUERY, {
    variables: { input: { id: collaborationId } },
    fetchPolicy: "cache-and-network",
  });
  const detail = data?.affiliateCollaborationDetail;
  const collaboration = detail?.collaboration;
  const [removeOpen, removeOpenState] = useMutation<
    { removeAffiliateOpenCollaboration: GQL.RemoveAffiliateOpenCollaborationPayload },
    { input: GQL.RemoveAffiliateOpenCollaborationInput }
  >(REMOVE_AFFILIATE_OPEN_COLLABORATION_MUTATION);
  const [removeTarget, removeTargetState] = useMutation<
    { removeAffiliateTargetCollaboration: GQL.RemoveAffiliateTargetCollaborationPayload },
    { input: GQL.RemoveAffiliateTargetCollaborationInput }
  >(REMOVE_AFFILIATE_TARGET_COLLABORATION_MUTATION);
  const removing = removeOpenState.loading || removeTargetState.loading;

  async function refreshAfterChange(): Promise<void> {
    await refetch();
    onChanged();
  }

  async function removeCollaboration(): Promise<void> {
    if (!collaboration || removing) return;
    try {
      const input = { shopId: collaboration.shopId, collaborationId: collaboration.id };
      if (collaboration.type === GQL.AffiliateCollaborationType.Open) {
        await removeOpen({ variables: { input } });
      } else {
        await removeTarget({ variables: { input } });
      }
      showToast(t("ecommerce.affiliateWorkspace.collaborationOperations.removeSuccess"), "success");
      setRemoveConfirmOpen(false);
      onChanged();
      onClose();
    } catch (mutationError) {
      showToast(
        mutationError instanceof Error
          ? mutationError.message
          : t("ecommerce.affiliateWorkspace.collaborationOperations.operationFailed"),
        "error",
      );
    }
  }

  return (
    <>
      <div className="modal-backdrop affiliate-creator-detail-backdrop" role="presentation" onClick={onClose}>
        <div
          className="modal-content affiliate-collaboration-modal affiliate-platform-collaboration-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t("ecommerce.affiliateWorkspace.collaborationOperations.detailsTitle")}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header affiliate-platform-collaboration-modal-header">
            <div className="affiliate-collaboration-modal-title-block">
              <div className="affiliate-platform-collaboration-kicker">
                {t("ecommerce.affiliateWorkspace.collaborationOperations.livePlatformObject")}
              </div>
              <h2>{collaboration?.name || t("ecommerce.affiliateWorkspace.collaborationOperations.detailsTitle")}</h2>
              {collaboration ? (
                <p>
                  <span className={`affiliate-platform-collaboration-type-mark is-${collaboration.type.toLowerCase()}`}>
                    {formatAffiliateEnumLabel(collaboration.type)}
                  </span>
                  <span>{shopLabel(collaboration.shopId)}</span>
                  <PlatformIdCopy value={collaboration.platformCollaborationId} />
                </p>
              ) : null}
            </div>
            <div className="affiliate-platform-collaboration-header-actions">
              {collaboration ? (
                <button
                  className={editing ? "btn btn-secondary" : "btn btn-primary"}
                  type="button"
                  onClick={() => setEditing((value) => !value)}
                >
                  {editing
                    ? t("common.cancel")
                    : t("ecommerce.affiliateWorkspace.collaborationOperations.editConfiguration")}
                </button>
              ) : null}
              <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t("common.close")}>×</button>
            </div>
          </div>
          <div className="affiliate-platform-collaboration-detail-body">
            {error ? (
              <AffiliateQueryErrorState error={error} onRetry={() => void refetch()} />
            ) : loading && !detail ? (
              <AffiliateLoadingState />
            ) : collaboration && detail ? (
              <>
                <section className="affiliate-platform-collaboration-hero">
                  <div>
                    <span className={`affiliate-platform-collaboration-status is-${collaboration.status.toLowerCase()}`}>
                      {formatAffiliateEnumLabel(collaboration.status)}
                    </span>
                    <h3>
                      {collaboration.type === GQL.AffiliateCollaborationType.Open
                        ? t("ecommerce.affiliateWorkspace.collaborationOperations.openProductProgram")
                        : t("ecommerce.affiliateWorkspace.collaborationOperations.targetInvitation")}
                    </h3>
                    <p>
                      {collaboration.type === GQL.AffiliateCollaborationType.Open
                        ? t("ecommerce.affiliateWorkspace.collaborationOperations.openProductProgramHint")
                        : t("ecommerce.affiliateWorkspace.collaborationOperations.targetInvitationHint")}
                    </p>
                  </div>
                  <div className="affiliate-platform-collaboration-detail-summary">
                    <RelationshipMetric label={t("ecommerce.affiliateWorkspace.collaborationOperations.creators")} value={formatInteger(detail.creators.length || collaboration.creatorOpenIds.length)} />
                    <RelationshipMetric label={t("ecommerce.affiliateWorkspace.collaborationOperations.sampleApplications")} value={formatInteger(detail.sampleApplications.length)} />
                    <RelationshipMetric label={t("ecommerce.affiliateWorkspace.labels.relatedProduct")} value={formatInteger(collaboration.productIds.length)} />
                    <RelationshipMetric label={t("ecommerce.affiliateWorkspace.collaborationOperations.lastObserved")} value={formatProposalTime(collaboration.lastObservedAt)} />
                  </div>
                </section>

                {editing ? (
                  collaboration.type === GQL.AffiliateCollaborationType.Open ? (
                    <AffiliateOpenCollaborationEditor
                      collaboration={collaboration}
                      onSaved={async () => {
                        setEditing(false);
                        await refreshAfterChange();
                      }}
                    />
                  ) : (
                    <AffiliateTargetCollaborationEditor
                      collaboration={collaboration}
                      onSaved={async () => {
                        setEditing(false);
                        await refreshAfterChange();
                      }}
                    />
                  )
                ) : (
                  <AffiliateCollaborationConfigurationSnapshot collaboration={collaboration} />
                )}

                <section className="affiliate-platform-collaboration-linked-section">
                  <div className="affiliate-platform-collaboration-section-heading">
                    <div>
                      <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.linkedBusinessData")}</span>
                      <h3>{t("ecommerce.affiliateWorkspace.labels.relatedProduct")}</h3>
                    </div>
                    <small>{formatInteger(collaboration.productIds.length)}</small>
                  </div>
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

                <section className="affiliate-platform-collaboration-linked-section">
                  <div className="affiliate-platform-collaboration-section-heading">
                    <div>
                      <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.linkedBusinessData")}</span>
                      <h3>{t("ecommerce.affiliateWorkspace.collaborationOperations.creators")}</h3>
                    </div>
                    <small>{formatInteger(detail.creators.length)}</small>
                  </div>
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
                        ? t("ecommerce.affiliateWorkspace.collaborationOperations.noExpandedOpenCreators")
                        : t("ecommerce.affiliateWorkspace.collaborationOperations.noCreators")}
                    </div>
                  )}
                </section>

                <section className="affiliate-platform-collaboration-linked-section">
                  <div className="affiliate-platform-collaboration-section-heading">
                    <div>
                      <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.linkedBusinessData")}</span>
                      <h3>{t("ecommerce.affiliateWorkspace.collaborationOperations.samplesAndFulfillment")}</h3>
                    </div>
                    <small>{formatInteger(detail.sampleApplications.length)}</small>
                  </div>
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
                      {t("ecommerce.affiliateWorkspace.collaborationOperations.noSampleApplications")}
                    </div>
                  )}
                </section>

                <section className="affiliate-platform-collaboration-danger-zone">
                  <div>
                    <strong>{t("ecommerce.affiliateWorkspace.collaborationOperations.stopCollaboration")}</strong>
                    <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.stopCollaborationHint")}</span>
                  </div>
                  <button className="btn btn-danger" type="button" onClick={() => setRemoveConfirmOpen(true)}>
                    {t("ecommerce.affiliateWorkspace.collaborationOperations.removeFromPlatform")}
                  </button>
                </section>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={removeConfirmOpen}
        onCancel={() => setRemoveConfirmOpen(false)}
        onConfirm={() => void removeCollaboration()}
        title={t("ecommerce.affiliateWorkspace.collaborationOperations.removeConfirmTitle")}
        message={t("ecommerce.affiliateWorkspace.collaborationOperations.removeConfirmMessage", {
          type: collaboration ? formatAffiliateEnumLabel(collaboration.type) : "",
        })}
        confirmLabel={removing
          ? t("common.loading")
          : t("ecommerce.affiliateWorkspace.collaborationOperations.removeConfirmAction")}
        cancelLabel={t("common.cancel")}
      />
    </>
  );
}

type AffiliateCollaborationShopOption = { value: string; label: string };

type AffiliateTargetProductDraft = {
  productId: string;
  commissionPercent: string;
  adsCommissionPercent: string;
};

export function affiliateCommissionPercentToBps(value: string): number {
  const percent = Number(value);
  const bps = Math.round(percent * 100);
  if (!Number.isFinite(percent) || bps < 100 || bps > 8000) {
    throw new Error("Commission must be between 1% and 80%");
  }
  return bps;
}

export function affiliateDelimitedIdentifiers(value: string): string[] {
  return [...new Set(value.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean))];
}

function optionalAffiliateNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function affiliateBpsPercentValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value / 100);
}

export function affiliateCommissionPercentRange(values: readonly string[]): string {
  const rates = [...new Set(values.flatMap((value) => {
    const trimmed = value.trim();
    if (!trimmed) return [];
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? [parsed] : [];
  }))].sort((left, right) => left - right);
  if (rates.length === 0) return "—";
  const first = formatPercent(rates[0]! / 100);
  const last = formatPercent(rates[rates.length - 1]! / 100);
  return first === last ? first : `${first}–${last}`;
}

function affiliateDateTimeLocalValue(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function affiliateDateTimeLocalToIso(value: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error("A valid date and time is required");
  return date.toISOString();
}

function affiliateDateTimeLocalToUnixSeconds(value: string): number {
  return Math.floor(new Date(affiliateDateTimeLocalToIso(value)).getTime() / 1000);
}

function targetProductDrafts(collaboration: GQL.AffiliateCollaboration): AffiliateTargetProductDraft[] {
  const activeProducts = collaboration.products.filter((product) => {
    const status = product.collaborationStatus?.toUpperCase();
    return product.productId && status !== "DELETED" && status !== "DELETING";
  });
  if (activeProducts.length > 0) {
    return activeProducts.map((product) => ({
      productId: product.productId ?? product.id ?? "",
      commissionPercent: affiliateBpsPercentValue(product.commission?.rate),
      adsCommissionPercent: affiliateBpsPercentValue(product.commission?.shopAdsCommissionRate),
    }));
  }
  return collaboration.productIds.map((productId) => ({
    productId,
    commissionPercent: "",
    adsCommissionPercent: "",
  }));
}

function collaborationSampleRuleIsEnabled(rule: GQL.EcomOpenCollaborationSampleRule | null | undefined): boolean {
  if (!rule) return false;
  return !["DEACTIVATED", "DISABLED", "INACTIVE"].includes(rule.status?.toUpperCase() ?? "");
}

function AffiliateCollaborationConfigurationSnapshot({
  collaboration,
}: {
  collaboration: GQL.AffiliateCollaboration;
}) {
  const { t } = useTranslation();
  const sampleRule = collaboration.openSampleRule;
  const facts = collaboration.type === GQL.AffiliateCollaborationType.Open
    ? [
        {
          label: t("ecommerce.affiliateWorkspace.collaborationOperations.commissionRate"),
          value: collaboration.commissionRate == null ? "—" : formatPercent(collaboration.commissionRate),
        },
        {
          label: t("ecommerce.affiliateWorkspace.collaborationOperations.sampleRule"),
          value: collaborationSampleRuleIsEnabled(sampleRule)
            ? t("ecommerce.affiliateWorkspace.collaborationOperations.enabled")
            : t("ecommerce.affiliateWorkspace.collaborationOperations.disabled"),
        },
        {
          label: t("ecommerce.affiliateWorkspace.collaborationOperations.sampleQuota"),
          value: sampleRule?.sampleQuota == null ? "—" : formatInteger(sampleRule.sampleQuota),
        },
        {
          label: t("ecommerce.affiliateWorkspace.collaborationOperations.sampleWindow"),
          value: sampleRule?.isSampleTimeUnlimited
            ? t("ecommerce.affiliateWorkspace.collaborationOperations.unlimited")
            : sampleRule?.startTime && sampleRule.endTime
              ? `${formatProposalTime(new Date(sampleRule.startTime * 1000).toISOString())} – ${formatProposalTime(new Date(sampleRule.endTime * 1000).toISOString())}`
              : "—",
        },
      ]
    : [
        {
          label: t("ecommerce.affiliateWorkspace.collaborationOperations.name"),
          value: collaboration.name || "—",
        },
        {
          label: t("ecommerce.affiliateWorkspace.collaborationOperations.endTime"),
          value: collaboration.endTime ? formatProposalTime(collaboration.endTime) : "—",
        },
        {
          label: t("ecommerce.affiliateWorkspace.collaborationOperations.freeSamples"),
          value: collaboration.freeSampleRule?.hasFreeSample
            ? t("ecommerce.affiliateWorkspace.collaborationOperations.enabled")
            : t("ecommerce.affiliateWorkspace.collaborationOperations.disabled"),
        },
        {
          label: t("ecommerce.affiliateWorkspace.collaborationOperations.sellerContact"),
          value: collaboration.sellerContactInfo?.email || "—",
        },
      ];

  return (
    <section className="affiliate-platform-collaboration-config-snapshot">
      <div className="affiliate-platform-collaboration-section-heading">
        <div>
          <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.platformConfiguration")}</span>
          <h3>{t("ecommerce.affiliateWorkspace.collaborationOperations.currentConfiguration")}</h3>
        </div>
        <span className="affiliate-platform-live-indicator">
          <i />{t("ecommerce.affiliateWorkspace.collaborationOperations.syncedProjection")}
        </span>
      </div>
      <div className="affiliate-platform-collaboration-fact-grid">
        {facts.map((fact) => (
          <div className="affiliate-platform-collaboration-fact" key={fact.label}>
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
          </div>
        ))}
      </div>
      {collaboration.type === GQL.AffiliateCollaborationType.Target ? (
        <div className="affiliate-platform-product-commission-snapshot">
          {targetProductDrafts(collaboration).map((product) => (
            <div className="affiliate-platform-product-commission-row" key={product.productId}>
              <span className="input-mono">{product.productId}</span>
              <span>
                {t("ecommerce.affiliateWorkspace.collaborationOperations.commissionPercent")}: {affiliateCommissionPercentRange([product.commissionPercent])}
              </span>
              <span>
                {t("ecommerce.affiliateWorkspace.collaborationOperations.adsCommissionPercent")}: {affiliateCommissionPercentRange([product.adsCommissionPercent])}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {collaboration.type === GQL.AffiliateCollaborationType.Open ? (
        <div className="affiliate-platform-collaboration-guardrail">
          <InfoIcon />
          <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.commissionLockedHint")}</span>
        </div>
      ) : null}
    </section>
  );
}

function AffiliateOpenCollaborationEditor({
  collaboration,
  onSaved,
}: {
  collaboration: GQL.AffiliateCollaboration;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const rule = collaboration.openSampleRule;
  const [enabled, setEnabled] = useState(collaborationSampleRuleIsEnabled(rule));
  const [sampleQuota, setSampleQuota] = useState(rule?.sampleQuota == null ? "" : String(rule.sampleQuota));
  const [unlimited, setUnlimited] = useState(rule?.isSampleTimeUnlimited ?? true);
  const [startTime, setStartTime] = useState(affiliateDateTimeLocalValue(rule?.startTime));
  const [endTime, setEndTime] = useState(affiliateDateTimeLocalValue(rule?.endTime));
  const [minimumFollowerCount, setMinimumFollowerCount] = useState(rule?.thresholds?.minimumFollowerCount == null ? "" : String(rule.thresholds.minimumFollowerCount));
  const [minimumGmv, setMinimumGmv] = useState(rule?.thresholds?.minimumGmv == null ? "" : String(rule.thresholds.minimumGmv));
  const [avgEcVideoViews, setAvgEcVideoViews] = useState(rule?.thresholds?.avgEcVideoViews == null ? "" : String(rule.thresholds.avgEcVideoViews));
  const [categoryIds, setCategoryIds] = useState(rule?.thresholds?.categoryIds?.join(", ") ?? "");
  const [predictedFulfillmentRank, setPredictedFulfillmentRank] = useState(rule?.thresholds?.predictedFulfillmentRank ?? "");
  const [saveRule, saveRuleState] = useMutation<
    { editAffiliateOpenCollaborationSampleRule: GQL.EditAffiliateOpenCollaborationSampleRulePayload },
    { input: GQL.EditAffiliateOpenCollaborationSampleRuleInput }
  >(EDIT_AFFILIATE_OPEN_COLLABORATION_SAMPLE_RULE_MUTATION);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      const input: GQL.EditAffiliateOpenCollaborationSampleRuleInput = {
        shopId: collaboration.shopId,
        collaborationId: collaboration.id,
        activateStatus: enabled
          ? GQL.AffiliateOpenSampleRuleActivation.Activate
          : GQL.AffiliateOpenSampleRuleActivation.Deactivate,
      };
      if (enabled) {
        input.sampleRule = {
          sampleQuota: optionalAffiliateNumber(sampleQuota),
          isSampleTimeUnlimited: unlimited,
          startTime: unlimited ? undefined : affiliateDateTimeLocalToUnixSeconds(startTime),
          endTime: unlimited ? undefined : affiliateDateTimeLocalToUnixSeconds(endTime),
        };
        input.thresholds = {
          minimumFollowerCount: optionalAffiliateNumber(minimumFollowerCount),
          minimumGmv: optionalAffiliateNumber(minimumGmv),
          avgEcVideoViews: optionalAffiliateNumber(avgEcVideoViews),
          categoryIds: categoryIds.trim() ? affiliateDelimitedIdentifiers(categoryIds) : undefined,
          predictedFulfillmentRank: predictedFulfillmentRank.trim() || undefined,
        };
      }
      await saveRule({ variables: { input } });
      showToast(t("ecommerce.affiliateWorkspace.collaborationOperations.saveSuccess"), "success");
      await onSaved();
    } catch (mutationError) {
      showToast(mutationError instanceof Error ? mutationError.message : t("ecommerce.affiliateWorkspace.collaborationOperations.operationFailed"), "error");
    }
  }

  return (
    <form className="affiliate-platform-collaboration-editor" onSubmit={(event) => void submit(event)}>
      <div className="affiliate-platform-collaboration-editor-heading">
        <div>
          <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.platformConfiguration")}</span>
          <h3>{t("ecommerce.affiliateWorkspace.collaborationOperations.editOpenSampleRule")}</h3>
        </div>
        <span className="affiliate-platform-write-badge">{t("ecommerce.affiliateWorkspace.collaborationOperations.writesImmediately")}</span>
      </div>
      <div className="affiliate-platform-collaboration-guardrail">
        <InfoIcon />
        <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.commissionLockedHint")}</span>
      </div>
      <label className="affiliate-platform-toggle-field">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span>
          <strong>{t("ecommerce.affiliateWorkspace.collaborationOperations.enableSampleRule")}</strong>
          <small>{t("ecommerce.affiliateWorkspace.collaborationOperations.enableSampleRuleHint")}</small>
        </span>
      </label>
      {enabled ? (
        <>
          <div className="affiliate-platform-form-grid">
            <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.sampleQuota")}>
              <input className="input-full" type="number" min={0} value={sampleQuota} onChange={(event) => setSampleQuota(event.target.value)} />
            </AffiliateOperationField>
            <label className="affiliate-platform-toggle-field affiliate-platform-toggle-field-compact">
              <input type="checkbox" checked={unlimited} onChange={(event) => setUnlimited(event.target.checked)} />
              <span><strong>{t("ecommerce.affiliateWorkspace.collaborationOperations.unlimitedSampleWindow")}</strong></span>
            </label>
            {!unlimited ? (
              <>
                <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.startTime")}>
                  <input className="input-full" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
                </AffiliateOperationField>
                <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.endTime")}>
                  <input className="input-full" type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
                </AffiliateOperationField>
              </>
            ) : null}
          </div>
          <div className="affiliate-platform-editor-subsection">
            <h4>{t("ecommerce.affiliateWorkspace.collaborationOperations.creatorThresholds")}</h4>
            <div className="affiliate-platform-form-grid affiliate-platform-form-grid-three">
              <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.minimumFollowers")}>
                <input className="input-full" type="number" min={0} value={minimumFollowerCount} onChange={(event) => setMinimumFollowerCount(event.target.value)} />
              </AffiliateOperationField>
              <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.minimumGmv")}>
                <input className="input-full" type="number" min={0} value={minimumGmv} onChange={(event) => setMinimumGmv(event.target.value)} />
              </AffiliateOperationField>
              <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.averageVideoViews")}>
                <input className="input-full" type="number" min={0} value={avgEcVideoViews} onChange={(event) => setAvgEcVideoViews(event.target.value)} />
              </AffiliateOperationField>
              <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.categoryIds")} hint={t("ecommerce.affiliateWorkspace.collaborationOperations.delimitedHint")}>
                <input className="input-full" value={categoryIds} onChange={(event) => setCategoryIds(event.target.value)} />
              </AffiliateOperationField>
              <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.fulfillmentRank")}>
                <input className="input-full" value={predictedFulfillmentRank} onChange={(event) => setPredictedFulfillmentRank(event.target.value)} />
              </AffiliateOperationField>
            </div>
          </div>
        </>
      ) : null}
      <div className="affiliate-platform-editor-actions">
        <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.immediateProjectionHint")}</span>
        <button className="btn btn-primary" type="submit" disabled={saveRuleState.loading}>
          {saveRuleState.loading ? t("common.loading") : t("ecommerce.affiliateWorkspace.collaborationOperations.saveChanges")}
        </button>
      </div>
    </form>
  );
}

function AffiliateOperationField({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`affiliate-platform-operation-field ${className}`.trim()}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function AffiliateTargetCollaborationEditor({
  collaboration,
  onSaved,
}: {
  collaboration: GQL.AffiliateCollaboration;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const activeCreatorOpenIds = collaboration.targetCreators
    .filter((creator) => !["DELETED", "DELETING"].includes(creator.collaborationStatus?.toUpperCase() ?? ""))
    .map((creator) => creator.creatorOpenId)
    .filter((value): value is string => Boolean(value));
  const [name, setName] = useState(collaboration.name ?? "");
  const [endTime, setEndTime] = useState(affiliateDateTimeLocalValue(collaboration.endTime));
  const [creatorOpenIds, setCreatorOpenIds] = useState(
    (activeCreatorOpenIds.length > 0 ? activeCreatorOpenIds : collaboration.creatorOpenIds).join("\n"),
  );
  const [products, setProducts] = useState<AffiliateTargetProductDraft[]>(targetProductDrafts(collaboration));
  const [email, setEmail] = useState(collaboration.sellerContactInfo?.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState(collaboration.sellerContactInfo?.phoneNumber ?? "");
  const [whatsapp, setWhatsapp] = useState(collaboration.sellerContactInfo?.whatsapp ?? "");
  const [telegram, setTelegram] = useState(collaboration.sellerContactInfo?.telegram ?? "");
  const [line, setLine] = useState(collaboration.sellerContactInfo?.line ?? "");
  const [hasFreeSample, setHasFreeSample] = useState<boolean | null>(collaboration.freeSampleRule?.hasFreeSample ?? null);
  const [isSampleApprovalExempt, setIsSampleApprovalExempt] = useState<boolean | null>(collaboration.freeSampleRule?.isSampleApprovalExempt ?? null);
  const [updateTarget, updateTargetState] = useMutation<
    { updateAffiliateTargetCollaboration: GQL.UpdateAffiliateTargetCollaborationPayload },
    { input: GQL.UpdateAffiliateTargetCollaborationInput }
  >(UPDATE_AFFILIATE_TARGET_COLLABORATION_MUTATION);

  const missingSafetyFields = [
    !name.trim() ? t("ecommerce.affiliateWorkspace.collaborationOperations.name") : null,
    !endTime ? t("ecommerce.affiliateWorkspace.collaborationOperations.endTime") : null,
    affiliateDelimitedIdentifiers(creatorOpenIds).length === 0 ? t("ecommerce.affiliateWorkspace.collaborationOperations.creatorOpenIds") : null,
    products.length === 0 || products.some((product) => !product.productId.trim() || !product.commissionPercent.trim())
      ? t("ecommerce.affiliateWorkspace.collaborationOperations.productsAndCommission")
      : null,
    !email.trim() ? t("ecommerce.affiliateWorkspace.collaborationOperations.sellerContact") : null,
    hasFreeSample == null || isSampleApprovalExempt == null
      ? t("ecommerce.affiliateWorkspace.collaborationOperations.freeSampleRule")
      : null,
  ].filter((value): value is string => Boolean(value));

  function updateProduct(index: number, patch: Partial<AffiliateTargetProductDraft>): void {
    setProducts((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (missingSafetyFields.length > 0) {
      showToast(t("ecommerce.affiliateWorkspace.collaborationOperations.missingSafetyFields"), "error");
      return;
    }
    try {
      const result = await updateTarget({
        variables: {
          input: {
            shopId: collaboration.shopId,
            collaborationId: collaboration.id,
            name: name.trim(),
            endTime: affiliateDateTimeLocalToIso(endTime),
            creatorOpenIds: affiliateDelimitedIdentifiers(creatorOpenIds),
            products: products.map((product) => ({
              productId: product.productId.trim(),
              commissionRateBps: affiliateCommissionPercentToBps(product.commissionPercent),
              targetAdCommissionRateBps: product.adsCommissionPercent.trim()
                ? affiliateCommissionPercentToBps(product.adsCommissionPercent)
                : undefined,
            })),
            sellerContactInfo: {
              email: email.trim(),
              phoneNumber: phoneNumber.trim() || undefined,
              whatsapp: whatsapp.trim() || undefined,
              telegram: telegram.trim() || undefined,
              line: line.trim() || undefined,
            },
            freeSampleRule: {
              hasFreeSample: hasFreeSample!,
              isSampleApprovalExempt: isSampleApprovalExempt!,
            },
          },
        },
      });
      const partialFailure = result.data?.updateAffiliateTargetCollaboration.providerResult.updateFailed;
      showToast(
        partialFailure
          ? t("ecommerce.affiliateWorkspace.collaborationOperations.partialUpdateWarning")
          : t("ecommerce.affiliateWorkspace.collaborationOperations.saveSuccess"),
        partialFailure ? "warning" : "success",
      );
      await onSaved();
    } catch (mutationError) {
      showToast(mutationError instanceof Error ? mutationError.message : t("ecommerce.affiliateWorkspace.collaborationOperations.operationFailed"), "error");
    }
  }

  return (
    <form className="affiliate-platform-collaboration-editor" onSubmit={(event) => void submit(event)}>
      <div className="affiliate-platform-collaboration-editor-heading">
        <div>
          <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.platformConfiguration")}</span>
          <h3>{t("ecommerce.affiliateWorkspace.collaborationOperations.editTargetCollaboration")}</h3>
        </div>
        <span className="affiliate-platform-write-badge">{t("ecommerce.affiliateWorkspace.collaborationOperations.writesImmediately")}</span>
      </div>
      <div className="affiliate-platform-collaboration-guardrail">
        <InfoIcon />
        <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.targetFullStateHint")}</span>
      </div>
      {missingSafetyFields.length > 0 ? (
        <div className="affiliate-platform-collaboration-data-warning" role="alert">
          <strong>{t("ecommerce.affiliateWorkspace.collaborationOperations.editBlockedTitle")}</strong>
          <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.editBlockedHint", { fields: missingSafetyFields.join(", ") })}</span>
        </div>
      ) : null}
      <div className="affiliate-platform-form-grid">
        <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.name")}>
          <input className="input-full" value={name} onChange={(event) => setName(event.target.value)} required />
        </AffiliateOperationField>
        <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.endTime")}>
          <input className="input-full" type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
        </AffiliateOperationField>
        <AffiliateOperationField
          className="affiliate-platform-operation-field-wide"
          label={t("ecommerce.affiliateWorkspace.collaborationOperations.creatorOpenIds")}
          hint={t("ecommerce.affiliateWorkspace.collaborationOperations.fullListHint")}
        >
          <textarea className="input-full" rows={4} value={creatorOpenIds} onChange={(event) => setCreatorOpenIds(event.target.value)} required />
        </AffiliateOperationField>
      </div>

      <AffiliateTargetProductRows products={products} onChange={setProducts} onUpdate={updateProduct} />

      <div className="affiliate-platform-editor-subsection">
        <h4>{t("ecommerce.affiliateWorkspace.collaborationOperations.sellerContact")}</h4>
        <div className="affiliate-platform-form-grid affiliate-platform-form-grid-three">
          <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.email")}>
            <input className="input-full" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </AffiliateOperationField>
          <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.phoneNumber")}>
            <input className="input-full" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
          </AffiliateOperationField>
          <AffiliateOperationField label="WhatsApp">
            <input className="input-full" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} />
          </AffiliateOperationField>
          <AffiliateOperationField label="Telegram">
            <input className="input-full" value={telegram} onChange={(event) => setTelegram(event.target.value)} />
          </AffiliateOperationField>
          <AffiliateOperationField label="LINE">
            <input className="input-full" value={line} onChange={(event) => setLine(event.target.value)} />
          </AffiliateOperationField>
        </div>
      </div>

      <div className="affiliate-platform-editor-subsection">
        <h4>{t("ecommerce.affiliateWorkspace.collaborationOperations.freeSampleRule")}</h4>
        <div className="affiliate-platform-binary-grid">
          <AffiliateBinaryChoice
            label={t("ecommerce.affiliateWorkspace.collaborationOperations.freeSamples")}
            value={hasFreeSample}
            onChange={setHasFreeSample}
          />
          <AffiliateBinaryChoice
            label={t("ecommerce.affiliateWorkspace.collaborationOperations.sampleApprovalExempt")}
            value={isSampleApprovalExempt}
            onChange={setIsSampleApprovalExempt}
          />
        </div>
      </div>
      <div className="affiliate-platform-editor-actions">
        <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.immediateProjectionHint")}</span>
        <button className="btn btn-primary" type="submit" disabled={updateTargetState.loading || missingSafetyFields.length > 0}>
          {updateTargetState.loading ? t("common.loading") : t("ecommerce.affiliateWorkspace.collaborationOperations.saveChanges")}
        </button>
      </div>
    </form>
  );
}

function AffiliateTargetProductRows({
  products,
  onChange,
  onUpdate,
}: {
  products: AffiliateTargetProductDraft[];
  onChange: (products: AffiliateTargetProductDraft[]) => void;
  onUpdate: (index: number, patch: Partial<AffiliateTargetProductDraft>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="affiliate-platform-editor-subsection">
      <div className="affiliate-platform-editor-subsection-heading">
        <div>
          <h4>{t("ecommerce.affiliateWorkspace.collaborationOperations.productsAndCommission")}</h4>
          <small>{t("ecommerce.affiliateWorkspace.collaborationOperations.fullProductListHint")}</small>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => onChange([...products, { productId: "", commissionPercent: "", adsCommissionPercent: "" }])}
        >
          {t("ecommerce.affiliateWorkspace.collaborationOperations.addProduct")}
        </button>
      </div>
      <div className="affiliate-platform-product-editor-list">
        {products.map((product, index) => (
          <div className="affiliate-platform-product-editor-row" key={`${product.productId}:${index}`}>
            <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.productId")}>
              <input className="input-full input-mono" value={product.productId} onChange={(event) => onUpdate(index, { productId: event.target.value })} required />
            </AffiliateOperationField>
            <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.commissionPercent")}>
              <input className="input-full" type="number" min={1} max={80} step={0.01} value={product.commissionPercent} onChange={(event) => onUpdate(index, { commissionPercent: event.target.value })} required />
            </AffiliateOperationField>
            <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.adsCommissionPercent")}>
              <input className="input-full" type="number" min={1} max={80} step={0.01} value={product.adsCommissionPercent} onChange={(event) => onUpdate(index, { adsCommissionPercent: event.target.value })} />
            </AffiliateOperationField>
            <button
              className="affiliate-platform-product-remove"
              type="button"
              aria-label={t("ecommerce.affiliateWorkspace.collaborationOperations.removeProduct")}
              onClick={() => onChange(products.filter((_, itemIndex) => itemIndex !== index))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AffiliateBinaryChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="affiliate-platform-binary-choice">
      <legend>{label}</legend>
      <button className={value === true ? "is-selected" : ""} type="button" onClick={() => onChange(true)}>
        {t("common.yes")}
      </button>
      <button className={value === false ? "is-selected" : ""} type="button" onClick={() => onChange(false)}>
        {t("common.no")}
      </button>
    </fieldset>
  );
}

function AffiliateCollaborationCreateModal({
  defaultShopId,
  shopOptions,
  onClose,
  onChanged,
}: {
  defaultShopId: string;
  shopOptions: AffiliateCollaborationShopOption[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [mode, setMode] = useState<"OPEN" | "TARGET">("OPEN");
  const [shopId, setShopId] = useState(defaultShopId || shopOptions[0]?.value || "");
  const [openProductId, setOpenProductId] = useState("");
  const [openCommissionPercent, setOpenCommissionPercent] = useState("20");
  const [targetName, setTargetName] = useState("");
  const [targetMessage, setTargetMessage] = useState("");
  const [targetEndTime, setTargetEndTime] = useState(
    affiliateDateTimeLocalValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
  );
  const [targetCreatorOpenIds, setTargetCreatorOpenIds] = useState("");
  const [targetProducts, setTargetProducts] = useState<AffiliateTargetProductDraft[]>([
    { productId: "", commissionPercent: "20", adsCommissionPercent: "" },
  ]);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [contactTelegram, setContactTelegram] = useState("");
  const [contactLine, setContactLine] = useState("");
  const [hasFreeSample, setHasFreeSample] = useState<boolean | null>(true);
  const [isSampleApprovalExempt, setIsSampleApprovalExempt] = useState<boolean | null>(false);
  const [createOpen, createOpenState] = useMutation<
    { createAffiliateOpenCollaboration: GQL.CreateAffiliateOpenCollaborationPayload },
    { input: GQL.CreateAffiliateOpenCollaborationInput }
  >(CREATE_AFFILIATE_OPEN_COLLABORATION_MUTATION);
  const [createTarget, createTargetState] = useMutation<
    { createAffiliateTargetCollaboration: GQL.CreateAffiliateTargetCollaborationPayload },
    { input: GQL.CreateAffiliateTargetCollaborationInput }
  >(CREATE_AFFILIATE_TARGET_COLLABORATION_MUTATION);
  const submitting = createOpenState.loading || createTargetState.loading;

  function updateTargetProduct(index: number, patch: Partial<AffiliateTargetProductDraft>): void {
    setTargetProducts((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!shopId) {
      showToast(t("ecommerce.affiliateWorkspace.collaborationOperations.selectShop"), "error");
      return;
    }
    try {
      if (mode === "OPEN") {
        await createOpen({
          variables: {
            input: {
              shopId,
              productId: openProductId.trim(),
              commissionRateBps: affiliateCommissionPercentToBps(openCommissionPercent),
            },
          },
        });
      } else {
        const result = await createTarget({
          variables: {
            input: {
              shopId,
              name: targetName.trim(),
              message: targetMessage.trim() || undefined,
              endTime: affiliateDateTimeLocalToIso(targetEndTime),
              creatorOpenIds: affiliateDelimitedIdentifiers(targetCreatorOpenIds),
              products: targetProducts.map((product) => ({
                productId: product.productId.trim(),
                targetCommissionRateBps: affiliateCommissionPercentToBps(product.commissionPercent),
                shopAdsCommissionRateBps: product.adsCommissionPercent.trim()
                  ? affiliateCommissionPercentToBps(product.adsCommissionPercent)
                  : undefined,
              })),
              sellerContactInfo: {
                email: contactEmail.trim(),
                phoneNumber: contactPhone.trim() || undefined,
                whatsapp: contactWhatsapp.trim() || undefined,
                telegram: contactTelegram.trim() || undefined,
                line: contactLine.trim() || undefined,
              },
              freeSampleRule: {
                hasFreeSample: hasFreeSample ?? false,
                isSampleApprovalExempt: isSampleApprovalExempt ?? false,
              },
            },
          },
        });
        if (!result.data?.createAffiliateTargetCollaboration.collaboration) {
          showToast(t("ecommerce.affiliateWorkspace.collaborationOperations.targetCreateConflict"), "warning");
          return;
        }
      }
      showToast(t("ecommerce.affiliateWorkspace.collaborationOperations.createSuccess"), "success");
      onChanged();
      onClose();
    } catch (mutationError) {
      showToast(mutationError instanceof Error ? mutationError.message : t("ecommerce.affiliateWorkspace.collaborationOperations.operationFailed"), "error");
    }
  }

  return (
    <div className="modal-backdrop affiliate-creator-detail-backdrop" role="presentation" onClick={onClose}>
      <form
        className="modal-content affiliate-collaboration-modal affiliate-platform-collaboration-create-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("ecommerce.affiliateWorkspace.collaborationOperations.newCollaboration")}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
      >
        <div className="modal-header affiliate-platform-collaboration-modal-header">
          <div className="affiliate-collaboration-modal-title-block">
            <div className="affiliate-platform-collaboration-kicker">{t("ecommerce.affiliateWorkspace.collaborationOperations.platformOperation")}</div>
            <h2>{t("ecommerce.affiliateWorkspace.collaborationOperations.newCollaboration")}</h2>
            <p>{t("ecommerce.affiliateWorkspace.collaborationOperations.newCollaborationHint")}</p>
          </div>
          <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t("common.close")}>×</button>
        </div>
        <div className="affiliate-platform-collaboration-create-body">
          <div className="affiliate-platform-collaboration-create-rail">
            <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.shop")}>
              <Select value={shopId} onChange={setShopId} options={shopOptions} />
            </AffiliateOperationField>
            <div className="affiliate-platform-collaboration-mode-picker" role="tablist">
              <button className={mode === "OPEN" ? "is-selected" : ""} type="button" onClick={() => setMode("OPEN")}>
                <strong>Open</strong>
                <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.openCreateChoice")}</span>
              </button>
              <button className={mode === "TARGET" ? "is-selected" : ""} type="button" onClick={() => setMode("TARGET")}>
                <strong>Target</strong>
                <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.targetCreateChoice")}</span>
              </button>
            </div>
            <div className="affiliate-platform-collaboration-rail-note">
              <InfoIcon />
              <span>{mode === "OPEN"
                ? t("ecommerce.affiliateWorkspace.collaborationOperations.openCreateRailHint")
                : t("ecommerce.affiliateWorkspace.collaborationOperations.targetCreateRailHint")}</span>
            </div>
          </div>
          <div className="affiliate-platform-collaboration-create-form">
            {mode === "OPEN" ? (
              <>
                <div className="affiliate-platform-collaboration-editor-heading">
                  <div><span>Open Collaboration</span><h3>{t("ecommerce.affiliateWorkspace.collaborationOperations.enableProduct")}</h3></div>
                  <span className="affiliate-platform-write-badge">{t("ecommerce.affiliateWorkspace.collaborationOperations.writesImmediately")}</span>
                </div>
                <div className="affiliate-platform-form-grid">
                  <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.productId")}>
                    <input className="input-full input-mono" value={openProductId} onChange={(event) => setOpenProductId(event.target.value)} required />
                  </AffiliateOperationField>
                  <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.commissionPercent")} hint={t("ecommerce.affiliateWorkspace.collaborationOperations.commissionRangeHint")}>
                    <input className="input-full" type="number" min={1} max={80} step={0.01} value={openCommissionPercent} onChange={(event) => setOpenCommissionPercent(event.target.value)} required />
                  </AffiliateOperationField>
                </div>
                <div className="affiliate-platform-collaboration-data-warning is-neutral">
                  <strong>{t("ecommerce.affiliateWorkspace.collaborationOperations.commissionLockedTitle")}</strong>
                  <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.commissionLockedCreateHint")}</span>
                </div>
              </>
            ) : (
              <>
                <div className="affiliate-platform-collaboration-editor-heading">
                  <div><span>Target Collaboration</span><h3>{t("ecommerce.affiliateWorkspace.collaborationOperations.createInvitation")}</h3></div>
                  <span className="affiliate-platform-write-badge">{t("ecommerce.affiliateWorkspace.collaborationOperations.writesImmediately")}</span>
                </div>
                <div className="affiliate-platform-form-grid">
                  <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.name")}>
                    <input className="input-full" value={targetName} onChange={(event) => setTargetName(event.target.value)} required />
                  </AffiliateOperationField>
                  <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.endTime")}>
                    <input className="input-full" type="datetime-local" value={targetEndTime} onChange={(event) => setTargetEndTime(event.target.value)} required />
                  </AffiliateOperationField>
                  <AffiliateOperationField className="affiliate-platform-operation-field-wide" label={t("ecommerce.affiliateWorkspace.collaborationOperations.message")}>
                    <textarea className="input-full" rows={3} value={targetMessage} onChange={(event) => setTargetMessage(event.target.value)} />
                  </AffiliateOperationField>
                  <AffiliateOperationField className="affiliate-platform-operation-field-wide" label={t("ecommerce.affiliateWorkspace.collaborationOperations.creatorOpenIds")} hint={t("ecommerce.affiliateWorkspace.collaborationOperations.delimitedHint")}>
                    <textarea className="input-full input-mono" rows={4} value={targetCreatorOpenIds} onChange={(event) => setTargetCreatorOpenIds(event.target.value)} required />
                  </AffiliateOperationField>
                </div>
                <AffiliateTargetProductRows products={targetProducts} onChange={setTargetProducts} onUpdate={updateTargetProduct} />
                <div className="affiliate-platform-editor-subsection">
                  <h4>{t("ecommerce.affiliateWorkspace.collaborationOperations.sellerContact")}</h4>
                  <div className="affiliate-platform-form-grid affiliate-platform-form-grid-three">
                    <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.email")}><input className="input-full" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} required /></AffiliateOperationField>
                    <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.phoneNumber")}><input className="input-full" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></AffiliateOperationField>
                    <AffiliateOperationField label="WhatsApp"><input className="input-full" value={contactWhatsapp} onChange={(event) => setContactWhatsapp(event.target.value)} /></AffiliateOperationField>
                    <AffiliateOperationField label="Telegram"><input className="input-full" value={contactTelegram} onChange={(event) => setContactTelegram(event.target.value)} /></AffiliateOperationField>
                    <AffiliateOperationField label="LINE"><input className="input-full" value={contactLine} onChange={(event) => setContactLine(event.target.value)} /></AffiliateOperationField>
                  </div>
                </div>
                <div className="affiliate-platform-binary-grid">
                  <AffiliateBinaryChoice label={t("ecommerce.affiliateWorkspace.collaborationOperations.freeSamples")} value={hasFreeSample} onChange={setHasFreeSample} />
                  <AffiliateBinaryChoice label={t("ecommerce.affiliateWorkspace.collaborationOperations.sampleApprovalExempt")} value={isSampleApprovalExempt} onChange={setIsSampleApprovalExempt} />
                </div>
              </>
            )}
          </div>
        </div>
        <div className="affiliate-platform-create-actions">
          <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.immediateProjectionHint")}</span>
          <div>
            <button className="btn btn-secondary" type="button" onClick={onClose}>{t("common.cancel")}</button>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? t("common.loading") : t("ecommerce.affiliateWorkspace.collaborationOperations.createOnTikTok")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AffiliateOpenCollaborationSettingsModal({
  defaultShopId,
  shopOptions,
  onClose,
}: {
  defaultShopId: string;
  shopOptions: AffiliateCollaborationShopOption[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [shopId, setShopId] = useState(defaultShopId || shopOptions[0]?.value || "");
  const [enabled, setEnabled] = useState(false);
  const [commissionPercent, setCommissionPercent] = useState("");
  const { data, loading, error, refetch } = useQuery<
    { affiliateOpenCollaborationSettings: GQL.EcomOpenCollaborationSettings },
    { shopId: string }
  >(AFFILIATE_OPEN_COLLABORATION_SETTINGS_QUERY, {
    variables: { shopId },
    skip: !shopId,
    fetchPolicy: "network-only",
  });
  const [saveSettings, saveSettingsState] = useMutation<
    { editAffiliateOpenCollaborationSettings: GQL.EditAffiliateOpenCollaborationSettingsPayload },
    { input: GQL.EditAffiliateOpenCollaborationSettingsInput }
  >(EDIT_AFFILIATE_OPEN_COLLABORATION_SETTINGS_MUTATION);

  useEffect(() => {
    const setting = data?.affiliateOpenCollaborationSettings.autoAddProduct;
    if (!setting) return;
    setEnabled(setting.enable ?? false);
    setCommissionPercent(affiliateBpsPercentValue(setting.commissionRate));
  }, [data]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await saveSettings({
        variables: {
          input: {
            shopId,
            autoAddProduct: {
              enable: enabled,
              commissionRateBps: affiliateCommissionPercentToBps(commissionPercent),
            },
          },
        },
      });
      showToast(t("ecommerce.affiliateWorkspace.collaborationOperations.settingsSaveSuccess"), "success");
      await refetch();
    } catch (mutationError) {
      showToast(mutationError instanceof Error ? mutationError.message : t("ecommerce.affiliateWorkspace.collaborationOperations.operationFailed"), "error");
    }
  }

  return (
    <div className="modal-backdrop affiliate-creator-detail-backdrop" role="presentation" onClick={onClose}>
      <form className="modal-content affiliate-platform-settings-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void submit(event)}>
        <div className="modal-header affiliate-platform-collaboration-modal-header">
          <div className="affiliate-collaboration-modal-title-block">
            <div className="affiliate-platform-collaboration-kicker">Open Collaboration</div>
            <h2>{t("ecommerce.affiliateWorkspace.collaborationOperations.openSettings")}</h2>
            <p>{t("ecommerce.affiliateWorkspace.collaborationOperations.openSettingsHint")}</p>
          </div>
          <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t("common.close")}>×</button>
        </div>
        <div className="affiliate-platform-settings-body">
          <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.shop")}>
            <Select value={shopId} onChange={setShopId} options={shopOptions} />
          </AffiliateOperationField>
          {error ? <AffiliateQueryErrorState error={error} onRetry={() => void refetch()} /> : null}
          {loading ? <AffiliateLoadingState /> : (
            <>
              <label className="affiliate-platform-toggle-field">
                <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                <span>
                  <strong>{t("ecommerce.affiliateWorkspace.collaborationOperations.autoAddProducts")}</strong>
                  <small>{t("ecommerce.affiliateWorkspace.collaborationOperations.autoAddProductsHint")}</small>
                </span>
              </label>
              <AffiliateOperationField label={t("ecommerce.affiliateWorkspace.collaborationOperations.defaultCommissionPercent")} hint={t("ecommerce.affiliateWorkspace.collaborationOperations.commissionRangeHint")}>
                <input className="input-full" type="number" min={1} max={80} step={0.01} value={commissionPercent} onChange={(event) => setCommissionPercent(event.target.value)} required />
              </AffiliateOperationField>
              <div className="affiliate-platform-collaboration-data-warning is-neutral">
                <strong>{t("ecommerce.affiliateWorkspace.collaborationOperations.settingsScopeTitle")}</strong>
                <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.settingsScopeHint")}</span>
              </div>
            </>
          )}
        </div>
        <div className="affiliate-platform-create-actions">
          <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.writesImmediately")}</span>
          <div>
            <button className="btn btn-secondary" type="button" onClick={onClose}>{t("common.cancel")}</button>
            <button className="btn btn-primary" type="submit" disabled={loading || saveSettingsState.loading || !commissionPercent}>
              {saveSettingsState.loading ? t("common.loading") : t("ecommerce.affiliateWorkspace.collaborationOperations.saveSettings")}
            </button>
          </div>
        </div>
      </form>
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
  const [createCollaborationOpen, setCreateCollaborationOpen] = useState(false);
  const [openSettingsOpen, setOpenSettingsOpen] = useState(false);

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
      <div
        className="ecommerce-page-header affiliate-workbench-header"
        data-tutorial-id="affiliate-history-header"
      >
        <div>
          <h1>{t("ecommerce.affiliateWorkspace.historyTitle")}</h1>
          <p className="ecommerce-page-subtitle">
            {t("ecommerce.affiliateWorkspace.historySubtitle")}
          </p>
        </div>
        <div
          className="affiliate-workbench-controls"
          data-tutorial-id="affiliate-history-controls"
        >
          <Select
            value={selectedShopId}
            onChange={setSelectedShopId}
            options={shopOptions}
            className="affiliate-workspace-shop-select"
          />
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setOpenSettingsOpen(true)}
            disabled={shopOptions.length <= 1}
          >
            {t("ecommerce.affiliateWorkspace.collaborationOperations.openSettings")}
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setCreateCollaborationOpen(true)}
            disabled={shopOptions.length <= 1}
          >
            {t("ecommerce.affiliateWorkspace.collaborationOperations.newCollaboration")}
          </button>
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
          <div
            className="affiliate-attention-toolbar"
            data-tutorial-id="affiliate-history-filters"
          >
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
              <span>{t("ecommerce.affiliateWorkspace.collaborationOperations.collaborationType")}</span>
              <Select
                value={historyTypeFilter}
                onChange={(value) => setHistoryTypeFilter(value as HistoryTypeFilter)}
                options={historyTypeOptions}
                className="affiliate-status-select"
                ariaLabel={t("ecommerce.affiliateWorkspace.collaborationOperations.collaborationType")}
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
          <div data-tutorial-id="affiliate-history-results">
            <AffiliateQueryErrorState error={error} onRetry={() => void refetch()} />
          </div>
        ) : loading && visibleItems.length === 0 ? (
          <div data-tutorial-id="affiliate-history-results">
            <AffiliateLoadingState />
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className="affiliate-proposal-empty"
            data-tutorial-id="affiliate-history-results"
          >
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
          onChanged={() => void refetch()}
        />
      ) : null}

      {createCollaborationOpen ? (
        <AffiliateCollaborationCreateModal
          defaultShopId={selectedShopId}
          shopOptions={shopOptions.filter((option) => option.value)}
          onClose={() => setCreateCollaborationOpen(false)}
          onChanged={() => void refetch()}
        />
      ) : null}

      {openSettingsOpen ? (
        <AffiliateOpenCollaborationSettingsModal
          defaultShopId={selectedShopId}
          shopOptions={shopOptions.filter((option) => option.value)}
          onClose={() => setOpenSettingsOpen(false)}
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

export type AffiliateProposalManualTagRow = {
  key: string;
  operation: GQL.CreatorTagOperation;
  manualTagId: string;
  /** Current catalog name. Null only when the tag was deleted after the proposal froze. */
  tagName: string | null;
  contextShopId: string | null;
};

/**
 * Manual tag changes a proposal will apply.
 *
 * Names come from `referencedManualTags`, which the backend resolves for exactly
 * this: an ADD names a tag the Relationship does not carry yet, and a renamed
 * tag must show its current name, so neither can be recovered by joining against
 * the Relationship's own tags.
 */
export function proposalManualTagRows(
  proposal: GQL.ActionProposal,
): AffiliateProposalManualTagRow[] {
  const nameById = new Map(
    (proposal.referencedManualTags ?? []).map((tag) => [tag.id, tag.name] as const),
  );
  const sources: Array<{ key: string; intent: GQL.ActionProposalCreatorTagIntent }> = [];
  for (const step of proposal.steps ?? []) {
    if (step.creatorTagIntent) sources.push({ key: step.stepId, intent: step.creatorTagIntent });
  }
  if (sources.length === 0 && proposal.creatorTagIntent) {
    sources.push({ key: proposal.id, intent: proposal.creatorTagIntent });
  }
  return sources.map(({ key, intent }) => ({
    key,
    operation: intent.operation,
    manualTagId: intent.manualTagId,
    tagName: nameById.get(intent.manualTagId) ?? null,
    contextShopId: intent.contextShopId ?? null,
  }));
}

function renderCreatorTagIntentSummary(
  proposal: GQL.ActionProposal,
  intent: GQL.ActionProposalCreatorTagIntent,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const tagName = (proposal.referencedManualTags ?? []).find(
    (tag) => tag.id === intent.manualTagId,
  )?.name;
  return t(
    intent.operation === GQL.CreatorTagOperation.Add
      ? "ecommerce.shopDrawer.affiliate.manualTagAddPreview"
      : "ecommerce.shopDrawer.affiliate.manualTagRemovePreview",
    { name: tagName ?? intent.manualTagId },
  );
}

function ProposalManualTagChanges({
  rows,
  relationshipLabel,
}: {
  rows: AffiliateProposalManualTagRow[];
  relationshipLabel: string;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <section className="affiliate-card-section affiliate-card-manual-tag-section">
      <div className="affiliate-card-section-label">
        {t("ecommerce.affiliateWorkspace.manualTags.proposalSectionLabel")}
      </div>
      <div className="affiliate-manual-tag-change-list">
        {rows.map((row) => (
          <div className="affiliate-manual-tag-change" key={row.key}>
            <span
              className={`affiliate-manual-tag-operation affiliate-manual-tag-operation-${row.operation.toLowerCase()}`}
            >
              {t(
                row.operation === GQL.CreatorTagOperation.Add
                  ? "ecommerce.affiliateWorkspace.manualTags.operationAdd"
                  : "ecommerce.affiliateWorkspace.manualTags.operationRemove",
              )}
            </span>
            <strong>{row.tagName ?? t("ecommerce.affiliateWorkspace.manualTags.deletedTag")}</strong>
            <span className="affiliate-manual-tag-change-target">
              {t("ecommerce.affiliateWorkspace.manualTags.proposalTarget", { name: relationshipLabel })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function renderAgentWorkRecommendationTitle(
  proposal: GQL.ActionProposal,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const sampleReviewRows = proposalSampleReviewRows(proposal);
  if (sampleReviewRows.length <= 1) return renderProposalRecommendationTitle(proposal, t);
  const summary = summarizeSampleProposalReviewRows(sampleReviewRows);
  return t("ecommerce.affiliateWorkspace.sampleDecisionBundle.recommendationTitle", {
    count: sampleReviewRows.length,
    approveCount: summary.approveCount,
    rejectCount: summary.rejectCount,
  });
}

type AgentWorkTableAction = {
  key: string;
  label: string;
  tone: "approve" | "reject" | "message" | "neutral";
};

function proposalHasMessageIntent(proposal: GQL.ActionProposal): boolean {
  return Boolean(
    proposal.messageIntent ||
    (proposal.steps ?? []).some((step) => Boolean(step.messageIntent)),
  );
}

function agentWorkTableActions(
  proposal: GQL.ActionProposal,
  t: ReturnType<typeof useTranslation>["t"],
): AgentWorkTableAction[] {
  const sampleRows = proposalSampleReviewRows(proposal);
  const actions: AgentWorkTableAction[] = [];
  if (sampleRows.some((row) => row.decision === GQL.AffiliateSampleReviewDecision.Reject)) {
    actions.push({
      key: "reject-sample",
      label: t("ecommerce.affiliateWorkspace.agentWorkTable.actions.rejectSample"),
      tone: "reject",
    });
  }
  if (sampleRows.some((row) => row.decision === GQL.AffiliateSampleReviewDecision.Approve)) {
    actions.push({
      key: "approve-sample",
      label: t("ecommerce.affiliateWorkspace.agentWorkTable.actions.approveSample"),
      tone: "approve",
    });
  }
  if (sampleRows.length === 0 && proposalHasMessageIntent(proposal)) {
    actions.push({
      key: "send-message",
      label: t("ecommerce.affiliateWorkspace.agentWorkTable.actions.sendMessage"),
      tone: "message",
    });
  }
  if (actions.length === 0) {
    actions.push({
      key: "no-action",
      label: t("ecommerce.affiliateWorkspace.agentWorkTable.actions.noAction"),
      tone: "neutral",
    });
  }
  return actions;
}

function AgentWorkBundleTable({
  bundles,
  shopLabelForId,
  onOpen,
  onOpenCreator,
}: {
  bundles: AgentWorkBundle[];
  shopLabelForId: (shopId: string) => string;
  onOpen: (bundle: AgentWorkBundle) => void;
  onOpenCreator: (bundle: AgentWorkBundle) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="affiliate-agent-work-table-shell"
      data-tutorial-id="affiliate-attention-queue"
    >
      <table className="affiliate-agent-work-table">
        <colgroup>
          <col className="affiliate-agent-work-col-time" />
          <col className="affiliate-agent-work-col-shop" />
          <col className="affiliate-agent-work-col-creator" />
          <col className="affiliate-agent-work-col-creator-metrics" />
          <col className="affiliate-agent-work-col-type" />
          <col className="affiliate-agent-work-col-work" />
          <col className="affiliate-agent-work-col-status" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{t("ecommerce.affiliateWorkspace.agentWorkTable.time")}</th>
            <th scope="col">{t("ecommerce.affiliateWorkspace.agentWorkTable.shop")}</th>
            <th scope="col">{t("ecommerce.affiliateWorkspace.agentWorkTable.creator")}</th>
            <th scope="col">{t("ecommerce.affiliateWorkspace.agentWorkTable.creatorMetrics.title")}</th>
            <th scope="col">{t("ecommerce.affiliateWorkspace.agentWorkTable.type")}</th>
            <th scope="col">{t("ecommerce.affiliateWorkspace.agentWorkTable.work")}</th>
            <th scope="col">{t("ecommerce.affiliateWorkspace.agentWorkTable.status")}</th>
          </tr>
        </thead>
        <tbody>
          {bundles.map((bundle) => {
            const proposal = bundle.proposal;
            const creatorName = proposal.creatorProfile
              ? creatorPrimaryName(proposal.creatorProfile, t("ecommerce.affiliateWorkspace.unknownCreator"))
              : t("ecommerce.affiliateWorkspace.unknownCreator");
            const creatorUsername = proposal.creatorProfile
              ? normalizeTikTokUsername(proposal.creatorProfile.username)
              : null;
            const creatorNickname = proposal.creatorProfile?.nickname?.trim() || null;
            const creatorSecondaryName = creatorNickname
              && normalizeTikTokUsername(creatorNickname) !== creatorUsername
              ? creatorNickname
              : null;
            const recommendationTitle = renderAgentWorkRecommendationTitle(proposal, t);
            const workActions = agentWorkTableActions(proposal, t);
            const shopLabels = actionProposalDisplayShopIds(proposal).map(shopLabelForId);
            const primaryShopLabel = shopLabels[0]
              ?? t("ecommerce.affiliateWorkspace.sampleDecisionBundle.unknownShop");
            const additionalShopCount = Math.max(0, shopLabels.length - 1);
            const openLabel = t("ecommerce.affiliateWorkspace.agentWorkTable.openDetail", {
              creator: creatorName,
              work: recommendationTitle,
            });

            return (
              <tr
                key={bundle.rootProposalId}
                className="affiliate-agent-work-table-row"
                data-tutorial-id="affiliate-attention-bundle"
                tabIndex={0}
                aria-label={openLabel}
                onClick={() => onOpen(bundle)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onOpen(bundle);
                }}
              >
                <td className="affiliate-agent-work-table-time">
                  <time dateTime={proposal.createdAt}>
                    <strong>{formatProposalTableTime(proposal.createdAt)}</strong>
                    <span>{formatProposalTableDate(proposal.createdAt)}</span>
                  </time>
                </td>
                <td className="affiliate-agent-work-table-shop" title={shopLabels.join(" · ")}>
                  <strong>{primaryShopLabel}</strong>
                  {additionalShopCount > 0 ? (
                    <span>{t("ecommerce.affiliateWorkspace.agentWorkTable.moreShops", { count: additionalShopCount })}</span>
                  ) : null}
                </td>
                <td className="affiliate-agent-work-table-creator">
                  <button
                    className="affiliate-agent-work-table-creator-button"
                    type="button"
                    title={t("ecommerce.affiliateWorkspace.openCreatorDetail")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenCreator(bundle);
                    }}
                  >
                    <CreatorAvatarImage
                      avatarUrl={proposal.creatorProfile?.avatarUrl}
                      className="affiliate-avatar affiliate-agent-work-table-avatar affiliate-remote-avatar-image"
                      name={creatorName}
                    />
                    <span className="affiliate-agent-work-table-creator-copy">
                      <strong>{creatorUsername ? `@${creatorUsername}` : creatorName}</strong>
                      {creatorSecondaryName ? <small>{creatorSecondaryName}</small> : null}
                    </span>
                  </button>
                </td>
                <td className="affiliate-agent-work-table-creator-metrics">
                  <div className="affiliate-agent-work-creator-metric-grid">
                    <span>
                      <small>{t("ecommerce.affiliateWorkspace.agentWorkTable.creatorMetrics.followers")}</small>
                      <strong>{formatCount(proposal.creatorFollowerCount) ?? "—"}</strong>
                    </span>
                    <span>
                      <small>{t("ecommerce.affiliateWorkspace.agentWorkTable.creatorMetrics.avgViews")}</small>
                      <strong>{formatCount(proposal.creatorAverageVideoViews) ?? "—"}</strong>
                    </span>
                    <span>
                      <small>{t("ecommerce.affiliateWorkspace.agentWorkTable.creatorMetrics.engagementRate")}</small>
                      <strong>{formatPerformanceRate(proposal.creatorEngagementRate) ?? "—"}</strong>
                    </span>
                    <span>
                      <small>{t("ecommerce.affiliateWorkspace.agentWorkTable.creatorMetrics.shoppableVideos")}</small>
                      <strong>{formatCount(proposal.creatorShoppableVideoCount) ?? "—"}</strong>
                    </span>
                  </div>
                </td>
                <td className="affiliate-agent-work-table-type">
                  <span className={`affiliate-agent-work-type-${proposal.type.toLowerCase().replace(/_/g, "-")}`}>
                    {formatActionProposalTypeLabel(proposal.type, t)}
                  </span>
                </td>
                <td className="affiliate-agent-work-table-work">
                  <div className="affiliate-agent-work-table-actions" aria-label={recommendationTitle}>
                    {workActions.map((action) => (
                      <span
                        className={`affiliate-agent-work-table-action affiliate-agent-work-table-action-${action.tone}`}
                        key={action.key}
                      >
                        {action.label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="affiliate-agent-work-table-status">
                  <span className={`affiliate-kind-badge affiliate-kind-${proposal.status.toLowerCase()}`}>
                    {t(`ecommerce.affiliateWorkspace.proposalFilters.${proposal.status}`, {
                      defaultValue: proposal.status,
                    })}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AgentWorkBundleDetailModal({
  bundle,
  shopLabelForId,
  decidingProposal,
  affiliateWorkspace,
  covered,
  onClose,
  onOpenCreator,
  onApprove,
  onReject,
  onRequestRevision,
}: {
  bundle: AgentWorkBundle;
  shopLabelForId: (shopId: string) => string;
  decidingProposal: boolean;
  affiliateWorkspace: AffiliateWorkspaceStore;
  covered: boolean;
  onClose: () => void;
  onOpenCreator: (profile: GQL.AffiliateCreatorIdentity) => void;
  onApprove: (proposal: GQL.ActionProposal) => Promise<boolean>;
  onReject: (proposal: GQL.ActionProposal) => Promise<boolean>;
  onRequestRevision: (proposal: GQL.ActionProposal, note: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const proposal = bundle.proposal;
  const shopLabels = actionProposalDisplayShopIds(proposal).map(shopLabelForId);
  const primaryShopLabel = shopLabels[0]
    ?? t("ecommerce.affiliateWorkspace.sampleDecisionBundle.unknownShop");
  const isPending = proposal.status === GQL.ActionProposalStatus.Pending;
  const titleId = `affiliate-agent-work-detail-${proposal.id}`;
  const relationshipId = proposal.creatorRelationshipId
    ?? proposal.sourceWorkBoundary?.creatorRelationshipId
    ?? null;
  const contextEndAt = proposal.sourceWorkBoundary?.versionAt ?? proposal.createdAt;
  const {
    data: reviewRelationshipData,
    loading: reviewRelationshipLoading,
    error: reviewRelationshipError,
  } = useQuery<
    { affiliateCreatorRelationshipDetail: GQL.AffiliateCreatorRelationshipDetailPayload },
    { input: GQL.AffiliateCreatorRelationshipDetailInput }
  >(AFFILIATE_CREATOR_RELATIONSHIP_DETAIL_QUERY, {
    variables: { input: { creatorRelationshipId: relationshipId ?? "" } },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
  });
  const {
    data: reviewTimelineData,
    loading: reviewTimelineLoading,
    error: reviewTimelineError,
  } = useQuery<
    { affiliateRelationshipTimeline: GQL.AffiliateRelationshipTimelinePayload },
    { input: GQL.AffiliateRelationshipTimelineInput }
  >(AFFILIATE_RELATIONSHIP_TIMELINE_QUERY, {
    variables: {
      input: {
        creatorRelationshipId: relationshipId ?? "",
        endAt: contextEndAt,
        limit: 10,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
  });
  const {
    data: reviewProposalHistoryData,
    loading: reviewProposalHistoryLoading,
    error: reviewProposalHistoryError,
  } = useQuery<
    AffiliateActionProposalPageData,
    { input: ReadAffiliateActionProposalPageInput }
  >(AFFILIATE_ACTION_PROPOSALS_QUERY, {
    variables: {
      input: {
        creatorRelationshipId: relationshipId ?? "",
        limit: 8,
      },
    },
    fetchPolicy: "cache-and-network",
    skip: !relationshipId,
  });

  useEffect(() => {
    if (covered) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [covered, onClose]);

  return (
    <div className="modal-backdrop affiliate-agent-work-detail-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-content affiliate-agent-work-detail-modal"
        data-tutorial-id="affiliate-attention-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header affiliate-agent-work-detail-header">
          <div className="affiliate-agent-work-detail-heading">
            <span>{t("ecommerce.affiliateWorkspace.agentWorkDetail.eyebrow")}</span>
            <h2 id={titleId}>{t("ecommerce.affiliateWorkspace.agentWorkDetail.title")}</h2>
            <p>
              <strong>{primaryShopLabel}</strong>
              <span>{formatActionProposalTypeLabel(proposal.type, t)}</span>
              <span className={`affiliate-kind-badge affiliate-kind-${proposal.status.toLowerCase()}`}>
                {t(`ecommerce.affiliateWorkspace.proposalFilters.${proposal.status}`, {
                  defaultValue: proposal.status,
                })}
              </span>
            </p>
          </div>
          <div className="affiliate-agent-work-detail-header-actions">
            <button
              className="modal-close-btn"
              data-tutorial-id="affiliate-attention-detail-close"
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
            >
              ×
            </button>
          </div>
        </div>
        <div className="affiliate-agent-work-detail-body">
          <AgentWorkReviewContext
            proposal={proposal}
            contextEndAt={contextEndAt}
            relationshipDetail={reviewRelationshipData?.affiliateCreatorRelationshipDetail ?? null}
            timelineItems={(reviewTimelineData?.affiliateRelationshipTimeline.items ?? [])
              .filter((item) => item.relatedIds.actionProposalId !== proposal.id)}
            previousAgentWork={(reviewProposalHistoryData?.affiliateActionProposalPage.items ?? [])
              .filter((item) => item.id !== proposal.id && proposalTimestamp(item.createdAt) <= proposalTimestamp(proposal.createdAt))
              .slice(0, 4)}
            loading={reviewRelationshipLoading || reviewTimelineLoading || reviewProposalHistoryLoading}
            failed={Boolean(reviewRelationshipError || reviewTimelineError || reviewProposalHistoryError)}
            shopLabelForId={shopLabelForId}
          />
          <div
            className="affiliate-agent-work-detail-main"
            data-tutorial-id="affiliate-attention-detail-decision"
          >
            <AgentWorkBundleCard
              proposal={proposal}
              revisionHistory={bundle.revisionHistory}
              shopLabel={primaryShopLabel}
              shopLabelForId={shopLabelForId}
              decidingProposal={decidingProposal}
              allowDecisionActions={isPending}
              showRevisionHistory={false}
              affiliateWorkspace={affiliateWorkspace}
              onOpenCreator={onOpenCreator}
              onApprove={isPending ? onApprove : undefined}
              onReject={isPending ? onReject : undefined}
              onRequestRevision={isPending ? onRequestRevision : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentWorkReviewContext({
  proposal,
  contextEndAt,
  relationshipDetail,
  timelineItems,
  previousAgentWork,
  loading,
  failed,
  shopLabelForId,
}: {
  proposal: GQL.ActionProposal;
  contextEndAt: string;
  relationshipDetail: GQL.AffiliateCreatorRelationshipDetailPayload | null;
  timelineItems: GQL.AffiliateRelationshipTimelineItem[];
  previousAgentWork: GQL.ActionProposal[];
  loading: boolean;
  failed: boolean;
  shopLabelForId: (shopId: string) => string;
}) {
  const { t } = useTranslation();
  const source = proposal.sourceWorkBoundary;
  const contextEntries = buildRelationshipTimelineEntries(timelineItems, [], t).slice(-8);
  const counts = relationshipDetail?.counts;
  const triggerFacts = [
    source?.workKind
      ? {
          label: t("ecommerce.affiliateWorkspace.agentWorkDetail.triggerWorkKind"),
          value: t(`ecommerce.affiliateWorkspace.workKinds.${source.workKind}`, {
            defaultValue: formatAffiliateEnumLabel(source.workKind),
          }),
        }
      : null,
    source?.triggerKind
      ? {
          label: t("ecommerce.affiliateWorkspace.agentWorkDetail.triggerKind"),
          value: t(`ecommerce.affiliateWorkspace.triggerKinds.${source.triggerKind}`, {
            defaultValue: formatAffiliateEnumLabel(source.triggerKind),
          }),
        }
      : null,
    source?.triggerChannel
      ? {
          label: t("ecommerce.affiliateWorkspace.agentWorkDetail.triggerChannel"),
          value: t(`ecommerce.affiliateWorkspace.messageChannels.${source.triggerChannel}`, {
            defaultValue: formatAffiliateEnumLabel(source.triggerChannel),
          }),
        }
      : null,
    source?.triggerShopId
      ? {
          label: t("ecommerce.affiliateWorkspace.agentWorkDetail.triggerShop"),
          value: shopLabelForId(source.triggerShopId),
        }
      : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));

  return (
    <aside
      className="affiliate-agent-review-context"
      data-tutorial-id="affiliate-attention-detail-context"
    >
      <div className="affiliate-agent-review-context-head">
        <span>{t("ecommerce.affiliateWorkspace.agentWorkDetail.contextEyebrow")}</span>
        <h3>{t("ecommerce.affiliateWorkspace.agentWorkDetail.contextTitle")}</h3>
        <p>{t("ecommerce.affiliateWorkspace.agentWorkDetail.contextSubtitle")}</p>
        <time dateTime={contextEndAt}>
          {t("ecommerce.affiliateWorkspace.agentWorkDetail.contextAsOf", {
            time: formatProposalTime(contextEndAt),
          })}
        </time>
      </div>

      {triggerFacts.length > 0 ? (
        <section className="affiliate-agent-review-context-section">
          <h4>{t("ecommerce.affiliateWorkspace.agentWorkDetail.triggerContext")}</h4>
          <div className="affiliate-agent-review-trigger-facts">
            {triggerFacts.map((fact) => (
              <div key={`${fact.label}-${fact.value}`}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="affiliate-agent-review-context-section">
        <div className="affiliate-agent-review-context-section-head">
          <h4>{t("ecommerce.affiliateWorkspace.agentWorkDetail.currentBusinessContext")}</h4>
          <span>{t("ecommerce.affiliateWorkspace.agentWorkDetail.currentBusinessContextHint")}</span>
        </div>
        {reviewContextHasCurrentFacts(relationshipDetail) ? (
          <div className="affiliate-agent-review-metrics">
            <RelationshipMetric
              label={t("ecommerce.affiliateWorkspace.creatorLastContactedAt")}
              value={relationshipDetail?.lastContactedAt
                ? formatProposalTime(relationshipDetail.lastContactedAt)
                : t("ecommerce.affiliateWorkspace.noRecentContact")}
            />
            <RelationshipMetric
              label={t("ecommerce.affiliateWorkspace.creatorDetail.followers")}
              value={formatCount(relationshipDetail?.performance?.followerCount) ?? "—"}
            />
            <RelationshipMetric
              label={t("ecommerce.affiliateWorkspace.agentWorkDetail.activeSampleApplications")}
              value={formatInteger(counts?.activeSampleApplicationCount ?? 0)}
            />
            <RelationshipMetric
              label={t("ecommerce.affiliateWorkspace.relationshipPanelPlatformCollaborations")}
              value={formatInteger(counts?.activePlatformCollaborationCount ?? 0)}
            />
          </div>
        ) : loading ? (
          <div className="affiliate-agent-review-context-state">{t("common.loading")}</div>
        ) : (
          <div className="affiliate-agent-review-context-state">—</div>
        )}
      </section>

      <section className="affiliate-agent-review-context-section affiliate-agent-review-history-section">
        <h4>{t("ecommerce.affiliateWorkspace.agentWorkDetail.recentContext")}</h4>
        {failed && contextEntries.length === 0 ? (
          <div className="affiliate-agent-review-context-state affiliate-agent-review-context-state-error">
            {t("ecommerce.affiliateWorkspace.agentWorkDetail.contextLoadFailed")}
          </div>
        ) : loading && contextEntries.length === 0 ? (
          <div className="affiliate-agent-review-context-state">{t("common.loading")}</div>
        ) : contextEntries.length > 0 ? (
          <div className="affiliate-agent-review-history">
            {contextEntries.map((entry) => entry.type === "time-passed" ? (
              <div className="affiliate-agent-review-history-gap" key={entry.id}>
                <span />
                <em>{entry.title}</em>
                <span />
              </div>
            ) : (
              <article className="affiliate-agent-review-history-item" key={entry.id}>
                <div className="affiliate-agent-review-history-meta">
                  <span>{entry.kind}</span>
                  <time dateTime={entry.time}>{formatProposalTime(entry.time)}</time>
                </div>
                <strong>{entry.title}</strong>
                {entry.detail ? <p>{entry.detail}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="affiliate-agent-review-context-state">
            {t("ecommerce.affiliateWorkspace.agentWorkDetail.noRecentContext")}
          </div>
        )}
        {previousAgentWork.length > 0 ? (
          <div className="affiliate-agent-review-previous-work">
            <h4>{t("ecommerce.affiliateWorkspace.agentWorkDetail.previousAgentWork")}</h4>
            <div className="affiliate-agent-review-previous-work-list">
              {previousAgentWork.map((item) => (
                <article key={item.id}>
                  <div>
                    <span>{formatActionProposalTypeLabel(item.type, t)}</span>
                    <span>{t(`ecommerce.affiliateWorkspace.proposalFilters.${item.status}`, {
                      defaultValue: item.status,
                    })}</span>
                    <time dateTime={item.createdAt}>{formatProposalTime(item.createdAt)}</time>
                  </div>
                  <p>{item.operatorSummary}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </aside>
  );
}

function reviewContextHasCurrentFacts(
  detail: GQL.AffiliateCreatorRelationshipDetailPayload | null,
): boolean {
  return Boolean(detail?.lastContactedAt || detail?.performance || detail?.counts);
}

function AgentWorkBundleCard({
  proposal,
  revisionHistory = proposal.revisionHistory ?? [],
  shopLabel,
  shopLabelForId,
  decidingProposal = false,
  variant = "full",
  allowDecisionActions,
  showRevisionHistory = false,
  affiliateWorkspace,
  onOpenRelationshipWork,
  onOpenCreator,
  onApprove,
  onReject,
  onRequestRevision,
}: {
  proposal: GQL.ActionProposal;
  revisionHistory?: GQL.ActionProposalRevisionSummary[];
  shopLabel: string;
  shopLabelForId?: (shopId: string) => string;
  decidingProposal?: boolean;
  variant?: "full" | "compact";
  allowDecisionActions?: boolean;
  showRevisionHistory?: boolean;
  affiliateWorkspace?: AffiliateWorkspaceStore;
  onOpenRelationshipWork?: (item: CreatorRelationshipWorkItem) => void;
  onOpenCreator?: (profile: GQL.AffiliateCreatorIdentity) => void;
  onApprove?: (proposal: GQL.ActionProposal) => Promise<boolean>;
  onReject?: (proposal: GQL.ActionProposal) => Promise<boolean>;
  onRequestRevision?: (proposal: GQL.ActionProposal, note: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [compactOpen, setCompactOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const creatorName = proposal.creatorProfile
    ? creatorPrimaryName(proposal.creatorProfile, t("ecommerce.affiliateWorkspace.unknownCreator"))
    : t("ecommerce.affiliateWorkspace.unknownCreator");
  const creatorHandle = proposal.creatorProfile ? creatorTikTokHandle(proposal.creatorProfile) : null;
  const creatorPlatformId = proposal.creatorProfile ? creatorPlatformIdentity(proposal.creatorProfile) : null;
  const openCreator = proposal.creatorProfile && onOpenCreator
    ? () => onOpenCreator(proposal.creatorProfile as GQL.AffiliateCreatorIdentity)
    : undefined;
  const sampleReviewRows = proposalSampleReviewRows(proposal);
  const manualTagRows = proposalManualTagRows(proposal);
  const recommendationTitle = renderAgentWorkRecommendationTitle(proposal, t);
  const executionDescription = sampleReviewRows.length > 0
    ? null
    : renderProposalExecutionDescription(proposal, t);
  const { text: messagePreview, contentCleared: messageContentCleared } =
    resolveProposalMessageDisplay(proposal);
  const showsBundledMessage = sampleReviewRows.length > 0 && proposalHasMessageIntent(proposal);
  const predictionSnapshot =
    sampleReviewRows.length === 0 &&
    proposal.type === GQL.ActionProposalType.ReviewSampleApplication
      ? findProposalPredictionSnapshot(proposal)
      : null;
  const isCompact = variant === "compact";
  const bodyExpanded = !isCompact || compactOpen;
  const canDecide =
    proposal.status === GQL.ActionProposalStatus.Pending &&
    Boolean(onApprove) &&
    (allowDecisionActions ?? !isCompact);
  const canRequestRevision = canDecide && Boolean(onRequestRevision);
  const sampleDecisionOverrideTarget = proposalSampleDecisionOverrideTarget(proposal);
  const canRejectOverride = canDecide && Boolean(onReject && sampleDecisionOverrideTarget);
  const approveActionLabel = sampleReviewRows.length === 1
    ? t(
        sampleReviewRows[0]?.decision === GQL.AffiliateSampleReviewDecision.Approve
          ? "ecommerce.affiliateWorkspace.sampleDecisionBundle.confirmSend"
          : "ecommerce.affiliateWorkspace.sampleDecisionBundle.confirmDoNotSend",
      )
    : sampleReviewRows.length > 1
      ? t("ecommerce.affiliateWorkspace.sampleDecisionBundle.approveBundle")
      : proposal.type === GQL.ActionProposalType.NoActionNeeded
        ? t("ecommerce.affiliateWorkspace.noActionDecision.confirm")
        : t("common.approve", { defaultValue: "Approve" });
  const trimmedRevisionNote = revisionNote.trim();
  const proposalStepCount = proposal.steps?.length ?? 0;
  const proposalStepCountLabel = proposalStepCount > 1
    ? t("ecommerce.affiliateWorkspace.activity.proposalStepCount", { count: proposalStepCount })
    : null;
  const revisionCount = Math.max(proposal.revisionNumber ?? 1, revisionHistory.length);
  const hasRevisionHistory = showRevisionHistory && revisionCount > 1;
  const detailItem = relationshipWorkItemFromProposal(proposal, affiliateWorkspace);
  const canOpenRelationshipWork = !isCompact && Boolean(detailItem && onOpenRelationshipWork);
  const openPrimaryTarget = () => {
    if (canOpenRelationshipWork && detailItem && onOpenRelationshipWork) onOpenRelationshipWork(detailItem);
  };
  const shouldShowProductSummary =
    sampleReviewRows.length === 0 && getProposalActionProductId(proposal) != null;
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
          {canRejectOverride ? (
            <button
              className="btn btn-secondary affiliate-proposal-override-button"
              type="button"
              disabled={decidingProposal}
              onClick={(event) => {
                event.stopPropagation();
                void onReject?.(proposal);
              }}
            >
              {t(
                sampleDecisionOverrideTarget === GQL.AffiliateSampleReviewDecision.Approve
                  ? "ecommerce.affiliateWorkspace.sampleDecisionBundle.overrideSend"
                  : "ecommerce.affiliateWorkspace.sampleDecisionBundle.overrideDoNotSend",
              )}
            </button>
          ) : null}
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
              void revisionPromise.then((succeeded) => {
                if (!succeeded) return;
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
          : approveActionLabel}
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
                onOpen={openCreator}
              />
              <div className="affiliate-creator-text">
                <CreatorName
                  name={creatorName}
                  onOpen={openCreator}
                />
                <CreatorPlatformId
                  handle={creatorHandle}
                  platformId={creatorPlatformId}
                />
                <div className="affiliate-work-item-meta">
                  <span>{shopLabel}</span>
                  <span>{formatProposalTime(proposal.createdAt)}</span>
                </div>
              </div>
            </div>
            <div className="affiliate-proposal-row-id-actions">
              <SystemIdCopy value={proposal.id} />
            </div>
          </div>

          <div className="affiliate-proposal-row-main">
            <div
              className="affiliate-proposal-row-heading"
              data-tutorial-id="affiliate-attention-queue"
            >
              <div>
                <div className="affiliate-card-section-label">
                  {t("ecommerce.affiliateWorkspace.labels.aiRecommendation")}
                </div>
                <div className="affiliate-card-section-title">{recommendationTitle}</div>
              </div>
              <div className="affiliate-work-bundle-heading-meta">
                {statusBadge}
                {hasRevisionHistory ? (
                  <button
                    className="affiliate-work-bundle-version-button"
                    type="button"
                    aria-expanded={historyOpen}
                    onClick={(event) => {
                      event.stopPropagation();
                      setHistoryOpen((value) => !value);
                    }}
                  >
                    {t("ecommerce.affiliateWorkspace.revisionHistory.versionCount", {
                      version: proposal.revisionNumber,
                      count: revisionCount,
                    })}
                  </button>
                ) : null}
              </div>
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
              {sampleReviewRows.length > 0 ? (
                <ProposalSampleDecisionBundle
                  rows={sampleReviewRows}
                  shopLabelForId={shopLabelForId ?? (() => shopLabel)}
                />
              ) : null}
              <ProposalManualTagChanges rows={manualTagRows} relationshipLabel={creatorName} />
              {showsBundledMessage ? (
                <section className="affiliate-card-section affiliate-card-bundled-message-section">
                  <div className="affiliate-card-section-label">
                    {t("ecommerce.affiliateWorkspace.agentWorkDetail.bundledMessage")}
                  </div>
                  {messagePreview ? (
                    <div className="affiliate-work-item-preview">{messagePreview}</div>
                  ) : messageContentCleared ? (
                    <div className="affiliate-card-section-copy affiliate-message-content-cleared">
                      {t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.SEND_MESSAGE_CONTENT_CLEARED")}
                    </div>
                  ) : (
                    <div className="affiliate-card-section-copy">
                      {t("ecommerce.affiliateWorkspace.agentWorkDetail.bundledMessageUnavailable")}
                    </div>
                  )}
                </section>
              ) : null}
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
                    {t(
                      proposal.status === GQL.ActionProposalStatus.Pending
                        ? "ecommerce.affiliateWorkspace.labels.whatWillHappen"
                        : "ecommerce.affiliateWorkspace.labels.currentSituation",
                    )}
                  </div>
                  <div className="affiliate-card-section-copy">{executionDescription}</div>
                  {messagePreview ? (
                    <div className="affiliate-work-item-preview">{messagePreview}</div>
                  ) : messageContentCleared ? (
                    <div className="affiliate-card-section-copy affiliate-message-content-cleared">
                      {t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.SEND_MESSAGE_CONTENT_CLEARED")}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>

          <aside className="affiliate-proposal-row-decision" onClick={(event) => event.stopPropagation()}>
            <div className="affiliate-proposal-row-decision-meta">
              <span>{formatActionProposalTypeLabel(proposal.type, t)}</span>
              {proposalStepCountLabel ? <span>{proposalStepCountLabel}</span> : null}
              <strong>{formatProposalTime(proposal.createdAt)}</strong>
            </div>
            {decisionActions}
          </aside>
        </div>
        {historyOpen ? (
          <AgentWorkRevisionHistory
            currentProposalId={proposal.id}
            versions={revisionHistory}
          />
        ) : null}
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
            onOpen={openCreator}
          />
          <div className="affiliate-creator-text">
            <CreatorName
              name={creatorName}
              onOpen={openCreator}
            />
            <CreatorPlatformId
              handle={creatorHandle}
              platformId={creatorPlatformId}
            />
            <div className="affiliate-work-item-meta">
              <span>{shopLabel}</span>
              <span>{formatProposalTime(proposal.createdAt)}</span>
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
              <span>{formatProposalTime(proposal.createdAt)}</span>
            </div>
          ) : null}
        </section>
        {bodyExpanded ? (
          <>
            {sampleReviewRows.length > 0 ? (
              <ProposalSampleDecisionBundle
                rows={sampleReviewRows}
                shopLabelForId={shopLabelForId ?? (() => shopLabel)}
              />
            ) : null}
            <ProposalManualTagChanges rows={manualTagRows} relationshipLabel={creatorName} />
            {showsBundledMessage ? (
              <section className="affiliate-card-section affiliate-card-bundled-message-section">
                <div className="affiliate-card-section-label">
                  {t("ecommerce.affiliateWorkspace.agentWorkDetail.bundledMessage")}
                </div>
                {messagePreview ? (
                  <div className="affiliate-work-item-preview">{messagePreview}</div>
                ) : messageContentCleared ? (
                  <div className="affiliate-card-section-copy affiliate-message-content-cleared">
                    {t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.SEND_MESSAGE_CONTENT_CLEARED")}
                  </div>
                ) : (
                  <div className="affiliate-card-section-copy">
                    {t("ecommerce.affiliateWorkspace.agentWorkDetail.bundledMessageUnavailable")}
                  </div>
                )}
              </section>
            ) : null}
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
                  {t(
                    proposal.status === GQL.ActionProposalStatus.Pending
                      ? "ecommerce.affiliateWorkspace.labels.whatWillHappen"
                      : "ecommerce.affiliateWorkspace.labels.currentSituation",
                  )}
                </div>
                <div className="affiliate-card-section-copy">{executionDescription}</div>
                {messagePreview ? (
                  <div className="affiliate-work-item-preview">{messagePreview}</div>
                ) : messageContentCleared ? (
                  <div className="affiliate-card-section-copy affiliate-message-content-cleared">
                    {t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.SEND_MESSAGE_CONTENT_CLEARED")}
                  </div>
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

function AgentWorkRevisionHistory({
  currentProposalId,
  versions,
}: {
  currentProposalId: string;
  versions: GQL.ActionProposalRevisionSummary[];
}) {
  const { t } = useTranslation();
  if (versions.length < 2) return null;

  return (
    <section
      className="affiliate-work-bundle-revision-history"
      aria-label={t("ecommerce.affiliateWorkspace.revisionHistory.title")}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="affiliate-work-bundle-revision-head">
        <strong>{t("ecommerce.affiliateWorkspace.revisionHistory.title")}</strong>
        <span>{t("ecommerce.affiliateWorkspace.revisionHistory.hint")}</span>
      </div>
      <ol>
        {versions.map((version) => (
          <li
            key={version.id}
            className={version.id === currentProposalId ? "affiliate-work-bundle-revision-current" : undefined}
          >
            <div className="affiliate-work-bundle-revision-meta">
              <strong>V{version.revisionNumber}</strong>
              <span>{formatActionProposalTypeLabel(version.type, t)}</span>
              <span>{t(`ecommerce.affiliateWorkspace.proposalFilters.${version.status}`, {
                defaultValue: version.status,
              })}</span>
              <time dateTime={version.createdAt}>{formatProposalTime(version.createdAt)}</time>
            </div>
            <p>{version.operatorSummary}</p>
            {version.decision?.note ? <blockquote>{version.decision.note}</blockquote> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function summarizeSampleProposalReviewRows(
  rows: AffiliateSampleProposalReviewRow[],
): { approveCount: number; rejectCount: number } {
  return rows.reduce(
    (summary, row) => {
      if (row.decision === GQL.AffiliateSampleReviewDecision.Approve) {
        summary.approveCount += 1;
      } else if (row.decision === GQL.AffiliateSampleReviewDecision.Reject) {
        summary.rejectCount += 1;
      }
      return summary;
    },
    { approveCount: 0, rejectCount: 0 },
  );
}

export function proposalSampleDecisionOverrideTarget(
  proposal: GQL.ActionProposal,
): GQL.AffiliateSampleReviewDecision | null {
  const sources = proposal.steps?.length ? proposal.steps : [proposal];
  if (
    sources.length !== 1
    || proposal.type !== GQL.ActionProposalType.ReviewSampleApplication
    || !isPureSampleReviewProposalSource(proposal)
    || !isPureSampleReviewProposalSource(sources[0]!)
  ) {
    return null;
  }
  const agentDecision = sources[0]!.sampleReviewIntent?.decision;
  if (agentDecision === GQL.AffiliateSampleReviewDecision.Approve) {
    return GQL.AffiliateSampleReviewDecision.Reject;
  }
  if (agentDecision === GQL.AffiliateSampleReviewDecision.Reject) {
    return GQL.AffiliateSampleReviewDecision.Approve;
  }
  return null;
}

function isPureSampleReviewProposalSource(source: {
  type?: GQL.ActionProposalType | null;
  candidateDecisionIntent?: unknown;
  messageIntent?: unknown;
  sampleReviewIntent?: GQL.ActionProposalSampleReviewIntent | null;
  sampleShipmentIntent?: unknown;
  creatorTagIntent?: unknown;
  blockCreatorIntent?: unknown;
  campaignProductUpdateIntent?: unknown;
  approvalPolicyUpdateIntent?: unknown;
}): boolean {
  return source.type === GQL.ActionProposalType.ReviewSampleApplication
    && source.sampleReviewIntent != null
    && source.candidateDecisionIntent == null
    && source.messageIntent == null
    && source.sampleShipmentIntent == null
    && source.creatorTagIntent == null
    && source.blockCreatorIntent == null
    && source.campaignProductUpdateIntent == null
    && source.approvalPolicyUpdateIntent == null;
}

export function proposalSampleReviewRows(
  proposal: GQL.ActionProposal,
): AffiliateSampleProposalReviewRow[] {
  const sampleSteps = (proposal.steps ?? []).filter(
    (step) =>
      step.type === GQL.ActionProposalType.ReviewSampleApplication ||
      Boolean(step.sampleReviewIntent),
  );
  const sources: Array<{
    stepId: string;
    shopId: string | null;
    sampleApplicationRecordId: string | null;
    productId: string | null;
    predictionCacheIds: string[];
    sampleReviewIntent: GQL.ActionProposalSampleReviewIntent;
  }> = sampleSteps.length > 0
    ? sampleSteps
        .filter((step): step is GQL.ActionProposalStep & {
          sampleReviewIntent: GQL.ActionProposalSampleReviewIntent;
        } => Boolean(step.sampleReviewIntent))
        .map((step) => ({
          stepId: step.stepId,
          shopId: step.shopId ?? null,
          sampleApplicationRecordId:
            step.sampleReviewIntent.sampleApplicationRecordId ??
            step.sampleApplicationRecordId ??
            null,
          productId: step.productId ?? null,
          predictionCacheIds: step.predictionCacheIds ?? [],
          sampleReviewIntent: step.sampleReviewIntent,
        }))
    : proposal.sampleReviewIntent
      ? [{
          stepId: proposal.id,
          // FROZEN-LEGACY (focusShopId): stepless pre-steps-era proposals only;
          // their single frozen anchor is the honest shop of the one intent.
          shopId: proposal.focusShopId ?? null,
          sampleApplicationRecordId:
            proposal.sampleReviewIntent.sampleApplicationRecordId ??
            proposal.sampleApplicationRecordId ??
            null,
          productId:
            proposal.productId ??
            proposal.sampleApplicationRecord?.productId ??
            null,
          predictionCacheIds: proposal.predictionCacheIds ?? [],
          sampleReviewIntent: proposal.sampleReviewIntent,
        }]
      : [];

  const snapshots = (proposal.predictionSnapshots ?? []) as AffiliatePredictionSnapshotView[];
  return sources.map((source) => {
    const snapshot = findPredictionSnapshotForSampleSource(
      snapshots,
      source,
      sources.length === 1,
    );
    const productId =
      source.productId ??
      snapshot?.resolvedContext?.productId ??
      snapshot?.subject?.productId ??
      null;
    const productSummary = proposal.productSummary?.productId === productId
      ? proposal.productSummary
      : null;
    const productSellerSku = productSummary?.skus
      ?.map((sku) => sku.sellerSku?.trim())
      .find((sellerSku): sellerSku is string => Boolean(sellerSku)) ?? null;
    return {
      stepId: source.stepId,
      shopId: source.shopId,
      sampleApplicationRecordId: source.sampleApplicationRecordId,
      platformApplicationId: source.sampleReviewIntent.platformApplicationId ?? null,
      productId,
      productTitle:
        snapshot?.resolvedContext?.productTitle ??
        productSummary?.title ??
        (sources.length === 1 ? proposal.productSummary?.title ?? null : null),
      productSellerSku,
      decision: source.sampleReviewIntent.decision,
      rejectReason: source.sampleReviewIntent.rejectReason ?? null,
      rejectReasonExplanation:
        source.sampleReviewIntent.rejectReasonExplanation?.trim() || null,
      predictionSnapshot: snapshot,
    };
  });
}

function findPredictionSnapshotForSampleSource(
  snapshots: AffiliatePredictionSnapshotView[],
  source: {
    predictionCacheIds: string[];
    sampleApplicationRecordId: string | null;
    productId: string | null;
    shopId: string | null;
    sampleReviewIntent: GQL.ActionProposalSampleReviewIntent;
  },
  allowSingleSnapshotFallback: boolean,
): AffiliatePredictionSnapshotView | null {
  if (!snapshots.length) return null;
  const cacheIds = new Set(source.predictionCacheIds);
  const platformApplicationId = source.sampleReviewIntent.platformApplicationId ?? null;
  const ranked = snapshots
    .map((snapshot) => {
      let score = 0;
      if (snapshot.sourceCacheId && cacheIds.has(snapshot.sourceCacheId)) score += 100;
      if (
        source.sampleApplicationRecordId &&
        (snapshot.subject?.sampleApplicationRecordId === source.sampleApplicationRecordId ||
          snapshot.resolvedContext?.sampleApplicationRecordId === source.sampleApplicationRecordId)
      ) score += 80;
      if (
        platformApplicationId &&
        (snapshot.subject?.platformApplicationId === platformApplicationId ||
          snapshot.resolvedContext?.platformApplicationId === platformApplicationId)
      ) score += 70;
      if (
        score > 0 &&
        source.productId &&
        (snapshot.subject?.productId === source.productId ||
          snapshot.resolvedContext?.productId === source.productId)
      ) score += 10;
      if (score > 0 && source.shopId && snapshot.resolvedContext?.shopId === source.shopId) {
        score += 5;
      }
      return { snapshot, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return sortPredictionSnapshotsByCaptureTime([a.snapshot, b.snapshot])[0] === a.snapshot
        ? -1
        : 1;
    });
  if (ranked[0]) return ranked[0].snapshot;
  if (allowSingleSnapshotFallback && snapshots.length === 1) return snapshots[0];
  return null;
}

function ProposalSampleDecisionBundle({
  rows,
  shopLabelForId,
}: {
  rows: AffiliateSampleProposalReviewRow[];
  shopLabelForId: (shopId: string) => string;
}) {
  const { t } = useTranslation();
  const summary = summarizeSampleProposalReviewRows(rows);
  return (
    <section
      className="affiliate-sample-decision-bundle"
      aria-label={t("ecommerce.affiliateWorkspace.sampleDecisionBundle.title")}
    >
      <div className="affiliate-sample-decision-bundle-head">
        <div>
          <div className="affiliate-card-section-label">
            {t("ecommerce.affiliateWorkspace.sampleDecisionBundle.title")}
          </div>
          <strong>
            {t("ecommerce.affiliateWorkspace.sampleDecisionBundle.summary", {
              count: rows.length,
              approveCount: summary.approveCount,
              rejectCount: summary.rejectCount,
            })}
          </strong>
        </div>
        <span>{t("ecommerce.affiliateWorkspace.sampleDecisionBundle.approvalScope")}</span>
      </div>
      <div className="affiliate-sample-decision-list">
        {rows.map((row, index) => {
          const evidenceState = resolvePredictionEvidenceState(row.predictionSnapshot);
          const evidence =
            evidenceState?.kind === "EVIDENCE" ? evidenceState.evidence : null;
          const highlightTarget = evidence
            ? predictionEvidenceHighlightTarget(evidence)
            : "NONE";
          const unavailableLabel = t("ecommerce.affiliateWorkspace.sampleDecisionBundle.unavailable");
          const evidenceStateFallback =
            evidenceState?.kind === "CONTRACT_VIOLATION"
              ? t("ecommerce.affiliateWorkspace.predictionComparison.evidenceMissing")
              : evidenceState?.kind === "REQUEST_FAILED"
                ? `${unavailableLabel} (${evidenceState.status})`
                : unavailableLabel;
          const expectedSales =
            evidence?.expectedSales.status === GQL.AffiliateModelSignalStatus.Ready
              && evidence.expectedSales.value
              ? formatExpectedSalesUnits(evidence.expectedSales.value.units)
              : null;
          const expectedSalesFallback = evidence
            ? predictionSignalFallbackLabel(evidence.expectedSales, unavailableLabel)
              ?? unavailableLabel
            : evidenceStateFallback;
          const humanDecision =
            evidence?.humanDecision.status === GQL.AffiliateModelSignalStatus.Ready
              && evidence.humanDecision.value
              ? evidence.humanDecision.value.wouldApprove
              : null;
          const humanDecisionFallback = evidence
            ? predictionSignalFallbackLabel(evidence.humanDecision, unavailableLabel)
              ?? unavailableLabel
            : evidenceStateFallback;
          const approves = row.decision === GQL.AffiliateSampleReviewDecision.Approve;
          const productLabel = row.productTitle
            || (row.productSellerSku
              ? `${t("ecommerce.affiliateWorkspace.sampleDecisionBundle.sellerSku")} ${row.productSellerSku}`
              : row.productId || t("ecommerce.affiliateWorkspace.sampleDecisionBundle.unknownProduct"));
          const rejectReasonLabel = row.rejectReason
            ? t(`ecommerce.affiliateWorkspace.sampleDecisionBundle.rejectReasons.${row.rejectReason}`, {
                defaultValue: formatAffiliateEnumLabel(row.rejectReason),
              })
            : null;
          const decisionLabel = approves
            ? t("ecommerce.affiliateWorkspace.sampleDecisionBundle.approve")
            : rejectReasonLabel && row.rejectReasonExplanation
              ? t("ecommerce.affiliateWorkspace.sampleDecisionBundle.rejectWithReasonExplanation", {
                  reason: rejectReasonLabel,
                  explanation: row.rejectReasonExplanation,
                })
              : rejectReasonLabel
              ? t("ecommerce.affiliateWorkspace.sampleDecisionBundle.rejectWithReason", {
                  reason: rejectReasonLabel,
                })
              : t("ecommerce.affiliateWorkspace.sampleDecisionBundle.reject");
          return (
            <article className="affiliate-sample-decision-row" key={row.stepId}>
              <div className="affiliate-sample-decision-identity">
                <span className="affiliate-sample-decision-index">{index + 1}</span>
                <div>
                  <strong>{productLabel}</strong>
                  <div className="affiliate-sample-decision-identifiers">
                    <span>
                      {t("ecommerce.affiliateWorkspace.sampleDecisionBundle.localApplication")}
                    </span>
                    <SystemIdCopy value={row.sampleApplicationRecordId} />
                    <PlatformIdCopy value={row.platformApplicationId} />
                    <span>
                      {t("ecommerce.affiliateWorkspace.sampleDecisionBundle.shop")}：
                      {row.shopId
                        ? shopLabelForId(row.shopId)
                        : t("ecommerce.affiliateWorkspace.sampleDecisionBundle.unknownShop")}
                    </span>
                  </div>
                </div>
              </div>
              <div
                className={
                  highlightTarget === "EXPECTED_SALES"
                    ? "affiliate-sample-decision-metric affiliate-sample-decision-signal"
                    : "affiliate-sample-decision-metric affiliate-sample-decision-history"
                }
              >
                <span>{t("ecommerce.affiliateWorkspace.predictionComparison.expectedSales")}</span>
                <strong>{expectedSales ?? expectedSalesFallback}</strong>
              </div>
              <div className="affiliate-sample-decision-metric">
                <span>{t("ecommerce.affiliateWorkspace.sampleDecisionBundle.agentDecision")}</span>
                <strong className={approves ? "affiliate-sample-decision-approve" : "affiliate-sample-decision-reject"}>
                  {decisionLabel}
                </strong>
              </div>
              <div
                className={
                  highlightTarget === "HUMAN_DECISION"
                    ? "affiliate-sample-decision-metric affiliate-sample-decision-signal"
                    : "affiliate-sample-decision-metric affiliate-sample-decision-history"
                }
              >
                <span>
                  {t(
                    highlightTarget === "HUMAN_DECISION"
                      ? "ecommerce.affiliateWorkspace.predictionComparison.merchantApprovalTendency"
                      : "ecommerce.affiliateWorkspace.sampleDecisionBundle.historicalStaff",
                  )}
                </span>
                <strong>
                  {humanDecision == null
                    ? humanDecisionFallback
                    : t(
                        humanDecision
                          ? "ecommerce.affiliateWorkspace.sampleDecisionBundle.approve"
                          : "ecommerce.affiliateWorkspace.sampleDecisionBundle.reject",
                      )}
                </strong>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProposalPredictionComparison({
  snapshot,
}: {
  snapshot: AffiliatePredictionSnapshotView | null;
}) {
  const { t } = useTranslation();
  if (!snapshot) return null;
  const evidenceState = resolvePredictionEvidenceState(snapshot);
  if (!evidenceState || evidenceState.kind !== "EVIDENCE") {
    // REQUEST_FAILED: the prediction request itself failed — render the
    // snapshot's own status/message. CONTRACT_VIOLATION: snapshot OK but the
    // frozen evidence is absent — surface it explicitly, never guess.
    return (
      <section className="affiliate-prediction-comparison" aria-label={t("ecommerce.affiliateWorkspace.predictionComparison.title")}>
        <div className="affiliate-prediction-comparison-head">
          <span>{t("ecommerce.affiliateWorkspace.predictionComparison.title")}</span>
        </div>
        <div className="td-meta">
          {evidenceState?.kind === "REQUEST_FAILED"
            ? `${t("ecommerce.affiliateWorkspace.predictionComparison.modelUnavailable")} · ${formatAffiliateEnumLabel(evidenceState.status)}${
                evidenceState.message ? ` · ${evidenceState.message}` : ""
              }`
            : t("ecommerce.affiliateWorkspace.predictionComparison.evidenceMissing")}
        </div>
      </section>
    );
  }
  const evidence = evidenceState.evidence;
  const highlightTarget = predictionEvidenceHighlightTarget(evidence);
  const expectedSalesSignal = evidence.expectedSales;
  const humanDecisionSignal = evidence.humanDecision;
  const expectedSalesValue =
    expectedSalesSignal.status === GQL.AffiliateModelSignalStatus.Ready
      ? expectedSalesSignal.value ?? null
      : null;
  const humanDecisionValue =
    humanDecisionSignal.status === GQL.AffiliateModelSignalStatus.Ready
      ? humanDecisionSignal.value ?? null
      : null;
  const unavailableLabel = t("ecommerce.affiliateWorkspace.predictionComparison.modelUnavailable");

  const predictionJudgmentLabel = getPredictionSalesJudgmentLabel(
    expectedSalesValue?.units ?? null,
    t,
  );
  const humanDecisionLabel = humanDecisionValue
    ? humanDecisionValue.wouldApprove
      ? t("ecommerce.affiliateWorkspace.predictionComparison.humanWouldApprove")
      : t("ecommerce.affiliateWorkspace.predictionComparison.humanWouldReject")
    : humanDecisionSignal.status === GQL.AffiliateModelSignalStatus.Ready
      ? t("ecommerce.affiliateWorkspace.predictionComparison.humanInsufficient")
      : predictionSignalFallbackLabel(humanDecisionSignal, unavailableLabel)
        ?? unavailableLabel;
  const probability = typeof humanDecisionValue?.approvalProbability === "number"
    ? formatPercent(humanDecisionValue.approvalProbability)
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
        <div
          className={
            highlightTarget === "HUMAN_DECISION"
              ? "affiliate-prediction-metric affiliate-prediction-metric-signal"
              : "affiliate-prediction-metric"
          }
        >
          <span>
            {t(
              highlightTarget === "HUMAN_DECISION"
                ? "ecommerce.affiliateWorkspace.predictionComparison.merchantApprovalTendency"
                : "ecommerce.affiliateWorkspace.predictionComparison.humanDecision",
            )}
          </span>
          <strong>{humanDecisionLabel}</strong>
          {probability ? (
            <small>
              {t("ecommerce.affiliateWorkspace.predictionComparison.humanApprovalProbability", { probability })}
            </small>
          ) : null}
          {highlightTarget === "HUMAN_DECISION" ? (
            <small>
              {t("ecommerce.affiliateWorkspace.predictionComparison.merchantApprovalTendencyHint")}
            </small>
          ) : null}
          {humanDecisionSignal.selection?.effectiveScope ? (
            <small>
              {t("ecommerce.affiliateWorkspace.predictionComparison.effectiveScope", {
                scope: humanDecisionSignal.selection.effectiveScope,
              })}
            </small>
          ) : null}
        </div>
        <div
          className={
            highlightTarget === "EXPECTED_SALES"
              ? "affiliate-prediction-metric affiliate-prediction-metric-signal"
              : "affiliate-prediction-metric"
          }
        >
          <span>
            {t("ecommerce.affiliateWorkspace.predictionComparison.expectedSales")}
          </span>
          <strong>
            {expectedSalesValue
              ? t("ecommerce.affiliateWorkspace.predictionComparison.expectedSalesValue", {
                  units: formatExpectedSalesUnits(expectedSalesValue.units),
                })
              : expectedSalesSignal.status === GQL.AffiliateModelSignalStatus.Ready
                ? t("ecommerce.affiliateWorkspace.predictionComparison.unknown")
                : predictionSignalFallbackLabel(expectedSalesSignal, unavailableLabel)
                  ?? unavailableLabel}
          </strong>
          {expectedSalesSignal.selection?.effectiveScope ? (
            <small>
              {t("ecommerce.affiliateWorkspace.predictionComparison.effectiveScope", {
                scope: expectedSalesSignal.selection.effectiveScope,
              })}
            </small>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export type AffiliatePredictionHighlightTarget =
  | "EXPECTED_SALES"
  | "HUMAN_DECISION"
  | "NONE";

/**
 * 1:1 mapping from the backend-frozen evidence mode to the highlighted cell.
 * No derivation: the backend already resolved the either-or evidence contract
 * (ADR-058) when it froze the evidence.
 */
export function predictionEvidenceHighlightTarget(
  evidence: Pick<GQL.AffiliatePredictionEvidence, "evidenceMode">,
): AffiliatePredictionHighlightTarget {
  if (evidence.evidenceMode === GQL.AffiliatePredictionEvidenceMode.ExpectedSalesTrusted) {
    return "EXPECTED_SALES";
  }
  if (evidence.evidenceMode === GQL.AffiliatePredictionEvidenceMode.MerchantApprovalTendency) {
    return "HUMAN_DECISION";
  }
  return "NONE";
}

/**
 * Fallback text for a family signal that has no displayable value.
 * READY → null (the value renders instead). NOT_AVAILABLE → the plain
 * unavailable text: it is the sanctioned absence, never annotated with a
 * status code. ERROR → unavailable text plus the family's real error code.
 * The signal status itself is never printed, so "不可用 (OK)" cannot occur.
 */
export function predictionSignalFallbackLabel(
  signal: AffiliatePredictionSignalLike,
  unavailableText: string,
): string | null {
  if (signal.status === GQL.AffiliateModelSignalStatus.Ready) return null;
  if (signal.status === GQL.AffiliateModelSignalStatus.Error) {
    return `${unavailableText} (${signal.error?.code || "ERROR"})`;
  }
  return unavailableText;
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
  const productId = getProposalActionProductId(proposal);
  const product = productId && proposal.productSummary?.productId === productId
    ? proposal.productSummary
    : null;
  return (
    <ProductSummaryCard
      product={product}
      productId={productId}
      // FROZEN-LEGACY-UNTIL-REMOVAL (focusShopId): product context is one
      // shop's catalog; the removal batch derives it from the product-bearing
      // step instead of the fabricated anchor.
      shopId={proposal.focusShopId}
      label={label}
    />
  );
}

function relationshipWorkItemFromProposal(
  proposal: GQL.ActionProposal,
  workspace?: AffiliateWorkspaceStore,
): CreatorRelationshipWorkItem | null {
  const projection = relationshipProjectionSnapshot(workspace, proposal.creatorRelationshipId);
  const proposalProjection = proposalProjectionSnapshot(workspace, proposal.id);
  const hydratedProposal = hydrateAffiliateProposalProjection(proposalProjection ?? { proposal });
  const relationshipId = hydratedProposal.creatorRelationshipId
    ?? hydratedProposal.sourceWorkBoundary?.creatorRelationshipId;
  if (!relationshipId) return null;
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
    relationshipId,
    // FROZEN-LEGACY-UNTIL-REMOVAL (focusShopId): CreatorRelationshipWorkItem
    // carries a single shop slot; the removal batch owns its multi-shop rule.
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
      ? reconcileAgendaProcessingStatusWithPendingProposals(
          relationshipProcessingStatusFromAgendaOwner(primaryAgenda.owner),
          pendingProposals.length > 0,
        )
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

// The agenda cannot see PENDING proposals (its builder loads only
// REVISION_REQUESTED ones), so an item stays AGENT-owned after the Agent has
// produced its proposal; with one pending, the decision waits on staff.
// Mirrors the backend's reconcileProcessingStatusWithOpenProposal.
export function reconcileAgendaProcessingStatusWithPendingProposals(
  status: GQL.AffiliateRelationshipProcessingStatus,
  hasPendingProposals: boolean,
): GQL.AffiliateRelationshipProcessingStatus {
  if (
    hasPendingProposals &&
    status === GQL.AffiliateRelationshipProcessingStatus.AgentRequired
  ) {
    return GQL.AffiliateRelationshipProcessingStatus.StaffRequired;
  }
  return status;
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
  onOpen,
}: {
  avatarUrl?: string | null;
  className: string;
  fallbackClassName?: string;
  name: string;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  const handleImageError = useCallback(() => setFailed(true), []);

  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const avatar = !avatarUrl || failed
    ? (
      <div className={`${className} ${fallbackClassName ?? ""}`.trim()} aria-hidden="true">
        {initial}
      </div>
    )
    : (
      <RemoteMediaImage
        alt=""
        cachePolicy="force"
        className={className}
        loading="lazy"
        onImageError={handleImageError}
        sourceUrl={avatarUrl}
      />
    );

  if (!onOpen) return avatar;

  return (
    <button
      className="affiliate-creator-avatar-button"
      type="button"
      title={t("ecommerce.affiliateWorkspace.openCreatorDetail")}
      aria-label={t("ecommerce.affiliateWorkspace.openCreatorDetail")}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
    >
      {avatar}
    </button>
  );
}

export function CreatorRelationshipDetailModal({
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
    return shop?.alias || shop?.shopName || t("ecommerce.affiliateWorkspace.sampleDecisionBundle.unknownShop");
  };
  const [relationshipOwnerId, setRelationshipOwnerId] = useState(relationship?.businessDeveloperId ?? "");
  const [pendingOwnershipConfirmation, setPendingOwnershipConfirmation] = useState<
    { kind: "OWNER"; nextOwnerId: string } | { kind: "PROTECTION" } | null
  >(null);
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
  const lastManualTagChange = latestManualTagChange(relationshipTimeline?.items ?? []);
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

  function updateRelationshipOwner(nextOwnerId: string): void {
    if (!relationshipId || ownershipBusy || nextOwnerId === relationshipOwnerId) return;
    setPendingOwnershipConfirmation({ kind: "OWNER", nextOwnerId });
  }

  async function applyRelationshipOwner(nextOwnerId: string): Promise<void> {
    if (!relationshipId || ownershipBusy || nextOwnerId === relationshipOwnerId) return;
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

  function toggleRelationshipProtection(): void {
    if (!relationshipId || ownershipBusy) return;
    setPendingOwnershipConfirmation({ kind: "PROTECTION" });
  }

  async function applyRelationshipProtectionChange(): Promise<void> {
    if (!relationshipId || ownershipBusy) return;
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

  function confirmOwnershipChange(): void {
    const confirmation = pendingOwnershipConfirmation;
    if (!confirmation) return;
    setPendingOwnershipConfirmation(null);
    if (confirmation.kind === "OWNER") {
      void applyRelationshipOwner(confirmation.nextOwnerId);
      return;
    }
    void applyRelationshipProtectionChange();
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
            </section>
            {relationshipId ? (
              <AffiliateCreatorManualTagEditor
                relationshipId={relationshipId}
                manualTags={relationship?.manualTags ?? []}
                lastChange={lastManualTagChange}
                onChanged={() => {
                  void refetchRelationshipDetail();
                  void refetchRelationshipTimeline();
                }}
              />
            ) : null}
            <section className="affiliate-relationship-work-side-card affiliate-relationship-owner-card">
              <div className="affiliate-relationship-work-side-card-head">
                <span>{t("ecommerce.affiliateWorkspace.relationshipOwner")}</span>
                <strong>{effectiveAiLabel}</strong>
              </div>
              <label>
                <span>{t("ecommerce.affiliateWorkspace.relationshipOwnerLabel")}</span>
                <Select
                  value={relationshipOwnerId}
                  onChange={updateRelationshipOwner}
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
                  onClick={toggleRelationshipProtection}
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
                  label={t("ecommerce.affiliateWorkspace.agentWorkDetail.activeSampleApplications")}
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
                      <span className="affiliate-relationship-shop-tier">
                        {t("ecommerce.affiliateWorkspace.sampleTierColumnLabel")}: {creatorSampleTierDisplay(
                          t,
                          rawShopStates.find((state) => state.shopId === summary.shopId)?.sampleTier,
                        )}
                      </span>
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
                          <span>{t("ecommerce.affiliateWorkspace.agentWorkDetail.activeSampleApplications")}</span>
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
                          <AgentWorkBundleCard
                            key={proposal.id}
                            proposal={proposal}
                            shopLabel={t("ecommerce.affiliateWorkspace.relationshipAcrossShops")}
                            shopLabelForId={relationshipShopName}
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
                          <AgentWorkBundleCard
                            key={proposal.id}
                            proposal={proposal}
                            // FROZEN-LEGACY-UNTIL-REMOVAL (focusShopId):
                            // single-shop label slot, same rule as the timeline.
                            shopLabel={relationshipShopName(proposal.focusShopId)}
                            shopLabelForId={relationshipShopName}
                            variant="compact"
                          />
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
      <ConfirmDialog
        isOpen={Boolean(pendingOwnershipConfirmation)}
        onCancel={() => setPendingOwnershipConfirmation(null)}
        onConfirm={confirmOwnershipChange}
        title={pendingOwnershipConfirmation?.kind === "OWNER"
          ? t("ecommerce.affiliateWorkspace.relationshipOwner")
          : t("ecommerce.affiliateWorkspace.relationshipAiParticipation")}
        message={pendingOwnershipConfirmation?.kind === "OWNER"
          ? t("ecommerce.affiliateWorkspace.relationshipOwnerChangeConfirm")
          : t("ecommerce.affiliateWorkspace.relationshipProtectionChangeConfirm")}
        confirmLabel={pendingOwnershipConfirmation?.kind === "OWNER"
          ? t("ecommerce.affiliateTeam.assignDeveloper")
          : relationshipProtection
            ? t("ecommerce.affiliateTeam.removeProtection", { defaultValue: "Remove protection" })
            : t("ecommerce.affiliateTeam.addProtectedCreator")}
        cancelLabel={t("common.cancel")}
        confirmVariant={pendingOwnershipConfirmation?.kind === "OWNER" ? "primary" : "danger"}
      />
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

export function getProposalActionProductId(proposal: GQL.ActionProposal | null): string | null {
  if (!proposal) return null;
  const directProductId = proposal.messageIntent?.parts.find((part) => part.productId)?.productId
    ?? proposal.campaignProductUpdateIntent?.productId
    ?? (proposal.sampleReviewIntent ? proposal.productId : null)
    ?? null;
  if (directProductId) return directProductId;
  for (const step of proposal.steps ?? []) {
    const stepProductId = step.messageIntent?.parts.find((part) => part.productId)?.productId
      ?? step.campaignProductUpdateIntent?.productId
      ?? (step.sampleReviewIntent ? step.productId : null)
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

/**
 * Classifies a snapshot's backend-frozen evidence:
 * - EVIDENCE: the typed `predictionEvidence` field is present (written
 *   verbatim by the backend at prediction time).
 * - REQUEST_FAILED: evidence is null and the snapshot's own status is not OK
 *   — the prediction request itself failed; render from status/message.
 * - CONTRACT_VIOLATION: snapshot status OK but evidence absent — the backend
 *   contract guarantees evidence on successful requests, so surface it loudly
 *   instead of guessing.
 */
export function resolvePredictionEvidenceState(
  snapshot: AffiliatePredictionSnapshotView | null,
): AffiliatePredictionEvidenceState | null {
  if (!snapshot) return null;
  if (snapshot.predictionEvidence) {
    return { kind: "EVIDENCE", evidence: snapshot.predictionEvidence };
  }
  if (snapshot.status !== "OK") {
    return {
      kind: "REQUEST_FAILED",
      status: snapshot.status,
      message: snapshot.message ?? null,
    };
  }
  return { kind: "CONTRACT_VIOLATION" };
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

function formatProposalTableTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatProposalTableDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
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

export function formatExpectedSalesUnits(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

/**
 * The manual tag audit trail is the ordinary lifecycle event stream — there is
 * no separate tag history query — so the most recent change is the newest
 * TAG_ADDED / TAG_REMOVED item on the relationship timeline.
 */
export function latestManualTagChange(
  items: readonly GQL.AffiliateRelationshipTimelineItem[],
): CreatorManualTagChange | null {
  let latest: CreatorManualTagChange | null = null;
  for (const item of items) {
    const eventType = item.businessEvent?.eventType ?? item.actionEvent?.eventType ?? null;
    if (
      eventType !== GQL.AffiliateLifecycleEventType.TagAdded
      && eventType !== GQL.AffiliateLifecycleEventType.TagRemoved
    ) {
      continue;
    }
    if (latest && latest.occurredAt >= item.occurredAt) continue;
    latest = {
      occurredAt: item.occurredAt,
      added: eventType === GQL.AffiliateLifecycleEventType.TagAdded,
      actorType: item.actorType ?? null,
      summary: item.summary,
    };
  }
  return latest;
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
  if (proposal.type === GQL.ActionProposalType.NoActionNeeded) {
    return t("ecommerce.affiliateWorkspace.proposalRecommendationTitles.NO_ACTION_NEEDED");
  }
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
  if (proposal.type === GQL.ActionProposalType.ManageCreatorTag) {
    const rows = proposalManualTagRows(proposal);
    if (rows.length === 1) {
      const row = rows[0]!;
      return t(
        row.operation === GQL.CreatorTagOperation.Add
          ? "ecommerce.affiliateWorkspace.proposalRecommendationTitles.ADD_CREATOR_TAG"
          : "ecommerce.affiliateWorkspace.proposalRecommendationTitles.REMOVE_CREATOR_TAG",
        { name: row.tagName ?? t("ecommerce.affiliateWorkspace.manualTags.deletedTag") },
      );
    }
    return t("ecommerce.affiliateWorkspace.proposalRecommendationTitles.MANAGE_CREATOR_TAG", {
      count: rows.length,
    });
  }
  return t(`ecommerce.shopDrawer.affiliate.proposalTypes.${proposal.type}`, {
    defaultValue: proposal.type,
  });
}

function renderProposalExecutionDescription(
  proposal: GQL.ActionProposal,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (proposal.type === GQL.ActionProposalType.NoActionNeeded) {
    // A gated no-action proposal is still a decision waiting on staff, so the
    // "what will happen" copy must describe the pending outcome, not a past run.
    return t(
      proposal.status === GQL.ActionProposalStatus.Pending
        ? "ecommerce.affiliateWorkspace.proposalExecutionDescriptions.NO_ACTION_NEEDED_PENDING"
        : "ecommerce.affiliateWorkspace.proposalExecutionDescriptions.NO_ACTION_NEEDED",
    );
  }
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
    // The same card renders a proposal before and after it runs, so the copy has
    // to follow the proposal's own tense instead of always promising a future send.
    if (proposalDraftIsRetained(proposal)) {
      return t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.SEND_MESSAGE");
    }
    return t(
      proposalMessageWasDelivered(proposal)
        ? "ecommerce.affiliateWorkspace.proposalExecutionDescriptions.SEND_MESSAGE_EXECUTED"
        : "ecommerce.affiliateWorkspace.proposalExecutionDescriptions.SEND_MESSAGE_NOT_SENT",
    );
  }
  if (proposal.type === GQL.ActionProposalType.ManageCreatorTag) {
    const rows = proposalManualTagRows(proposal);
    return t("ecommerce.affiliateWorkspace.proposalExecutionDescriptions.MANAGE_CREATOR_TAG", {
      count: rows.length,
    });
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

/**
 * A proposal's review draft is only readable while the proposal is still open:
 * the backend scrubs creator-facing draft text the moment it reaches a terminal
 * state, keeping just the hash and length.
 */
function proposalDraftIsRetained(proposal: GQL.ActionProposal): boolean {
  return (
    proposal.status === GQL.ActionProposalStatus.Pending ||
    proposal.status === GQL.ActionProposalStatus.RevisionRequested ||
    proposal.status === GQL.ActionProposalStatus.Approved
  );
}

/**
 * Delivery statuses that mean the message actually reached the provider on its
 * way to the creator. A proposal can end in EXECUTION_FAILED while still
 * carrying a deliveryId, so the id's presence alone never proves a send.
 */
const DELIVERED_MESSAGE_STATUSES = new Set<GQL.AffiliateDeliveryStatus>([
  GQL.AffiliateDeliveryStatus.Sent,
  GQL.AffiliateDeliveryStatus.PartiallySent,
  GQL.AffiliateDeliveryStatus.Submitted,
]);

export function proposalMessageWasDelivered(proposal: GQL.ActionProposal): boolean {
  const status = proposal.deliveredMessage?.status ?? proposal.executionResult?.deliveryStatus;
  return Boolean(status) && DELIVERED_MESSAGE_STATUSES.has(status as GQL.AffiliateDeliveryStatus);
}

/**
 * Text actually delivered to the creator, read back from the linked Delivery.
 * This is the only message body still available once the review draft is gone.
 */
function getProposalDeliveredMessageText(proposal: GQL.ActionProposal): string | null {
  const parts = proposal.deliveredMessage?.parts;
  if (!parts || parts.length === 0) return null;
  const text = [...parts]
    .sort((left, right) => left.sequence - right.sequence)
    .filter((part) => part.kind === GQL.AffiliateMessagePartKind.Text)
    .map((part) => part.text?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n");
  return text || null;
}

/**
 * What the card should put in its message box.
 *
 * A proposal that is still open shows its review draft. Once it closes, the
 * draft is gone and only the linked Delivery can still say what the creator
 * actually received. When neither exists the card must say the wording was
 * cleared rather than render an empty box.
 */
export function resolveProposalMessageDisplay(proposal: GQL.ActionProposal): {
  text: string | null;
  contentCleared: boolean;
} {
  const text = getProposalMessagePreview(proposal) ?? getProposalDeliveredMessageText(proposal);
  if (text) return { text, contentCleared: false };
  if (proposalDraftIsRetained(proposal)) return { text: null, contentCleared: false };
  const hadMessageIntent =
    Boolean(proposal.messageIntent) ||
    (proposal.steps ?? []).some((step) => Boolean(step.messageIntent));
  return { text: null, contentCleared: hadMessageIntent };
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
  if (proposal.blockCreatorIntent) {
    return t("ecommerce.shopDrawer.affiliate.blockCreatorPreview", {
      creatorId: proposal.blockCreatorIntent.creatorId,
    });
  }
  if (proposal.creatorTagIntent) {
    return renderCreatorTagIntentSummary(proposal, proposal.creatorTagIntent, t);
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
