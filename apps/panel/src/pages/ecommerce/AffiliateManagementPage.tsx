import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useMutation, useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../components/inputs/Select.js";
import { useToast } from "../../components/Toast.js";
import { CheckIcon, CopyIcon } from "../../components/icons.js";
import { panelEventBus } from "../../lib/event-bus.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import {
  AFFILIATE_ACTION_PROPOSALS_QUERY,
  DECIDE_ACTION_PROPOSAL_MUTATION,
} from "../../api/shops-queries.js";

interface ProposalGroup {
  key: string;
  shopId: string;
  creatorId: string | null;
  creatorProfile: GQL.CreatorGlobalProfile | null;
  collaborationRecordId: string | null;
  proposals: GQL.ActionProposal[];
}

export const AffiliateManagementPage = observer(function AffiliateManagementPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const shops = entityStore.shops;
  const [selectedShopId, setSelectedShopId] = useState("");
  const [liveProposals, setLiveProposals] = useState<GQL.ActionProposal[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    { actionProposals: GQL.ActionProposal[] },
    { input: GQL.ReadActionProposalsInput }
  >(AFFILIATE_ACTION_PROPOSALS_QUERY, {
    variables: {
      input: {
        shopId: selectedShopId || undefined,
        status: GQL.ActionProposalStatus.Pending,
        limit: 100,
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
    setLiveProposals(data?.actionProposals ?? []);
  }, [data?.actionProposals]);

  useEffect(() => {
    return panelEventBus.subscribe("affiliate-action-proposal-changed", (raw) => {
      const proposal = readActionProposalChangedPayload(raw);
      if (!proposal) return;
      setLiveProposals((current) => {
        const isSelectedShop = !selectedShopId || proposal.shopId === selectedShopId;
        const next = current.filter((item) => item.id !== proposal.id);
        if (proposal.status === GQL.ActionProposalStatus.Pending && isSelectedShop) {
          next.push(proposal);
        }
        return sortProposals(next);
      });
    });
  }, [selectedShopId]);

  const pendingProposals = liveProposals;
  const groups = useMemo(() => groupProposals(pendingProposals), [pendingProposals]);

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
      setLiveProposals((current) => current.filter((item) => item.id !== proposal.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  function shopLabel(shopId: string): string {
    const shop = shops.find((candidate) => candidate.id === shopId);
    return shop?.alias || shop?.shopName || shop?.platformShopId || shopId;
  }

  async function copyId(value: string) {
    try {
      await copyTextToClipboard(value);
      setCopiedId(value);
      window.setTimeout(() => {
        setCopiedId((current) => current === value ? null : current);
      }, 1400);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.affiliateWorkspace.copyFailed"), "error");
    }
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
    <div className="page-enter">
      <div className="ecommerce-page-header">
        <div>
          <h1>{t("ecommerce.affiliateWorkspace.title")}</h1>
          <p className="ecommerce-page-subtitle">{t("ecommerce.affiliateWorkspace.subtitle")}</p>
        </div>
      </div>

      <div className="affiliate-proposal-panel affiliate-workspace-panel">
        <div className="affiliate-proposal-toolbar">
          <div>
            <div className="affiliate-proposal-count">
              {t("ecommerce.shopDrawer.affiliate.pendingProposalCount", { count: pendingProposals.length })}
            </div>
            <div className="form-hint">{t("ecommerce.affiliateWorkspace.queueHint")}</div>
          </div>
          <div className="affiliate-workspace-actions">
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

        {loading && pendingProposals.length === 0 ? (
          <div className="affiliate-proposal-empty">{t("common.loading")}</div>
        ) : groups.length === 0 ? (
          <div className="affiliate-proposal-empty">
            {t("ecommerce.shopDrawer.affiliate.noPendingProposals")}
          </div>
        ) : (
          <div className="affiliate-proposal-group-list">
            {groups.map((group) => (
              <section className="affiliate-proposal-group" key={group.key}>
                <div className="affiliate-proposal-group-head">
                  <div>
                    <div className="affiliate-proposal-group-title">
                      {group.creatorProfile
                        ? creatorDisplayName(group.creatorProfile)
                        : group.creatorId
                          ? t("ecommerce.affiliateWorkspace.creatorGroupTitle", { creatorId: shortId(group.creatorId) })
                        : t("ecommerce.affiliateWorkspace.unknownCreator")}
                    </div>
                    <div className="affiliate-proposal-meta">
                      <span>{shopLabel(group.shopId)}</span>
                      {group.creatorId ? (
                        <CopyableId
                          label={t("ecommerce.affiliateWorkspace.creatorIdLabel")}
                          value={group.creatorId}
                          copied={copiedId === group.creatorId}
                          onCopy={copyId}
                        />
                      ) : null}
                      {group.collaborationRecordId ? (
                        <CopyableId
                          label={t("ecommerce.affiliateWorkspace.collaborationIdLabel")}
                          value={group.collaborationRecordId}
                          copied={copiedId === group.collaborationRecordId}
                          onCopy={copyId}
                        />
                      ) : null}
                      <span>{t("ecommerce.affiliateWorkspace.groupProposalCount", { count: group.proposals.length })}</span>
                    </div>
                  </div>
                </div>

                <div className="affiliate-proposal-list affiliate-proposal-list-compact">
                  {group.proposals.map((proposal) => (
                    <div className="affiliate-proposal-card affiliate-proposal-row" key={proposal.id}>
                      <div className="affiliate-proposal-card-head">
                        <div className="affiliate-proposal-title-wrap">
                          <span className="badge badge-warning">
                            {t(`ecommerce.shopDrawer.affiliate.proposalTypes.${proposal.type}`, { defaultValue: proposal.type })}
                          </span>
                          <span className="affiliate-proposal-time">{formatProposalTime(proposal.createdAt)}</span>
                        </div>
                        <span className="badge badge-muted">{proposal.status}</span>
                      </div>
                      <div className="affiliate-proposal-summary">{proposal.operatorSummary}</div>
                      <div className="affiliate-proposal-preview">
                        {renderProposalPreview(proposal, t)}
                      </div>
                      {proposal.policySnapshot?.reasons?.length ? (
                        <div className="affiliate-proposal-policy">
                          <span>{t("ecommerce.shopDrawer.affiliate.policyReasons")}</span>
                          {proposal.policySnapshot.reasons.map((reason) => (
                            <code key={reason}>{reason}</code>
                          ))}
                        </div>
                      ) : null}
                      <div className="affiliate-proposal-meta">
                        <CopyableId
                          label={t("ecommerce.affiliateWorkspace.proposalIdLabel")}
                          value={proposal.id}
                          copied={copiedId === proposal.id}
                          onCopy={copyId}
                        />
                        {proposal.creatorId ? (
                          <CopyableId
                            label={t("ecommerce.affiliateWorkspace.creatorIdLabel")}
                            value={proposal.creatorId}
                            copied={copiedId === proposal.creatorId}
                            onCopy={copyId}
                          />
                        ) : null}
                        {proposal.collaborationRecordId ? (
                          <CopyableId
                            label={t("ecommerce.affiliateWorkspace.collaborationIdLabel")}
                            value={proposal.collaborationRecordId}
                            copied={copiedId === proposal.collaborationRecordId}
                            onCopy={copyId}
                          />
                        ) : null}
                      </div>
                      <div className="affiliate-proposal-actions">
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={decidingProposal}
                          onClick={() => void decideProposal(proposal, GQL.ActionProposalStatus.Rejected)}
                        >
                          {t("common.reject", { defaultValue: "Reject" })}
                        </button>
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={decidingProposal}
                          onClick={() => void decideProposal(proposal, GQL.ActionProposalStatus.Approved)}
                        >
                          {t("common.approve", { defaultValue: "Approve" })}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

function groupProposals(proposals: GQL.ActionProposal[]): ProposalGroup[] {
  const map = new Map<string, ProposalGroup>();
  for (const proposal of proposals) {
    const key = proposal.collaborationRecordId
      ? `collaboration:${proposal.collaborationRecordId}`
      : proposal.creatorId
        ? `creator:${proposal.shopId}:${proposal.creatorId}`
        : `proposal:${proposal.id}`;
    const existing = map.get(key);
    if (existing) {
      existing.proposals.push(proposal);
      if (!existing.creatorProfile && proposal.creatorProfile) {
        existing.creatorProfile = proposal.creatorProfile;
      }
    } else {
      map.set(key, {
                        key,
                        shopId: proposal.shopId,
                        creatorId: proposal.creatorId ?? null,
                        creatorProfile: proposal.creatorProfile ?? null,
                        collaborationRecordId: proposal.collaborationRecordId ?? null,
                        proposals: [proposal],
                      });
    }
  }
  return [...map.values()].sort((left, right) => {
    const leftTime = Math.max(...left.proposals.map((proposal) => new Date(proposal.createdAt).getTime()));
    const rightTime = Math.max(...right.proposals.map((proposal) => new Date(proposal.createdAt).getTime()));
    return rightTime - leftTime;
  });
}

function creatorDisplayName(profile: GQL.CreatorGlobalProfile): string {
  const name = profile.nickname || profile.username || profile.creatorOpenId || profile.creatorImId || profile.id;
  return profile.username && profile.nickname && profile.username !== profile.nickname
    ? `${profile.nickname} (@${profile.username})`
    : name;
}

function sortProposals(proposals: GQL.ActionProposal[]): GQL.ActionProposal[] {
  return [...proposals].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return rightTime - leftTime;
  });
}

function CopyableId({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <button
      className={`affiliate-id-copy${copied ? " affiliate-id-copy-copied" : ""}`}
      type="button"
      title={`${label}: ${value}`}
      aria-label={`${label}: ${value}`}
      onClick={() => void onCopy(value)}
    >
      <span className="affiliate-id-copy-label">{label}</span>
      <code>{shortId(value)}</code>
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
    </button>
  );
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function readActionProposalChangedPayload(raw: unknown): GQL.ActionProposal | null {
  if (!raw || typeof raw !== "object") return null;
  const proposal = (raw as { proposal?: unknown }).proposal;
  if (!proposal || typeof proposal !== "object") return null;
  const maybeProposal = proposal as Partial<GQL.ActionProposal>;
  if (
    typeof maybeProposal.id !== "string" ||
    typeof maybeProposal.shopId !== "string" ||
    typeof maybeProposal.type !== "string" ||
    typeof maybeProposal.status !== "string"
  ) {
    return null;
  }
  return maybeProposal as GQL.ActionProposal;
}

function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function formatProposalTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
      decision: proposal.sampleReviewIntent.decision,
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
      creatorId: shortId(proposal.blockCreatorIntent.creatorId),
    });
  }
  if (proposal.creatorTagIntent) {
    return t("ecommerce.shopDrawer.affiliate.creatorTagPreview", {
      creatorId: shortId(proposal.creatorTagIntent.creatorId),
      tagId: shortId(proposal.creatorTagIntent.tagId),
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
