export const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
      user {
        userId
        email
        name
        plan
        createdAt
        enrolledModules
        entitlementKeys
        defaultRunProfileId
        llmKey {
          key
          suspendedUntil
        }
        support {
          telegramDebugProxyToken
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
      plan
      createdAt
      enrolledModules
      entitlementKeys
      defaultRunProfileId
      llmKey {
        key
        suspendedUntil
      }
      support {
        telegramDebugProxyToken
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
        plan
        createdAt
        enrolledModules
        entitlementKeys
        defaultRunProfileId
        llmKey {
          key
          suspendedUntil
        }
        support {
          telegramDebugProxyToken
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
        plan
        createdAt
        enrolledModules
        entitlementKeys
        defaultRunProfileId
        llmKey {
          key
          suspendedUntil
        }
        support {
          telegramDebugProxyToken
        }
      }
    }
  }
`;

export const REQUEST_CAPTCHA_MUTATION = `
  mutation RequestCaptcha {
    requestCaptcha {
      token
      svg
    }
  }
`;
