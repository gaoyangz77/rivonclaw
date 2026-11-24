import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { AFFILIATE_ASSIGNABLE_BUSINESS_DEVELOPERS_QUERY } from "../../../api/affiliate-staff-queries.js";
import { ASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION } from "../../../api/shops-queries.js";
import {
  TkAlert,
  TkButton,
  TkChoiceSelect,
  TkLoadingState,
  TkModal,
  TkPrivate,
} from "../../../components/design-system/index.js";
import { useToast } from "../../../components/Toast.js";
import { AFFILIATE_CREATOR_OWNER_CHANGED } from "../../../lib/affiliate-allocation.js";
import { graphQLErrorCode } from "../../../lib/graphql-error-code.js";
import { shopDisplayLabel } from "../../../lib/shop-display.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { AffiliateReleaseCreatorButton } from "./AffiliateReleaseCreatorButton.js";
import "./AffiliateAllocationControl.css";

/**
 * Who owns a Creator, for a staff login holding `ALLOCATE` (ADR-112, ADR-113):
 * assign a BD, change the BD, or return the Creator to the public pool. The
 * picker lists only the BDs the Backend lets this login name for the Creator, and
 * the Backend decides each write; its refusal (translated by the Affiliate
 * permission error link) reaches the user as a toast.
 *
 * Every assignment carries the owner the user was looking at when the dialog
 * opened (`null` for a public Creator), so a write based on a stale owner is
 * refused instead of overriding someone else's change. A BD that does not cover
 * every shop of the Creator is a warning, never a block (ADR-113).
 *
 * Takes ids only: the owner it was opened for is what the write and the release
 * confirm, and the BD list is read for the Creator when the dialog opens.
 */
export const AffiliateAllocationControl = observer(function AffiliateAllocationControl({
  creatorRelationshipId,
  businessDeveloperId,
  onChanged,
}: {
  creatorRelationshipId: string;
  /** The current owner, or null for a Creator in the public pool. */
  businessDeveloperId: string | null;
  onChanged: () => Promise<unknown>;
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  // The dialog is open while this is set. It holds the owner seen at open: the
  // owner the write expects, and the one the picker leaves out.
  const [dialog, setDialog] = useState<{ expectedOwnerId: string | null } | null>(null);
  const [chosenId, setChosenId] = useState("");
  const candidates = useQuery<{
    affiliateAssignableBusinessDevelopers: GQL.AffiliateAssignableBusinessDeveloper[];
  }>(AFFILIATE_ASSIGNABLE_BUSINESS_DEVELOPERS_QUERY, {
    variables: { creatorRelationshipId },
    fetchPolicy: "network-only",
    skip: !dialog,
  });
  const [assign, { loading }] = useMutation<{
    assignAffiliateBusinessDeveloper: GQL.AffiliateCreatorRelationship;
  }>(ASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION);

  const developers = (candidates.data?.affiliateAssignableBusinessDevelopers ?? [])
    .filter((developer) => developer.id !== dialog?.expectedOwnerId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const chosen = developers.find((developer) => developer.id === chosenId);
  const uncoveredShops = (chosen?.uncoveredShopIds ?? []).map((shopId) =>
    shopDisplayLabel(
      entityStore.shops.find((candidate) => candidate.id === shopId),
      shopId,
    ),
  );

  function openDialog() {
    setChosenId("");
    setDialog({ expectedOwnerId: businessDeveloperId });
  }

  async function confirmAssignment() {
    if (!dialog || !chosen || loading) return;
    const { expectedOwnerId } = dialog;
    const chosenName = chosen.displayName;
    const targetId = chosen.id;
    try {
      const result = await assign({
        variables: {
          input: {
            creatorRelationshipId,
            businessDeveloperId: targetId,
            expectedBusinessDeveloperId: expectedOwnerId,
          },
        },
      });
      const relationship = result.data?.assignAffiliateBusinessDeveloper;
      if (!relationship || String(relationship.businessDeveloperId ?? "") !== targetId) {
        throw new Error(t("ecommerce.updateFailed"));
      }
      entityStore.affiliateWorkspace.upsertAffiliateCreatorRelationship(relationship);
      setDialog(null);
      await onChanged();
      showToast(t("ecommerce.affiliateStaff.allocated", { name: chosenName }), "success");
    } catch (error) {
      if (graphQLErrorCode(error) === AFFILIATE_CREATOR_OWNER_CHANGED) {
        // Someone changed the owner after this dialog opened: show the current one.
        setDialog(null);
        showToast(t("ecommerce.affiliateStaff.ownerChanged"), "error");
        await onChanged();
        return;
      }
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  return (
    // The Creator list opens a detail on click; allocation must not.
    <div
      className="affiliate-allocation-control"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <TkButton size="sm" variant="secondary" onClick={openDialog}>
        {t(
          businessDeveloperId
            ? "ecommerce.affiliateStaff.changeBd"
            : "ecommerce.affiliateStaff.assignBd",
        )}
      </TkButton>
      {businessDeveloperId ? (
        <AffiliateReleaseCreatorButton
          creatorRelationshipId={creatorRelationshipId}
          businessDeveloperId={businessDeveloperId}
          onReleased={onChanged}
        />
      ) : null}
      <TkModal
        isOpen={dialog !== null}
        onClose={() => {
          if (!loading) setDialog(null);
        }}
        title={t("ecommerce.affiliateStaff.allocateTitle")}
        maxWidth={480}
      >
        <div className="affiliate-allocation-dialog">
          <p>{t("ecommerce.affiliateStaff.allocateDescription")}</p>
          {candidates.error ? (
            <TkAlert tone="danger" title={t("ecommerce.affiliateStaff.allocateLoadFailed")}>
              {candidates.error.message}
            </TkAlert>
          ) : candidates.loading && !candidates.data ? (
            <TkLoadingState size="inline" label={t("common.loading")} />
          ) : developers.length === 0 ? (
            <TkAlert tone="info">{t("ecommerce.affiliateStaff.allocateEmpty")}</TkAlert>
          ) : (
            <TkChoiceSelect
              label={t("ecommerce.affiliateStaff.allocateLabel")}
              placeholder={t("ecommerce.affiliateStaff.allocatePlaceholder")}
              value={chosenId}
              onChange={setChosenId}
              options={developers.map((developer) => ({
                value: developer.id,
                label: developer.displayName,
              }))}
              searchable
              searchPlaceholder={t(
                "ecommerce.affiliateWorkspace.businessDeveloperSearchPlaceholder",
              )}
              disabled={loading}
            />
          )}
          {uncoveredShops.length > 0 ? (
            <TkAlert tone="warning">
              <TkPrivate sensitive={uncoveredShops.some((shop) => shop.sensitive)}>
                {t("ecommerce.affiliateStaff.allocateUncoveredWarning", {
                  shops: new Intl.ListFormat(i18n.language, {
                    style: "long",
                    type: "conjunction",
                  }).format(uncoveredShops.map((shop) => shop.text)),
                })}
              </TkPrivate>
            </TkAlert>
          ) : null}
          <div className="tk-v1-modal-actions">
            <TkButton variant="secondary" disabled={loading} onClick={() => setDialog(null)}>
              {t("common.cancel")}
            </TkButton>
            <TkButton
              variant="primary"
              loading={loading}
              disabled={!chosen}
              onClick={() => void confirmAssignment()}
            >
              {t("ecommerce.affiliateStaff.allocateConfirm")}
            </TkButton>
          </div>
        </div>
      </TkModal>
    </div>
  );
});
