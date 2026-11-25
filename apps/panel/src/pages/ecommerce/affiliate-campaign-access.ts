import { GQL } from "@rivonclaw/core";
import type { TFunction } from "i18next";
import { formatAffiliateActor } from "../../lib/affiliate-actor.js";

/**
 * What the Campaign page offers the signed-in login (ADR-118). The strategies
 * come from `AffiliateAccess.campaignStrategies`; these helpers only turn that
 * list into page decisions, so the page holds no role conditions of its own.
 */

/** The strategy a new Campaign starts on: the first one the login may use, rules first. */
export function defaultCampaignStrategy(
  strategies: readonly GQL.AffiliateCampaignSelectionStrategy[],
): GQL.AffiliateCampaignSelectionStrategy {
  return strategies[0] ?? GQL.AffiliateCampaignSelectionStrategy.CreatorList;
}

/** Whether the wizard offers this strategy to the login. */
export function campaignStrategyOffered(
  strategies: readonly GQL.AffiliateCampaignSelectionStrategy[],
  strategy: GQL.AffiliateCampaignSelectionStrategy,
): boolean {
  return strategies.includes(strategy);
}

/**
 * Who created a Campaign. A Campaign created before ADR-118 has no creator and
 * was created by an admin; every other creator is labelled by the Backend's
 * resolved actor (a BD or member by name, the owner account by its kind label).
 */
export function campaignCreatorLabel(
  campaign: { createdBy?: Pick<GQL.AffiliateActorDisplay, "kind" | "displayName"> | null },
  t: TFunction,
): string {
  return campaign.createdBy
    ? formatAffiliateActor(campaign.createdBy, t)
    : t("ecommerce.affiliateCampaign.createdByAdmin");
}
