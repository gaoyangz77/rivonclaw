import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { TkConfirmDialog as ConfirmDialog } from "../../../components/design-system/index.js";
import { useRoleDisplayName } from "../hooks/useRoleDisplayName.js";
import type { AccountRole } from "../hooks/useSubAccounts.js";

const ALL_SCOPES = Object.values(GQL.PermissionScope);

interface AccountRolesPanelProps {
  roles: AccountRole[];
  savingRole: boolean;
  deletingRole: boolean;
  onWriteRole: (input: GQL.WriteAccountRoleInput) => Promise<boolean>;
  onDeleteRole: (roleId: string) => Promise<boolean>;
}

/**
 * Compact role editor. Without it the owner can only ever use the seeded
 * "Business Developer" role and cannot adjust what a sub-account sees.
 */
export function AccountRolesPanel({
  roles,
  savingRole,
  deletingRole,
  onWriteRole,
  onDeleteRole,
}: AccountRolesPanelProps) {
  const { t } = useTranslation();
  const { ofRole } = useRoleDisplayName(roles);
  // "new" = the create form; a role id = that role's inline editor.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftScopes, setDraftScopes] = useState<GQL.PermissionScope[]>([]);
  const [confirmDeleteRoleId, setConfirmDeleteRoleId] = useState<string | null>(null);

  function openCreate() {
    setEditingKey("new");
    setDraftName("");
    setDraftScopes([]);
  }

  function openEdit(role: AccountRole) {
    setEditingKey(role.id);
    setDraftName(role.name);
    setDraftScopes([...role.scopes]);
  }

  function closeEditor() {
    setEditingKey(null);
  }

  function toggleDraftScope(scope: GQL.PermissionScope) {
    setDraftScopes((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope],
    );
  }

  async function handleSave() {
    if (!draftName.trim()) return;
    const ok = await onWriteRole({
      roleId: editingKey === "new" ? null : editingKey,
      name: draftName.trim(),
      scopes: draftScopes,
    });
    if (ok) closeEditor();
  }

  /**
   * Why a role cannot be deleted, or null when it can be.
   *
   * A built-in role re-seeds itself, so the backend refuses to delete it at
   * all — that case is checked first, because telling the owner to move its
   * sub-accounts away would promise a deletion that still would not happen.
   */
  function deleteBlockedHint(role: AccountRole): string | null {
    if (role.isSystem) return t("subAccounts.systemRoleUndeletableHint");
    if (role.memberCount > 0) return t("subAccounts.roleInUseHint");
    return null;
  }

  const confirmDeleteRole = confirmDeleteRoleId
    ? roles.find((role) => role.id === confirmDeleteRoleId) ?? null
    : null;

  /** @param role the role being edited, or null for the create form. */
  function renderEditor(role: AccountRole | null) {
    const isSystem = role?.isSystem ?? false;
    // A built-in role's name is fixed, so it is shown translated while the
    // draft keeps the stored name — saving its sections must not read as a
    // rename, which the backend rejects.
    const nameValue = role && role.isSystem ? ofRole(role) : draftName;
    return (
      <div className="acct-item acct-role-editor">
        <div>
          <label className="form-label-block">{t("subAccounts.roleNameLabel")}</label>
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={t("subAccounts.roleNamePlaceholder")}
            className="input-full"
            disabled={isSystem}
          />
          {isSystem && <div className="form-hint">{t("subAccounts.systemRoleNameHint")}</div>}
        </div>
        <div>
          <label className="form-label-block">{t("subAccounts.roleScopesLabel")}</label>
          <div className="form-hint">{t("subAccounts.roleScopesHint")}</div>
          <div className="acct-role-scope-grid">
            {ALL_SCOPES.map((scope) => (
              <label key={scope} className="form-checkbox-row">
                <input
                  type="checkbox"
                  checked={draftScopes.includes(scope)}
                  onChange={() => toggleDraftScope(scope)}
                />
                <span className="form-checkbox-label">{t(`subAccounts.scope.${scope}`)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary btn-sm" onClick={closeEditor}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={!draftName.trim() || savingRole}
          >
            {savingRole ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="acct-role-panel">
      <div className="acct-role-panel-header">
        <div>
          <h4>{t("subAccounts.rolesTitle")}</h4>
          <p className="acct-section-desc">{t("subAccounts.rolesDescription")}</p>
        </div>
        <div className="td-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={openCreate}
            disabled={editingKey === "new"}
          >
            {t("subAccounts.createRole")}
          </button>
        </div>
      </div>

      {editingKey === "new" && renderEditor(null)}

      {roles.length === 0 && editingKey !== "new" ? (
        <div className="empty-cell">{t("subAccounts.noRoles")}</div>
      ) : (
        <div className="acct-item-list">
          {roles.map((role) =>
            editingKey === role.id ? (
              <div key={role.id}>{renderEditor(role)}</div>
            ) : (
              <div key={role.id} className="acct-item">
                <div className="acct-item-title-row">
                  <span className="acct-item-name">{ofRole(role)}</span>
                  {role.isSystem && (
                    <span className="badge badge-muted">{t("subAccounts.systemRole")}</span>
                  )}
                  <div className="acct-item-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(role)}>
                      {t("common.edit")}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setConfirmDeleteRoleId(role.id)}
                      disabled={role.isSystem || role.memberCount > 0 || deletingRole}
                      title={deleteBlockedHint(role) ?? undefined}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
                <div className="acct-item-meta">
                  <span>{t("subAccounts.roleMemberCount", { count: role.memberCount })}</span>
                </div>
                {deleteBlockedHint(role) && (
                  <div className="form-hint">{deleteBlockedHint(role)}</div>
                )}
                <div className="acct-tool-chips">
                  {role.scopes.length === 0 ? (
                    <span className="acct-tool-chip">{t("subAccounts.noScopes")}</span>
                  ) : (
                    role.scopes.map((scope) => (
                      <span key={scope} className="acct-tool-chip">
                        {t(`subAccounts.scope.${scope}`)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDeleteRole !== null}
        title={t("subAccounts.deleteRoleTitle")}
        message={t("subAccounts.deleteRoleMessage", {
          name: confirmDeleteRole ? ofRole(confirmDeleteRole) : "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          const roleId = confirmDeleteRoleId;
          setConfirmDeleteRoleId(null);
          if (roleId) onDeleteRole(roleId);
        }}
        onCancel={() => setConfirmDeleteRoleId(null)}
      />
    </div>
  );
}
