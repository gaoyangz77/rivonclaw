import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { RELEASE_AFFILIATE_CREATOR_RELATIONSHIP_MUTATION } from "../../../api/shops-queries.js";
import { TkButton, TkConfirmDialog } from "../../../components/design-system/index.js";
import { useToast } from "../../../components/Toast.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

export function AffiliateReleaseCreatorButton({
  creatorRelationshipId,
  businessDeveloperId,
  onReleased,
}: {
  creatorRelationshipId: string;
  businessDeveloperId: string;
  onReleased: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const [expectedOwner, setExpectedOwner] = useState<string | null>(null);
  const [release, { loading }] = useMutation<{
    releaseAffiliateCreatorRelationship: GQL.AffiliateCreatorRelationship;
  }>(RELEASE_AFFILIATE_CREATOR_RELATIONSHIP_MUTATION);

  async function confirmRelease() {
    if (!expectedOwner || loading) return;
    const confirmedOwner = expectedOwner;
    setExpectedOwner(null);
    try {
      const result = await release({
        variables: { creatorRelationshipId, expectedBusinessDeveloperId: confirmedOwner },
      });
      const relationship = result.data?.releaseAffiliateCreatorRelationship;
      if (!relationship || relationship.businessDeveloperId != null)
        throw new Error(t("ecommerce.updateFailed"));
      entityStore.affiliateWorkspace.upsertAffiliateCreatorRelationship(relationship);
      await onReleased();
      showToast(t("ecommerce.affiliateWorkspace.creatorReleased"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  return (
    <>
      <TkButton size="sm" loading={loading} onClick={() => setExpectedOwner(businessDeveloperId)}>
        {t("ecommerce.affiliateWorkspace.releaseCreator")}
      </TkButton>
      <TkConfirmDialog
        isOpen={expectedOwner !== null}
        onCancel={() => setExpectedOwner(null)}
        onConfirm={() => void confirmRelease()}
        title={t("ecommerce.affiliateWorkspace.releaseCreator")}
        message={t("ecommerce.affiliateWorkspace.releaseCreatorWarning")}
        confirmLabel={t("ecommerce.affiliateWorkspace.confirmReleaseCreator")}
        cancelLabel={t("common.cancel")}
      />
    </>
  );
}
