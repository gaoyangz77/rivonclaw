import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { useToast } from "../../../components/Toast.js";
import {
  ASSIGN_CREATOR_RELATIONSHIP_TAG_MUTATION,
  CREATE_CREATOR_MANUAL_TAG_MUTATION,
  CREATOR_MANUAL_TAGS_QUERY,
  REMOVE_CREATOR_RELATIONSHIP_TAG_MUTATION,
} from "../../../api/shops-queries.js";

export type CreatorManualTagChange = {
  occurredAt: string;
  added: boolean;
  actorType?: GQL.AffiliateLifecycleActorType | null;
  summary: string;
};

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

/**
 * Manual tags on the Relationship: seller-scoped, free-form, and never attached
 * to a shop. The editor holds only the relationship id and primitive drafts, so
 * a store refresh between render and save cannot leave it writing through a
 * dead node.
 */
export function AffiliateCreatorManualTagEditor({
  relationshipId,
  manualTags,
  lastChange,
  onChanged,
}: {
  relationshipId: string;
  manualTags: ReadonlyArray<Pick<GQL.CreatorManualTag, "id" | "name">>;
  lastChange: CreatorManualTagChange | null;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [busyTagId, setBusyTagId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: catalogData, refetch: refetchCatalog } = useQuery<
    { creatorManualTags: GQL.CreatorManualTag[] },
    { input: GQL.ReadCreatorManualTagsInput }
  >(CREATOR_MANUAL_TAGS_QUERY, {
    variables: { input: { search: search.trim() || undefined } },
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
  const [createTag] = useMutation<
    { createCreatorManualTag: GQL.CreatorManualTag },
    { input: GQL.CreateCreatorManualTagInput }
  >(CREATE_CREATOR_MANUAL_TAG_MUTATION);

  const catalog = catalogData?.creatorManualTags ?? [];
  const selectable = selectableManualTags(catalog, manualTags);
  const trimmedSearch = search.trim();
  const canCreate = canCreateManualTag(catalog, trimmedSearch);
  const busy = busyTagId !== null || creating;

  async function assign(manualTagId: string): Promise<void> {
    setBusyTagId(manualTagId);
    try {
      await assignTag({ variables: { input: { creatorRelationshipId: relationshipId, manualTagId } } });
      showToast(t("ecommerce.affiliateWorkspace.manualTags.addSuccess"), "success");
      onChanged();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("ecommerce.affiliateWorkspace.manualTags.updateFailed"),
        "error",
      );
    } finally {
      setBusyTagId(null);
    }
  }

  async function remove(manualTagId: string): Promise<void> {
    setBusyTagId(manualTagId);
    try {
      await removeTag({ variables: { input: { creatorRelationshipId: relationshipId, manualTagId } } });
      showToast(t("ecommerce.affiliateWorkspace.manualTags.removeSuccess"), "success");
      onChanged();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("ecommerce.affiliateWorkspace.manualTags.updateFailed"),
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
      await assignTag({ variables: { input: { creatorRelationshipId: relationshipId, manualTagId } } });
      setSearch("");
      await refetchCatalog();
      showToast(t("ecommerce.affiliateWorkspace.manualTags.createSuccess"), "success");
      onChanged();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("ecommerce.affiliateWorkspace.manualTags.createFailed"),
        "error",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="affiliate-relationship-work-side-card affiliate-manual-tag-card">
      <div className="affiliate-relationship-work-side-card-head">
        <span>{t("ecommerce.affiliateWorkspace.manualTags.title")}</span>
      </div>
      <p className="form-hint">{t("ecommerce.affiliateWorkspace.manualTags.hint")}</p>

      <div className="affiliate-creator-tag-list">
        {manualTags.length ? (
          manualTags.map((tag) => (
            <span className="affiliate-creator-tag" key={tag.id}>
              <span>{tag.name}</span>
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
