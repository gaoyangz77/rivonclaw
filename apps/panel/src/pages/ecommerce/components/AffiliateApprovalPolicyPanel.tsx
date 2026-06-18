import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import type { Shop } from "@rivonclaw/core/models";
import { Select } from "../../../components/inputs/Select.js";
import { ConfirmDialog } from "../../../components/modals/ConfirmDialog.js";
import { Modal } from "../../../components/modals/Modal.js";
import { useToast } from "../../../components/Toast.js";
import { CheckIcon, CopyIcon, InfoIcon, RefreshIcon } from "../../../components/icons.js";
import {
  AFFILIATE_APPROVAL_POLICIES_QUERY,
  AFFILIATE_POLICY_CONTEXT_QUERY,
  DELETE_AFFILIATE_APPROVAL_POLICY_MUTATION,
  WRITE_AFFILIATE_APPROVAL_POLICY_MUTATION,
} from "../../../api/shops-queries.js";
import { creatorTagLabel } from "../affiliate-tag-labels.js";

type AffiliateApprovalPolicy = GQL.AffiliateApprovalPolicy;
type AffiliatePolicyAction = GQL.ActionProposalType;

const AFFILIATE_POLICY_ACTIONS = [
  GQL.ActionProposalType.SendMessage,
  GQL.ActionProposalType.ReviewSampleApplication,
  GQL.ActionProposalType.CreateTargetCollaboration,
] as const;

type AffiliatePolicyFormState = {
  id?: string;
  action: AffiliatePolicyAction;
  enabled: boolean;
  reason: string;
  creatorTagIds: string[];
  campaignIds: string[];
  productIdsText: string;
};

const EMPTY_POLICY_FORM: AffiliatePolicyFormState = {
  action: GQL.ActionProposalType.SendMessage,
  enabled: true,
  reason: "",
  creatorTagIds: [],
  campaignIds: [],
  productIdsText: "",
};

