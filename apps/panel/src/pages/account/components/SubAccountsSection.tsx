import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TkConfirmDialog as ConfirmDialog } from "../../../components/design-system/index.js";
import { useRoleDisplayName } from "../hooks/useRoleDisplayName.js";
import { useSubAccounts } from "../hooks/useSubAccounts.js";
import { formatLocalizedDate } from "../../../lib/format-datetime.js";
import { AccountRolesPanel } from "./AccountRolesPanel.js";
import { SubAccountFormModal } from "./SubAccountFormModal.js";
import {
  TkAlert,
  TkPanel,
  TkPanelBody,
  TkPanelHeader,
} from "../../../components/design-system/index.js";

/**
 * Sub-account management, shown only to the owner of an account.
 *
 * Members are gated at the sidebar by the scopes their role grants; this
 * section is where those members and roles are administered.
 */
export function SubAccountsSection() {
  const { t, i18n } = useTranslation();
  const subAccounts = useSubAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState<string | null>(null);

  const { members, roles } = subAccounts;
  const { ofMember } = useRoleDisplayName(roles);
  const editingMember = editingMemberId
    ? members.find((member) => member.id === editingMemberId) ?? null
    : null;
  const confirmDeleteMember = confirmDeleteMemberId
    ? members.find((member) => member.id === confirmDeleteMemberId) ?? null
    : null;

  function openCreate() {
    setEditingMemberId(null);
    setFormOpen(true);
  }

  function openEdit(memberId: string) {
    setEditingMemberId(memberId);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingMemberId(null);
  }

  return (
    <TkPanel as="section" padding="none" clip className="section-card">
      <TkPanelHeader
        title={t("subAccounts.title")}
        description={t("subAccounts.description")}
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={openCreate}
            disabled={roles.length === 0}
            title={roles.length === 0 ? t("subAccounts.needRoleFirst") : undefined}
          >
            {t("subAccounts.createMember")}
          </button>
        }
      />

      <TkPanelBody className="acct-section-body">
        {subAccounts.loadError && (
          <TkAlert tone="danger">
            {t("common.operationFailed", { message: subAccounts.loadError.message })}
          </TkAlert>
        )}

        {subAccounts.loading && members.length === 0 ? (
          <div className="empty-cell">{t("common.loading")}</div>
        ) : members.length === 0 ? (
          <div className="empty-cell">{t("subAccounts.noMembers")}</div>
        ) : (
          <div className="acct-item-list">
            {members.map((member) => (
              <div key={member.id} className="acct-item">
                <div className="acct-item-title-row">
                  <span className="acct-item-name">{member.name || member.email}</span>
                  <span className={`badge ${member.disabled ? "badge-muted" : "badge-active"}`}>
                    {member.disabled ? t("subAccounts.statusDisabled") : t("subAccounts.statusActive")}
                  </span>
                  <div className="acct-item-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEdit(member.id)}
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        subAccounts.updateMember({
                          memberId: member.id,
                          disabled: !member.disabled,
                        })
                      }
                      disabled={subAccounts.savingMember}
                    >
                      {member.disabled ? t("subAccounts.enable") : t("subAccounts.disable")}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setConfirmDeleteMemberId(member.id)}
                      disabled={subAccounts.deletingMember}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
                <div className="acct-item-meta">
                  <span>{member.email}</span>
                  <span>{ofMember(member) || t("subAccounts.noRole")}</span>
                  <span>
                    {t("subAccounts.createdAt", {
                      date: formatLocalizedDate(member.createdAt, i18n.language),
                    })}
                  </span>
                </div>
                <div className="acct-tool-chips">
                  {member.scopes.length === 0 ? (
                    <span className="acct-tool-chip">{t("subAccounts.noScopes")}</span>
                  ) : (
                    member.scopes.map((scope) => (
                      <span key={scope} className="acct-tool-chip">
                        {t(`subAccounts.scope.${scope}`)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <AccountRolesPanel
          roles={roles}
          savingRole={subAccounts.savingRole}
          deletingRole={subAccounts.deletingRole}
          onWriteRole={subAccounts.writeRole}
          onDeleteRole={subAccounts.deleteRole}
        />

        <SubAccountFormModal
          isOpen={formOpen}
          editingMember={editingMember}
          roles={roles}
          saving={subAccounts.savingMember}
          onCreate={subAccounts.createMember}
          onUpdate={subAccounts.updateMember}
          onClose={closeForm}
        />

        <ConfirmDialog
          isOpen={confirmDeleteMember !== null}
          title={t("subAccounts.deleteMemberTitle")}
          message={t("subAccounts.deleteMemberMessage", {
            email: confirmDeleteMember?.email ?? "",
          })}
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          onConfirm={() => {
            const memberId = confirmDeleteMemberId;
            setConfirmDeleteMemberId(null);
            if (memberId) subAccounts.deleteMember(memberId);
          }}
          onCancel={() => setConfirmDeleteMemberId(null)}
        />
      </TkPanelBody>
    </TkPanel>
  );
}
