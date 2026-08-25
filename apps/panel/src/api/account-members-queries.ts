import { gql } from "@apollo/client/core";

const ACCOUNT_MEMBER_FIELDS_FRAGMENT = gql`
  fragment AccountMemberFields on AccountMember {
    id
    email
    name
    roleId
    roleName
    scopes
    disabled
    createdAt
  }
`;

const ACCOUNT_ROLE_FIELDS_FRAGMENT = gql`
  fragment AccountRoleFields on AccountRoleType {
    id
    name
    scopes
    isSystem
    memberCount
  }
`;

export const ACCOUNT_MEMBERS_QUERY = gql`
  ${ACCOUNT_MEMBER_FIELDS_FRAGMENT}
  query AccountMembers {
    accountMembers {
      ...AccountMemberFields
    }
  }
`;

export const ACCOUNT_ROLES_QUERY = gql`
  ${ACCOUNT_ROLE_FIELDS_FRAGMENT}
  query AccountRoles {
    accountRoles {
      ...AccountRoleFields
    }
  }
`;

export const CREATE_ACCOUNT_MEMBER_MUTATION = gql`
  ${ACCOUNT_MEMBER_FIELDS_FRAGMENT}
  mutation CreateAccountMember($input: CreateAccountMemberInput!) {
    createAccountMember(input: $input) {
      ...AccountMemberFields
    }
  }
`;

export const UPDATE_ACCOUNT_MEMBER_MUTATION = gql`
  ${ACCOUNT_MEMBER_FIELDS_FRAGMENT}
  mutation UpdateAccountMember($input: UpdateAccountMemberInput!) {
    updateAccountMember(input: $input) {
      ...AccountMemberFields
    }
  }
`;

export const DELETE_ACCOUNT_MEMBER_MUTATION = gql`
  mutation DeleteAccountMember($memberId: String!) {
    deleteAccountMember(memberId: $memberId)
  }
`;

export const WRITE_ACCOUNT_ROLE_MUTATION = gql`
  ${ACCOUNT_ROLE_FIELDS_FRAGMENT}
  mutation WriteAccountRole($input: WriteAccountRoleInput!) {
    writeAccountRole(input: $input) {
      ...AccountRoleFields
    }
  }
`;

export const DELETE_ACCOUNT_ROLE_MUTATION = gql`
  mutation DeleteAccountRole($roleId: String!) {
    deleteAccountRole(roleId: $roleId)
  }
`;
