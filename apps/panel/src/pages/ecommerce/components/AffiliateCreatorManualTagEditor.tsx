import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { useToast } from "../../../components/Toast.js";
import {
  ASSIGN_CREATOR_RELATIONSHIP_TAG_MUTATION,
  ASSIGN_CREATOR_RELATIONSHIP_SYSTEM_TAG_MUTATION,
  AFFILIATE_CREATOR_SYSTEM_TAG_DEFINITIONS_QUERY,
  CREATE_CREATOR_MANUAL_TAG_MUTATION,
  CREATOR_MANUAL_TAGS_QUERY,
  REMOVE_CREATOR_RELATIONSHIP_TAG_MUTATION,
  REMOVE_CREATOR_RELATIONSHIP_SYSTEM_TAG_MUTATION,
  RENAME_CREATOR_MANUAL_TAG_MUTATION,
} from "../../../api/shops-queries.js";
import {
  creatorSystemTagDescription,
  creatorSystemTagLabel,
} from "../affiliate-creator-system-tags.js";
import panelI18n from "../../../i18n/index.js";
import { formatLocalizedDateTime } from "../../../lib/format-datetime.js";

export type CreatorManualTagChange = {
  occurredAt: string;
  added: boolean;
  actorType?: GQL.AffiliateLifecycleActorType | null;
  summary: string;
};

export type CreatorSystemTagChange = CreatorManualTagChange;

/** Catalog rows the relationship does not already carry. */
export function selectableManualTags<T extends { id: string }>(
  catalog: readonly T[],
  attached: ReadonlyArray<{ id: string }>,
): T[] {
  const attachedIds = new Set(attached.map((tag) => tag.id));
  return catalog.filter((tag) => !attachedIds.has(tag.id));
}

/**
 * Creating is offered only for a name the catalog does not already hold.
 * The backend's uniqueness key is trim + lowercase, so the check must match it
 * or the button would offer a create that always fails.
 */
export function canCreateManualTag(
  catalog: ReadonlyArray<{ name: string }>,
  searchText: string,
): boolean {
  const trimmed = searchText.trim();
  if (trimmed.length === 0) return false;
  return !catalog.some((tag) => tag.name.trim().toLowerCase() === trimmed.toLowerCase());
}

/** Why a rename cannot be submitted, or null when it can. */
export type ManualTagRenameIssue = "EMPTY" | "UNCHANGED" | "DUPLICATE";

/**
 * The rename equivalent of `canCreateManualTag`, with two differences: the tag
 * being renamed is not its own duplicate, and a name equal to the current one
 * is a no-op rather than an error.
 *
 * The catalog this checks is the search-filtered one, so it can miss a conflict
 * with a tag the current search excludes. That is why the backend's unique key
 * is still the authority and `isDuplicateManualTagNameError` exists.
 */
export function manualTagRenameIssue(
  catalog: ReadonlyArray<{ id: string; name: string }>,
  tagId: string,
  currentName: string,
  draftName: string,
): ManualTagRenameIssue | null {
  const trimmed = draftName.trim();
  if (trimmed.length === 0) return "EMPTY";
  if (trimmed === currentName.trim()) return "UNCHANGED";
  const key = trimmed.toLowerCase();
  const clash = catalog.some((tag) => tag.id !== tagId && tag.name.trim().toLowerCase() === key);
  return clash ? "DUPLICATE" : null;
}

/**
 * The uniqueness key {userId, normalizedName} is enforced by a Mongo index, so
 * a losing rename surfaces as a raw driver error. Recognising it is what lets
 * the drawer say "that name is taken" instead of showing the seller an E11000.
 */
export function isDuplicateManualTagNameError(message: string): boolean {
  const lowered = message.toLowerCase();
  return lowered.includes("e11000") || lowered.includes("duplicate key");
}

/**
 * Manual tags on the Relationship: seller-scoped, free-form, and never attached
 * to a shop. The editor holds only the relationship id and primitive drafts, so
 * a store refresh between render and save cannot leave it writing through a
 * dead node.
 */
