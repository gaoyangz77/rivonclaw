import { useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import {
  TkAlert,
  TkBadge,
  TkButton,
  TkConfirmDialog as ConfirmDialog,
  TkPanel,
  TkPanelBody,
  TkPanelHeader,
  TkPrivate,
} from "../../../components/design-system/index.js";
import { LoadingSpinner } from "../../../components/LoadingSpinner.js";
import { useToast } from "../../../components/Toast.js";
import { formatLocalizedDate } from "../../../lib/format-datetime.js";
import { UserPlusIcon } from "../../../components/icons.js";
import {
  buildTeamTree,
  memberLabel,
  teamStructureErrorKey,
  type RegionAdminProfile,
  type TeamStructure,
} from "../affiliate-team-structure.js";
import {
  useAffiliateTeamStructure,
  type RegionAdminSaveInput,
  type TeamLeadSaveInput,
} from "../hooks/useAffiliateTeamStructure.js";
import { AffiliateBusinessDeveloperShopScopeSummary } from "./AffiliateBusinessDeveloperShopScopeSummary.js";
import { AffiliateRegionAdminEditor } from "./AffiliateRegionAdminEditor.js";
import { AffiliateTeamLeadEditor } from "./AffiliateTeamLeadEditor.js";
import { AffiliateTeamStructureTree, type ParentSubject } from "./AffiliateTeamStructureTree.js";
import "./AffiliateTeamStructure.css";

/** Ids and names only: the confirmation outlives the query result it was opened from. */
type PendingArchive =
  | { kind: "TEAM_LEAD"; id: string; displayName: string }
  | { kind: "REGION_ADMIN"; id: string; displayName: string };

/**
 * The admin's team-structure tab (ADR-112): the hierarchy tree, team lead
 * profiles, region admin profiles and the parent of every BD and lead.
 *
 * Editors and confirmations hold ids and primitive drafts only. The query
 * result is plain data, re-read on every render, so a refetch after a write can
 * never leave an editor pointing at a stale object.
 */
export const AffiliateTeamStructurePanel = observer(function AffiliateTeamStructurePanel() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const team = useAffiliateTeamStructure();
  const [leadEditor, setLeadEditor] = useState<{ leadId: string | null } | null>(null);
  const [adminEditor, setAdminEditor] = useState<{ adminId: string | null } | null>(null);
  const [pendingArchive, setPendingArchive] = useState<PendingArchive | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const structure = team.structure;

  /** The one place write failures are shown: translated when the Backend refused with a known code. */
  function reportFailure(error: unknown) {
    const key = teamStructureErrorKey(error);
    showToast(
      key ? t(key) : error instanceof Error ? error.message : t("ecommerce.updateFailed"),
      "error",
    );
  }

  async function runSave(write: () => Promise<void>, onSaved: () => void) {
    setSaving(true);
    try {
      await write();
      onSaved();
      showToast(t("ecommerce.affiliateTeam.teamStructureSaved"), "success");
    } catch (error) {
      reportFailure(error);
    } finally {
      setSaving(false);
    }
  }

  function saveLead(input: TeamLeadSaveInput) {
    void runSave(
      () => team.saveTeamLead(input),
      () => setLeadEditor(null),
    );
  }

  function saveAdmin(input: RegionAdminSaveInput) {
    void runSave(
      () => team.saveRegionAdmin(input),
      () => setAdminEditor(null),
    );
  }

  async function setParent(subject: ParentSubject, parentLeadId: string | null) {
    setBusyId(subject.id);
    try {
      await team.setParent(
        subject.kind === "TEAM_LEAD"
          ? GQL.AffiliateTeamParentSubjectKind.TeamLead
          : GQL.AffiliateTeamParentSubjectKind.BusinessDeveloper,
        subject.id,
        parentLeadId,
      );
      showToast(t("ecommerce.affiliateTeam.teamStructureSaved"), "success");
    } catch (error) {
      reportFailure(error);
    } finally {
      setBusyId(null);
    }
  }

  async function archivePending(pending: PendingArchive) {
    setPendingArchive(null);
    setSaving(true);
    try {
      if (pending.kind === "TEAM_LEAD") await team.archiveTeamLead(pending.id);
      else await team.archiveRegionAdmin(pending.id);
      showToast(
        t(
          pending.kind === "TEAM_LEAD"
            ? "ecommerce.affiliateTeam.teamLeadArchived"
            : "ecommerce.affiliateTeam.regionAdminArchived",
        ),
        "success",
      );
    } catch (error) {
      reportFailure(error);
    } finally {
      setSaving(false);
    }
  }

  if (!structure) {
    return team.error ? (
      <TkAlert
        tone="danger"
        actions={
          <TkButton size="sm" onClick={() => void team.reload()}>
            {t("common.refresh")}
          </TkButton>
        }
      >
        {team.error.message}
      </TkAlert>
    ) : (
      <LoadingSpinner variant="inline" />
    );
  }

  const tree = buildTeamTree(structure);
  const liveAdmins = structure.regionAdmins.filter((admin) => !admin.archivedAt);
  const archivedAdmins = structure.regionAdmins.filter((admin) => admin.archivedAt);
  const archivedCount = tree.archivedLeads.length + archivedAdmins.length;
  // The editors re-read their profile from the structure; if it is gone, close them.
  const leadEditorMissing =
    leadEditor?.leadId && !structure.teamLeads.some((lead) => lead.id === leadEditor.leadId);
  const adminEditorMissing =
    adminEditor?.adminId &&
    !structure.regionAdmins.some((admin) => admin.id === adminEditor.adminId);

  return (
    <div className="affiliate-team-structure">
      <TkPanel padding="none">
        <TkPanelHeader
          title={t("ecommerce.affiliateTeam.teamStructureTitle")}
          description={t("ecommerce.affiliateTeam.teamStructureDescription")}
          actions={
            <TkButton
              variant="primary"
              leadingIcon={<UserPlusIcon />}
              onClick={() => setLeadEditor({ leadId: null })}
            >
              {t("ecommerce.affiliateTeam.teamLeadAdd")}
            </TkButton>
          }
        />
        <TkPanelBody>
          <AffiliateTeamStructureTree
            tree={tree}
            structure={structure}
            busyId={busyId}
            onSetParent={(subject, parentLeadId) => void setParent(subject, parentLeadId)}
            onEditLead={(leadId) => setLeadEditor({ leadId })}
            onArchiveLead={(leadId) => {
              const lead = structure.teamLeads.find((candidate) => candidate.id === leadId);
              if (lead)
                setPendingArchive({
                  kind: "TEAM_LEAD",
                  id: lead.id,
                  displayName: lead.displayName,
                });
            }}
          />
        </TkPanelBody>
      </TkPanel>

      <TkPanel padding="none">
        <TkPanelHeader
          title={t("ecommerce.affiliateTeam.regionAdminsTitle")}
          description={t("ecommerce.affiliateTeam.regionAdminsDescription")}
          actions={
            <TkButton
              variant="primary"
              leadingIcon={<UserPlusIcon />}
              onClick={() => setAdminEditor({ adminId: null })}
            >
              {t("ecommerce.affiliateTeam.regionAdminAdd")}
            </TkButton>
          }
        />
        <TkPanelBody>
          {liveAdmins.length === 0 ? (
            <p className="affiliate-team-structure-empty">
              {t("ecommerce.affiliateTeam.regionAdminsEmpty")}
            </p>
          ) : (
            <ul className="affiliate-team-structure-list">
              {liveAdmins.map((admin) => (
                <li className="affiliate-team-structure-node" key={admin.id}>
                  <RegionAdminRow
                    admin={admin}
                    structure={structure}
                    onEdit={() => setAdminEditor({ adminId: admin.id })}
                    onArchive={() =>
                      setPendingArchive({
                        kind: "REGION_ADMIN",
                        id: admin.id,
                        displayName: admin.displayName,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </TkPanelBody>
      </TkPanel>

      {archivedCount > 0 && (
        <details className="affiliate-team-structure-archived">
          <summary>
            {t("ecommerce.affiliateTeam.teamStructureArchivedTitle", { count: archivedCount })}
          </summary>
          <ul className="affiliate-team-structure-list">
            {tree.archivedLeads.map((lead) => (
              <li className="affiliate-team-structure-archived-row" key={lead.id}>
                <TkBadge tone="info">{t("ecommerce.affiliateTeam.teamLeadRole")}</TkBadge>
                <TkPrivate>{lead.displayName}</TkPrivate>
                <small>{formatLocalizedDate(lead.archivedAt, i18n.language)}</small>
              </li>
            ))}
            {archivedAdmins.map((admin) => (
              <li className="affiliate-team-structure-archived-row" key={admin.id}>
                <TkBadge tone="accent">{t("ecommerce.affiliateTeam.regionAdminRole")}</TkBadge>
                <TkPrivate>{admin.displayName}</TkPrivate>
                <small>{formatLocalizedDate(admin.archivedAt, i18n.language)}</small>
              </li>
            ))}
          </ul>
        </details>
      )}

      {leadEditor && !leadEditorMissing && (
        <AffiliateTeamLeadEditor
          structure={structure}
          leadId={leadEditor.leadId}
          saving={saving}
          onClose={() => setLeadEditor(null)}
          onSave={saveLead}
        />
      )}
      {adminEditor && !adminEditorMissing && (
        <AffiliateRegionAdminEditor
          structure={structure}
          adminId={adminEditor.adminId}
          saving={saving}
          onClose={() => setAdminEditor(null)}
          onSave={saveAdmin}
        />
      )}
      <ConfirmDialog
        isOpen={pendingArchive !== null}
        title={t(
          pendingArchive?.kind === "REGION_ADMIN"
            ? "ecommerce.affiliateTeam.regionAdminArchiveTitle"
            : "ecommerce.affiliateTeam.teamLeadArchiveTitle",
        )}
        message={t(
          pendingArchive?.kind === "REGION_ADMIN"
            ? "ecommerce.affiliateTeam.regionAdminArchiveMessage"
            : "ecommerce.affiliateTeam.teamLeadArchiveMessage",
          { name: pendingArchive?.displayName ?? "" },
        )}
        confirmLabel={t("ecommerce.affiliateTeam.teamStructureArchive")}
        cancelLabel={t("common.cancel")}
        confirmVariant="danger"
        onConfirm={() => pendingArchive && void archivePending(pendingArchive)}
        onCancel={() => setPendingArchive(null)}
      />
    </div>
  );
});

function RegionAdminRow({
  admin,
  structure,
  onEdit,
  onArchive,
}: {
  admin: RegionAdminProfile;
  structure: TeamStructure;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation();
  const member = structure.eligibleRegionAdminMembers.find(
    (candidate) => candidate.userId === admin.memberUserId,
  );
  return (
    <div className="affiliate-team-structure-row is-region-admin">
      <div className="affiliate-team-structure-identity">
        <TkBadge tone="accent">{t("ecommerce.affiliateTeam.regionAdminRole")}</TkBadge>
        <div className="affiliate-team-structure-name">
          <strong>
            <TkPrivate>{admin.displayName}</TkPrivate>
          </strong>
          {member && (
            <small>
              <TkPrivate>{memberLabel(member)}</TkPrivate>
            </small>
          )}
        </div>
        {!member && (
          <TkBadge tone="warning">
            {t("ecommerce.affiliateTeam.teamStructureMemberIneligibleShort")}
          </TkBadge>
        )}
      </div>
      <p className="affiliate-team-structure-scope">
        <AffiliateBusinessDeveloperShopScopeSummary
          regions={admin.regions}
          shopIds={admin.shopIds}
        />
      </p>
      <div className="affiliate-team-structure-actions">
        <TkButton size="sm" variant="ghost" onClick={onEdit}>
          {t("common.edit")}
        </TkButton>
        <TkButton size="sm" variant="ghost" onClick={onArchive}>
          {t("ecommerce.affiliateTeam.teamStructureArchive")}
        </TkButton>
      </div>
    </div>
  );
}
