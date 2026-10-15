import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { SET_AFFILIATE_UNREPLIED_MESSAGE_LOOKBACK_MUTATION } from "../../../api/shops-queries.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { useToast } from "../../../components/Toast.js";
import {
  TkButton,
  TkField,
  TkPanel,
  TkPanelBody,
  TkPanelHeader,
} from "../../../components/design-system/index.js";

export const AffiliateMessageLookbackPanel = observer(function AffiliateMessageLookbackPanel() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const [daysDraft, setDaysDraft] = useState<string | null>(null);
  const persistedDays =
    entityStore.affiliateWorkspace.operationalSettings?.unrepliedMessageLookbackDays;
  const daysText = daysDraft ?? String(persistedDays ?? 90);
  const days = Number(daysText);
  const valid = daysText.trim() !== "" && Number.isInteger(days) && days >= 1 && days <= 90;
  const [saveSettings, { loading: saving }] = useMutation<
    { setAffiliateUnrepliedMessageLookback: GQL.AffiliateOperationalSettings },
    { days: number }
  >(SET_AFFILIATE_UNREPLIED_MESSAGE_LOOKBACK_MUTATION);

  async function save() {
    if (!valid || saving || persistedDays == null) return;
    try {
      const result = await saveSettings({ variables: { days } });
      if (!result.data?.setAffiliateUnrepliedMessageLookback)
        throw new Error("Settings response missing");
      entityStore.affiliateWorkspace.setAffiliateOperationalSettings(
        result.data.setAffiliateUnrepliedMessageLookback,
      );
      setDaysDraft(null);
      showToast(t("ecommerce.affiliateTeam.messageLookback.saved"), "success");
    } catch {
      showToast(t("ecommerce.affiliateTeam.messageLookback.saveFailed"), "error");
    }
  }

  return (
    <TkPanel padding="none">
      <TkPanelHeader
        title={t("ecommerce.affiliateTeam.messageLookback.title")}
        description={t("ecommerce.affiliateTeam.messageLookback.description")}
        actions={
          <TkButton
            variant="primary"
            loading={saving}
            disabled={!valid || persistedDays == null || days === persistedDays}
            onClick={() => void save()}
          >
            {t("common.save")}
          </TkButton>
        }
      />
      <TkPanelBody>
        <TkField
          type="number"
          min={1}
          max={90}
          step={1}
          label={t("ecommerce.affiliateTeam.messageLookback.days")}
          hint={t("ecommerce.affiliateTeam.messageLookback.hint")}
          error={!valid ? t("ecommerce.affiliateTeam.messageLookback.invalid") : undefined}
          value={daysText}
          disabled={saving || persistedDays == null}
          onChange={(event) => setDaysDraft(event.target.value)}
        />
        <p className="form-hint">
          {t("ecommerce.affiliateTeam.messageLookback.existingProposals")}
        </p>
      </TkPanelBody>
    </TkPanel>
  );
});
