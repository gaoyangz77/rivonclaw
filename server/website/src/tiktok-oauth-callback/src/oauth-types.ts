export enum OAuthBackend {
  PRODUCTION = "PRODUCTION",
  STAGING = "STAGING",
}

export enum OAuthAttemptStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
}

export enum OAuthPageState {
  IDLE = "IDLE",
  LOADING = "LOADING",
  READY = "READY",
  ERROR = "ERROR",
}

export interface CompleteTikTokOAuthResult {
  shopId: string;
  shopName: string;
  platform: string;
}

export interface CompleteTikTokOAuthData {
  completeTikTokOAuth: CompleteTikTokOAuthResult;
}

export interface CompleteTikTokOAuthVariables {
  code: string;
  state: string;
}

export interface OAuthEndpointAttempt {
  backend: OAuthBackend;
  endpoint: string;
}
