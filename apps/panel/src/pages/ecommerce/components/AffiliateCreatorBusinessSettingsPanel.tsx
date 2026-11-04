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
  TkField,
  TkFormGroup,
  TkPanel,
  TkPanelBody,
  TkPanelHeader,
  TkSwitch,
} from "../../../components/design-system/index.js";
import "./AffiliateCreatorBusinessSettingsPanel.css";

// TikTok's review window is 144 hours; the backend accepts 1..142 hours before its deadline.
const RELEASE_HOURS_MIN = 1;
const RELEASE_HOURS_MAX = 142;
const RELEASE_HOURS_DEFAULT = 72;

// Display order of the assignment scenarios. The default selection is owned by the backend.
const ASSIGNMENT_TRIGGERS = [
  "CREATOR_INBOUND",
  "SAMPLE_APPLICATION",
  "PARTNER_SAMPLE_APPLICATION",
  "REFUNDABLE_SAMPLE_APPLICATION",
  "TARGET_COLLABORATION",
  "CAMPAIGN_FIRST_TOUCH",
  "PLATFORM_ACTION",
] as const satisfies readonly GQL.AffiliateCreatorAssignmentTrigger[];

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

export const AffiliateCreatorBusinessSettingsPanel = observer(
  function AffiliateCreatorBusinessSettingsPanel() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const entityStore = useEntityStore();
    const settings = entityStore.affiliateWorkspace.operationalSettings;
    const loaded = settings != null;
    const persistedAutoClaim = settings?.autoClaimOnSampleApproval ?? false;
    const persistedAutoRelease = settings?.autoReleaseOnSampleRejection ?? false;
    // Null means the deadline release is off.
    const persistedReleaseHours = settings?.releaseBeforeSampleExpiryHours ?? null;
    // Drafts hold only primitives; null means "no unsaved edit, follow the store".
    const [autoClaimDraft, setAutoClaimDraft] = useState<boolean | null>(null);
    const [autoReleaseDraft, setAutoReleaseDraft] = useState<boolean | null>(null);
    const [deadlineReleaseDraft, setDeadlineReleaseDraft] = useState<boolean | null>(null);
    const [releaseHoursDraft, setReleaseHoursDraft] = useState<string | null>(null);
    const autoClaim = autoClaimDraft ?? persistedAutoClaim;
    const autoRelease = autoReleaseDraft ?? persistedAutoRelease;
    const deadlineRelease = deadlineReleaseDraft ?? persistedReleaseHours != null;
    const releaseHoursText =
      releaseHoursDraft ?? String(persistedReleaseHours ?? RELEASE_HOURS_DEFAULT);
    const releaseHoursValue = Number(releaseHoursText);
    const releaseHoursValid =
      releaseHoursText.trim() !== "" &&
      Number.isInteger(releaseHoursValue) &&
      releaseHoursValue >= RELEASE_HOURS_MIN &&
      releaseHoursValue <= RELEASE_HOURS_MAX;
    // Off sends null; an invalid hours draft only matters while the rule is on.
    const releaseHours = deadlineRelease ? releaseHoursValue : null;
    const hoursInvalid = deadlineRelease && !releaseHoursValid;
    const rulesDirty =
      autoClaim !== persistedAutoClaim ||
      autoRelease !== persistedAutoRelease ||
      releaseHours !== persistedReleaseHours;
    // Plain copy of the persisted scenarios; the draft is null until the user edits them.
    const persistedTriggers: string[] = [...(settings?.enabledCreatorAssignmentTriggers ?? [])];
    const triggersCustomized = settings?.creatorAssignmentTriggersCustomized ?? false;
    const [triggersDraft, setTriggersDraft] = useState<string[] | null>(null);
    const triggers = triggersDraft ?? persistedTriggers;
    const triggersDirty = triggersDraft != null && !sameSet(triggersDraft, persistedTriggers);
    const dirty = rulesDirty || triggersDirty;
    const [saveSettings, { loading: saving }] = useMutation<
      { setAffiliateCreatorBusinessSettings: GQL.AffiliateOperationalSettings },
      { input: GQL.SetAffiliateCreatorBusinessSettingsInput }
    >(SET_AFFILIATE_CREATOR_BUSINESS_SETTINGS_MUTATION);

    async function save() {
      if (!loaded || !dirty || hoursInvalid || saving) return;
      try {
        const result = await saveSettings({
          variables: {
            input: {
              autoClaimOnSampleApproval: autoClaim,
              autoReleaseOnSampleRejection: autoRelease,
              releaseBeforeSampleExpiryHours: releaseHours,
              // Absent leaves the stored selection unchanged.
              ...(triggersDirty
                ? { creatorAssignmentTriggers: triggers as GQL.AffiliateCreatorAssignmentTrigger[] }
                : {}),
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
        setDeadlineReleaseDraft(null);
        setReleaseHoursDraft(null);
        setTriggersDraft(null);
        showToast(t("ecommerce.affiliateTeam.creatorBusiness.saved"), "success");
      } catch {
        showToast(t("ecommerce.affiliateTeam.creatorBusiness.saveFailed"), "error");
      }
    }

    function toggleTrigger(trigger: string, checked: boolean) {
      const next = triggers.filter((item) => item !== trigger);
      setTriggersDraft(checked ? [...next, trigger] : next);
    }

    // The backend owns the default selection: ask it to restore, then apply its answer.
    async function restoreDefaults() {
      if (!loaded || saving) return;
      if (!triggersCustomized) {
        setTriggersDraft(null);
        return;
      }
      try {
        const result = await saveSettings({
          variables: {
            input: {
              // The resolver always writes these two, so send the persisted values, not drafts.
              autoClaimOnSampleApproval: persistedAutoClaim,
              autoReleaseOnSampleRejection: persistedAutoRelease,
              creatorAssignmentTriggers: null,
            },
          },
        });
        if (!result.data?.setAffiliateCreatorBusinessSettings)
          throw new Error("Settings response missing");
        entityStore.affiliateWorkspace.setAffiliateOperationalSettings(
          result.data.setAffiliateCreatorBusinessSettings,
        );
        setTriggersDraft(null);
        showToast(t("ecommerce.affiliateTeam.creatorBusiness.triggers.restored"), "success");
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
              disabled={!loaded || !dirty || hoursInvalid}
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
          <TkSwitch
            label={t("ecommerce.affiliateTeam.creatorBusiness.deadlineRelease")}
            description={t("ecommerce.affiliateTeam.creatorBusiness.deadlineReleaseHint")}
            checked={deadlineRelease}
            disabled={!loaded || saving}
            onChange={setDeadlineReleaseDraft}
          />
          {deadlineRelease && (
            <TkField
              className="affiliate-creator-business-hours"
              type="number"
              inputMode="numeric"
              min={RELEASE_HOURS_MIN}
              max={RELEASE_HOURS_MAX}
              step={1}
              label={t("ecommerce.affiliateTeam.creatorBusiness.deadlineReleaseHours")}
              error={
                hoursInvalid
                  ? t("ecommerce.affiliateTeam.creatorBusiness.deadlineReleaseHoursInvalid")
                  : undefined
              }
              value={releaseHoursText}
              disabled={!loaded || saving}
              onChange={(event) => setReleaseHoursDraft(event.target.value)}
            />
          )}
          <p className="form-hint">{t("ecommerce.affiliateTeam.creatorBusiness.exclusions")}</p>
          <TkFormGroup
            className="affiliate-creator-business-triggers"
            title={t("ecommerce.affiliateTeam.creatorBusiness.triggers.title")}
            description={t("ecommerce.affiliateTeam.creatorBusiness.triggers.description")}
          >
            {ASSIGNMENT_TRIGGERS.map((trigger) => (
              <label key={trigger} className="affiliate-creator-business-trigger">
                <input
                  type="checkbox"
                  checked={triggers.includes(trigger)}
                  disabled={!loaded || saving}
                  onChange={(event) => toggleTrigger(trigger, event.target.checked)}
                />
                <span>
                  <span className="affiliate-creator-business-trigger-label">
                    {t(`ecommerce.affiliateTeam.creatorBusiness.triggers.${trigger}.label`)}
                  </span>
                  <span className="affiliate-creator-business-trigger-hint">
                    {t(`ecommerce.affiliateTeam.creatorBusiness.triggers.${trigger}.hint`)}
                  </span>
                </span>
              </label>
            ))}
            <div>
              <TkButton
                disabled={!loaded || saving || (!triggersCustomized && triggersDraft == null)}
                onClick={() => void restoreDefaults()}
              >
                {t("ecommerce.affiliateTeam.creatorBusiness.triggers.restoreDefaults")}
              </TkButton>
            </div>
          </TkFormGroup>
        </TkPanelBody>
      </TkPanel>
    );
  },
);
