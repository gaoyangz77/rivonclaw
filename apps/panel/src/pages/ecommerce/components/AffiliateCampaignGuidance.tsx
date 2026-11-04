import { useTranslation } from "react-i18next";
import { TkBadge } from "../../../components/design-system/index.js";
import {
  guidanceTreatmentPresentation,
  guidanceUsageGroups,
  type GuidanceChecklistItemView,
  type GuidancePreviewErrorKey,
  type GuidanceUsageCapabilities,
} from "../affiliate-campaign-guidance.js";
import "./AffiliateCampaignGuidance.css";

const KEY_PREFIX = "ecommerce.affiliateCampaign.guidance.";

/**
 * The seller's search guidance as the backend understood it (ADR-097): one row
 * per requirement with how it is enforced, then the restatement. Shared by the
 * wizard's confirmation step and the Campaign detail so both say the same thing.
 */
export function AffiliateCampaignGuidanceChecklist({
  checklist,
  restatement,
}: {
  checklist: readonly GuidanceChecklistItemView[];
  restatement?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="affiliate-guidance-checklist">
      {checklist.length > 0 && (
        <ul className="affiliate-guidance-checklist-rows">
          {checklist.map((item, index) => {
            const presentation = guidanceTreatmentPresentation(item.treatment);
            return (
              <li key={`${index}-${item.requirement}`}>
                <p className="affiliate-guidance-requirement">{item.requirement}</p>
                <div className="affiliate-guidance-treatment">
                  <TkBadge tone={presentation.tone}>
                    <span aria-hidden="true">{presentation.marker}</span>{" "}
                    {t(`${KEY_PREFIX}${presentation.labelKey}`)}
                  </TkBadge>
                  {presentation.showsNote && item.note && <small>{item.note}</small>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {restatement && (
        <div className="affiliate-guidance-restatement">
          <strong>{t(`${KEY_PREFIX}restatementTitle`)}</strong>
          <p>{restatement}</p>
        </div>
      )}
    </div>
  );
}

/** Wizard confirmation step: what the seller wrote, as understood, with a way back to edit. */
export function AffiliateCampaignGuidancePreview({
  state,
  onEdit,
}: {
  state:
    | { status: "empty" }
    | { status: "loading" }
    | { status: "error"; errorKey: GuidancePreviewErrorKey }
    | {
        status: "ready";
        checklist: readonly GuidanceChecklistItemView[];
        restatement?: string | null;
      };
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="affiliate-guidance-preview" aria-live="polite">
      <div className="affiliate-guidance-preview-heading">
        <div>
          <strong>{t(`${KEY_PREFIX}checklistTitle`)}</strong>
          <p>{t(`${KEY_PREFIX}checklistDescription`)}</p>
        </div>
        {state.status !== "empty" && (
          <button type="button" className="btn btn-secondary" onClick={onEdit}>
            {t(`${KEY_PREFIX}editGuidance`)}
          </button>
        )}
      </div>
      {state.status === "empty" && (
        <p className="affiliate-guidance-state">{t(`${KEY_PREFIX}noGuidance`)}</p>
      )}
      {state.status === "loading" && (
        <p className="affiliate-guidance-state" role="status">
          {t(`${KEY_PREFIX}interpreting`)}
        </p>
      )}
      {state.status === "error" && (
        <p className="affiliate-guidance-state is-error" role="alert">
          {t(`${KEY_PREFIX}previewError.${state.errorKey}`)}
        </p>
      )}
      {state.status === "ready" && (
        <AffiliateCampaignGuidanceChecklist
          checklist={state.checklist}
          restatement={state.restatement}
        />
      )}
    </section>
  );
}

/** Campaign detail: the stored interpretation, or a note that none exists yet. */
export function AffiliateCampaignGuidanceSummary({
  loading,
  interpretation,
}: {
  loading: boolean;
  interpretation: {
    checklist: readonly GuidanceChecklistItemView[];
    restatement?: string | null;
  } | null;
}) {
  const { t } = useTranslation();
  return (
    <section className="affiliate-guidance-summary data-card-hover">
      <strong>{t(`${KEY_PREFIX}checklistTitle`)}</strong>
      {interpretation ? (
        <AffiliateCampaignGuidanceChecklist
          checklist={interpretation.checklist}
          restatement={interpretation.restatement}
        />
      ) : (
        <p className="affiliate-guidance-state">
          {t(`${KEY_PREFIX}${loading ? "interpreting" : "notInterpreted"}`)}
        </p>
      )}
    </section>
  );
}

/** Plain-language guide under the guidance textarea: what can be filtered, approximated, or not. */
export function AffiliateCampaignGuidanceUsage({
  capabilities,
  marketplaceLabel,
}: {
  capabilities: GuidanceUsageCapabilities | null | undefined;
  marketplaceLabel: (value: string) => string;
}) {
  const { t } = useTranslation();
  const groups = guidanceUsageGroups(capabilities);
  const renderItem = (key: string) => (
    <li key={key}>
      {t(`${KEY_PREFIX}${key}`, {
        labels: groups.categoryPros.map(marketplaceLabel).join(", "),
      })}
    </li>
  );
  return (
    <details className="affiliate-guidance-usage">
      <summary>{t(`${KEY_PREFIX}usageToggle`)}</summary>
      <div className="affiliate-guidance-usage-groups">
        <section>
          <strong>
            <span aria-hidden="true">✓</span> {t(`${KEY_PREFIX}usageExactTitle`)}
          </strong>
          <ul>{groups.exact.map((item) => renderItem(item.key))}</ul>
        </section>
        <section>
          <strong>
            <span aria-hidden="true">≈</span> {t(`${KEY_PREFIX}usageApproximateTitle`)}
          </strong>
          <ul>{groups.approximate.map((item) => renderItem(item.key))}</ul>
        </section>
        <section>
          <strong>
            <span aria-hidden="true">✕</span> {t(`${KEY_PREFIX}usageUnsupportedTitle`)}
          </strong>
          <ul>{groups.unsupported.map((item) => renderItem(item.key))}</ul>
        </section>
      </div>
    </details>
  );
}
