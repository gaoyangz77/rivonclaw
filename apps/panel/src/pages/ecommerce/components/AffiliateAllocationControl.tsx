import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
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
} from "../../../components/design-system/index.js";
import { useToast } from "../../../components/Toast.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { AffiliateReleaseCreatorButton } from "./AffiliateReleaseCreatorButton.js";
import "./AffiliateAllocationControl.css";

/**
 * Who owns a Creator, for a region admin (ADR-112): assign a BD, change the BD,
 * or return the Creator to the public pool. These are the only writes a staff
 * login has, and the Backend allows each only for a Creator whose shops are all
 * in the admin's scope. Its refusal (translated by the Affiliate permission
 * error link) reaches the admin as a toast; the control is shown only where the
 * Panel can see the Creator's shops are in scope.
 *
 * Takes ids only: the owner it was opened for is what the release confirms, and
 * the BD list is read for the Creator when the dialog opens.
 */
export function AffiliateAllocationControl({
  creatorRelationshipId,
  businessDeveloperId,
  onChanged,
}: {
  creatorRelationshipId: string;
  /** The current owner, or null for a Creator in the public pool. */
  businessDeveloperId: string | null;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const [open, setOpen] = useState(false);
  const [chosenId, setChosenId] = useState("");
  const candidates = useQuery<{
    affiliateAssignableBusinessDevelopers: GQL.AffiliateAllocationBusinessDeveloper[];
  }>(AFFILIATE_ASSIGNABLE_BUSINESS_DEVELOPERS_QUERY, {
    variables: { creatorRelationshipId },
    fetchPolicy: "network-only",
    skip: !open,
  });
  const [assign, { loading }] = useMutation<{
    assignAffiliateBusinessDeveloper: GQL.AffiliateCreatorRelationship;
  }>(ASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION);

  const developers = (candidates.data?.affiliateAssignableBusinessDevelopers ?? [])
    .filter((developer) => developer.id !== businessDeveloperId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  function openDialog() {
    setChosenId("");
    setOpen(true);
  }

  async function confirmAssignment() {
    if (!chosenId || loading) return;
    const chosen = developers.find((developer) => developer.id === chosenId);
    try {
      const result = await assign({
        variables: { input: { creatorRelationshipId, businessDeveloperId: chosenId } },
      });
      const relationship = result.data?.assignAffiliateBusinessDeveloper;
      if (!relationship || String(relationship.businessDeveloperId ?? "") !== chosenId) {
        throw new Error(t("ecommerce.updateFailed"));
      }
      entityStore.affiliateWorkspace.upsertAffiliateCreatorRelationship(relationship);
      setOpen(false);
      await onChanged();
      showToast(t("ecommerce.affiliateStaff.allocated", { name: chosen?.displayName ?? "" }), "success");
    } catch (error) {
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
        {t(businessDeveloperId ? "ecommerce.affiliateStaff.changeBd" : "ecommerce.affiliateStaff.assignBd")}
      </TkButton>
      {businessDeveloperId ? (
        <AffiliateReleaseCreatorButton
          creatorRelationshipId={creatorRelationshipId}
          businessDeveloperId={businessDeveloperId}
          onReleased={onChanged}
        />
      ) : null}
      <TkModal
        isOpen={open}
        onClose={() => {
          if (!loading) setOpen(false);
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
              searchPlaceholder={t("ecommerce.affiliateWorkspace.businessDeveloperSearchPlaceholder")}
              disabled={loading}
            />
          )}
          <div className="tk-v1-modal-actions">
            <TkButton variant="secondary" disabled={loading} onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </TkButton>
            <TkButton
              variant="primary"
              loading={loading}
              disabled={!chosenId}
              onClick={() => void confirmAssignment()}
            >
              {t("ecommerce.affiliateStaff.allocateConfirm")}
            </TkButton>
          </div>
        </div>
      </TkModal>
    </div>
  );
}
