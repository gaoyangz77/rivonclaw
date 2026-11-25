import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TkAlert,
  TkButton,
  TkField,
  TkFormStack,
  TkModal as Modal,
  TkPrivate,
} from "../../../components/design-system/index.js";
import { Select } from "../../../components/inputs/Select.js";
import { openPanelRoute } from "../../../lib/open-route.js";
import {
  defaultStaffPermissions,
  displayNameAfterMemberPick,
  liveParentLeadId,
  memberLabel,
  parentLeadCandidates,
  sameStaffPermissions,
  unboundEligibleMembers,
  type TeamStructure,
} from "../affiliate-team-structure.js";
import type { TeamLeadSaveInput } from "../hooks/useAffiliateTeamStructure.js";
import { AffiliateStaffPermissionsField } from "./AffiliateStaffPermissionsField.js";
import "./AffiliateTeamStructure.css";

/** Where the owner assigns the Team Lead / Region Admin roles to members. */
export const ACCOUNT_MEMBERS_ROUTE = "/account/profile";

/**
 * Creates or edits one team lead profile (ADR-112) and the permissions it holds
 * (ADR-113). Mounted only while open, so
 * the primitive draft below is seeded once from the structure and then belongs
 * to the user until save or cancel. `leadId` is the only thing it keeps from
 * the structure; the profile itself is re-read from the structure each render.
 */
export function AffiliateTeamLeadEditor({
  structure,
  leadId,
  saving,
  onClose,
  onSave,
}: {
  structure: TeamStructure;
  /** null creates a new lead. */
  leadId: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: TeamLeadSaveInput) => void;
}) {
  const { t } = useTranslation();
  const lead = leadId
    ? (structure.teamLeads.find((candidate) => candidate.id === leadId) ?? null)
    : null;
  const liveLeadIds = new Set(structure.teamLeads.filter((l) => !l.archivedAt).map((l) => l.id));
  const storedParentId = lead ? liveParentLeadId(lead.parentLeadId, liveLeadIds) : null;
  const [memberUserId, setMemberUserId] = useState("");
  const [displayName, setDisplayName] = useState(lead?.displayName ?? "");
  const [parentLeadId, setParentLeadId] = useState<string>(storedParentId ?? "");
  // A new lead starts on the role default; an existing one on what it holds.
  const [permissions, setPermissions] = useState(
    () => lead?.permissions ?? defaultStaffPermissions("TEAM_LEAD"),
  );

  const members = unboundEligibleMembers(structure.eligibleTeamLeadMembers);

  function pickMember(userId: string) {
    const byId = (id: string) => members.find((member) => member.userId === id);
    setDisplayName((draft) => displayNameAfterMemberPick(draft, byId(memberUserId), byId(userId)));
    setMemberUserId(userId);
  }
  const boundMember = lead
    ? structure.eligibleTeamLeadMembers.find((member) => member.userId === lead.memberUserId)
    : null;
  const parentOptions = parentLeadCandidates(
    structure,
    lead ? { kind: "TEAM_LEAD", id: lead.id } : { kind: "BUSINESS_DEVELOPER" },
  );

  const name = displayName.trim();
  const nameChanged = !lead || name !== lead.displayName;
  const parentChanged = (parentLeadId || null) !== storedParentId;
  const permissionsChanged = !lead || !sameStaffPermissions(permissions, lead.permissions);
  const canSave =
    Boolean(name) &&
    (lead ? nameChanged || parentChanged || permissionsChanged : Boolean(memberUserId));

  return (
    <Modal
      isOpen
      onClose={onClose}
      preventBackdropClose={saving}
      title={t(
        lead
          ? "ecommerce.affiliateTeam.teamLeadEditTitle"
          : "ecommerce.affiliateTeam.teamLeadAddTitle",
      )}
      maxWidth={520}
      closeLabel={t("common.close")}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave || saving) return;
          onSave({
            id: lead?.id,
            memberUserId: lead ? undefined : memberUserId,
            displayName: name,
            parentLeadId: parentLeadId || null,
            permissions,
            displayNameChanged: nameChanged,
            parentLeadIdChanged: parentChanged,
            permissionsChanged,
          });
        }}
      >
        <TkFormStack>
          {lead ? (
            <div className="affiliate-team-structure-field">
              <span>{t("ecommerce.affiliateTeam.teamStructureMember")}</span>
              {boundMember ? (
                <TkPrivate>{memberLabel(boundMember)}</TkPrivate>
              ) : (
                <TkAlert tone="warning">
                  {t("ecommerce.affiliateTeam.teamStructureMemberIneligible")}
                </TkAlert>
              )}
            </div>
          ) : members.length === 0 ? (
            <TkAlert
              tone="info"
              actions={
                <TkButton size="sm" onClick={() => openPanelRoute(ACCOUNT_MEMBERS_ROUTE)}>
                  {t("ecommerce.affiliateTeam.teamStructureOpenMembers")}
                </TkButton>
              }
            >
              {t("ecommerce.affiliateTeam.teamLeadNoEligibleMembers")}
            </TkAlert>
          ) : (
            <label className="affiliate-team-structure-field">
              <span>{t("ecommerce.affiliateTeam.teamStructureMember")}</span>
              <Select
                value={memberUserId}
                onChange={pickMember}
                searchable
                searchPlaceholder={t("ecommerce.affiliateTeam.teamStructureMemberSearch")}
                placeholder={t("ecommerce.affiliateTeam.teamStructureMemberPlaceholder")}
                ariaLabel={t("ecommerce.affiliateTeam.teamStructureMember")}
                options={members.map((member) => ({
                  value: member.userId,
                  label: memberLabel(member),
                  sensitive: true,
                  searchTerms: [member.email, member.name ?? ""],
                }))}
              />
              <small className="form-hint">{t("ecommerce.affiliateTeam.teamLeadMemberHint")}</small>
            </label>
          )}
          <TkField
            label={t("ecommerce.affiliateTeam.teamStructureDisplayName")}
            hint={t("ecommerce.affiliateTeam.teamStructureDisplayNameHint")}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="off"
          />
          <label className="affiliate-team-structure-field">
            <span>{t("ecommerce.affiliateTeam.teamStructureReportsTo")}</span>
            <Select
              value={parentLeadId}
              onChange={setParentLeadId}
              ariaLabel={t("ecommerce.affiliateTeam.teamStructureReportsTo")}
              options={[
                { value: "", label: t("ecommerce.affiliateTeam.teamStructureNoParent") },
                ...parentOptions.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.displayName,
                })),
              ]}
            />
          </label>
          <AffiliateStaffPermissionsField role="TEAM_LEAD" value={permissions} onChange={setPermissions} />
          <div className="tk-v1-modal-actions">
            <TkButton type="button" onClick={onClose} disabled={saving}>
              {t("common.cancel")}
            </TkButton>
            <TkButton
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!canSave || saving}
            >
              {t("common.save")}
            </TkButton>
          </div>
        </TkFormStack>
      </form>
    </Modal>
  );
}
