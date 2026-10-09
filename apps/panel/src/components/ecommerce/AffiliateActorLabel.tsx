import type { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import { formatAffiliateActor } from "../../lib/affiliate-actor.js";
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
  return (
    <span className={className ? `affiliate-actor-label ${className}` : "affiliate-actor-label"}>
      {formatAffiliateActor(actor, t)}
    </span>
  );
}
