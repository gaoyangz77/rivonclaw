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

export const DESKTOP_GOOGLE_AUTH_CONFIG_QUERY = `
  query DesktopGoogleAuthConfig {
    desktopGoogleAuthConfig {
      enabled
      clientId
    }
  }
`;

export const EXCHANGE_DESKTOP_GOOGLE_CODE_MUTATION = `
  mutation ExchangeDesktopGoogleCode($input: DesktopGoogleCodeExchangeInput!) {
    exchangeDesktopGoogleCode(input: $input)
  }
`;

export const GOOGLE_LOGIN_MUTATION = `
  mutation DesktopGoogleLogin($input: GoogleLoginInput!) {
    googleLogin(input: $input) {
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

export const START_BROWSER_TO_DESKTOP_LOGIN_MUTATION = `
  mutation StartBrowserToDesktopLogin($input: BrowserToDesktopLoginInput!) {
    startBrowserToDesktopLogin(input: $input) {
      flowId
      authorizationUrl
      expiresAt
    }
  }
`;

export const EXCHANGE_BROWSER_TO_DESKTOP_LOGIN_MUTATION = `
  mutation ExchangeBrowserToDesktopLogin($input: BrowserToDesktopCodeInput!) {
    exchangeBrowserToDesktopLoginCode(input: $input) {
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

export const CREATE_DESKTOP_TO_WEB_LOGIN_MUTATION = `
  mutation CreateDesktopToWebLogin($returnPath: String!, $surface: WebAppSurface) {
    createDesktopToWebLogin(returnPath: $returnPath, surface: $surface) {
      authorizationUrl
      expiresAt
    }
  }
`;
