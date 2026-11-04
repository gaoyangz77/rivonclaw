import { GQL } from "@rivonclaw/core";

// ADR-097: the backend interprets a Campaign's search guidance once and the
// seller sees the result as a plain checklist. These helpers are the pure part
// of that presentation, kept apart from React so each rule can be tested.

/** A checklist row as the Panel renders it: a plain DTO, never an MST node. */
export interface GuidanceChecklistItemView {
  requirement: string;
  treatment: GQL.AffiliateCampaignGuidanceTreatment;
  note?: string | null;
}

/** The interpretation as the Panel keeps it in component state. */
export interface GuidanceInterpretationView {
  checklist: GuidanceChecklistItemView[];
  restatement?: string | null;
}

export type GuidanceTreatmentTone = "success" | "warning" | "neutral";

export interface GuidanceTreatmentPresentation {
  /** Glyph shown beside the label. Text accompanies it, so colour is never the only cue. */
  marker: "✓" | "≈" | "✕";
  /** Key below `ecommerce.affiliateCampaign.guidance.` */
  labelKey: "treatmentExact" | "treatmentApproximate" | "treatmentUnsupported";
  tone: GuidanceTreatmentTone;
  /** EXACT carries no note; the other two explain themselves with the backend's note. */
  showsNote: boolean;
}

export function guidanceTreatmentPresentation(
  treatment: GQL.AffiliateCampaignGuidanceTreatment,
): GuidanceTreatmentPresentation {
  switch (treatment) {
    case GQL.AffiliateCampaignGuidanceTreatment.Exact:
      return { marker: "✓", labelKey: "treatmentExact", tone: "success", showsNote: false };
    case GQL.AffiliateCampaignGuidanceTreatment.Approximate:
      return { marker: "≈", labelKey: "treatmentApproximate", tone: "warning", showsNote: true };
    case GQL.AffiliateCampaignGuidanceTreatment.Unsupported:
      return { marker: "✕", labelKey: "treatmentUnsupported", tone: "neutral", showsNote: true };
  }
}

export interface GuidanceTreatmentCounts {
  exact: number;
  approximate: number;
  unsupported: number;
}

/** How many requirements fall under each treatment, for the collapsed summary. */
export function guidanceTreatmentCounts(
  checklist: readonly GuidanceChecklistItemView[],
): GuidanceTreatmentCounts {
  const counts: GuidanceTreatmentCounts = { exact: 0, approximate: 0, unsupported: 0 };
  for (const item of checklist) {
    switch (item.treatment) {
      case GQL.AffiliateCampaignGuidanceTreatment.Exact:
        counts.exact += 1;
        break;
      case GQL.AffiliateCampaignGuidanceTreatment.Approximate:
        counts.approximate += 1;
        break;
      case GQL.AffiliateCampaignGuidanceTreatment.Unsupported:
        counts.unsupported += 1;
        break;
    }
  }
  return counts;
}

export type GuidancePreviewErrorKey =
  | "quotaExhausted"
  | "generationDisabled"
  | "tooLong"
  | "generic";

/**
 * Maps a preview failure to the message the seller reads. The backend reports
 * its reason as a code inside the GraphQL error message; anything it does not
 * name is a generic failure.
 */
export function guidancePreviewErrorKey(error: unknown): GuidancePreviewErrorKey {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("SEARCH_PLAN_CLOUD_QUOTA_EXHAUSTED")) return "quotaExhausted";
  if (raw.includes("SEARCH_PLAN_BACKEND_GENERATION_DISABLED")) return "generationDisabled";
  if (raw.includes("searchPlanGuidance exceeds 500 characters")) return "tooLong";
  return "generic";
}

/**
 * The preview request for a form, or null when there is nothing to interpret.
 * The guidance is trimmed exactly as the save path trims it, so text differing
 * only by surrounding whitespace is the same request and hits the same cached
 * interpretation the generator will use.
 */
export function guidancePreviewInput(input: {
  shopId: string;
  searchPlanGuidance: string;
  searchPlanExplanationLocale: GQL.AffiliateCampaignSearchPlanExplanationLocale;
}): GQL.PreviewAffiliateCampaignGuidanceInterpretationInput | null {
  const searchPlanGuidance = input.searchPlanGuidance.trim();
  if (!input.shopId || !searchPlanGuidance) return null;
  return {
    shopId: input.shopId,
    searchPlanGuidance,
    searchPlanExplanationLocale: input.searchPlanExplanationLocale,
  };
}

/**
 * Identity of a preview request: a checklist answers exactly this shop, locale
 * and (trimmed) guidance. Any difference means the shown checklist is stale.
 */
export function guidancePreviewKey(
  input: GQL.PreviewAffiliateCampaignGuidanceInterpretationInput,
): string {
  return JSON.stringify([
    input.shopId,
    input.searchPlanExplanationLocale,
    input.searchPlanGuidance,
  ]);
}

export interface GuidanceUsageItem {
  /** Key below `ecommerce.affiliateCampaign.guidance.` */
  key: string;
}

export interface GuidanceUsageCapabilities {
  languages?: readonly string[] | null;
  categoryPros?: readonly string[] | null;
}

export interface GuidanceUsageGroups {
  exact: GuidanceUsageItem[];
  approximate: GuidanceUsageItem[];
  unsupported: GuidanceUsageItem[];
  /** The shop's own Category Pro values, listed under the category-specialty item. */
  categoryPros: string[];
}

const EXACT_ITEM_KEYS = [
  "usageExactFollowers",
  "usageExactFollowerGender",
  "usageExactVideoViews",
  "usageExactLiveViewers",
  "usageExactCreatorLevel",
  "usageExactCategoryPro",
  "usageExactAgency",
  "usageExactFastGrowing",
  "usageExactNotInvited",
] as const;

const APPROXIMATE_ITEM_KEYS = [
  "usageApproxSales",
  "usageApproxUnitsSold",
  "usageApproxVideoGmv",
  "usageApproxAge",
  "usageApproxCategory",
  "usageApproxFulfillment",
  "usageApproxCommission",
] as const;

const UNSUPPORTED_ITEM_KEYS = [
  "usageUnsupportedContentStyle",
  "usageUnsupportedCooperationReview",
  "usageUnsupportedSamplePerformance",
  "usageUnsupportedCreatorDemographics",
  "usageUnsupportedBrands",
] as const;

/**
 * Which requirements the usage guide lists under each heading for one shop.
 * Content language is only filterable where the shop's Marketplace offers
 * language values, so it moves between "exact" and "unsupported" with the
 * capability instead of promising a filter the shop does not have. Category
 * specialty is likewise only listed when the shop has values to choose from.
 */
export function guidanceUsageGroups(
  capabilities: GuidanceUsageCapabilities | null | undefined,
): GuidanceUsageGroups {
  const hasLanguages = (capabilities?.languages?.length ?? 0) > 0;
  const categoryPros = [...(capabilities?.categoryPros ?? [])];
  const exact: GuidanceUsageItem[] = EXACT_ITEM_KEYS.filter(
    (key) => key !== "usageExactCategoryPro" || categoryPros.length > 0,
  ).map((key) => ({ key }));
  const unsupported: GuidanceUsageItem[] = UNSUPPORTED_ITEM_KEYS.map((key) => ({ key }));
  if (hasLanguages) {
    exact.push({ key: "usageExactLanguage" });
  } else {
    unsupported.unshift({ key: "usageUnsupportedLanguage" });
  }
  return {
    exact,
    approximate: APPROXIMATE_ITEM_KEYS.map((key) => ({ key })),
    unsupported,
    categoryPros,
  };
}
