import { useRef, useState } from "react";
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
import {
  CAMPAIGN_NAME_TEMPLATE_VARIABLES,
  RECOMMENDED_CAMPAIGN_NAME_TEMPLATE,
  campaignNameTemplateIssue,
  renderCampaignNameTemplate,
} from "../affiliate-campaign-name-template.js";
import "./AffiliateCreatorBusinessSettingsPanel.css";

// TikTok's review window is 144 hours; the backend accepts 1..142 hours before its deadline.
const RELEASE_HOURS_MIN = 1;
const RELEASE_HOURS_MAX = 142;
const RELEASE_HOURS_DEFAULT = 72;

// ADR-119: the backend accepts 0..30 days; 0 turns the BD Campaign assignment off.
const BD_CAMPAIGN_DAYS_MIN = 0;
const BD_CAMPAIGN_DAYS_MAX = 30;

// Display order of the assignment scenarios. The default selection is owned by the backend.
// Partner-managed and buy-and-refund samples never trigger assignment, so their
// retired scenarios are not offered.
const ASSIGNMENT_TRIGGERS = [
  "CREATOR_INBOUND",
  "SAMPLE_APPLICATION",
  "TARGET_COLLABORATION",
  "CAMPAIGN_FIRST_TOUCH",
  "PLATFORM_ACTION",
] as const satisfies readonly GQL.AffiliateCreatorAssignmentTrigger[];

// ADR-120: the Backend accepts at most 200 characters.
const CAMPAIGN_NAME_TEMPLATE_MAX_LENGTH = 200;

// ADR-124: the Backend accepts 1..10000 for a daily outreach limit; empty means unlimited.
const OUTREACH_LIMIT_MIN = 1;
const OUTREACH_LIMIT_MAX = 10000;

// An empty field is "unlimited" (null); anything else must be a whole number in range.
function parseOutreachLimit(text: string): { valid: boolean; value: number | null } {
  if (text.trim() === "") return { valid: true, value: null };
  const value = Number(text);
  const valid =
    Number.isInteger(value) && value >= OUTREACH_LIMIT_MIN && value <= OUTREACH_LIMIT_MAX;
  return { valid, value: valid ? value : null };
}

// The variable chips: one per date format, the other variables by their name.
const CAMPAIGN_NAME_CHIPS = CAMPAIGN_NAME_TEMPLATE_VARIABLES.map((token) => ({
  token,
  nameKey: token.startsWith("date:") ? "date" : token,
  format: token.startsWith("date:") ? token.slice("date:".length) : null,
}));

