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
  AFFILIATE_COLLABORATION_ACTIVITY_QUERY,
  AFFILIATE_COLLABORATION_RECORD_ITEMS_QUERY,
  AFFILIATE_DASHBOARD_QUERY,
  DECIDE_ACTION_PROPOSAL_MUTATION,
} from "../../api/shops-queries.js";
import { ProductSummaryCard } from "./components/ProductSummaryCard.js";

type DashboardSection = GQL.AffiliateDashboardSection;
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
  const [activeAttentionTab, setActiveAttentionTab] = useState<"PROPOSALS" | "COLLABORATIONS">("PROPOSALS");
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

  const { data, loading, refetch } = useQuery<
    { affiliateDashboard: GQL.AffiliateDashboardPayload },
    { input: GQL.AffiliateDashboardInput }
  >(AFFILIATE_DASHBOARD_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || undefined,
        section: GQL.AffiliateDashboardSection.NeedsAttention,
        limit: 120,
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

  const dashboard = data?.affiliateDashboard;
  const items = dashboard?.items ?? [];
  const approvalItems = useMemo(
    () => items.filter((item) => isPendingActionProposalItem(item)),
    [items],
  );
  const collaborationWorkItems = useMemo(
    () => items.filter((item) => !isPendingActionProposalItem(item)),
    [items],
  );
  const visibleApprovalItems = useMemo(
    () => filterDashboardItems(approvalItems, attentionSearch, shopLabel),
    [approvalItems, attentionSearch, shops],
  );
  const visibleCollaborationWorkItems = useMemo(
    () => filterDashboardItems(collaborationWorkItems, attentionSearch, shopLabel),
    [collaborationWorkItems, attentionSearch, shops],
  );
  const activeItems =
    activeAttentionTab === "PROPOSALS" ? visibleApprovalItems : visibleCollaborationWorkItems;

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
      await refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  function shopLabel(shopId: string): string {
    const shop = shops.find((candidate) => candidate.id === shopId);
    return shop?.alias || shop?.shopName || shop?.platformShopId || shopId;
  }

  if (authChecking) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <p>{t("common.loading")}</p>
        </div>
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
              {activeAttentionTab === "PROPOSALS"
                ? t("ecommerce.affiliateWorkspace.approvalQueueTitle")
                : t("ecommerce.affiliateWorkspace.collaborationWorkQueueTitle")}
            </div>
            <div className="form-hint">
              {activeAttentionTab === "PROPOSALS"
                ? t("ecommerce.affiliateWorkspace.approvalQueueHint")
                : t("ecommerce.affiliateWorkspace.collaborationWorkQueueHint")}
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
                <strong>{approvalItems.length}</strong>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeAttentionTab === "COLLABORATIONS"}
                className={`affiliate-attention-tab${activeAttentionTab === "COLLABORATIONS" ? " affiliate-attention-tab-active" : ""}`}
                onClick={() => setActiveAttentionTab("COLLABORATIONS")}
              >
                <span>{t("ecommerce.affiliateWorkspace.collaborationWorkQueueShortTitle")}</span>
                <strong>{collaborationWorkItems.length}</strong>
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

        <div className="affiliate-attention-active-list">
          {loading && activeItems.length === 0 ? (
            <div className="affiliate-proposal-empty">{t("common.loading")}</div>
          ) : activeItems.length === 0 ? (
            <div className="affiliate-proposal-empty">
              {activeAttentionTab === "PROPOSALS"
                ? t("ecommerce.affiliateWorkspace.emptyApprovals")
                : t("ecommerce.affiliateWorkspace.emptyCollaborationWork")}
            </div>
          ) : (
            <div className="affiliate-workbench-list">
              {activeItems.map((item) => (
                <DashboardItemCard
                  key={item.id}
                  item={item}
                  shopLabel={shopLabel(item.shopId)}
                  decidingProposal={decidingProposal}
                  onOpenCollaboration={(detailItem) => setSelectedCollaboration(detailItem)}
                  onOpenCreator={(profile) => setSelectedCreator(profile)}
                  onApprove={(proposal) => decideProposal(proposal, GQL.ActionProposalStatus.Approved)}
                  onReject={(proposal) => decideProposal(proposal, GQL.ActionProposalStatus.Rejected)}
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
        <div className="section-card">
          <p>{t("common.loading")}</p>
        </div>
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
          <div className="affiliate-proposal-empty">{t("common.loading")}</div>
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
            <CreatorDetailCopyRow
              label={t("ecommerce.affiliateWorkspace.creatorDetail.profileRecordId")}
              value={profile.id}
              muted
            />
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
