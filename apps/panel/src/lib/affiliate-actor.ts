import { GQL } from "@rivonclaw/core";
import type { TFunction } from "i18next";

/** The part of the backend actor the Panel needs to label it. */
export type AffiliateActorLike = Pick<GQL.AffiliateActorDisplay, "kind" | "displayName">;

const KIND_LABEL_PREFIX = "ecommerce.affiliateWorkspace.actor";

/**
 * How an Affiliate action's actor is labelled.
 *
 * The backend already resolved who acted; this only decides the wording.
 * Members and business developers are named by `displayName` alone. When a
 * named kind arrives without a name, fall back to the generic staff label
 * rather than printing an empty string.
 */
export function formatAffiliateActor(actor: AffiliateActorLike, t: TFunction): string {
  const kindLabel = (kind: GQL.AffiliateActorDisplayKind) =>
    t(`${KIND_LABEL_PREFIX}.kinds.${kind}`);
  switch (actor.kind) {
    case GQL.AffiliateActorDisplayKind.BusinessDeveloper:
    case GQL.AffiliateActorDisplayKind.Member:
      return actor.displayName?.trim() || kindLabel(GQL.AffiliateActorDisplayKind.UnknownHuman);
    default:
      return kindLabel(actor.kind);
  }
}