// What the preview renders with: Rosa / 黄海燕 on a product of the seller's, the first Campaign today.
const CAMPAIGN_NAME_PREVIEW_PRODUCT_ID = "1737647724406212416";

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
    // The effective window in force; the backend resolves its default.
    const persistedBdCampaignDays = settings?.effectiveBdCampaignSampleAssignmentDays ?? null;
    const [bdCampaignDaysDraft, setBdCampaignDaysDraft] = useState<string | null>(null);
    const bdCampaignDaysText = bdCampaignDaysDraft ?? String(persistedBdCampaignDays ?? "");
    const bdCampaignDaysValue = Number(bdCampaignDaysText);
    const bdCampaignDaysInvalid = !(
      bdCampaignDaysText.trim() !== "" &&
      Number.isInteger(bdCampaignDaysValue) &&
      bdCampaignDaysValue >= BD_CAMPAIGN_DAYS_MIN &&
      bdCampaignDaysValue <= BD_CAMPAIGN_DAYS_MAX
    );
    const bdCampaignDaysDirty =
      bdCampaignDaysDraft != null &&
      !bdCampaignDaysInvalid &&
      bdCampaignDaysValue !== persistedBdCampaignDays;
    // ADR-120: the default Campaign name; "" is off.
    const persistedNameTemplate = settings?.campaignNameTemplate ?? "";
    const [nameTemplateDraft, setNameTemplateDraft] = useState<string | null>(null);
    const nameTemplate = nameTemplateDraft ?? persistedNameTemplate;
    const nameTemplateIssue = campaignNameTemplateIssue(nameTemplate);
    const nameTemplateDirty =
      nameTemplateDraft != null && nameTemplateDraft !== persistedNameTemplate;
    const nameTemplateInput = useRef<HTMLInputElement | null>(null);
    // ADR-124: daily outreach limits on BD-created Campaigns; null means unlimited.
    const persistedBdLimit = settings?.bdDailyOutreachLimit ?? null;
    const persistedListLimit = settings?.creatorListDailyOutreachLimit ?? null;
    const [bdLimitDraft, setBdLimitDraft] = useState<string | null>(null);
    const [listLimitDraft, setListLimitDraft] = useState<string | null>(null);
    const bdLimitText = bdLimitDraft ?? String(persistedBdLimit ?? "");
    const listLimitText = listLimitDraft ?? String(persistedListLimit ?? "");
    const bdLimit = parseOutreachLimit(bdLimitText);
    const listLimit = parseOutreachLimit(listLimitText);
    const bdLimitDirty = bdLimitDraft != null && bdLimit.valid && bdLimit.value !== persistedBdLimit;
    const listLimitDirty =
      listLimitDraft != null && listLimit.valid && listLimit.value !== persistedListLimit;
    const limitsInvalid = !bdLimit.valid || !listLimit.valid;
    const dirty =
      rulesDirty ||
      triggersDirty ||
      bdCampaignDaysDirty ||
      nameTemplateDirty ||
      bdLimitDirty ||
      listLimitDirty;
    const [saveSettings, { loading: saving }] = useMutation<
      { setAffiliateCreatorBusinessSettings: GQL.AffiliateOperationalSettings },
      { input: GQL.SetAffiliateCreatorBusinessSettingsInput }
    >(SET_AFFILIATE_CREATOR_BUSINESS_SETTINGS_MUTATION);

    async function save() {
      if (
        !loaded ||
        !dirty ||
        hoursInvalid ||
        bdCampaignDaysInvalid ||
        nameTemplateIssue ||
        limitsInvalid ||
        saving
      )
        return;
      try {
        const result = await saveSettings({
          variables: {
            input: {
              autoClaimOnSampleApproval: autoClaim,
              autoReleaseOnSampleRejection: autoRelease,
              releaseBeforeSampleExpiryHours: releaseHours,
              // Absent leaves the stored window unchanged.
              ...(bdCampaignDaysDirty
                ? { bdCampaignSampleAssignmentDays: bdCampaignDaysValue }
                : {}),
              // Absent leaves the stored selection unchanged.
              ...(triggersDirty
                ? { creatorAssignmentTriggers: triggers as GQL.AffiliateCreatorAssignmentTrigger[] }
                : {}),
              // Absent leaves the stored template unchanged; "" turns it off.
              ...(nameTemplateDirty ? { campaignNameTemplate: nameTemplate } : {}),
              // Absent leaves a stored limit unchanged; null clears it to unlimited.
              ...(bdLimitDirty ? { bdDailyOutreachLimit: bdLimit.value } : {}),
              ...(listLimitDirty ? { creatorListDailyOutreachLimit: listLimit.value } : {}),
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
        setBdCampaignDaysDraft(null);
        setNameTemplateDraft(null);
        setBdLimitDraft(null);
        setListLimitDraft(null);
        showToast(t("ecommerce.affiliateTeam.creatorBusiness.saved"), "success");
      } catch {
        showToast(t("ecommerce.affiliateTeam.creatorBusiness.saveFailed"), "error");
      }
    }

    // Inserts a variable where the caret (or selection) sits, then puts the caret after it.
    function insertNameVariable(token: string) {
      const input = nameTemplateInput.current;
      const text = `{{${token}}}`;
      const start = input?.selectionStart ?? nameTemplate.length;
      const end = input?.selectionEnd ?? nameTemplate.length;
      const next = nameTemplate.slice(0, start) + text + nameTemplate.slice(end);
      if (next.length > CAMPAIGN_NAME_TEMPLATE_MAX_LENGTH) return;
      setNameTemplateDraft(next);
      const caret = start + text.length;
      // The controlled value lands on the next render; the caret can only move after it.
      requestAnimationFrame(() => {
        const current = nameTemplateInput.current;
        if (!current) return;
        current.focus();
        current.setSelectionRange(caret, caret);
      });
    }

    const namePreview = renderCampaignNameTemplate(nameTemplate, {
      businessDeveloperName: "黄海燕",
      businessDeveloperEnglishName: "Rosa",
      productId: CAMPAIGN_NAME_PREVIEW_PRODUCT_ID,
      date: new Date(),
      sequence: 1,
    });
    const nameIssueMessage =
      nameTemplateIssue == null
        ? undefined
        : nameTemplateIssue.kind === "unknownVariable"
          ? t("ecommerce.affiliateTeam.creatorBusiness.campaignName.unknownVariable", {
              variables: nameTemplateIssue.variables.join(", "),
            })
          : t(`ecommerce.affiliateTeam.creatorBusiness.campaignName.${nameTemplateIssue.kind}`);

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
              disabled={
                !loaded ||
                !dirty ||
                hoursInvalid ||
                bdCampaignDaysInvalid ||
                nameTemplateIssue != null ||
                limitsInvalid
              }
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
          <TkField
            className="affiliate-creator-business-bd-campaign-days"
            type="number"
            inputMode="numeric"
            min={BD_CAMPAIGN_DAYS_MIN}
            max={BD_CAMPAIGN_DAYS_MAX}
            step={1}
            label={t("ecommerce.affiliateTeam.creatorBusiness.bdCampaignDays")}
            hint={t("ecommerce.affiliateTeam.creatorBusiness.bdCampaignDaysHint")}
            error={
              loaded && bdCampaignDaysInvalid
                ? t("ecommerce.affiliateTeam.creatorBusiness.bdCampaignDaysInvalid")
                : undefined
            }
            value={bdCampaignDaysText}
            disabled={!loaded || saving}
            onChange={(event) => setBdCampaignDaysDraft(event.target.value)}
          />
          <TkFormGroup
            className="affiliate-creator-business-name"
            title={t("ecommerce.affiliateTeam.creatorBusiness.campaignName.label")}
            description={t("ecommerce.affiliateTeam.creatorBusiness.campaignName.hint")}
          >
            <TkField
              ref={nameTemplateInput}
              className="affiliate-creator-business-name-input"
              type="text"
              label={t("ecommerce.affiliateTeam.creatorBusiness.campaignName.label")}
              hideLabel
              maxLength={CAMPAIGN_NAME_TEMPLATE_MAX_LENGTH}
              placeholder={RECOMMENDED_CAMPAIGN_NAME_TEMPLATE}
              error={nameIssueMessage}
              value={nameTemplate}
              disabled={!loaded || saving}
              onChange={(event) => setNameTemplateDraft(event.target.value)}
            />
            <div
              className="affiliate-creator-business-name-chips"
              role="group"
              aria-label={t("ecommerce.affiliateTeam.creatorBusiness.campaignName.variablesTitle")}
            >
              {CAMPAIGN_NAME_CHIPS.map((chip) => (
                <TkButton
                  key={chip.token}
                  size="sm"
                  disabled={!loaded || saving}
                  title={`{{${chip.token}}}`}
                  onClick={() => insertNameVariable(chip.token)}
                >
                  {chip.format
                    ? `${t(`ecommerce.affiliateTeam.creatorBusiness.campaignName.variables.${chip.nameKey}`)} ${chip.format}`
                    : t(
                        `ecommerce.affiliateTeam.creatorBusiness.campaignName.variables.${chip.nameKey}`,
                      )}
                </TkButton>
              ))}
              <TkButton
                size="sm"
                variant="ghost"
                disabled={!loaded || saving || nameTemplate === RECOMMENDED_CAMPAIGN_NAME_TEMPLATE}
                onClick={() => setNameTemplateDraft(RECOMMENDED_CAMPAIGN_NAME_TEMPLATE)}
              >
                {t("ecommerce.affiliateTeam.creatorBusiness.campaignName.recommended")}
              </TkButton>
            </div>
            <p className="form-hint">
              {t("ecommerce.affiliateTeam.creatorBusiness.campaignName.variablesHint")}
            </p>
            <div className="affiliate-creator-business-name-preview" aria-live="polite">
              <span>{t("ecommerce.affiliateTeam.creatorBusiness.campaignName.preview")}</span>
              {nameTemplateIssue != null ? null : nameTemplate.trim() === "" ? (
                <em>{t("ecommerce.affiliateTeam.creatorBusiness.campaignName.previewOff")}</em>
              ) : (
                <code data-testid="campaign-name-preview">{namePreview}</code>
              )}
              <small>{t("ecommerce.affiliateTeam.creatorBusiness.campaignName.previewNote")}</small>
            </div>
          </TkFormGroup>
          <TkFormGroup
            className="affiliate-creator-business-limits"
            title={t("ecommerce.affiliateTeam.creatorBusiness.outreachLimits.title")}
            description={t("ecommerce.affiliateTeam.creatorBusiness.outreachLimits.description")}
          >
            <TkField
              className="affiliate-creator-business-limit-input"
              type="number"
              inputMode="numeric"
              min={OUTREACH_LIMIT_MIN}
              max={OUTREACH_LIMIT_MAX}
              step={1}
              label={t("ecommerce.affiliateTeam.creatorBusiness.outreachLimits.bdDaily")}
              hint={t("ecommerce.affiliateTeam.creatorBusiness.outreachLimits.bdDailyHint")}
              placeholder={t("ecommerce.affiliateTeam.creatorBusiness.outreachLimits.unlimited")}
              error={
                loaded && !bdLimit.valid
                  ? t("ecommerce.affiliateTeam.creatorBusiness.outreachLimits.invalid")
                  : undefined
              }
              value={bdLimitText}
              disabled={!loaded || saving}
              onChange={(event) => setBdLimitDraft(event.target.value)}
            />
            <TkField
              className="affiliate-creator-business-limit-input"
              type="number"
              inputMode="numeric"
              min={OUTREACH_LIMIT_MIN}
              max={OUTREACH_LIMIT_MAX}
              step={1}
              label={t("ecommerce.affiliateTeam.creatorBusiness.outreachLimits.creatorListDaily")}
              hint={t(
                "ecommerce.affiliateTeam.creatorBusiness.outreachLimits.creatorListDailyHint",
              )}
              placeholder={t("ecommerce.affiliateTeam.creatorBusiness.outreachLimits.unlimited")}
              error={
                loaded && !listLimit.valid
                  ? t("ecommerce.affiliateTeam.creatorBusiness.outreachLimits.invalid")
                  : undefined
              }
              value={listLimitText}
              disabled={!loaded || saving}
              onChange={(event) => setListLimitDraft(event.target.value)}
            />
          </TkFormGroup>
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
