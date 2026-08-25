import { useTranslation } from "react-i18next";
import type { AccountMember, AccountRole } from "./useSubAccounts.js";

/**
 * Display names for account roles.
 *
 * The backend seeds its built-in roles with an English name and refuses to
 * rename them, so the stored name doubles as a stable translation key — the
 * same approach `useSystemName` uses for system surfaces and run profiles.
 * A role the owner created keeps its name verbatim in every locale.
 *
 * @param roles the account's roles, as loaded by `useSubAccounts`
 */
export function useRoleDisplayName(roles: AccountRole[]) {
  const { t } = useTranslation();

  function translate(name: string, isSystem: boolean): string {
    return isSystem
      ? (t(`subAccounts.systemRoleNames.${name}`, { defaultValue: name }) as string)
      : name;
  }

  return {
    /** For a role row, which carries the built-in flag itself. */
    ofRole: (role: AccountRole) => translate(role.name, role.isSystem),

    /**
     * For a member row: `AccountMember` carries no built-in flag, so the role
     * list loaded alongside it decides whether the name is translatable.
     * Falls back to the name the member row carries when its role is gone.
     */
    ofMember: (member: AccountMember): string => {
      const role = roles.find((candidate) => candidate.id === member.roleId);
      return role ? translate(role.name, role.isSystem) : member.roleName ?? "";
    },
  };
}
