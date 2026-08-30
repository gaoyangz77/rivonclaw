import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { LoadingSpinner } from "../../../components/LoadingSpinner.js";
import { TkModal as Modal } from "../../../components/design-system/index.js";
import { useToast } from "../../../components/Toast.js";
import {
  CREATE_CREATOR_MANUAL_TAG_MUTATION,
  CREATOR_MANUAL_TAGS_QUERY,
  CREATOR_MANUAL_TAG_USAGE_QUERY,
  DELETE_CREATOR_MANUAL_TAG_MUTATION,
  RENAME_CREATOR_MANUAL_TAG_MUTATION,
} from "../../../api/shops-queries.js";
import {
  canCreateManualTag,
  isDuplicateManualTagNameError,
  manualTagRenameIssue,
} from "./AffiliateCreatorManualTagEditor.js";
import { formatLocalizedDate } from "../../../lib/format-datetime.js";

/**
 * One consequence line the delete confirmation renders. Deleting a tag cascades
 * in four separate directions and the seller has to see each one that actually
 * applies to this tag.
 */
export type ManualTagDeleteConsequence =
  | { kind: "CREATORS"; count: number }
  | { kind: "POLICY_MATCHES"; count: number }
  | { kind: "POLICY_EXCLUSIONS"; count: number }
  | { kind: "POLICIES_DISABLED"; count: number };

/**
 * Which consequences the confirmation should state, given what the tag is
 * currently used for.
 *
 * The creator count is always stated, zero included: "no creator carries this"
 * is the fact that makes an unused tag safe to delete, so it has to be visible.
 * The three approval-policy lines are stated ONLY when their count is non-zero.
 * Most deletes are of an unused tag, and a dialog padded with three zeroes is a
 * dialog people learn to click through — which is exactly the habit that would
 * carry them past the one delete that does disable a live approval rule.
 */
export function manualTagDeleteConsequences(
  usage: Pick<
    GQL.CreatorManualTagUsage,
    | "creatorRelationshipCount"
    | "approvalPolicyMatchCount"
    | "approvalPolicyExclusionCount"
    | "approvalPolicyDisableCount"
  >,
): ManualTagDeleteConsequence[] {
  const lines: ManualTagDeleteConsequence[] = [
    { kind: "CREATORS", count: usage.creatorRelationshipCount },
  ];
  if (usage.approvalPolicyMatchCount > 0) {
    lines.push({ kind: "POLICY_MATCHES", count: usage.approvalPolicyMatchCount });
  }
  if (usage.approvalPolicyExclusionCount > 0) {
    lines.push({ kind: "POLICY_EXCLUSIONS", count: usage.approvalPolicyExclusionCount });
  }
  if (usage.approvalPolicyDisableCount > 0) {
    lines.push({ kind: "POLICIES_DISABLED", count: usage.approvalPolicyDisableCount });
  }
  return lines;
}

const CONSEQUENCE_KEYS: Record<ManualTagDeleteConsequence["kind"], string> = {
  CREATORS: "ecommerce.affiliateTeam.tagCatalog.deleteCreators",
  POLICY_MATCHES: "ecommerce.affiliateTeam.tagCatalog.deletePolicyMatches",
  POLICY_EXCLUSIONS: "ecommerce.affiliateTeam.tagCatalog.deletePolicyExclusions",
  POLICIES_DISABLED: "ecommerce.affiliateTeam.tagCatalog.deletePoliciesDisabled",
};

/**
 * The seller's whole manual-tag catalog: create, rename, delete.
 *
 * Deliberately NOT the same thing as the tag editor in the relationship drawer.
 * That one attaches and detaches tags on one creator; this one governs which
 * tags exist at all for the entire seller account, so a rename here renames the
 * tag everywhere and a delete here removes it from every creator that carries
 * it. The copy leads with that distinction because the two live one tab apart.
 *
 * Holds only ids and primitive drafts — every row is re-read from the current
 * query result on render, so a refetch between opening a form and submitting it
 * cannot write through a stale row.
 */
