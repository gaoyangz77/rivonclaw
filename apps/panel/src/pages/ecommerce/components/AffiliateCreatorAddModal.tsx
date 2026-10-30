import { useId, useState, type FormEvent } from "react";
import { useMutation } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { IMPORT_AFFILIATE_CREATOR_UPDATES_MUTATION } from "../../../api/shops-queries.js";
import {
  TkField,
  TkFormStack,
  TkModal as Modal,
  TkPanel,
  TkPanelBody,
} from "../../../components/design-system/index.js";
import { Select } from "../../../components/inputs/Select.js";
import { useToast } from "../../../components/Toast.js";
import "./AffiliateCreatorAddModal.css";

/** Select value for "no human BD"; never sent to the backend. */
const UNASSIGNED_BD = "__UNASSIGNED__";

/** Backend limits (AffiliateCreatorRelationshipSellerMetadataService); a longer value rejects the row. */
export const AFFILIATE_SELLER_PROVIDED_UID_MAX_LENGTH = 128;
export const AFFILIATE_SELLER_NOTE_MAX_LENGTH = 5000;

/** A BD as a primitive DTO, so the modal never holds a live MST node. */
export interface AffiliateCreatorAddBd {
  id: string;
  displayName: string;
}

/** A manual tag from the seller's catalog, as a primitive DTO. */
export interface AffiliateCreatorAddTag {
  id: string;
  name: string;
}

export interface AffiliateCreatorAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Active BDs the Creator can be assigned to. */
  developers: readonly AffiliateCreatorAddBd[];
  /** The existing manual tag catalog. Tags can only be picked here, never created. */
  tags: readonly AffiliateCreatorAddTag[];
  tagsLoading: boolean;
  /** Called after the backend accepted the change, so the page can refetch what it shows. */
  onAdded: () => void;
}

export interface AffiliateCreatorAddDraft {
  username: string;
  businessDeveloperId: string | null;
  protect: boolean;
  protectionNote: string;
  sellerProvidedUid: string;
  sellerNote: string;
  /** Names of catalog tags; the backend rejects a name it does not know. */
  manualTagNames: readonly string[];
}

/** Accepts `@name`, `name` and surrounding whitespace; returns the bare TikTok username. */
export function normalizeCreatorUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").trim();
}

/**
 * The single import entry for one Creator: additive, never overwriting.
 *
 * A blank UID or note is left out of the entry entirely. With `overwrite: false` the backend
 * writes seller metadata whenever the field is present, and a present `null` clears the value
 * already stored, so sending null would wipe the Creator's existing UID or note.
 */
export function buildAffiliateCreatorAddEntry(
  draft: AffiliateCreatorAddDraft,
): GQL.ImportAffiliateCreatorUpdateEntryInput {
  const sellerProvidedUid = draft.sellerProvidedUid.trim();
  const sellerNote = draft.sellerNote.trim();
  return {
    platform: GQL.ShopPlatform.TiktokShop,
    creatorOpenId: null,
    username: normalizeCreatorUsername(draft.username),
    businessDeveloperId: draft.businessDeveloperId,
    protect: draft.protect,
    protectionNote: draft.protect ? draft.protectionNote.trim() || null : null,
    overwrite: false,
    businessDeveloperOnly: false,
    manualTagNames: [...draft.manualTagNames],
    ...(sellerProvidedUid ? { sellerProvidedUid } : {}),
    ...(sellerNote ? { sellerNote } : {}),
  };
}

type SubmitFailure = { kind: "rejected" | "error"; message: string };