export function AffiliateCreatorManualTagEditor({
  relationshipId,
  manualTags,
  systemTags = [],
  lastChange,
  lastSystemTagChange = null,
  onChanged,
}: {
  relationshipId: string;
  manualTags: ReadonlyArray<Pick<GQL.CreatorManualTag, "id" | "name" | "sensitive">>;
  systemTags?: readonly GQL.AffiliateCreatorSystemTag[];
  lastChange: CreatorManualTagChange | null;
  lastSystemTagChange?: CreatorSystemTagChange | null;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [busyTagId, setBusyTagId] = useState<string | null>(null);
  const [busySystemTag, setBusySystemTag] = useState<GQL.AffiliateCreatorSystemTag | null>(null);
  const [creating, setCreating] = useState(false);
  // Only the id and a primitive draft: the row this points at is re-read from
  // the current props on every render, so a refetch between opening the form
  // and saving cannot write through a stale tag.
  const [renameTagId, setRenameTagId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);

  const { data: catalogData, refetch: refetchCatalog } = useQuery<
    { creatorManualTags: GQL.CreatorManualTag[] },
    { input: GQL.ReadCreatorManualTagsInput }
  >(CREATOR_MANUAL_TAGS_QUERY, {
    variables: { input: { search: search.trim() || undefined } },
    fetchPolicy: "cache-and-network",
  });
  const { data: systemTagDefinitionData } = useQuery<{
    affiliateCreatorSystemTagDefinitions: GQL.AffiliateCreatorSystemTagDefinition[];
  }>(AFFILIATE_CREATOR_SYSTEM_TAG_DEFINITIONS_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const [assignTag] = useMutation<
    { assignCreatorRelationshipTag: GQL.AffiliateCreatorRelationship },
    { input: GQL.CreatorRelationshipManualTagInput }
  >(ASSIGN_CREATOR_RELATIONSHIP_TAG_MUTATION);
  const [removeTag] = useMutation<
    { removeCreatorRelationshipTag: GQL.AffiliateCreatorRelationship },
    { input: GQL.CreatorRelationshipManualTagInput }
  >(REMOVE_CREATOR_RELATIONSHIP_TAG_MUTATION);
  const [assignSystemTag] = useMutation<
    { assignCreatorRelationshipSystemTag: GQL.AffiliateCreatorRelationship },
    { input: GQL.CreatorRelationshipSystemTagInput }
  >(ASSIGN_CREATOR_RELATIONSHIP_SYSTEM_TAG_MUTATION);
  const [removeSystemTag] = useMutation<
    { removeCreatorRelationshipSystemTag: GQL.AffiliateCreatorRelationship },
    { input: GQL.CreatorRelationshipSystemTagInput }
  >(REMOVE_CREATOR_RELATIONSHIP_SYSTEM_TAG_MUTATION);
  const [createTag] = useMutation<
    { createCreatorManualTag: GQL.CreatorManualTag },
    { input: GQL.CreateCreatorManualTagInput }
  >(CREATE_CREATOR_MANUAL_TAG_MUTATION);
  const [renameTag] = useMutation<
    { renameCreatorManualTag: GQL.CreatorManualTag },
    { input: GQL.RenameCreatorManualTagInput }
  >(RENAME_CREATOR_MANUAL_TAG_MUTATION);

  const catalog = catalogData?.creatorManualTags ?? [];
  const systemTagDefinitions = systemTagDefinitionData?.affiliateCreatorSystemTagDefinitions ?? [];
  const selectable = selectableManualTags(catalog, manualTags);
  const trimmedSearch = search.trim();
  const canCreate = canCreateManualTag(catalog, trimmedSearch);
  const renameTarget = renameTagId
    ? (manualTags.find((tag) => tag.id === renameTagId) ?? null)
    : null;
  const renameIssue = renameTarget
    ? manualTagRenameIssue(catalog, renameTarget.id, renameTarget.name, renameDraft)
    : null;
  const busy = busyTagId !== null || busySystemTag !== null || creating || renaming;

  async function setSystemTag(
    systemTag: GQL.AffiliateCreatorSystemTag,
    attached: boolean,
  ): Promise<void> {
    setBusySystemTag(systemTag);
    try {
      const variables = { input: { creatorRelationshipId: relationshipId, systemTag } };
      if (attached) {
        await removeSystemTag({ variables });
      } else {
        await assignSystemTag({ variables });
      }
      showToast(
        t(
          attached
            ? "ecommerce.affiliateWorkspace.systemTags.removeSuccess"
            : "ecommerce.affiliateWorkspace.systemTags.addSuccess",
        ),
        "success",
      );
      onChanged();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : t("ecommerce.affiliateWorkspace.systemTags.updateFailed"),
        "error",
      );
    } finally {
      setBusySystemTag(null);
    }
  }

  async function assign(manualTagId: string): Promise<void> {
    setBusyTagId(manualTagId);
    try {
      await assignTag({
        variables: { input: { creatorRelationshipId: relationshipId, manualTagId } },
      });
      showToast(t("ecommerce.affiliateWorkspace.manualTags.addSuccess"), "success");
      onChanged();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : t("ecommerce.affiliateWorkspace.manualTags.updateFailed"),
        "error",
      );
    } finally {
      setBusyTagId(null);
    }
  }

  async function remove(manualTagId: string): Promise<void> {
    setBusyTagId(manualTagId);
    try {
      await removeTag({
        variables: { input: { creatorRelationshipId: relationshipId, manualTagId } },
      });
      showToast(t("ecommerce.affiliateWorkspace.manualTags.removeSuccess"), "success");
      onChanged();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : t("ecommerce.affiliateWorkspace.manualTags.updateFailed"),
        "error",
      );
    } finally {
      setBusyTagId(null);
    }
  }

  async function createAndAssign(): Promise<void> {
    if (!canCreate) return;
    setCreating(true);
    try {
      const created = await createTag({
        variables: { input: { name: trimmedSearch, sensitive: false } },
      });
      const manualTagId = created.data?.createCreatorManualTag.id;
      if (!manualTagId) {
        throw new Error(t("ecommerce.affiliateWorkspace.manualTags.createFailed"));
      }
      await assignTag({
        variables: { input: { creatorRelationshipId: relationshipId, manualTagId } },
      });
      setSearch("");
      await refetchCatalog();
      showToast(t("ecommerce.affiliateWorkspace.manualTags.createSuccess"), "success");
      onChanged();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : t("ecommerce.affiliateWorkspace.manualTags.createFailed"),
        "error",
      );
    } finally {
      setCreating(false);
    }
  }

  function openRename(tagId: string, currentName: string): void {
    setRenameTagId(tagId);
    setRenameDraft(currentName);
  }

  function closeRename(): void {
    setRenameTagId(null);
    setRenameDraft("");
  }

  async function rename(tagId: string, sensitive: boolean): Promise<void> {
    const name = renameDraft.trim();
    setRenaming(true);
    try {
      await renameTag({ variables: { input: { tagId, name, sensitive } } });
      closeRename();
      await refetchCatalog();
      showToast(t("ecommerce.affiliateWorkspace.manualTags.renameSuccess"), "success");
      onChanged();
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

  return (
    <section className="affiliate-relationship-work-side-card affiliate-manual-tag-card">
      <div className="affiliate-relationship-work-side-card-head">
        <span>{t("ecommerce.affiliateWorkspace.systemTags.editorTitle")}</span>
      </div>
      <div className="affiliate-system-tag-editor">
        <strong>{t("ecommerce.affiliateWorkspace.systemTags.title")}</strong>
        <p className="form-hint">{t("ecommerce.affiliateWorkspace.systemTags.hint")}</p>
        <div className="affiliate-system-tag-options">
          {systemTagDefinitions.map((definition) => {
            const attached = systemTags.includes(definition.tag);
            return (
              <div className="affiliate-system-tag-option" key={definition.tag}>
                <div>
                  <strong>{creatorSystemTagLabel(t, definition.tag)}</strong>
                  <span>{creatorSystemTagDescription(t, definition.tag)}</span>
                </div>
                <button
                  className={attached ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                  type="button"
                  onClick={() => void setSystemTag(definition.tag, attached)}
                  disabled={busy}
                >
                  {t(
                    attached
                      ? "ecommerce.affiliateWorkspace.systemTags.remove"
                      : "ecommerce.affiliateWorkspace.systemTags.add",
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div className="affiliate-manual-tag-last-change">
          {lastSystemTagChange ? (
            <span>
              {t(
                lastSystemTagChange.added
                  ? "ecommerce.affiliateWorkspace.systemTags.lastChangeAdded"
                  : "ecommerce.affiliateWorkspace.systemTags.lastChangeRemoved",
                {
                  time: formatManualTagChangeTime(lastSystemTagChange.occurredAt),
                  source: manualTagChangeSourceLabel(t, lastSystemTagChange.actorType),
                },
              )}
            </span>
          ) : (
            <span>{t("ecommerce.affiliateWorkspace.systemTags.noChanges")}</span>
          )}
        </div>
      </div>

      <div className="affiliate-tag-editor-section-title">
        <strong>{t("ecommerce.affiliateWorkspace.manualTags.title")}</strong>
      </div>
      <p className="form-hint">{t("ecommerce.affiliateWorkspace.manualTags.hint")}</p>

      <div className="affiliate-creator-tag-list">
        {manualTags.length ? (
          manualTags.map((tag) => (
            <span className="affiliate-creator-tag" key={tag.id}>
              <span>{tag.name}</span>
              <button
                className="affiliate-creator-tag-rename"
                type="button"
                onClick={() => openRename(tag.id, tag.name)}
                disabled={busy}
                aria-label={t("ecommerce.affiliateWorkspace.manualTags.rename", { name: tag.name })}
                title={t("ecommerce.affiliateWorkspace.manualTags.rename", { name: tag.name })}
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => void remove(tag.id)}
                disabled={busy}
                aria-label={t("ecommerce.affiliateWorkspace.manualTags.remove", { name: tag.name })}
                title={t("ecommerce.affiliateWorkspace.manualTags.remove", { name: tag.name })}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="affiliate-creator-tag-empty">
            {t("ecommerce.affiliateWorkspace.manualTagsEmpty")}
          </span>
        )}
      </div>

      {renameTarget ? (
        <div className="affiliate-manual-tag-rename">
          <label className="affiliate-filter-field">
            <span>
              {t("ecommerce.affiliateWorkspace.manualTags.renameLabel", {
                name: renameTarget.name,
              })}
            </span>
            <input
              className="affiliate-attention-search"
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              placeholder={t("ecommerce.affiliateWorkspace.manualTags.renamePlaceholder")}
              aria-label={t("ecommerce.affiliateWorkspace.manualTags.renameLabel", {
                name: renameTarget.name,
              })}
              autoFocus
            />
          </label>
          <p className="affiliate-manual-tag-rename-scope">
            {t("ecommerce.affiliateWorkspace.manualTags.renameScopeWarning")}
          </p>
          {renameIssue === "DUPLICATE" ? (
            <p className="affiliate-manual-tag-rename-error">
              {t("ecommerce.affiliateWorkspace.manualTags.renameDuplicate", {
                name: renameDraft.trim(),
              })}
            </p>
          ) : null}
          <div className="affiliate-manual-tag-rename-actions">
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={closeRename}
              disabled={renaming}
            >
              {t("common.cancel")}
            </button>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => void rename(renameTarget.id, renameTarget.sensitive)}
              disabled={busy || renameIssue !== null}
            >
              {renaming
                ? t("common.loading")
                : t("ecommerce.affiliateWorkspace.manualTags.renameConfirm")}
            </button>
          </div>
        </div>
      ) : null}

      <label className="affiliate-filter-field affiliate-manual-tag-search">
        <span>{t("ecommerce.affiliateWorkspace.manualTags.searchLabel")}</span>
        <input
          className="affiliate-attention-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("ecommerce.affiliateWorkspace.manualTags.searchPlaceholder")}
          aria-label={t("ecommerce.affiliateWorkspace.manualTags.searchLabel")}
        />
      </label>

      <div className="affiliate-policy-option-grid affiliate-manual-tag-options">
        {selectable.length === 0 ? (
          <div className="affiliate-policy-option-empty">
            {t("ecommerce.affiliateWorkspace.manualTags.noSelectable")}
          </div>
        ) : (
          selectable.map((tag) => (
            <button
              key={tag.id}
              className="affiliate-policy-option"
              type="button"
              onClick={() => void assign(tag.id)}
              disabled={busy}
            >
              {tag.name}
            </button>
          ))
        )}
      </div>

      {canCreate ? (
        <button
          className="btn btn-secondary btn-sm affiliate-manual-tag-create"
          type="button"
          onClick={() => void createAndAssign()}
          disabled={busy}
        >
          {t("ecommerce.affiliateWorkspace.manualTags.createAndAdd", { name: trimmedSearch })}
        </button>
      ) : null}

      <div className="affiliate-manual-tag-last-change">
        {lastChange ? (
          <span>
            {t(
              lastChange.added
                ? "ecommerce.affiliateWorkspace.manualTags.lastChangeAdded"
                : "ecommerce.affiliateWorkspace.manualTags.lastChangeRemoved",
              {
                time: formatManualTagChangeTime(lastChange.occurredAt),
                source: manualTagChangeSourceLabel(t, lastChange.actorType),
              },
            )}
          </span>
        ) : (
          <span>{t("ecommerce.affiliateWorkspace.manualTags.noChanges")}</span>
        )}
      </div>
    </section>
  );
}

function formatManualTagChangeTime(value: string): string {
  return formatLocalizedDateTime(value, panelI18n.language, undefined, value);
}

function manualTagChangeSourceLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  actorType: GQL.AffiliateLifecycleActorType | null | undefined,
): string {
  if (actorType === GQL.AffiliateLifecycleActorType.Agent) {
    return t("ecommerce.affiliateWorkspace.manualTags.sourceAgent");
  }
  if (actorType === GQL.AffiliateLifecycleActorType.Human) {
    return t("ecommerce.affiliateWorkspace.manualTags.sourceHuman");
  }
  return t("ecommerce.affiliateWorkspace.manualTags.sourceSystem");
}
