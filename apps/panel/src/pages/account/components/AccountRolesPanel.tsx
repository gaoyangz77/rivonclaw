import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { TkConfirmDialog as ConfirmDialog } from "../../../components/design-system/index.js";
import { useRoleDisplayName } from "../hooks/useRoleDisplayName.js";
import type { AccountRole } from "../hooks/useSubAccounts.js";
import { GRANTABLE_ROLE_SCOPES, isBusinessDeveloperRole } from "../account-utils.js";

interface AccountRolesPanelProps {
  roles: AccountRole[];
  savingRole: boolean;
  deletingRole: boolean;
  onWriteRole: (input: GQL.WriteAccountRoleInput) => Promise<boolean>;
  onDeleteRole: (roleId: string) => Promise<boolean>;
}

/**
 * Compact role editor, so the owner can adjust what each sub-account sees.
 *
 * The built-in Business Developer role is shown but never edited: its sections
 * are fixed, and it is handed out only by creating a business developer's
 * login on the Affiliate Team & Channels page (ADR 085).
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
   * Why a role cannot be changed, or null when it can be.
   *
   * Built-in roles are fixed by the product: the backend refuses to edit or
   * delete them, so they get no Edit/Delete buttons at all. A custom role can
   * be deleted only once no sub-account uses it.
   */
  function roleLockedHint(role: AccountRole): string | null {
    if (isBusinessDeveloperRole(role)) {
      return t("subAccounts.businessDeveloperRoleHint", {
        section: t("nav.affiliateManagement"),
        page: t("nav.affiliateTeam"),
      });
    }
    if (role.isSystem) return t("subAccounts.systemRoleLockedHint");
    if (role.memberCount > 0) return t("subAccounts.roleInUseHint");
    return null;
  }

  const confirmDeleteRole = confirmDeleteRoleId
    ? (roles.find((role) => role.id === confirmDeleteRoleId) ?? null)
    : null;

  /** The create form, or the editor of a custom role (built-in roles are never edited). */
  function renderEditor() {
    return (
      <div className="acct-item acct-role-editor">
        <div>
          <label className="form-label-block">{t("subAccounts.roleNameLabel")}</label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={t("subAccounts.roleNamePlaceholder")}
            className="input-full"
          />
        </div>
        <div>
          <label className="form-label-block">{t("subAccounts.roleScopesLabel")}</label>
          <div className="form-hint">{t("subAccounts.roleScopesHint")}</div>
          <div className="acct-role-scope-grid">
            {GRANTABLE_ROLE_SCOPES.map((scope) => (
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

      {editingKey === "new" && renderEditor()}

      {roles.length === 0 && editingKey !== "new" ? (
        <div className="empty-cell">{t("subAccounts.noRoles")}</div>
      ) : (
        <div className="acct-item-list">
          {roles.map((role) =>
            editingKey === role.id ? (
              <div key={role.id}>{renderEditor()}</div>
            ) : (
              <div key={role.id} className="acct-item">
                <div className="acct-item-title-row">
                  <span className="acct-item-name">{ofRole(role)}</span>
                  {role.isSystem && (
                    <span className="badge badge-muted">{t("subAccounts.systemRole")}</span>
                  )}
                  {!role.isSystem && (
                    <div className="acct-item-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(role)}>
                        {t("common.edit")}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmDeleteRoleId(role.id)}
                        disabled={role.memberCount > 0 || deletingRole}
                        title={roleLockedHint(role) ?? undefined}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                </div>
                <div className="acct-item-meta">
                  <span>{t("subAccounts.roleMemberCount", { count: role.memberCount })}</span>
                </div>
                {roleLockedHint(role) && <div className="form-hint">{roleLockedHint(role)}</div>}
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
