import { z } from "zod/v4";

// ── Token lifecycle states for UI display ───────────────────────────────────

export const tiktokTokenLifecycleSchema = z.enum([
  "NOT_STARTED",
  "AWAITING_CALLBACK",
  "ACTIVE",
  "EXPIRING_SOON",
  "EXPIRED",
  "REFRESH_FAILED",
  "REVOKED",
]);

export type TikTokTokenLifecycle = z.infer<typeof tiktokTokenLifecycleSchema>;

// ── OAuth callback params (received from redirect) ──────────────────────────

export const tiktokOAuthCallbackSchema = z.object({
  auth_code: z.string(),
  state: z.string(),
});

export type TikTokOAuthCallback = z.infer<typeof tiktokOAuthCallbackSchema>;

// ── TikTok market enum ──────────────────────────────────────────────────────

export const tiktokMarketSchema = z.enum(["US", "ROW"]);

export type TikTokMarket = z.infer<typeof tiktokMarketSchema>;

// ── Shop OAuth status (for Panel UI display) ───────────────────────────────

export const tiktokShopOAuthStatusSchema = z.object({
  shopId: z.string(),
  shopName: z.string(),
  market: tiktokMarketSchema,
  tokenLifecycle: tiktokTokenLifecycleSchema,
  accessTokenExpiresAt: z.string().datetime().optional(),
  refreshTokenExpiresAt: z.string().datetime().optional(),
  grantedScopes: z.array(z.string()),
});

export type TikTokShopOAuthStatus = z.infer<typeof tiktokShopOAuthStatusSchema>;
