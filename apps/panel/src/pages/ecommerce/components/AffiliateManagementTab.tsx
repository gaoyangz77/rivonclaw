import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useMutation, useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import type { Shop } from "@rivonclaw/core/models";
import { Select } from "../../../components/inputs/Select.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { useToast } from "../../../components/Toast.js";
import {
  AFFILIATE_ACTION_PROPOSALS_QUERY,
  DECIDE_ACTION_PROPOSAL_MUTATION,
} from "../../../api/shops-queries.js";

interface AffiliateManagementTabProps {
  shop: Shop;
  selectedRunProfileId: string;
  runProfileOptions: Array<{ value: string; label: string }>;
  selectedRunProfile: { selectedToolIds: string[] } | null;
  savingRunProfile: boolean;
  onRunProfileChange: (profileId: string) => void;
  myDeviceId: string | null;
  togglingBindShopId: string | null;
  onBindDevice: (shopId: string) => void;
  onUnbindDevice: (shopId: string) => void;
}

export const AffiliateManagementTab = observer(function AffiliateManagementTab({
  shop,
  selectedRunProfileId,
  runProfileOptions,
  selectedRunProfile,
  savingRunProfile,
  onRunProfileChange,
  myDeviceId,
  togglingBindShopId,
  onBindDevice,
  onUnbindDevice,
}: AffiliateManagementTabProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const allTools = entityStore.availableTools;
  const assignedDeviceId = shop.services?.affiliateService?.csDeviceId ?? null;
  const handledByThisDevice = Boolean(myDeviceId && assignedDeviceId === myDeviceId);
  const { data: proposalsData, loading: proposalsLoading, refetch: refetchProposals } = useQuery<
    { actionProposals: GQL.ActionProposal[] },
    { input: GQL.ReadActionProposalsInput }
  >(AFFILIATE_ACTION_PROPOSALS_QUERY, {
    variables: {
      input: {
        shopId: shop.id,
        status: GQL.ActionProposalStatus.Pending,
        limit: 20,
      },
    },
    fetchPolicy: "cache-and-network",
  });
  const [decideActionProposal, { loading: decidingProposal }] = useMutation<
    { decideActionProposal: GQL.ActionProposal },
    { input: GQL.DecideActionProposalInput }
  >(DECIDE_ACTION_PROPOSAL_MUTATION);

  const pendingProposals = proposalsData?.actionProposals ?? [];

  function toolDisplayName(toolId: string): string {
    const tool = allTools.find((candidate) => candidate.id === toolId);
    const catLabel = tool?.category ? t(`tools.selector.category.${tool.category}`, { defaultValue: "" }) : "";
    const nameLabel = t(`tools.selector.name.${toolId}`, { defaultValue: tool?.displayName ?? toolId });
    return catLabel ? `${catLabel} — ${nameLabel}` : nameLabel;
  }

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

  return (
    <div className="shop-detail-section">
      <div className="drawer-section-label">{t("ecommerce.shopDrawer.affiliate.serviceStatus")}</div>

      <div className="shop-toggle-card">
        <div className="shop-toggle-card-left">
          <span className="shop-toggle-card-label">
            {t("ecommerce.shopDrawer.affiliate.bindDevice")}
          </span>
          <span className="form-hint">{t("ecommerce.shopDrawer.affiliate.bindDeviceHint")}</span>
          {assignedDeviceId && !handledByThisDevice && (
            <span className="badge badge-warning shop-badge-inline">
              {t("ecommerce.shopDrawer.affiliate.otherDevice")}
            </span>
          )}
          {handledByThisDevice && (
            <span className="badge badge-success shop-badge-inline">
              {t("ecommerce.shopDrawer.affiliate.thisDevice")}
            </span>
          )}
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={handledByThisDevice}
            onChange={() => {
              if (handledByThisDevice) {
                onUnbindDevice(shop.id);
              } else {
                onBindDevice(shop.id);
              }
            }}
            disabled={togglingBindShopId === shop.id || !myDeviceId}
          />
          <span
            className={`toggle-track ${handledByThisDevice ? "toggle-track-on" : "toggle-track-off"} ${togglingBindShopId === shop.id ? "toggle-track-disabled" : ""}`}
          >
            <span className={`toggle-thumb ${handledByThisDevice ? "toggle-thumb-on" : "toggle-thumb-off"}`} />
          </span>
        </label>
      </div>

      <div className="drawer-section-label">{t("ecommerce.shopDrawer.affiliate.runProfile")}</div>
      <div className="shop-info-card">
        <div className="shop-runprofile-row">
          <label className="form-label-block">{t("ecommerce.shopDrawer.affiliate.runProfileLabel")}</label>
          <Select
            value={selectedRunProfileId}
            onChange={onRunProfileChange}
            options={runProfileOptions}
            placeholder={t("ecommerce.shopDrawer.affiliate.runProfileNone")}
            disabled={savingRunProfile}
            className="input-full"
          />
        </div>
        {selectedRunProfile ? (
          <div className="shop-runprofile-tools">
            <div className="form-label-block">{t("ecommerce.shopDrawer.affiliate.availableTools")}</div>
            <ul className="shop-tool-list">
              {selectedRunProfile.selectedToolIds.map((toolId) => (
                <li key={toolId} className="shop-tool-list-item">{toolDisplayName(toolId)}</li>
              ))}
            </ul>
            <div className="shop-tool-count">
              {t("ecommerce.shopDrawer.affiliate.toolCount", { count: selectedRunProfile.selectedToolIds.length })}
            </div>
          </div>
        ) : (
          <div className="shop-info-card-hint">{t("ecommerce.shopDrawer.affiliate.runProfileHint")}</div>
        )}
      </div>

      <div className="drawer-section-label">{t("ecommerce.shopDrawer.affiliate.proposals")}</div>
      <div className="affiliate-proposal-panel">
        <div className="affiliate-proposal-toolbar">
          <div>
            <div className="affiliate-proposal-count">
              {t("ecommerce.shopDrawer.affiliate.pendingProposalCount", { count: pendingProposals.length })}
            </div>
            <div className="form-hint">{t("ecommerce.shopDrawer.affiliate.proposalsHint")}</div>
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void refetchProposals()}
            disabled={proposalsLoading}
          >
            {proposalsLoading
              ? t("common.loading")
              : t("ecommerce.shopDrawer.affiliate.refreshProposals")}
          </button>
        </div>

        {proposalsLoading && pendingProposals.length === 0 ? (
          <div className="shop-info-card-hint">{t("common.loading")}</div>
        ) : pendingProposals.length === 0 ? (
          <div className="affiliate-proposal-empty">
            {t("ecommerce.shopDrawer.affiliate.noPendingProposals")}
          </div>
        ) : (
          <div className="affiliate-proposal-list">
            {pendingProposals.map((proposal) => (
              <div className="affiliate-proposal-card" key={proposal.id}>
                <div className="affiliate-proposal-card-head">
                  <div className="affiliate-proposal-title-wrap">
                    <span className="badge badge-warning">
                      {t(`ecommerce.shopDrawer.affiliate.proposalTypes.${proposal.type}`, { defaultValue: proposal.type })}
                    </span>
                    <span className="affiliate-proposal-time">{formatProposalTime(proposal.createdAt)}</span>
                  </div>
                  <span className="badge badge-muted">{proposal.status}</span>
                </div>
                <div className="affiliate-proposal-summary">{proposal.summary}</div>
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
                  <span>ID {shortId(proposal.id)}</span>
                  {proposal.creatorId ? <span>Creator {shortId(proposal.creatorId)}</span> : null}
                  {proposal.collaborationId ? <span>Collab {shortId(proposal.collaborationId)}</span> : null}
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
        )}
      </div>
    </div>
  );
});

function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
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
  return proposal.summary;
}
