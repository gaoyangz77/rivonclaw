import type { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import { affiliateActorParts } from "../../lib/affiliate-actor.js";
import "./AffiliateActorLabel.css";

/**
 * Who performed an Affiliate action. Staff and business-developer names are
 * shown as plain text, the same as the business-developer names already in the
 * workbench tables, so privacy mode treats them identically on every surface.
 */
export function AffiliateActorLabel({
  actor,
  className,
}: {
  actor: Pick<GQL.AffiliateActorDisplay, "kind" | "displayName">;
  className?: string;
}) {
  const { t } = useTranslation();
  const { name, hint } = affiliateActorParts(actor, t);
  return (
    <span className={className ? `affiliate-actor-label ${className}` : "affiliate-actor-label"}>
      <span>{name}</span>
      {hint ? <span className="affiliate-actor-label-hint">{hint}</span> : null}
    </span>
  );
}
