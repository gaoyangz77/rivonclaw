import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import type { AccountMember, AccountRole } from "./useSubAccounts.js";

/**
 * Display names for account roles.
 *
 * A built-in role is translated by its stable `systemKey` (ADR 085 retired
 * matching built-in roles by their stored English name). A role the owner
 * created keeps its name verbatim in every locale.
 *
 * @param roles the account's roles, as loaded by `useSubAccounts`
 */
export function useRoleDisplayName(roles: AccountRole[]) {
  const { t } = useTranslation();

  function translate(name: string, systemKey: GQL.AccountSystemRoleKey | null | undefined): string {
    return systemKey ? (t(`subAccounts.systemRoleNames.${systemKey}`) as string) : name;
  }

  return {
    /** For a role row, which carries its built-in key itself. */
    ofRole: (role: AccountRole) => translate(role.name, role.systemKey),

    /**
     * For a member row: the member carries its role's built-in key; a custom
     * role's current name comes from the role list loaded alongside it, falling
     * back to the name the member row carries when its role is gone.
     */
    ofMember: (member: AccountMember): string => {
      if (member.roleSystemKey) return translate(member.roleName ?? "", member.roleSystemKey);
      const role = roles.find((candidate) => candidate.id === member.roleId);
      return role ? translate(role.name, role.systemKey) : (member.roleName ?? "");
    },
  };
}
