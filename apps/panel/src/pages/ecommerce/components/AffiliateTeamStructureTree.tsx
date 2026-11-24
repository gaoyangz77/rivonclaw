import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TkBadge, TkButton, TkPrivate } from "../../../components/design-system/index.js";
import { Select } from "../../../components/inputs/Select.js";
import {
  liveParentLeadId,
  liveTeamLeads,
  parentLeadCandidates,
  type TeamBusinessDeveloper,
  type TeamStructure,
  type TeamTree,
  type TeamTreeLead,
} from "../affiliate-team-structure.js";
import { AffiliateStaffPermissionBadges } from "./AffiliateStaffPermissionsField.js";
import "./AffiliateTeamStructure.css";

export type ParentSubject =
  | { kind: "BUSINESS_DEVELOPER"; id: string }
  | { kind: "TEAM_LEAD"; id: string };

interface TreeHandlers {
  /** The id of the node whose parent write is in flight, so its picker is disabled. */
  busyId: string | null;
  onSetParent: (subject: ParentSubject, parentLeadId: string | null) => void;
  onEditLead: (leadId: string) => void;
  onArchiveLead: (leadId: string) => void;
}

/**
 * The hierarchy as a nested list (ADR-112), each lead with the permissions it holds (ADR-113): leads at any depth, each lead's
 * child leads before its BDs, then a group of BDs that report to no live lead.
 * Takes plain objects only; the page re-reads them from the query on each render.
 */
