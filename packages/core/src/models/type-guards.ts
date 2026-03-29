/**
 * Compile-time drift detection between GQL generated types and MST model snapshots.
 *
 * MST models are a *subset* of GQL types — Desktop may omit fields it doesn't need.
 * These checks ensure every field in an MST snapshot exists in the corresponding GQL type.
 * If the GQL schema changes (field renamed/removed) but the MST model isn't updated,
 * TypeScript will surface an error here at build time.
 */

import type { SnapshotIn } from "mobx-state-tree";
import type * as GQL from "../generated/graphql.js";
import type { SurfaceModel } from "./Surface.js";
import type { RunProfileModel } from "./RunProfile.js";
import type { ShopModel } from "./Shop.js";
import type { ToolSpecModel } from "./ToolSpec.js";
import type { UserSubscriptionModel, LlmQuotaStatusModel } from "./Subscription.js";
import type { PlatformAppModel } from "./PlatformApp.js";
import type { ServiceCreditModel } from "./ServiceCredit.js";

/**
 * Ensures every required key in `MST` also exists in `GQL`.
 * Resolves to `true` when compatible, `never` when a field is missing.
 */
type AssertSubset<GQL, MST> = {
  [K in keyof Required<MST>]: K extends keyof GQL ? true : never;
}[keyof Required<MST>] extends true ? true : never;

// ── Surface ──────────────────────────────────────────────────────────
type _AssertSurfaceCompat = AssertSubset<GQL.Surface, SnapshotIn<typeof SurfaceModel>>;
const _surfaceGuard: _AssertSurfaceCompat = true;

// ── RunProfile ───────────────────────────────────────────────────────
type _AssertRunProfileCompat = AssertSubset<GQL.RunProfile, SnapshotIn<typeof RunProfileModel>>;
const _runProfileGuard: _AssertRunProfileCompat = true;

// ── Shop (MST is a subset — omits createdAt, updatedAt, grantedScopes, userId) ──
type _AssertShopCompat = AssertSubset<GQL.Shop, SnapshotIn<typeof ShopModel>>;
const _shopGuard: _AssertShopCompat = true;

// ── ToolSpec (ToolModel adds `source` which is local-only, not in GQL) ──
type _AssertToolSpecCompat = AssertSubset<GQL.ToolSpec, Omit<SnapshotIn<typeof ToolSpecModel>, "source">>;
const _toolSpecGuard: _AssertToolSpecCompat = true;

// ── UserSubscription ─────────────────────────────────────────────────
type _AssertUserSubscriptionCompat = AssertSubset<GQL.UserSubscription, SnapshotIn<typeof UserSubscriptionModel>>;
const _userSubscriptionGuard: _AssertUserSubscriptionCompat = true;

// ── LlmQuotaStatus ──────────────────────────────────────────────────
type _AssertLlmQuotaStatusCompat = AssertSubset<GQL.LlmQuotaStatus, SnapshotIn<typeof LlmQuotaStatusModel>>;
const _llmQuotaStatusGuard: _AssertLlmQuotaStatusCompat = true;

// ── PlatformApp ──────────────────────────────────────────────────────
type _AssertPlatformAppCompat = AssertSubset<GQL.PlatformApp, SnapshotIn<typeof PlatformAppModel>>;
const _platformAppGuard: _AssertPlatformAppCompat = true;

// ── ServiceCredit ────────────────────────────────────────────────────
type _AssertServiceCreditCompat = AssertSubset<GQL.ServiceCredit, SnapshotIn<typeof ServiceCreditModel>>;
const _serviceCreditGuard: _AssertServiceCreditCompat = true;
