import { gql } from "@apollo/client";

export const REQUEST_CAPTCHA = gql`
  mutation RequestCaptcha {
    requestCaptcha {
      token
      svg
    }
  }
`;

export const WEB_LOGIN = gql`
  mutation WebLogin($input: LoginInput!) {
    webLogin(input: $input) {
      accessToken
      user {
        userId
        email
        name
      }
    }
  }
`;

export const WEB_REGISTER = gql`
  mutation WebRegister($input: RegisterInput!) {
    webRegister(input: $input) {
      accessToken
      user {
        userId
        email
        name
      }
    }
  }
`;

export const WEB_GOOGLE_LOGIN = gql`
  mutation WebGoogleLogin($input: GoogleLoginInput!) {
    webGoogleLogin(input: $input) {
      accessToken
      user {
        userId
        email
        name
      }
    }
  }
`;

export const WEB_REFRESH = gql`
  mutation WebRefresh {
    webRefresh {
      accessToken
      user {
        userId
        email
        name
      }
    }
  }
`;

export const WEB_LOGOUT = gql`
  mutation WebLogout {
    webLogout
  }
`;

export const CONSUME_DESKTOP_TO_WEB_LOGIN = gql`
  mutation ConsumeDesktopToWebLogin($ticket: String!) {
    consumeDesktopToWebLogin(ticket: $ticket) {
      accessToken
      user {
        userId
        email
        name
      }
    }
  }
`;

export const BROWSER_TO_DESKTOP_LOGIN_ATTEMPT = gql`
  query BrowserToDesktopLoginAttempt($ticket: String!) {
    browserToDesktopLoginAttempt(ticket: $ticket) {
      status
      deviceName
      expiresAt
    }
  }
`;

export const APPROVE_BROWSER_TO_DESKTOP_LOGIN = gql`
  mutation ApproveBrowserToDesktopLogin($ticket: String!) {
    approveBrowserToDesktopLogin(ticket: $ticket) {
      redirectUrl
    }
  }
`;

export const CONSUME_TIKTOK_OAUTH_BROWSER_START = gql`
  mutation ConsumeTikTokOAuthBrowserStart($ticket: String!) {
    consumeTikTokOAuthBrowserStart(ticket: $ticket) {
      authUrl
      expiresAt
    }
  }
`;

export const COMPLETE_TIKTOK_OAUTH = gql`
  mutation CompleteTikTokOAuth($code: String!, $state: String, $serviceId: String!) {
    completeTikTokOAuth(code: $code, state: $state, serviceId: $serviceId) {
      mode
      webSessionEstablished
      claimStatus
      shops {
        shopId
        shopName
      }
    }
  }
`;

export const CLAIM_PENDING_TIKTOK_SHOPS = gql`
  mutation ClaimPendingTikTokShops {
    claimPendingTikTokShops {
      status
      shops {
        shopId
        shopName
      }
    }
  }
`;

export const EXPERT_BOOTSTRAP = gql`
  query ExpertBootstrap {
    expertProfile {
      id
      locale
      stage
      targetMarkets
      sellerTypes
      targetTimeline
      experience
      capitalBand
      teamCapacity
      goals
      constraints
      profileVersion
    }
    expertConversations(limit: 50) {
      items {
        id
        title
        lastMessageAt
      }
    }
    expertUsageStatus {
      mode
      freeUsed
      freeLimit
      freeRemaining
      weeklyTokenRemaining
      fiveHourTokenRemaining
      resetsAt
    }
    activeExpertKnowledgeRelease {
      version
      publishedAt
    }
  }
`;

export const UPSERT_EXPERT_PROFILE = gql`
  mutation UpsertExpertProfile($input: UpsertExpertProfileInput!) {
    upsertExpertProfile(input: $input) {
      id
      locale
      stage
      targetMarkets
      sellerTypes
      targetTimeline
      experience
      capitalBand
      teamCapacity
      goals
      constraints
      profileVersion
    }
  }
`;

export const CREATE_EXPERT_CONVERSATION = gql`
  mutation CreateExpertConversation {
    createExpertConversation {
      id
      title
      lastMessageAt
    }
  }
`;

export const RENAME_EXPERT_CONVERSATION = gql`
  mutation RenameExpertConversation($id: ID!, $title: String!) {
    renameExpertConversation(id: $id, title: $title) {
      id
      title
      lastMessageAt
    }
  }
`;

export const DELETE_EXPERT_CONVERSATION = gql`
  mutation DeleteExpertConversation($id: ID!) {
    deleteExpertConversation(id: $id)
  }
`;

export const UPDATE_EXPERT_MESSAGE = gql`
  mutation UpdateExpertMessage($id: ID!, $content: String!) {
    updateExpertMessage(id: $id, content: $content) {
      id
      content
      editedAt
    }
  }
`;

export const EXPERT_CONVERSATION = gql`
  query ExpertConversation($id: ID!) {
    expertConversation(id: $id) {
      conversation {
        id
        title
        lastMessageAt
      }
      messages {
        id
        role
        content
        suggestedQuestions
        editedAt
        createdAt
        imageAssets {
          assetId: id
          publicUrl
          mimeType
          sizeBytes
          width
          height
        }
      }
      recommendations {
        id
        topic
        recommendation
        assumptions
        risks
        validationSteps
      }
    }
  }
`;

export const DISPATCH_EXPERT_MESSAGE = gql`
  mutation DispatchExpertMessage(
    $conversationId: ID!
    $text: String!
    $idempotencyKey: String!
    $replaceMessageId: ID
    $imageAssetIds: [ID!] = []
  ) {
    dispatchExpertMessage(
      conversationId: $conversationId
      text: $text
      idempotencyKey: $idempotencyKey
      replaceMessageId: $replaceMessageId
      imageAssetIds: $imageAssetIds
    ) {
      run {
        id
        status
        usageMode
        skillVersion
      }
      usage {
        mode
        freeUsed
        freeLimit
        freeRemaining
        weeklyTokenRemaining
        fiveHourTokenRemaining
        resetsAt
      }
    }
  }
`;

export const EXPERT_RUN_EVENTS = gql`
  subscription ExpertRunEvents($runId: ID!, $afterSequence: Int!) {
    expertRunEvents(runId: $runId, afterSequence: $afterSequence) {
      runId
      sequence
      type
      text
      toolName
      recommendationId
      suggestedQuestions
      errorCode
      occurredAt
    }
  }
`;

export const CANCEL_EXPERT_RUN = gql`
  mutation CancelExpertRun($runId: ID!) {
    cancelExpertRun(runId: $runId) {
      id
      status
    }
  }
`;
