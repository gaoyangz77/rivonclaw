import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { TkModal as Modal } from "../../../components/design-system/index.js";
import { Select } from "../../../components/inputs/Select.js";
import { useRoleDisplayName } from "../hooks/useRoleDisplayName.js";
import type { AccountMember, AccountRole } from "../hooks/useSubAccounts.js";

interface SubAccountFormModalProps {
  isOpen: boolean;
  /** Null = create a new sub-account. */
  editingMember: AccountMember | null;
  roles: AccountRole[];
  saving: boolean;
  onCreate: (input: GQL.CreateAccountMemberInput) => Promise<boolean>;
  onUpdate: (input: GQL.UpdateAccountMemberInput) => Promise<boolean>;
  onClose: () => void;
}

export function SubAccountFormModal({
  isOpen,
  editingMember,
  roles,
  saving,
  onCreate,
  onUpdate,
  onClose,
}: SubAccountFormModalProps) {
  const { t } = useTranslation();
  const { ofRole } = useRoleDisplayName(roles);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [disabled, setDisabled] = useState(false);

  const editingMemberId = editingMember?.id ?? null;

  // Reseed the draft whenever the modal opens on a different member. These are
  // plain GraphQL objects, so holding their values as primitives is safe.
  useEffect(() => {
    if (!isOpen) return;
    setEmail(editingMember?.email ?? "");
    setName(editingMember?.name ?? "");
    setPassword("");
    setRoleId(editingMember?.roleId ?? roles[0]?.id ?? "");
    setDisabled(editingMember?.disabled ?? false);
  }, [isOpen, editingMemberId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEditing = editingMemberId !== null;
  const canSave = isEditing
    ? Boolean(roleId)
    : Boolean(email.trim() && password && roleId);

  async function handleSave() {
    if (!canSave) return;
    const ok = isEditing
      ? await onUpdate({
          memberId: editingMemberId!,
          name: name.trim() || null,
          roleId,
          password: password || null,
          disabled,
        })
      : await onCreate({
          email: email.trim(),
          name: name.trim() || null,
          password,
          roleId,
        });
    if (ok) onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t("subAccounts.editMember") : t("subAccounts.createMember")}
    >
      <div className="modal-form-col">
        <div>
          <label className="form-label-block">{t("subAccounts.emailLabel")}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("subAccounts.emailPlaceholder")}
            className="input-full"
            disabled={isEditing}
          />
          {isEditing && <div className="form-hint">{t("subAccounts.emailImmutableHint")}</div>}
        </div>

        <div>
          <label className="form-label-block">{t("subAccounts.nameLabel")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("subAccounts.namePlaceholder")}
            className="input-full"
          />
        </div>

        <div>
          <label className="form-label-block">
            {isEditing ? t("subAccounts.newPasswordLabel") : t("subAccounts.passwordLabel")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("subAccounts.passwordPlaceholder")}
            className="input-full"
            autoComplete="new-password"
          />
          {isEditing && <div className="form-hint">{t("subAccounts.newPasswordHint")}</div>}
        </div>

        <div>
          <label className="form-label-block">{t("subAccounts.roleLabel")}</label>
          <div className="form-hint">{t("subAccounts.roleHint")}</div>
          <Select
            value={roleId}
            onChange={setRoleId}
            className="input-full"
            placeholder={t("subAccounts.rolePlaceholder")}
            options={roles.map((role) => ({
              value: role.id,
              label: ofRole(role),
              description: t("subAccounts.roleMemberCount", { count: role.memberCount }),
            }))}
          />
        </div>

        {isEditing && (
          <label className="form-checkbox-row">
            <input
              type="checkbox"
              checked={disabled}
              onChange={(e) => setDisabled(e.target.checked)}
            />
            <span className="form-checkbox-label">{t("subAccounts.disabledLabel")}</span>
          </label>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