export function AffiliateCreatorAddModal({
  isOpen,
  onClose,
  developers,
  tags,
  tagsLoading,
  onAdded,
}: AffiliateCreatorAddModalProps) {
  const { t } = useTranslation();
  const noteFieldId = useId();
  const { showToast } = useToast();
  const [importCreatorUpdates, { loading }] = useMutation<
    { importAffiliateCreatorUpdates: GQL.ImportAffiliateCreatorUpdatesPayload },
    { input: GQL.ImportAffiliateCreatorUpdatesInput }
  >(IMPORT_AFFILIATE_CREATOR_UPDATES_MUTATION);
  const [username, setUsername] = useState("");
  const [bdId, setBdId] = useState(UNASSIGNED_BD);
  const [protect, setProtect] = useState(true);
  const [note, setNote] = useState("");
  const [sellerUid, setSellerUid] = useState("");
  const [sellerNote, setSellerNote] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<readonly string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [failure, setFailure] = useState<SubmitFailure | null>(null);

  const normalizedUsername = normalizeCreatorUsername(username);
  const trimmedUid = sellerUid.trim();
  const trimmedSellerNote = sellerNote.trim();
  // A tag that left the catalog since it was picked is dropped rather than sent.
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
  const uidTooLong = trimmedUid.length > AFFILIATE_SELLER_PROVIDED_UID_MAX_LENGTH;
  const sellerNoteTooLong = trimmedSellerNote.length > AFFILIATE_SELLER_NOTE_MAX_LENGTH;
  const nothingToApply =
    !protect &&
    bdId === UNASSIGNED_BD &&
    trimmedUid === "" &&
    trimmedSellerNote === "" &&
    selectedTags.length === 0;
  const canSubmit =
    normalizedUsername !== "" && !nothingToApply && !uidTooLong && !sellerNoteTooLong && !loading;
  const tagQuery = tagSearch.trim().toLowerCase();
  const visibleTags = tags.filter((tag) => tag.name.toLowerCase().includes(tagQuery));
  const bdOptions = [
    {
      value: UNASSIGNED_BD,
      label: t("ecommerce.affiliateTeam.unassignedOwner"),
    },
    ...developers.map((developer) => ({
      value: developer.id,
      label: developer.displayName,
    })),
  ];

  function finish() {
    setUsername("");
    setBdId(UNASSIGNED_BD);
    setProtect(true);
    setNote("");
    setSellerUid("");
    setSellerNote("");
    setSelectedTagIds([]);
    setTagSearch("");
    setFailure(null);
    onClose();
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  }

  function requestClose() {
    if (!loading) finish();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    // Capture primitives before the await; the toast copy is decided from this snapshot.
    const draft: AffiliateCreatorAddDraft = {
      username,
      businessDeveloperId: bdId === UNASSIGNED_BD ? null : bdId,
      protect,
      protectionNote: note,
      sellerProvidedUid: sellerUid,
      sellerNote,
      manualTagNames: selectedTags.map((tag) => tag.name),
    };
    const bdName = developers.find((developer) => developer.id === bdId)?.displayName ?? null;
    setFailure(null);
    try {
      const result = await importCreatorUpdates({
        variables: {
          input: {
            importBatchId: crypto.randomUUID(),
            entries: [buildAffiliateCreatorAddEntry(draft)],
          },
        },
      });
      const payload = result.data?.importAffiliateCreatorUpdates;
      const item = payload?.results[0];
      if (!payload || payload.results.length !== 1 || item?.index !== 0) {
        throw new Error("Affiliate Creator update response did not contain exactly one result");
      }
      // The copy renders the leading "@" itself.
      const handle = normalizeCreatorUsername(draft.username);
      switch (item.status) {
        case GQL.AffiliateCreatorBulkUpdateStatus.Applied:
          showToast(creatorAddedMessage(t, handle, draft.protect, bdName));
          break;
        case GQL.AffiliateCreatorBulkUpdateStatus.NoOp:
          showToast(t("ecommerce.affiliateTeam.creatorAddNoOp", { username: handle }));
          break;
        case GQL.AffiliateCreatorBulkUpdateStatus.Rejected:
        case GQL.AffiliateCreatorBulkUpdateStatus.Failed:
          setFailure({ kind: "rejected", message: item.reason || item.status });
          return;
        default:
          throw new Error(`Unknown Affiliate Creator update status: ${String(item.status)}`);
      }
      finish();
      onAdded();
    } catch (error) {
      setFailure({
        kind: "error",
        message: error instanceof Error ? error.message : t("ecommerce.updateFailed"),
      });
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title={t("ecommerce.affiliateTeam.creatorAddTitle")}
      maxWidth={480}
      closeLabel={t("common.close")}
      preventBackdropClose={loading}
    >
      <form className="affiliate-creator-add-form" onSubmit={(event) => void submit(event)}>
        <TkFormStack>
          <TkField
            label={t("ecommerce.affiliateTeam.creatorAddUsername")}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t("ecommerce.affiliateTeam.creatorIdentityPlaceholder")}
            autoComplete="off"
            required
            disabled={loading}
          />

          <div className="tk-v1-field">
            <span className="tk-v1-label">{t("ecommerce.affiliateTeam.creatorAddBd")}</span>
            <Select
              value={bdId}
              options={bdOptions}
              onChange={setBdId}
              ariaLabel={t("ecommerce.affiliateTeam.creatorAddBd")}
              disabled={loading}
            />
          </div>

          <div className="affiliate-creator-add-protect-group">
            <label className="affiliate-creator-add-protect">
              <input
                type="checkbox"
                className="checkbox-sm"
                checked={protect}
                onChange={(event) => setProtect(event.target.checked)}
                disabled={loading}
              />
              <span className="affiliate-creator-add-protect-copy">
                <strong>{t("ecommerce.affiliateTeam.creatorAddProtect")}</strong>
                <small>{t("ecommerce.affiliateTeam.creatorAddProtectHint")}</small>
              </span>
            </label>
            {nothingToApply && (
              <div className="form-hint form-hint-error">
                {t("ecommerce.affiliateTeam.creatorAddNothingToApply")}
              </div>
            )}
          </div>

          <TkField
            label={t("ecommerce.affiliateTeam.creatorAddProtectionNote")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("ecommerce.affiliateTeam.notePlaceholder")}
            autoComplete="off"
            disabled={loading || !protect}
          />

          <div className="form-hint">{t("ecommerce.affiliateTeam.creatorAddRelationshipHint")}</div>

          <TkField
            label={t("ecommerce.affiliateWorkspace.sellerProvidedUid")}
            value={sellerUid}
            onChange={(event) => setSellerUid(event.target.value)}
            error={
              uidTooLong
                ? t("ecommerce.affiliateTeam.creatorAddTooLong", {
                    max: AFFILIATE_SELLER_PROVIDED_UID_MAX_LENGTH,
                    count: trimmedUid.length,
                  })
                : undefined
            }
            autoComplete="off"
            disabled={loading}
          />

          <div className={`tk-v1-field${sellerNoteTooLong ? " tk-v1-field-error" : ""}`}>
            <label className="tk-v1-label" htmlFor={noteFieldId}>
              {t("ecommerce.affiliateWorkspace.sellerNote")}
            </label>
            <textarea
              id={noteFieldId}
              className="input-full textarea-resize-vertical"
              rows={3}
              value={sellerNote}
              onChange={(event) => setSellerNote(event.target.value)}
              placeholder={t("ecommerce.affiliateWorkspace.sellerNotePlaceholder")}
              aria-invalid={sellerNoteTooLong || undefined}
              disabled={loading}
            />
            {sellerNoteTooLong && (
              <div className="tk-v1-field-support">
                {t("ecommerce.affiliateTeam.creatorAddTooLong", {
                  max: AFFILIATE_SELLER_NOTE_MAX_LENGTH,
                  count: trimmedSellerNote.length,
                })}
              </div>
            )}
          </div>

          <div className="tk-v1-field">
            <span className="tk-v1-label">
              {t("ecommerce.affiliateWorkspace.manualTags.title")}
            </span>
            {selectedTags.length > 0 && (
              <ul className="affiliate-creator-add-tag-pills">
                {selectedTags.map((tag) => (
                  <li key={tag.id} className="affiliate-creator-add-tag-pill">
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      aria-label={t("ecommerce.affiliateWorkspace.manualTags.remove", {
                        name: tag.name,
                      })}
                      onClick={() => toggleTag(tag.id)}
                      disabled={loading}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <TkField
              label={t("ecommerce.affiliateWorkspace.manualTags.searchLabel")}
              hideLabel
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
              placeholder={t("ecommerce.affiliateTeam.creatorAddTagSearchPlaceholder")}
              autoComplete="off"
              disabled={loading}
            />
            <TkPanel variant="subtle" padding="none" className="affiliate-creator-add-tags-frame">
              <TkPanelBody scroll padding="sm">
                {tags.length === 0 || visibleTags.length === 0 ? (
                  <div className="affiliate-creator-add-tags-empty">
                    {tagsLoading && tags.length === 0
                      ? t("common.loading")
                      : t(
                          tags.length === 0
                            ? "ecommerce.affiliateTeam.creatorAddTagsEmpty"
                            : "ecommerce.affiliateTeam.creatorAddTagsNoMatch",
                        )}
                  </div>
                ) : (
                  <div className="affiliate-creator-add-tag-options">
                    {visibleTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className="affiliate-creator-add-tag-option"
                        aria-pressed={selectedTagIds.includes(tag.id)}
                        onClick={() => toggleTag(tag.id)}
                        disabled={loading}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </TkPanelBody>
            </TkPanel>
          </div>
        </TkFormStack>

        {failure && (
          <div className="affiliate-creator-add-failure" role="alert">
            <div className="form-hint form-hint-error">{failure.message}</div>
            {failure.kind === "rejected" && !protect && (
              <div className="form-hint">
                {t("ecommerce.affiliateTeam.creatorAddNotInSystemHint")}
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={requestClose}
            disabled={loading}
          >
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {loading ? t("common.loading") : t("ecommerce.affiliateTeam.creatorAddSubmit")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function creatorAddedMessage(
  t: (key: string, options?: Record<string, unknown>) => string,
  handle: string,
  protect: boolean,
  bdName: string | null,
): string {
  if (!protect) {
    return t("ecommerce.affiliateTeam.creatorAddedAssigned", {
      username: handle,
      name: bdName,
    });
  }
  return bdName
    ? t("ecommerce.affiliateTeam.creatorAddedProtectedWithBd", {
        username: handle,
        name: bdName,
      })
    : t("ecommerce.affiliateTeam.creatorAddedProtectedOnly", {
        username: handle,
      });
}
