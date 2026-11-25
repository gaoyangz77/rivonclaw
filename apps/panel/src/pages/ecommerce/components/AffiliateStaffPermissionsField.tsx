import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { TkBadge } from "../../../components/design-system/index.js";
import {
  AFFILIATE_STAFF_PERMISSIONS,
  staffPermissionsForRole,
  toggleStaffPermission,
  type StaffProfileRole,
} from "../affiliate-team-structure.js";
import "./AffiliateTeamStructure.css";

/** Translation keys of one permission: its checkbox label, its hint and its short tree label. */
const PERMISSION_COPY: Record<
  GQL.AffiliateStaffPermission,
  { label: string; hint: string; short: string }
> = {
  [GQL.AffiliateStaffPermission.View]: {
    label: "ecommerce.affiliateTeam.permissionView",
    hint: "ecommerce.affiliateTeam.permissionViewHint",
    short: "ecommerce.affiliateTeam.permissionViewShort",
  },
  [GQL.AffiliateStaffPermission.Operate]: {
    label: "ecommerce.affiliateTeam.permissionOperate",
    hint: "ecommerce.affiliateTeam.permissionOperateHint",
    short: "ecommerce.affiliateTeam.permissionOperateShort",
  },
  [GQL.AffiliateStaffPermission.Allocate]: {
    label: "ecommerce.affiliateTeam.permissionAllocate",
    hint: "ecommerce.affiliateTeam.permissionAllocateHint",
    short: "ecommerce.affiliateTeam.permissionAllocateShort",
  },
  [GQL.AffiliateStaffPermission.Campaign]: {
    label: "ecommerce.affiliateTeam.permissionCampaign",
    hint: "ecommerce.affiliateTeam.permissionCampaignHint",
    short: "ecommerce.affiliateTeam.permissionCampaignShort",
  },
};

/**
 * The permission checkboxes of a staff profile (ADR-113, ADR-118), shared by the
 * team lead and region admin editors; the role decides which ones exist. The value is a primitive draft the editor
 * owns; `OPERATE` and `VIEW` are coupled here so the draft is never a set the
 * Backend would refuse.
 */
export function AffiliateStaffPermissionsField({
  role,
  value,
  onChange,
  disabled = false,
}: {
  role: StaffProfileRole;
  value: readonly GQL.AffiliateStaffPermission[];
  onChange: (next: GQL.AffiliateStaffPermission[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="affiliate-staff-permissions" disabled={disabled}>
      <legend>{t("ecommerce.affiliateTeam.permissionsLabel")}</legend>
      <small className="form-hint">{t("ecommerce.affiliateTeam.permissionsHint")}</small>
      {staffPermissionsForRole(role).map((permission) => (
        <label className="affiliate-staff-permissions-option" key={permission}>
          <input
            type="checkbox"
            checked={value.includes(permission)}
            onChange={(event) =>
              onChange(toggleStaffPermission(value, permission, event.target.checked))
            }
          />
          <span>{t(PERMISSION_COPY[permission].label)}</span>
          <small>{t(PERMISSION_COPY[permission].hint)}</small>
        </label>
      ))}
    </fieldset>
  );
}

/** A profile's permissions as short labels, for the tree and the region admin list. */
export function AffiliateStaffPermissionBadges({
  permissions,
}: {
  permissions: readonly GQL.AffiliateStaffPermission[];
}) {
  const { t } = useTranslation();
  const held = AFFILIATE_STAFF_PERMISSIONS.filter((permission) => permissions.includes(permission));
  return (
    <span className="affiliate-staff-permission-badges">
      {held.length === 0 ? (
        <TkBadge tone="neutral">{t("ecommerce.affiliateTeam.permissionNoneShort")}</TkBadge>
      ) : (
        held.map((permission) => (
          <TkBadge key={permission} tone="neutral">
            {t(PERMISSION_COPY[permission].short)}
          </TkBadge>
        ))
      )}
    </span>
  );
}
