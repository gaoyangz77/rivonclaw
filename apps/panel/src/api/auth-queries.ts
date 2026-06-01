import { gql } from "@apollo/client/core";

export const REQUEST_CAPTCHA = gql`
  mutation RequestCaptcha {
    requestCaptcha {
      token
      svg
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      user {
        userId
        email
        name
        createdAt
        enrolledModules
        entitlementKeys
        defaultRunProfileId
        agent {
          active
          inviteCode
          enabledAt
          enabledByUserId
          disabledAt
          disabledByUserId
        }
      }
    }
  }
`;

export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user {
        userId
        email
        name
        createdAt
        enrolledModules
        entitlementKeys
        defaultRunProfileId
        agent {
          active
          inviteCode
          enabledAt
          enabledByUserId
          disabledAt
          disabledByUserId
        }
      }
    }
  }
`;

export const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
      user {
        userId
        email
        name
        createdAt
        enrolledModules
        entitlementKeys
        defaultRunProfileId
        agent {
          active
          inviteCode
          enabledAt
          enabledByUserId
          disabledAt
          disabledByUserId
        }
      }
    }
  }
`;

const ME_FIELDS_FRAGMENT = gql`
  fragment MeFields on MeResponse {
    userId
    email
    name
    createdAt
    enrolledModules
    entitlementKeys
    defaultRunProfileId
    support {
      telegramDebugProxyToken
    }
    agent {
      active
      inviteCode
      enabledAt
      enabledByUserId
      disabledAt
      disabledByUserId
    }
  }
`;

export const ME_QUERY = gql`
  ${ME_FIELDS_FRAGMENT}
  query Me {
    me {
      ...MeFields
    }
  }
`;

export const ENROLL_MODULE_MUTATION = gql`
  ${ME_FIELDS_FRAGMENT}
  mutation EnrollModule($moduleId: ModuleId!) {
    enrollModule(moduleId: $moduleId) {
      ...MeFields
    }
  }
`;

export const UNENROLL_MODULE_MUTATION = gql`
  ${ME_FIELDS_FRAGMENT}
  mutation UnenrollModule($moduleId: ModuleId!) {
    unenrollModule(moduleId: $moduleId) {
      ...MeFields
    }
  }
`;

export const SET_DEFAULT_RUN_PROFILE_MUTATION = gql`
  ${ME_FIELDS_FRAGMENT}
  mutation SetDefaultRunProfile($runProfileId: String) {
    setDefaultRunProfile(runProfileId: $runProfileId) {
      ...MeFields
    }
  }
`;

export { BILLING_OVERVIEW_QUERY } from "./billing-queries.js";

export const LOGOUT_MUTATION = gql`
  mutation Logout($refreshToken: String!) {
    logout(refreshToken: $refreshToken)
  }
`;

export const REVOKE_ALL_SESSIONS_MUTATION = gql`
  mutation RevokeAllSessions {
    revokeAllSessions
  }
`;