export function AffiliateCreatorTagCatalogPanel() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [createDraft, setCreateDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [renameTagId, setRenameTagId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: catalogData, loading: catalogLoading, refetch: refetchCatalog } = useQuery<
    { creatorManualTags: GQL.CreatorManualTag[] },
    { input: GQL.ReadCreatorManualTagsInput }
  >(CREATOR_MANUAL_TAGS_QUERY, {
    variables: { input: { search: search.trim() || undefined } },
    fetchPolicy: "cache-and-network",
  });
  // Read fresh every time the dialog opens: a count the seller is about to act
  // on must not come from a cache that predates someone else's policy edit.
  const { data: usageData, loading: usageLoading } = useQuery<
    { creatorManualTagUsage: GQL.CreatorManualTagUsage },
    { tagId: string }
  >(CREATOR_MANUAL_TAG_USAGE_QUERY, {
    variables: { tagId: deleteTagId ?? "" },
    skip: deleteTagId === null,
    fetchPolicy: "network-only",
  });
  const [createTag] = useMutation<
    { createCreatorManualTag: GQL.CreatorManualTag },
    { input: GQL.CreateCreatorManualTagInput }
  >(CREATE_CREATOR_MANUAL_TAG_MUTATION);
  const [renameTag] = useMutation<
    { renameCreatorManualTag: GQL.CreatorManualTag },
    { input: GQL.RenameCreatorManualTagInput }
  >(RENAME_CREATOR_MANUAL_TAG_MUTATION);
  const [deleteTag] = useMutation<
    { deleteCreatorManualTag: GQL.DeleteCreatorManualTagResult },
    { tagId: string }
  >(DELETE_CREATOR_MANUAL_TAG_MUTATION);

  const catalog = catalogData?.creatorManualTags ?? [];
  const trimmedCreateDraft = createDraft.trim();
  const canCreate = canCreateManualTag(catalog, trimmedCreateDraft);
  const createIsDuplicate = trimmedCreateDraft.length > 0 && !canCreate;
  const renameTarget = renameTagId ? catalog.find((tag) => tag.id === renameTagId) ?? null : null;
  const renameIssue = renameTarget
    ? manualTagRenameIssue(catalog, renameTarget.id, renameTarget.name, renameDraft)
    : null;
  const deleteTarget = deleteTagId ? catalog.find((tag) => tag.id === deleteTagId) ?? null : null;
  // Apollo can hand back the previous tag's data while the new query is in
  // flight. Counts shown under the wrong tag's name would be a lie the seller
  // cannot detect, so the id has to match before anything is rendered.
  const usageResult = usageData?.creatorManualTagUsage ?? null;
  const usage = usageResult && usageResult.manualTagId === deleteTagId ? usageResult : null;
  const busy = creating || renaming || deleting;

  async function create(): Promise<void> {
    if (!canCreate) return;
    setCreating(true);
    try {
      await createTag({ variables: { input: { name: trimmedCreateDraft, sensitive: false } } });
      setCreateDraft("");
      await refetchCatalog();
      showToast(t("ecommerce.affiliateTeam.tagCatalog.createSuccess"), "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      showToast(
        isDuplicateManualTagNameError(message)
          ? t("ecommerce.affiliateWorkspace.manualTags.renameDuplicate", { name: trimmedCreateDraft })
          : message || t("ecommerce.affiliateWorkspace.manualTags.createFailed"),
        "error",
      );
    } finally {
      setCreating(false);
    }
  }

  async function rename(tagId: string, sensitive: boolean): Promise<void> {
    const name = renameDraft.trim();
    setRenaming(true);
    try {
      await renameTag({ variables: { input: { tagId, name, sensitive } } });
      setRenameTagId(null);
      setRenameDraft("");
      await refetchCatalog();
      showToast(t("ecommerce.affiliateWorkspace.manualTags.renameSuccess"), "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      showToast(
        isDuplicateManualTagNameError(message)
          ? t("ecommerce.affiliateWorkspace.manualTags.renameDuplicate", { name })
          : message || t("ecommerce.affiliateWorkspace.manualTags.renameFailed"),
        "error",
      );
    } finally {
      setRenaming(false);
    }
  }

  async function confirmDelete(tagId: string): Promise<void> {
    setDeleting(true);
    try {
      const result = await deleteTag({ variables: { tagId } });
      const outcome = result.data?.deleteCreatorManualTag;
      setDeleteTagId(null);
      await refetchCatalog();
      // Report what the delete actually did, not what was predicted. The
      // predicted counts were read before the mutation and can have moved.
      showToast(
        t("ecommerce.affiliateTeam.tagCatalog.deleteSuccess", {
          creators: outcome?.creatorRelationshipsDetached ?? 0,
          policies: outcome?.approvalPoliciesDisabled ?? 0,
        }),
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("ecommerce.affiliateTeam.tagCatalog.deleteFailed"),
        "error",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="affiliate-tag-catalog">
      <div className="affiliate-team-policy-heading">
        <div>
          <span className="affiliate-team-eyebrow">{t("ecommerce.affiliateTeam.tagCatalog.eyebrow")}</span>
          <h2>{t("ecommerce.affiliateTeam.tagCatalog.title")}</h2>
        </div>
        <div className="affiliate-team-policy-heading-aside">
          <p>{t("ecommerce.affiliateTeam.tagCatalog.hint")}</p>
        </div>
      </div>

      <div className="affiliate-tag-catalog-body">
        <div className="affiliate-tag-catalog-toolbar">
          <label className="affiliate-tag-catalog-field">
            <span>{t("ecommerce.affiliateTeam.tagCatalog.searchLabel")}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("ecommerce.affiliateTeam.tagCatalog.searchPlaceholder")}
            />
          </label>
          <label className="affiliate-tag-catalog-field">
            <span>{t("ecommerce.affiliateTeam.tagCatalog.createLabel")}</span>
            <input
              value={createDraft}
              onChange={(event) => setCreateDraft(event.target.value)}
              placeholder={t("ecommerce.affiliateTeam.tagCatalog.createPlaceholder")}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void create();
              }}
            />
          </label>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void create()}
            disabled={busy || !canCreate}
          >
            {creating ? t("common.loading") : t("ecommerce.affiliateTeam.tagCatalog.createAction")}
          </button>
        </div>
        {createIsDuplicate ? (
          <p className="affiliate-tag-catalog-error">
            {t("ecommerce.affiliateWorkspace.manualTags.renameDuplicate", { name: trimmedCreateDraft })}
          </p>
        ) : null}

        <div className="affiliate-tag-catalog-table">
          <div className="affiliate-tag-catalog-table-head" aria-hidden="true">
            <span>{t("ecommerce.affiliateTeam.tagCatalog.columnName")}</span>
            <span>{t("ecommerce.affiliateTeam.protectionUpdatedAt")}</span>
            <span>{t("ecommerce.affiliateTeam.tagCatalog.columnActions")}</span>
          </div>
          <div className="affiliate-tag-catalog-list">
            {catalog.map((tag) => (
              <div className="affiliate-tag-catalog-row" key={tag.id}>
                {renameTarget?.id === tag.id ? (
                  <div className="affiliate-tag-catalog-rename">
                    <input
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      aria-label={t("ecommerce.affiliateWorkspace.manualTags.renameLabel", { name: tag.name })}
                      placeholder={t("ecommerce.affiliateWorkspace.manualTags.renamePlaceholder")}
                      autoFocus
                    />
                    <p className="affiliate-tag-catalog-scope">
                      {t("ecommerce.affiliateWorkspace.manualTags.renameScopeWarning")}
                    </p>
                    {renameIssue === "DUPLICATE" ? (
                      <p className="affiliate-tag-catalog-error">
                        {t("ecommerce.affiliateWorkspace.manualTags.renameDuplicate", {
                          name: renameDraft.trim(),
                        })}
                      </p>
                    ) : null}
                    {/* Confirm and cancel live with the field they act on, which
                        also keeps the actions column narrow enough to reserve a
                        fixed width in every locale — the only way the header,
                        an ordinary row and a row being renamed stay aligned. */}
                    <div className="affiliate-tag-catalog-rename-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={() => {
                          setRenameTagId(null);
                          setRenameDraft("");
                        }}
                        disabled={renaming}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={() => void rename(tag.id, tag.sensitive)}
                        disabled={busy || renameIssue !== null}
                      >
                        {renaming
                          ? t("common.loading")
                          : t("ecommerce.affiliateWorkspace.manualTags.renameConfirm")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <span className="affiliate-tag-catalog-name">{tag.name}</span>
                )}
                <span className="affiliate-tag-catalog-date">
                  {formatLocalizedDate(tag.updatedAt, i18n.language)}
                </span>
                <div className="affiliate-tag-catalog-actions">
                  {renameTarget?.id === tag.id ? null : (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={() => {
                          setRenameTagId(tag.id);
                          setRenameDraft(tag.name);
                        }}
                        disabled={busy}
                      >
                        {t("ecommerce.affiliateTeam.tagCatalog.renameAction")}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        onClick={() => setDeleteTagId(tag.id)}
                        disabled={busy}
                      >
                        {t("ecommerce.affiliateTeam.tagCatalog.deleteAction")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!catalogLoading && catalog.length === 0 ? (
              <div className="affiliate-empty-state compact">
                <p>
                  {t(
                    search.trim()
                      ? "ecommerce.affiliateTeam.tagCatalog.noSearchResults"
                      : "ecommerce.affiliateTeam.tagCatalog.empty",
                  )}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTagId(null)}
        title={t("ecommerce.affiliateTeam.tagCatalog.deleteTitle", { name: deleteTarget?.name ?? "" })}
        maxWidth={520}
        className="affiliate-tag-catalog-delete-modal"
        closeLabel={t("common.close")}
        preventBackdropClose={deleting}
        portal
      >
        <p className="affiliate-tag-catalog-delete-lead">
          {t("ecommerce.affiliateTeam.tagCatalog.deleteLead", { name: deleteTarget?.name ?? "" })}
        </p>
        {usageLoading || usage === null ? (
          <LoadingSpinner variant="inline" />
        ) : (
          <ul className="affiliate-tag-catalog-delete-consequences">
            {manualTagDeleteConsequences(usage).map((line) => (
              <li
                className={
                  line.kind === "POLICIES_DISABLED"
                    ? "affiliate-tag-catalog-delete-consequence is-severe"
                    : "affiliate-tag-catalog-delete-consequence"
                }
                key={line.kind}
              >
                {t(CONSEQUENCE_KEYS[line.kind], { count: line.count })}
              </li>
            ))}
          </ul>
        )}
        <p className="affiliate-tag-catalog-delete-irreversible">
          {t("ecommerce.affiliateTeam.tagCatalog.deleteIrreversible")}
        </p>
        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setDeleteTagId(null)}
            disabled={deleting}
          >
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => {
              if (deleteTarget) void confirmDelete(deleteTarget.id);
            }}
            disabled={deleting || usageLoading || usage === null}
          >
            {deleting
              ? t("common.loading")
              : t("ecommerce.affiliateTeam.tagCatalog.deleteConfirm", {
                  name: deleteTarget?.name ?? "",
                })}
          </button>
        </div>
      </Modal>
    </section>
  );
}
