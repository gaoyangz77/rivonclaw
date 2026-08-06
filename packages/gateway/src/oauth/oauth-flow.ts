/** Shared types for Desktop-managed OAuth providers. */
export interface OAuthFlowCallbacks {
  openUrl: (url: string) => Promise<void>;
  onStatusUpdate?: (status: string) => void;
  /** Local proxy router URL used when the system proxy must carry OAuth traffic. */
  proxyUrl?: string;
}

export interface OAuthFlowResult {
  providerKeyId: string;
  email?: string;
  provider: string;
}