export function AffiliateTeamStructureTree({
  tree,
  structure,
  ...handlers
}: { tree: TeamTree; structure: TeamStructure } & TreeHandlers) {
  const { t } = useTranslation();
  const liveMemberIds = new Set(structure.eligibleTeamLeadMembers.map((member) => member.userId));
  return (
    <div className="affiliate-team-structure-tree">
      {tree.roots.length === 0 && (
        <p className="affiliate-team-structure-empty">
          {t("ecommerce.affiliateTeam.teamStructureNoLeads")}
        </p>
      )}
      {tree.roots.length > 0 && (
        <ul className="affiliate-team-structure-list">
          {tree.roots.map((node) => (
            <LeadBranch
              key={node.lead.id}
              node={node}
              structure={structure}
              liveMemberIds={liveMemberIds}
              {...handlers}
            />
          ))}
        </ul>
      )}
      <section className="affiliate-team-structure-group">
        <header className="affiliate-team-structure-group-header">
          <strong>{t("ecommerce.affiliateTeam.teamStructureUnparentedTitle")}</strong>
          <small>
            {t("ecommerce.affiliateTeam.teamStructureBusinessDeveloperCount", {
              count: tree.unparentedBusinessDevelopers.length,
            })}
          </small>
        </header>
        {tree.unparentedBusinessDevelopers.length === 0 ? (
          <p className="affiliate-team-structure-empty">
            {t("ecommerce.affiliateTeam.teamStructureUnparentedEmpty")}
          </p>
        ) : (
          <ul className="affiliate-team-structure-list">
            {tree.unparentedBusinessDevelopers.map((developer) => (
              <BusinessDeveloperRow
                key={developer.id}
                developer={developer}
                structure={structure}
                {...handlers}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LeadBranch({
  node,
  structure,
  liveMemberIds,
  ...handlers
}: {
  node: TeamTreeLead;
  structure: TeamStructure;
  liveMemberIds: ReadonlySet<string>;
} & TreeHandlers) {
  const { t } = useTranslation();
  const { lead } = node;
  const options = parentLeadCandidates(structure, { kind: "TEAM_LEAD", id: lead.id });
  const hasChildren = node.childLeads.length > 0 || node.businessDevelopers.length > 0;
  return (
    <li className="affiliate-team-structure-node">
      <NodeRow
        badge={<TkBadge tone="info">{t("ecommerce.affiliateTeam.teamLeadRole")}</TkBadge>}
        name={lead.displayName}
        meta={[
          t("ecommerce.affiliateTeam.teamStructureLeadCount", { count: node.childLeads.length }),
          t("ecommerce.affiliateTeam.teamStructureBusinessDeveloperCount", {
            count: node.businessDevelopers.length,
          }),
        ].join(" · ")}
        permissions={<AffiliateStaffPermissionBadges permissions={lead.permissions} />}
        warnings={
          <>
            {node.inCycle && (
              <TkBadge tone="danger">{t("ecommerce.affiliateTeam.teamStructureCycle")}</TkBadge>
            )}
            {!liveMemberIds.has(lead.memberUserId) && (
              <TkBadge tone="warning">
                {t("ecommerce.affiliateTeam.teamStructureMemberIneligibleShort")}
              </TkBadge>
            )}
          </>
        }
        parentValue={
          liveParentLeadId(lead.parentLeadId, new Set(liveTeamLeads(structure).map((l) => l.id))) ??
          ""
        }
        parentOptions={options}
        busy={handlers.busyId === lead.id}
        onParentChange={(parentLeadId) =>
          handlers.onSetParent({ kind: "TEAM_LEAD", id: lead.id }, parentLeadId)
        }
        actions={
          <>
            <TkButton size="sm" variant="ghost" onClick={() => handlers.onEditLead(lead.id)}>
              {t("common.edit")}
            </TkButton>
            <TkButton size="sm" variant="ghost" onClick={() => handlers.onArchiveLead(lead.id)}>
              {t("ecommerce.affiliateTeam.teamStructureArchive")}
            </TkButton>
          </>
        }
      />
      {hasChildren && (
        <ul className="affiliate-team-structure-list is-nested">
          {node.childLeads.map((child) => (
            <LeadBranch
              key={child.lead.id}
              node={child}
              structure={structure}
              liveMemberIds={liveMemberIds}
              {...handlers}
            />
          ))}
          {node.businessDevelopers.map((developer) => (
            <BusinessDeveloperRow
              key={developer.id}
              developer={developer}
              structure={structure}
              {...handlers}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function BusinessDeveloperRow({
  developer,
  structure,
  ...handlers
}: { developer: TeamBusinessDeveloper; structure: TeamStructure } & TreeHandlers) {
  const { t } = useTranslation();
  const liveLeadIds = new Set(liveTeamLeads(structure).map((l) => l.id));
  return (
    <li className="affiliate-team-structure-node">
      <NodeRow
        badge={<TkBadge tone="neutral">{t("ecommerce.affiliateTeam.teamStructureBdRole")}</TkBadge>}
        name={developer.displayName}
        parentValue={liveParentLeadId(developer.parentLeadId, liveLeadIds) ?? ""}
        parentOptions={parentLeadCandidates(structure, { kind: "BUSINESS_DEVELOPER" })}
        busy={handlers.busyId === developer.id}
        onParentChange={(parentLeadId) =>
          handlers.onSetParent({ kind: "BUSINESS_DEVELOPER", id: developer.id }, parentLeadId)
        }
      />
    </li>
  );
}

function NodeRow({
  badge,
  name,
  meta,
  permissions,
  warnings,
  parentValue,
  parentOptions,
  busy,
  onParentChange,
  actions,
}: {
  badge: ReactNode;
  name: string;
  meta?: string;
  /** The profile's permissions as short labels; absent for a BD, who holds none. */
  permissions?: ReactNode;
  warnings?: ReactNode;
  parentValue: string;
  parentOptions: ReadonlyArray<{ id: string; displayName: string }>;
  busy: boolean;
  onParentChange: (parentLeadId: string | null) => void;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="affiliate-team-structure-row">
      <div className="affiliate-team-structure-identity">
        {badge}
        <div className="affiliate-team-structure-name">
          <strong>
            <TkPrivate>{name}</TkPrivate>
          </strong>
          {meta && <small>{meta}</small>}
        </div>
        {permissions}
        {warnings}
      </div>
      <div className="affiliate-team-structure-reports">
        <span>{t("ecommerce.affiliateTeam.teamStructureReportsTo")}</span>
        <Select
          size="compact"
          value={parentValue}
          disabled={busy}
          onChange={(next) => onParentChange(next || null)}
          ariaLabel={t("ecommerce.affiliateTeam.teamStructureReportsToFor", { name })}
          options={[
            { value: "", label: t("ecommerce.affiliateTeam.teamStructureNoParent") },
            ...parentOptions.map((option) => ({ value: option.id, label: option.displayName })),
          ]}
        />
      </div>
      {actions && <div className="affiliate-team-structure-actions">{actions}</div>}
    </div>
  );
}
