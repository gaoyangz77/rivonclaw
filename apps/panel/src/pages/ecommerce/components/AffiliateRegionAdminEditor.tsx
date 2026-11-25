import { useState } from "react";
import { observer } from "mobx-react-lite";
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
  isShopScopeDraftChanged,
  isShopScopeDraftSaveable,
  scopeShopsFrom,
  shopScopeDraftFrom,
  shopScopeOfDraft,
  type BusinessDeveloperShopScopeDraft,
} from "../../../lib/affiliate-bd-shop-scope.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import {
  defaultStaffPermissions,
  displayNameAfterMemberPick,
  memberLabel,
  sameStaffPermissions,
  unboundEligibleMembers,
  type TeamStructure,
} from "../affiliate-team-structure.js";
import type { RegionAdminSaveInput } from "../hooks/useAffiliateTeamStructure.js";
import { AffiliateBusinessDeveloperShopScopeEditor } from "./AffiliateBusinessDeveloperShopScopeEditor.js";
import { AffiliateStaffPermissionsField } from "./AffiliateStaffPermissionsField.js";
import { ACCOUNT_MEMBERS_ROUTE } from "./AffiliateTeamLeadEditor.js";
import "./AffiliateTeamStructure.css";

/**
 * A new region admin starts on "specific" with nothing ticked, which cannot be
 * saved: unrestricted access has to be chosen on purpose, never inherited from
 * an empty form.
 */
const NEW_REGION_ADMIN_SCOPE: BusinessDeveloperShopScopeDraft = {
  shopScopeMode: "SPECIFIC",
  regions: [],
  shopIds: [],
};

/**
 * Creates or edits one region admin profile (ADR-112) and the permissions it
 * holds (ADR-113). The scope is the
 * ADR-110 region and shop editor, reused as is. The drafts are primitives
 * seeded once on mount; the stored profile is re-read from the structure.
 */
export const AffiliateRegionAdminEditor = observer(function AffiliateRegionAdminEditor({
  structure,
  adminId,
  saving,
  onClose,
  onSave,
}: {
  structure: TeamStructure;
  /** null creates a new region admin. */
  adminId: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: RegionAdminSaveInput) => void;
}) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const admin = adminId
    ? (structure.regionAdmins.find((candidate) => candidate.id === adminId) ?? null)
    : null;
  const [memberUserId, setMemberUserId] = useState("");
  const [displayName, setDisplayName] = useState(admin?.displayName ?? "");
  const [scope, setScope] = useState<BusinessDeveloperShopScopeDraft>(() =>
    admin
      ? shopScopeDraftFrom(admin, new Set(scopeShopsFrom(entityStore.shops).map((shop) => shop.id)))
      : NEW_REGION_ADMIN_SCOPE,
  );
  // A new region admin starts on the role default; an existing one on what it holds.
  const [permissions, setPermissions] = useState(
    () => admin?.permissions ?? defaultStaffPermissions("REGION_ADMIN"),
  );

  const members = unboundEligibleMembers(structure.eligibleRegionAdminMembers);

  function pickMember(userId: string) {
    const byId = (id: string) => members.find((member) => member.userId === id);
    setDisplayName((draft) => displayNameAfterMemberPick(draft, byId(memberUserId), byId(userId)));
    setMemberUserId(userId);
  }
  const boundMember = admin
    ? structure.eligibleRegionAdminMembers.find((member) => member.userId === admin.memberUserId)
    : null;

  const name = displayName.trim();
  const scopeSaveable = isShopScopeDraftSaveable(scope);
  const permissionsChanged = !admin || !sameStaffPermissions(permissions, admin.permissions);
  const changed = admin
    ? name !== admin.displayName || isShopScopeDraftChanged(scope, admin) || permissionsChanged
    : true;
  const canSave =
    Boolean(name) && scopeSaveable && changed && (admin ? true : Boolean(memberUserId));

  return (
    <Modal
      isOpen
      onClose={onClose}
      preventBackdropClose={saving}
      title={t(
        admin
          ? "ecommerce.affiliateTeam.regionAdminEditTitle"
          : "ecommerce.affiliateTeam.regionAdminAddTitle",
      )}
      maxWidth={640}
      closeLabel={t("common.close")}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave || saving) return;
          onSave({
            id: admin?.id,
            memberUserId: admin ? undefined : memberUserId,
            displayName: name,
            ...shopScopeOfDraft(scope),
            permissions,
            permissionsChanged,
          });
        }}
      >
        <TkFormStack>
          {admin ? (
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
              {t("ecommerce.affiliateTeam.regionAdminNoEligibleMembers")}
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
              <small className="form-hint">
                {t("ecommerce.affiliateTeam.regionAdminMemberHint")}
              </small>
            </label>
          )}
          <TkField
            label={t("ecommerce.affiliateTeam.teamStructureDisplayName")}
            hint={t("ecommerce.affiliateTeam.teamStructureDisplayNameHint")}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="off"
          />
          <AffiliateBusinessDeveloperShopScopeEditor
            value={scope}
            onChange={setScope}
            allHint={t("ecommerce.affiliateTeam.regionAdminScopeAllHint")}
            specificHint={t("ecommerce.affiliateTeam.regionAdminScopeSpecificHint")}
          />
          <AffiliateStaffPermissionsField role="REGION_ADMIN" value={permissions} onChange={setPermissions} />
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
});
