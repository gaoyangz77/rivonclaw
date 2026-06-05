export const REFRESH_TOKEN_MUTATION = `
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
    }
  }
`;

export const ME_QUERY = `
  query Me {
    me {
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
  }
`;

export const LOGOUT_MUTATION = `
  mutation Logout($refreshToken: String!) {
    logout(refreshToken: $refreshToken)
  }
`;

export const LOGIN_MUTATION = `
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
    }
  }
`;

export const REGISTER_MUTATION = `
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
    }
  }
`;

export const REQUEST_CAPTCHA_MUTATION = `
  mutation RequestCaptcha($deterministicToken: String) {
    requestCaptcha(deterministicToken: $deterministicToken) {
      token
      svg
    }
  }
`;
