import { GQL } from "@rivonclaw/core";
import type { TFunction } from "i18next";

/** The part of the backend actor the Panel needs to label it. */
export type AffiliateActorLike = Pick<GQL.AffiliateActorDisplay, "kind" | "displayName">;

export interface AffiliateActorParts {
  /** The label that names the actor. */
  name: string;
  /** Short qualifier shown after the name, or null when the name says it all. */
  hint: string | null;
}

const KIND_LABEL_PREFIX = "ecommerce.affiliateWorkspace.actor";

/**
 * Resolve how an Affiliate action's actor is labelled.
 *
 * The backend already resolved who acted; this only decides the wording. Members
 * and business developers are named by `displayName`. When a named kind arrives
 * without a name, fall back to the generic staff label rather than printing an
 * empty string.
 */
export function affiliateActorParts(actor: AffiliateActorLike, t: TFunction): AffiliateActorParts {
  const kindLabel = (kind: GQL.AffiliateActorDisplayKind) => t(`${KIND_LABEL_PREFIX}.kinds.${kind}`);
  const displayName = actor.displayName?.trim();
  switch (actor.kind) {
    case GQL.AffiliateActorDisplayKind.BusinessDeveloper:
      return displayName
        ? { name: displayName, hint: t(`${KIND_LABEL_PREFIX}.businessDeveloperHint`) }
        : { name: kindLabel(GQL.AffiliateActorDisplayKind.UnknownHuman), hint: null };
    case GQL.AffiliateActorDisplayKind.Member:
      return {
        name: displayName || kindLabel(GQL.AffiliateActorDisplayKind.UnknownHuman),
        hint: null,
      };
    default:
      return { name: kindLabel(actor.kind), hint: null };
  }
}

/** Plain-text form of the actor label, for captions and interpolation. */
export function formatAffiliateActor(actor: AffiliateActorLike, t: TFunction): string {
  const { name, hint } = affiliateActorParts(actor, t);
  return hint ? `${name} (${hint})` : name;
}
