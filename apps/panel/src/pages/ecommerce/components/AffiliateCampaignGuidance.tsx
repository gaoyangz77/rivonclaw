import { useId } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { TkBadge } from "../../../components/design-system/index.js";
import {
  guidanceTreatmentCounts,
  guidanceTreatmentPresentation,
  guidanceUsageGroups,
  type GuidanceChecklistItemView,
  type GuidancePreviewErrorKey,
  type GuidanceTreatmentCounts,
  type GuidanceUsageCapabilities,
} from "../affiliate-campaign-guidance.js";
import "./AffiliateCampaignGuidance.css";

const KEY_PREFIX = "ecommerce.affiliateCampaign.guidance.";

/**
 * The seller's search guidance as the backend understood it (ADR-097): the
 * restatement first, because it summarizes the whole reading in one sentence,
 * then one row per requirement with how it is enforced. Shared by the wizard's
 * confirmation step and the Campaign detail so both say the same thing.
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
      {restatement && (
        <div className="affiliate-guidance-restatement">
          <strong>{t(`${KEY_PREFIX}restatementTitle`)}</strong>
          <p>{restatement}</p>
        </div>
      )}
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
    </div>
  );
}

/** "1 as requested · 1 approximate · 3 not filterable", leaving out empty treatments. */
function guidanceCountsLabel(counts: GuidanceTreatmentCounts, t: TFunction): string {
  return [
    counts.exact > 0 && t(`${KEY_PREFIX}countExact`, { count: counts.exact }),
    counts.approximate > 0 && t(`${KEY_PREFIX}countApproximate`, { count: counts.approximate }),
    counts.unsupported > 0 && t(`${KEY_PREFIX}countUnsupported`, { count: counts.unsupported }),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Target step, under the guidance input: how the guidance will run, reviewed
 * before the seller moves on, while the text can still be changed. Continue
 * interprets it on the first click; this block offers the same explicitly and
 * says when the text changed after the checklist was made.
 */
export function AffiliateCampaignGuidancePreview({
  state,
  stale,
  onRequest,
}: {
  state:
    | null
    | { status: "loading" }
    | { status: "error"; errorKey: GuidancePreviewErrorKey }
    | {
        status: "ready";
        checklist: readonly GuidanceChecklistItemView[];
        restatement?: string | null;
      };
  /** The guidance, shop or locale changed after `state` was produced. */
  stale: boolean;
  onRequest: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const loading = state?.status === "loading" && !stale;
  const actionKey = state === null ? "generateChecklist" : "refreshChecklist";
  const showAction = !loading && (state === null || stale || state.status === "error");
  return (
    <div
      className={`affiliate-guidance-preview${stale ? " is-stale" : ""}`}
      role="region"
      aria-labelledby={titleId}
      aria-live="polite"
    >
      <div className="affiliate-guidance-preview-heading">
        <div>
          <strong id={titleId}>{t(`${KEY_PREFIX}checklistTitle`)}</strong>
          <p>
            {t(
              `${KEY_PREFIX}${state === null ? "checklistPending" : stale ? "checklistStale" : "checklistDescription"}`,
            )}
          </p>
        </div>
        {showAction && (
          <button type="button" className="affiliate-guidance-edit" onClick={onRequest}>
            {t(`${KEY_PREFIX}${actionKey}`)}
          </button>
        )}
      </div>
      {loading && (
        <p className="affiliate-guidance-state" role="status">
          {t(`${KEY_PREFIX}interpreting`)}
        </p>
      )}
      {state?.status === "error" && !stale && (
        <p className="affiliate-guidance-state is-error" role="alert">
          {t(`${KEY_PREFIX}previewError.${state.errorKey}`)}
        </p>
      )}
      {state?.status === "ready" && (
        <AffiliateCampaignGuidanceChecklist
          checklist={state.checklist}
          restatement={state.restatement}
        />
      )}
    </div>
  );
}

/**
 * Campaign detail header toggle. Collapsed it still says how many requirements
 * are enforced, approximated or not filterable, so the seller sees at a glance
 * whether anything they asked for is not applied.
 */
export function AffiliateCampaignGuidanceToggle({
  open,
  checklist,
  onToggle,
}: {
  open: boolean;
  checklist: readonly GuidanceChecklistItemView[] | null;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const counts = checklist ? guidanceTreatmentCounts(checklist) : null;
  return (
    <button
      type="button"
      className="affiliate-campaign-template-toggle affiliate-guidance-toggle"
      aria-expanded={open}
      title={counts ? guidanceCountsLabel(counts, t) : undefined}
      onClick={onToggle}
    >
      {t(`${KEY_PREFIX}${open ? "hideChecklist" : "viewChecklist"}`)}
      {counts && (
        <span className="affiliate-guidance-toggle-counts" aria-hidden="true">
          {counts.exact > 0 && <span className="is-exact">✓{counts.exact}</span>}
          {counts.approximate > 0 && <span className="is-approximate">≈{counts.approximate}</span>}
          {counts.unsupported > 0 && <span className="is-unsupported">✕{counts.unsupported}</span>}
        </span>
      )}
    </button>
  );
}

/** Campaign detail, expanded: the stored interpretation, or a note that none exists yet. */
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
  const titleId = useId();
  return (
    <section className="affiliate-guidance-summary" aria-labelledby={titleId}>
      <div className="affiliate-guidance-summary-heading">
        <span id={titleId}>{t(`${KEY_PREFIX}checklistTitle`)}</span>
        {interpretation && (
          <small>{guidanceCountsLabel(guidanceTreatmentCounts(interpretation.checklist), t)}</small>
        )}
      </div>
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
