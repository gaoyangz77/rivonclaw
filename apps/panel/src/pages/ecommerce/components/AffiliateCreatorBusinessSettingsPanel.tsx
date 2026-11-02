import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { SET_AFFILIATE_CREATOR_BUSINESS_SETTINGS_MUTATION } from "../../../api/shops-queries.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { useToast } from "../../../components/Toast.js";
import {
  TkButton,
  TkPanel,
  TkPanelBody,
  TkPanelHeader,
  TkSwitch,
} from "../../../components/design-system/index.js";

export const AffiliateCreatorBusinessSettingsPanel = observer(
  function AffiliateCreatorBusinessSettingsPanel() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const entityStore = useEntityStore();
    const settings = entityStore.affiliateWorkspace.operationalSettings;
    const loaded = settings != null;
    const persistedAutoClaim = settings?.autoClaimOnSampleApproval ?? false;
    const persistedAutoRelease = settings?.autoReleaseOnSampleRejection ?? false;
    // Drafts hold only primitives; null means "no unsaved edit, follow the store".
    const [autoClaimDraft, setAutoClaimDraft] = useState<boolean | null>(null);
    const [autoReleaseDraft, setAutoReleaseDraft] = useState<boolean | null>(null);
    const autoClaim = autoClaimDraft ?? persistedAutoClaim;
    const autoRelease = autoReleaseDraft ?? persistedAutoRelease;
    const dirty = autoClaim !== persistedAutoClaim || autoRelease !== persistedAutoRelease;
    const [saveSettings, { loading: saving }] = useMutation<
      { setAffiliateCreatorBusinessSettings: GQL.AffiliateOperationalSettings },
      { input: GQL.SetAffiliateCreatorBusinessSettingsInput }
    >(SET_AFFILIATE_CREATOR_BUSINESS_SETTINGS_MUTATION);

    async function save() {
      if (!loaded || !dirty || saving) return;
      try {
        const result = await saveSettings({
          variables: {
            input: {
              autoClaimOnSampleApproval: autoClaim,
              autoReleaseOnSampleRejection: autoRelease,
            },
          },
        });
        if (!result.data?.setAffiliateCreatorBusinessSettings)
          throw new Error("Settings response missing");
        entityStore.affiliateWorkspace.setAffiliateOperationalSettings(
          result.data.setAffiliateCreatorBusinessSettings,
        );
        setAutoClaimDraft(null);
        setAutoReleaseDraft(null);
        showToast(t("ecommerce.affiliateTeam.creatorBusiness.saved"), "success");
      } catch {
        showToast(t("ecommerce.affiliateTeam.creatorBusiness.saveFailed"), "error");
      }
    }

    return (
      <TkPanel padding="none">
        <TkPanelHeader
          title={t("ecommerce.affiliateTeam.creatorBusiness.title")}
          description={t("ecommerce.affiliateTeam.creatorBusiness.description")}
          actions={
            <TkButton
              variant="primary"
              loading={saving}
              disabled={!loaded || !dirty}
              onClick={() => void save()}
            >
              {t("common.save")}
            </TkButton>
          }
        />
        <TkPanelBody>
          <TkSwitch
            label={t("ecommerce.affiliateTeam.creatorBusiness.autoClaim")}
            description={t("ecommerce.affiliateTeam.creatorBusiness.autoClaimHint")}
            checked={autoClaim}
            disabled={!loaded || saving}
            onChange={setAutoClaimDraft}
          />
          <TkSwitch
            label={t("ecommerce.affiliateTeam.creatorBusiness.autoRelease")}
            description={t("ecommerce.affiliateTeam.creatorBusiness.autoReleaseHint")}
            checked={autoRelease}
            disabled={!loaded || saving}
            onChange={setAutoReleaseDraft}
          />
          <p className="form-hint">{t("ecommerce.affiliateTeam.creatorBusiness.exclusions")}</p>
        </TkPanelBody>
      </TkPanel>
    );
  },
);
