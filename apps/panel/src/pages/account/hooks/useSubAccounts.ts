import { useMutation, useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { useToast } from "../../../components/Toast.js";
import {
  ACCOUNT_MEMBERS_QUERY,
  ACCOUNT_ROLES_QUERY,
  CREATE_ACCOUNT_MEMBER_MUTATION,
  DELETE_ACCOUNT_MEMBER_MUTATION,
  DELETE_ACCOUNT_ROLE_MUTATION,
  UPDATE_ACCOUNT_MEMBER_MUTATION,
  WRITE_ACCOUNT_ROLE_MUTATION,
} from "../../../api/account-members-queries.js";

export type AccountMember = GQL.AccountMember;
export type AccountRole = GQL.AccountRoleType;

interface MembersResult {
  accountMembers: AccountMember[];
}

interface RolesResult {
  accountRoles: AccountRole[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sub-account (member) and role administration for the owner of an account.
 *
 * Members and roles live on the backend only — there is no Desktop MST mirror
 * for them — so this reads through Apollo directly and refetches after every
 * mutation rather than patching a local cache by hand.
 */
export function useSubAccounts() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const membersQuery = useQuery<MembersResult>(ACCOUNT_MEMBERS_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const rolesQuery = useQuery<RolesResult>(ACCOUNT_ROLES_QUERY, {
    fetchPolicy: "cache-and-network",
  });

  const [createMemberMutation, createMemberState] = useMutation(CREATE_ACCOUNT_MEMBER_MUTATION);
  const [updateMemberMutation, updateMemberState] = useMutation(UPDATE_ACCOUNT_MEMBER_MUTATION);
  const [deleteMemberMutation, deleteMemberState] = useMutation(DELETE_ACCOUNT_MEMBER_MUTATION);
  const [writeRoleMutation, writeRoleState] = useMutation(WRITE_ACCOUNT_ROLE_MUTATION);
  const [deleteRoleMutation, deleteRoleState] = useMutation(DELETE_ACCOUNT_ROLE_MUTATION);

  async function refetchAll() {
    await Promise.all([membersQuery.refetch(), rolesQuery.refetch()]);
  }

  /**
   * Run one mutation, refetch, and report the outcome. The caller learns
   * whether it succeeded so it can close its modal; the error text itself is
   * always surfaced to the user rather than swallowed.
   */
  async function run(action: () => Promise<unknown>, successMessage: string): Promise<boolean> {
    try {
      await action();
      await refetchAll();
      showToast(successMessage);
      return true;
    } catch (error) {
      showToast(t("common.operationFailed", { message: errorMessage(error) }), "error");
      return false;
    }
  }

  return {
    members: membersQuery.data?.accountMembers ?? [],
    roles: rolesQuery.data?.accountRoles ?? [],
    loading: membersQuery.loading || rolesQuery.loading,
    loadError: membersQuery.error ?? rolesQuery.error ?? null,
    savingMember: createMemberState.loading || updateMemberState.loading,
    deletingMember: deleteMemberState.loading,
    savingRole: writeRoleState.loading,
    deletingRole: deleteRoleState.loading,

    createMember: (input: GQL.CreateAccountMemberInput) =>
      run(
        () => createMemberMutation({ variables: { input } }),
        t("subAccounts.memberCreated"),
      ),

    updateMember: (input: GQL.UpdateAccountMemberInput) =>
      run(
        () => updateMemberMutation({ variables: { input } }),
        t("subAccounts.memberUpdated"),
      ),

    deleteMember: (memberId: string) =>
      run(
        () => deleteMemberMutation({ variables: { memberId } }),
        t("subAccounts.memberDeleted"),
      ),

    writeRole: (input: GQL.WriteAccountRoleInput) =>
      run(() => writeRoleMutation({ variables: { input } }), t("subAccounts.roleSaved")),

    deleteRole: (roleId: string) =>
      run(() => deleteRoleMutation({ variables: { roleId } }), t("subAccounts.roleDeleted")),
  };
}
