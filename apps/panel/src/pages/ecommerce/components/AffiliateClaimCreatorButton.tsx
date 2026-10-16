import { useMutation } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { CLAIM_AFFILIATE_CREATOR_RELATIONSHIP_MUTATION } from "../../../api/shops-queries.js";
import { TkButton, TkTooltip } from "../../../components/design-system/index.js";
import { useToast } from "../../../components/Toast.js";

export function AffiliateClaimCreatorButton({
  creatorRelationshipId,
  onClaimed,
}: {
  creatorRelationshipId: string;
  onClaimed: (businessDeveloperId: string) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [claim, { loading }] = useMutation<{
    claimAffiliateCreatorRelationship: Pick<
      GQL.AffiliateCreatorRelationship,
      "id" | "businessDeveloperId" | "operationalConfigRevision" | "updatedAt"
    >;
  }>(CLAIM_AFFILIATE_CREATOR_RELATIONSHIP_MUTATION);

  async function claimCreator() {
    try {
      const result = await claim({ variables: { creatorRelationshipId } });
      const relationship = result.data?.claimAffiliateCreatorRelationship;
      if (!relationship?.businessDeveloperId) throw new Error(t("ecommerce.updateFailed"));
      await onClaimed(relationship.businessDeveloperId);
      showToast(t("ecommerce.affiliateWorkspace.creatorClaimed"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("ecommerce.updateFailed"), "error");
    }
  }

  return (
    <TkTooltip
      label={t("ecommerce.affiliateWorkspace.claimCreatorHint")}
      trigger={(props) => (
        <TkButton
          {...props}
          variant="primary"
          size="sm"
          loading={loading}
          onClick={() => void claimCreator()}
        >
          {t("ecommerce.affiliateWorkspace.claimCreator")}
        </TkButton>
      )}
    />
  );
}