export function AffiliateApprovalPolicyPanel({ shop }: { shop: Shop }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [form, setForm] = useState<AffiliatePolicyFormState>(EMPTY_POLICY_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<AffiliateApprovalPolicy | null>(null);
  const [copiedPolicyId, setCopiedPolicyId] = useState<string | null>(null);

  const {
    data: policiesData,
    loading: policiesLoading,
    refetch: refetchPolicies,
  } = useQuery<
    { affiliateApprovalPolicies: AffiliateApprovalPolicy[] },
    { input: GQL.ReadAffiliateApprovalPoliciesInput }
  >(AFFILIATE_APPROVAL_POLICIES_QUERY, {
    variables: { input: { shopId: shop.id } },
    fetchPolicy: "cache-and-network",
  });

  const { data: contextData } = useQuery<
    { affiliateCampaigns: GQL.AffiliateCampaign[]; creatorTags: GQL.CreatorTag[] },
    { campaignsInput: GQL.ReadAffiliateCampaignsInput; shopId: string }
  >(AFFILIATE_POLICY_CONTEXT_QUERY, {
    variables: {
      campaignsInput: {
        shopId: shop.id,
        limit: 500,
      },
      shopId: shop.id,
    },
    fetchPolicy: "cache-and-network",
  });

  const [writePolicy, { loading: savingPolicy }] = useMutation<
    { writeAffiliateApprovalPolicy: AffiliateApprovalPolicy },
    { input: GQL.WriteAffiliateApprovalPolicyInput }
  >(WRITE_AFFILIATE_APPROVAL_POLICY_MUTATION);

  const [deletePolicy, { loading: deletingPolicy }] = useMutation<
    { deleteAffiliateApprovalPolicy: boolean },
    { id: string }
  >(DELETE_AFFILIATE_APPROVAL_POLICY_MUTATION);

  const policies = policiesData?.affiliateApprovalPolicies ?? [];
  const creatorTags = contextData?.creatorTags ?? [];
  const campaigns = contextData?.affiliateCampaigns ?? [];
  const creatorTagOptions = useMemo(
    () => creatorTags.map((tag) => ({ id: tag.id, label: creatorTagLabel(t, tag) })),
    [creatorTags, t],
  );
  const campaignOptions = useMemo(
    () => campaigns.map((campaign) => ({ id: campaign.id, label: campaign.name })),
    [campaigns],
  );
  const actionOptions = useMemo(
    () =>
      AFFILIATE_POLICY_ACTIONS.map((action) => ({
        value: action,
        label: policyActionLabel(t, action),
      })),
    [t],
  );
  const hasRecommendedGlobalPolicies = AFFILIATE_POLICY_ACTIONS.every((action) =>
    policies.some((policy) =>
      policy.action === action &&
      policy.enabled &&
      policy.creatorTagIds.length === 0 &&
      policy.campaignIds.length === 0 &&
      policy.productIds.length === 0
    ),
  );

  function openCreate(action: AffiliatePolicyAction = GQL.ActionProposalType.SendMessage) {
    setForm({
      ...EMPTY_POLICY_FORM,
      action,
      reason: t("ecommerce.affiliateWorkspace.policies.defaultReason"),
    });
    setModalOpen(true);
  }

  function openEdit(policy: AffiliateApprovalPolicy) {
    setForm(policyToForm(policy));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(EMPTY_POLICY_FORM);
  }

  async function savePolicy() {
    try {
      await writePolicy({
        variables: {
          input: {
            id: form.id,
            shopId: shop.id,
            action: form.action,
            enabled: form.enabled,
            reason: form.reason.trim() || undefined,
            creatorTagIds: form.creatorTagIds,
            campaignIds: form.campaignIds,
            productIds: parsePolicyIds(form.productIdsText),
          },
        },
      });
      showToast(t("ecommerce.affiliateWorkspace.policies.saveSuccess"), "success");
      await refetchPolicies();
      closeModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function togglePolicy(policy: AffiliateApprovalPolicy) {
    try {
      await writePolicy({
        variables: {
          input: {
            id: policy.id,
            shopId: policy.shopId,
            action: policy.action,
            enabled: !policy.enabled,
            reason: policy.reason ?? undefined,
            creatorTagIds: policy.creatorTagIds,
            campaignIds: policy.campaignIds,
            productIds: policy.productIds,
          },
        },
      });
      showToast(
        policy.enabled
          ? t("ecommerce.affiliateWorkspace.policies.disableSuccess")
          : t("ecommerce.affiliateWorkspace.policies.enableSuccess"),
        "success",
      );
      await refetchPolicies();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function confirmDeletePolicy() {
    if (!policyToDelete) return;
    try {
      const result = await deletePolicy({ variables: { id: policyToDelete.id } });
      if (!result.data?.deleteAffiliateApprovalPolicy) {
        throw new Error(t("ecommerce.affiliateWorkspace.policies.deleteNotFound"));
      }
      showToast(t("ecommerce.affiliateWorkspace.policies.deleteSuccess"), "success");
      await refetchPolicies();
      setPolicyToDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function createRecommendedPolicies() {
    try {
      for (const action of AFFILIATE_POLICY_ACTIONS) {
        const existingGlobal = policies.find((policy) =>
          policy.action === action &&
          policy.creatorTagIds.length === 0 &&
          policy.campaignIds.length === 0 &&
          policy.productIds.length === 0
        );
        await writePolicy({
          variables: {
            input: {
              id: existingGlobal?.id,
              shopId: shop.id,
              action,
              enabled: true,
              reason: existingGlobal?.reason || t("ecommerce.affiliateWorkspace.policies.defaultReason"),
              creatorTagIds: [],
              campaignIds: [],
              productIds: [],
            },
          },
        });
      }
      showToast(t("ecommerce.affiliateWorkspace.policies.recommendedSuccess"), "success");
      await refetchPolicies();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("ecommerce.updateFailed"), "error");
    }
  }

  async function copyPolicyId(policyId: string) {
    try {
      await navigator.clipboard.writeText(policyId);
      setCopiedPolicyId(policyId);
      setTimeout(() => setCopiedPolicyId(null), 1200);
      showToast(t("ecommerce.affiliateWorkspace.debugIdCopied"), "success");
    } catch {
      showToast(t("ecommerce.affiliateWorkspace.copyFailed"), "error");
    }
  }

  const busy = savingPolicy || deletingPolicy;

  return (
    <div className="affiliate-policy-drawer-panel">
      <div className="shop-info-card affiliate-policy-drawer-summary">
        <div className="affiliate-policy-drawer-summary-copy">
          <span className="shop-toggle-card-label">
            {t("ecommerce.affiliateWorkspace.policies.title")}
          </span>
          <span className="form-hint">
            {hasRecommendedGlobalPolicies
              ? t("ecommerce.affiliateWorkspace.policies.recommendedReady")
              : t("ecommerce.affiliateWorkspace.policies.recommendedHint")}
          </span>
        </div>
        <div className="affiliate-policy-drawer-actions">
          <button
            className="btn btn-secondary btn-sm affiliate-intelligence-refresh"
            type="button"
            onClick={() => void refetchPolicies()}
            disabled={policiesLoading}
          >
            <RefreshIcon />
            <span>{policiesLoading ? t("common.loading") : t("ecommerce.affiliateWorkspace.policies.refresh")}</span>
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => void createRecommendedPolicies()}
            disabled={savingPolicy || hasRecommendedGlobalPolicies}
          >
            {t("ecommerce.affiliateWorkspace.policies.applyRecommended")}
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => openCreate()}
          >
            {t("ecommerce.affiliateWorkspace.policies.createTitle")}
          </button>
        </div>
      </div>

      {policiesLoading && policies.length === 0 ? (
        <div className="shop-info-card">
          <p className="form-hint">{t("common.loading")}</p>
        </div>
      ) : policies.length === 0 ? (
        <div className="shop-info-card">
          <p className="form-hint">{t("ecommerce.affiliateWorkspace.policies.empty")}</p>
        </div>
      ) : (
        <div className="affiliate-policy-action-groups affiliate-policy-drawer-groups">
          {AFFILIATE_POLICY_ACTIONS.map((action) => {
            const actionPolicies = policies.filter((policy) => policy.action === action);
            return (
              <div className="affiliate-policy-action-group" key={action}>
                <div className="affiliate-policy-action-head">
                  <div>
                    <strong>{policyActionLabel(t, action)}</strong>
                    <span>{policyActionDescription(t, action)}</span>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => openCreate(action)}
                  >
                    {t("ecommerce.affiliateWorkspace.policies.addForAction")}
                  </button>
                </div>
                {actionPolicies.length === 0 ? (
                  <div className="affiliate-policy-action-empty">
                    {t("ecommerce.affiliateWorkspace.policies.noPolicyForAction")}
                  </div>
                ) : (
                  <div className="affiliate-policy-card-list">
                    {actionPolicies.map((policy) => (
                      <AffiliatePolicyCard
                        key={policy.id}
                        policy={policy}
                        copiedPolicyId={copiedPolicyId}
                        creatorTags={creatorTags}
                        campaigns={campaigns}
                        busy={busy}
                        onCopyId={copyPolicyId}
                        onEdit={openEdit}
                        onToggle={togglePolicy}
                        onDelete={setPolicyToDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={form.id
          ? t("ecommerce.affiliateWorkspace.policies.editTitle")
          : t("ecommerce.affiliateWorkspace.policies.createTitle")}
        maxWidth={680}
      >
        <AffiliatePolicyForm
          actionOptions={actionOptions}
          campaignOptions={campaignOptions}
          creatorTagOptions={creatorTagOptions}
          form={form}
          saving={savingPolicy}
          onCancel={closeModal}
          onChange={setForm}
          onSave={savePolicy}
        />
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(policyToDelete)}
        onCancel={() => setPolicyToDelete(null)}
        onConfirm={() => void confirmDeletePolicy()}
        title={t("ecommerce.affiliateWorkspace.policies.deleteTitle")}
        message={t("ecommerce.affiliateWorkspace.policies.deleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
      />
    </div>
  );
}

function AffiliatePolicyForm({
  actionOptions,
  campaignOptions,
  creatorTagOptions,
  form,
  saving,
  onCancel,
  onChange,
  onSave,
}: {
  actionOptions: Array<{ value: AffiliatePolicyAction; label: string }>;
  campaignOptions: Array<{ id: string; label: string }>;
  creatorTagOptions: Array<{ id: string; label: string }>;
  form: AffiliatePolicyFormState;
  saving: boolean;
  onCancel: () => void;
  onChange: (form: AffiliatePolicyFormState) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="affiliate-policy-form affiliate-policy-modal-form">
      <label className="affiliate-policy-field">
        <span>{t("ecommerce.affiliateWorkspace.policies.actionLabel")}</span>
        <Select
          value={form.action}
          onChange={(value) => onChange({ ...form, action: value as AffiliatePolicyAction })}
          options={actionOptions}
          ariaLabel={t("ecommerce.affiliateWorkspace.policies.actionLabel")}
        />
      </label>

      <label className="affiliate-policy-toggle-row">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => onChange({ ...form, enabled: event.target.checked })}
        />
        <span>
          <strong>{t("ecommerce.affiliateWorkspace.policies.enabledLabel")}</strong>
          <small>{t("ecommerce.affiliateWorkspace.policies.enabledHint")}</small>
        </span>
      </label>

      <label className="affiliate-policy-field">
        <span>{t("ecommerce.affiliateWorkspace.policies.reasonLabel")}</span>
        <textarea
          value={form.reason}
          onChange={(event) => onChange({ ...form, reason: event.target.value })}
          placeholder={t("ecommerce.affiliateWorkspace.policies.reasonPlaceholder")}
          rows={3}
        />
      </label>

      <AffiliatePolicyMultiSelect
        label={t("ecommerce.affiliateWorkspace.policies.creatorTagsLabel")}
        allLabel={t("ecommerce.affiliateWorkspace.policies.allCreatorTags")}
        options={creatorTagOptions}
        selectedIds={form.creatorTagIds}
        onChange={(creatorTagIds) => onChange({ ...form, creatorTagIds })}
      />

      <AffiliatePolicyMultiSelect
        label={t("ecommerce.affiliateWorkspace.policies.campaignsLabel")}
        allLabel={t("ecommerce.affiliateWorkspace.policies.allCampaigns")}
        options={campaignOptions}
        selectedIds={form.campaignIds}
        onChange={(campaignIds) => onChange({ ...form, campaignIds })}
      />

      <label className="affiliate-policy-field">
        <span>{t("ecommerce.affiliateWorkspace.policies.productIdsLabel")}</span>
        <textarea
          value={form.productIdsText}
          onChange={(event) => onChange({ ...form, productIdsText: event.target.value })}
          placeholder={t("ecommerce.affiliateWorkspace.policies.productIdsPlaceholder")}
          rows={4}
        />
        <small>
          {parsePolicyIds(form.productIdsText).length === 0
            ? t("ecommerce.affiliateWorkspace.policies.allProducts")
            : t("ecommerce.affiliateWorkspace.policies.productIdsCount", {
                count: parsePolicyIds(form.productIdsText).length,
              })}
        </small>
      </label>

      <div className="affiliate-policy-match-preview">
        <InfoIcon />
        <span>
          {policyFormMatchesAll(form)
            ? t("ecommerce.affiliateWorkspace.policies.allMatchPreview", {
                action: policyActionLabel(t, form.action),
              })
            : t("ecommerce.affiliateWorkspace.policies.filteredMatchPreview")}
        </span>
      </div>

      <div className="modal-actions affiliate-policy-form-actions">
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </button>
        <button className="btn btn-primary" type="button" onClick={() => void onSave()} disabled={saving}>
          {saving ? t("common.saving") : t("ecommerce.affiliateWorkspace.policies.savePolicy")}
        </button>
      </div>
    </div>
  );
}

function AffiliatePolicyCard({
  policy,
  copiedPolicyId,
  creatorTags,
  campaigns,
  busy,
  onCopyId,
  onEdit,
  onToggle,
  onDelete,
}: {
  policy: AffiliateApprovalPolicy;
  copiedPolicyId: string | null;
  creatorTags: GQL.CreatorTag[];
  campaigns: GQL.AffiliateCampaign[];
  busy: boolean;
  onCopyId: (policyId: string) => void;
  onEdit: (policy: AffiliateApprovalPolicy) => void;
  onToggle: (policy: AffiliateApprovalPolicy) => void;
  onDelete: (policy: AffiliateApprovalPolicy) => void;
}) {
  const { t } = useTranslation();
  const conditionSummary = buildPolicyConditionSummary(t, policy, creatorTags, campaigns);
  const matchesAll =
    policy.creatorTagIds.length === 0 &&
    policy.campaignIds.length === 0 &&
    policy.productIds.length === 0;

  return (
    <article className={`affiliate-policy-card${policy.enabled ? "" : " affiliate-policy-card-disabled"}`}>
      <div className="affiliate-policy-card-head">
        <div>
          <span className={`affiliate-policy-status ${policy.enabled ? "affiliate-policy-status-enabled" : "affiliate-policy-status-disabled"}`}>
            {policy.enabled ? t("common.enabled") : t("common.disabled")}
          </span>
          {matchesAll ? (
            <span className="affiliate-policy-global-chip">
              {t("ecommerce.affiliateWorkspace.policies.appliesToAll")}
            </span>
          ) : null}
        </div>
        <button
          className={`affiliate-id-copy-btn${copiedPolicyId === policy.id ? " affiliate-id-copy-copied" : ""}`}
          type="button"
          onClick={() => onCopyId(policy.id)}
          title={t("ecommerce.affiliateWorkspace.copyDebugId")}
          aria-label={t("ecommerce.affiliateWorkspace.copyDebugId")}
        >
          {copiedPolicyId === policy.id ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>

      <div className="affiliate-policy-match-copy">
        <strong>{conditionSummary.title}</strong>
        <span>{conditionSummary.description}</span>
      </div>

      {policy.reason ? (
        <p className="affiliate-policy-reason">{policy.reason}</p>
      ) : (
        <p className="affiliate-policy-reason affiliate-policy-reason-empty">
          {t("ecommerce.affiliateWorkspace.policies.noReason")}
        </p>
      )}

      <div className="affiliate-policy-meta-row">
        <span>{t("ecommerce.affiliateWorkspace.updatedAt", { time: formatPolicyTime(policy.updatedAt) })}</span>
      </div>

      <div className="affiliate-policy-card-actions">
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => onEdit(policy)} disabled={busy}>
          {t("common.edit")}
        </button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => onToggle(policy)} disabled={busy}>
          {policy.enabled
            ? t("ecommerce.affiliateWorkspace.policies.disable")
            : t("ecommerce.affiliateWorkspace.policies.enable")}
        </button>
        <button className="btn btn-secondary btn-sm affiliate-policy-delete" type="button" onClick={() => onDelete(policy)} disabled={busy}>
          {t("common.delete")}
        </button>
      </div>
    </article>
  );
}

function AffiliatePolicyMultiSelect({
  label,
  allLabel,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: Array<{ id: string; label: string }>;
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const knownIds = new Set(options.map((option) => option.id));
  const unknownSelectedIds = selectedIds.filter((id) => !knownIds.has(id));

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div className="affiliate-policy-field">
      <span>{label}</span>
      <div className="affiliate-policy-option-grid">
        {options.length === 0 ? (
          <div className="affiliate-policy-option-empty">
            {t("ecommerce.affiliateWorkspace.policies.noSelectableOptions")}
          </div>
        ) : (
          options.map((option) => (
            <button
              key={option.id}
              className={`affiliate-policy-option${selectedIds.includes(option.id) ? " affiliate-policy-option-selected" : ""}`}
              type="button"
              onClick={() => toggle(option.id)}
            >
              {option.label}
            </button>
          ))
        )}
      </div>
      <small>
        {selectedIds.length === 0
          ? allLabel
          : t("ecommerce.affiliateWorkspace.policies.selectedCount", {
              count: selectedIds.length,
            })}
      </small>
      {unknownSelectedIds.length > 0 ? (
        <small className="affiliate-policy-unknown-count">
          {t("ecommerce.affiliateWorkspace.policies.unknownSelectedCount", {
            count: unknownSelectedIds.length,
          })}
        </small>
      ) : null}
    </div>
  );
}

type AffiliatePolicyTranslate = ReturnType<typeof useTranslation>["t"];

function policyActionLabel(t: AffiliatePolicyTranslate, action: AffiliatePolicyAction): string {
  return t(`ecommerce.affiliateWorkspace.policyActions.${action}`, { defaultValue: action });
}

function policyActionDescription(t: AffiliatePolicyTranslate, action: AffiliatePolicyAction): string {
  return t(`ecommerce.affiliateWorkspace.policyActionDescriptions.${action}`, {
    defaultValue: policyActionLabel(t, action),
  });
}

function policyToForm(policy: AffiliateApprovalPolicy): AffiliatePolicyFormState {
  return {
    id: policy.id,
    action: policy.action,
    enabled: policy.enabled,
    reason: policy.reason ?? "",
    creatorTagIds: [...policy.creatorTagIds],
    campaignIds: [...policy.campaignIds],
    productIdsText: policy.productIds.join("\n"),
  };
}

function parsePolicyIds(value: string): string[] {
  return [...new Set(value.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean))];
}

function policyFormMatchesAll(form: AffiliatePolicyFormState): boolean {
  return (
    form.creatorTagIds.length === 0 &&
    form.campaignIds.length === 0 &&
    parsePolicyIds(form.productIdsText).length === 0
  );
}

function buildPolicyConditionSummary(
  t: AffiliatePolicyTranslate,
  policy: AffiliateApprovalPolicy,
  creatorTags: GQL.CreatorTag[],
  campaigns: GQL.AffiliateCampaign[],
): { title: string; description: string } {
  if (
    policy.creatorTagIds.length === 0 &&
    policy.campaignIds.length === 0 &&
    policy.productIds.length === 0
  ) {
    return {
      title: t("ecommerce.affiliateWorkspace.policies.appliesToAll"),
      description: t("ecommerce.affiliateWorkspace.policies.appliesToAllDescription"),
    };
  }

  const pieces: string[] = [];
  if (policy.creatorTagIds.length > 0) {
    pieces.push(t("ecommerce.affiliateWorkspace.policies.creatorTagSummary", {
      value: summarizeKnownNames(policy.creatorTagIds, creatorTags.map((tag) => ({ id: tag.id, label: creatorTagLabel(t, tag) })), t),
    }));
  }
  if (policy.campaignIds.length > 0) {
    pieces.push(t("ecommerce.affiliateWorkspace.policies.campaignSummary", {
      value: summarizeKnownNames(policy.campaignIds, campaigns.map((campaign) => ({ id: campaign.id, label: campaign.name })), t),
    }));
  }
  if (policy.productIds.length > 0) {
    pieces.push(t("ecommerce.affiliateWorkspace.policies.productSummary", {
      count: policy.productIds.length,
    }));
  }

  return {
    title: pieces.join(" · "),
    description: t("ecommerce.affiliateWorkspace.policies.filteredMatchDescription"),
  };
}

function summarizeKnownNames(
  ids: string[],
  options: Array<{ id: string; label: string }>,
  t: AffiliatePolicyTranslate,
): string {
  const optionMap = new Map(options.map((option) => [option.id, option.label]));
  const knownNames = ids.map((id) => optionMap.get(id)).filter((name): name is string => Boolean(name));
  const unknownCount = ids.length - knownNames.length;
  const names = knownNames.slice(0, 2);
  if (unknownCount > 0) {
    names.push(t("ecommerce.affiliateWorkspace.policies.unknownSummary", { count: unknownCount }));
  }
  if (knownNames.length > 2) {
    names.push(t("ecommerce.affiliateWorkspace.policies.moreSummary", { count: knownNames.length - 2 }));
  }
  return names.join(", ");
}

function formatPolicyTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
