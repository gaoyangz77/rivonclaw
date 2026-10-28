import { LoadedListBackToTop } from "../../../components/navigation/LoadedListBackToTop.js";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TkConfirmDialog as ConfirmDialog } from "../../../components/design-system/index.js";
import { useRoleDisplayName } from "../hooks/useRoleDisplayName.js";
import { useSubAccounts } from "../hooks/useSubAccounts.js";
import { formatLocalizedDate } from "../../../lib/format-datetime.js";
import { AccountRolesPanel } from "./AccountRolesPanel.js";
import { SubAccountFormModal } from "./SubAccountFormModal.js";
import { assignableMemberRoles, isBusinessDeveloperMember } from "../account-utils.js";
import {
  TkAlert,
  TkPanel,
  TkPanelBody,
  TkPanelHeader,
  TkButton,
  TkField,
} from "../../../components/design-system/index.js";
import { switchToMember } from "../../../api/account-switch.js";
import { useToast } from "../../../components/Toast.js";

const MEMBER_BATCH_SIZE = 5;

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
  const [switchingMemberId, setSwitchingMemberId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [visibleMemberLimit, setVisibleMemberLimit] = useState(MEMBER_BATCH_SIZE);
  const { showToast } = useToast();

  async function loginAsMember(memberId: string) {
    setSwitchingMemberId(memberId);
    try {
      await switchToMember(memberId);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      const message =
        code === "ACCOUNT_SWITCH_CLIENT_UNAVAILABLE"
          ? t("subAccounts.loginAsClientUpdateRequired")
          : code === "ACCOUNT_SWITCH_BACKEND_UNAVAILABLE"
            ? t("subAccounts.loginAsServerUpdateRequired")
            : error instanceof Error
              ? error.message
              : String(error);
      showToast(
        t("common.operationFailed", {
          message,
        }),
        "error",
      );
    } finally {
      setSwitchingMemberId(null);
    }
  }

  const { members, roles } = subAccounts;
  const { ofMember } = useRoleDisplayName(roles);
  const search = memberSearch.normalize("NFKC").trim().toLocaleLowerCase();
  const visibleMembers = members.filter((member) =>
    [member.name, member.email, ofMember(member)].some((value) =>
      value?.normalize("NFKC").toLocaleLowerCase().includes(search),
    ),
  );
  const canCreateMember = assignableMemberRoles(roles).length > 0;
  const businessDeveloperLocation = {
    section: t("nav.affiliateManagement"),
    page: t("nav.affiliateTeam"),
  };
  const editingMember = editingMemberId
    ? (members.find((member) => member.id === editingMemberId) ?? null)
    : null;
  const confirmDeleteMember = confirmDeleteMemberId
    ? (members.find((member) => member.id === confirmDeleteMemberId) ?? null)
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
    <TkPanel
      as="section"
      padding="none"
      clip
      className="section-card"
      data-tutorial-id="account-members"
    >
      <TkPanelHeader
        title={t("subAccounts.title")}
        description={t("subAccounts.description")}
        actions={
          <button
            className="btn btn-primary btn-sm"
            onClick={openCreate}
            disabled={!canCreateMember}
            title={canCreateMember ? undefined : t("subAccounts.needRoleFirst")}
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

        <TkField
          type="search"
          label={t("subAccounts.searchMembers")}
          placeholder={t("subAccounts.searchMembersPlaceholder")}
          value={memberSearch}
          onChange={(event) => {
            setMemberSearch(event.target.value);
            setVisibleMemberLimit(MEMBER_BATCH_SIZE);
          }}
        />

        {subAccounts.loading && members.length === 0 ? (
          <div className="empty-cell">{t("common.loading")}</div>
        ) : members.length === 0 ? (
          <div className="empty-cell">{t("subAccounts.noMembers")}</div>
        ) : visibleMembers.length === 0 ? (
          <div className="empty-cell" role="status">{t("subAccounts.noMatchingMembers")}</div>
        ) : (
          <div className="acct-item-list">
            {visibleMembers.slice(0, visibleMemberLimit).map((member) => (
              <div key={member.id} className="acct-item">
                <div className="acct-item-title-row">
                  <span className="acct-item-name">{member.name || member.email}</span>
                  <span className={`badge ${member.disabled ? "badge-muted" : "badge-active"}`}>
                    {member.disabled
                      ? t("subAccounts.statusDisabled")
                      : t("subAccounts.statusActive")}
                  </span>
                  <div className="acct-item-actions">
                    <TkButton
                      size="sm"
                      variant="secondary"
                      disabled={member.disabled || switchingMemberId !== null}
                      onClick={() => void loginAsMember(member.id)}
                    >
                      {t(
                        switchingMemberId === member.id ? "common.loading" : "subAccounts.loginAs",
                      )}
                    </TkButton>
                    {!isBusinessDeveloperMember(member) && (
                      <>
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
                      </>
                    )}
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
                {isBusinessDeveloperMember(member) && (
                  <div className="form-hint">
                    {t("subAccounts.businessDeveloperMemberHint", businessDeveloperLocation)}
                  </div>
                )}
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

        <LoadedListBackToTop
          enabled={visibleMemberLimit > MEMBER_BATCH_SIZE && visibleMembers.length > MEMBER_BATCH_SIZE}
        />
        {visibleMembers.length > visibleMemberLimit && (
          <TkButton
            variant="secondary"
            onClick={() => setVisibleMemberLimit((limit) => limit + MEMBER_BATCH_SIZE)}
          >
            {t("subAccounts.showMoreMembers")}
          </TkButton>
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
