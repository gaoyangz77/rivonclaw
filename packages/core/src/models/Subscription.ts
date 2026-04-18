import { types, type Instance } from "mobx-state-tree";

export const QuotaCircleModel = types.model("QuotaCircle", {
  remainingPercent: types.number,
  refreshAt: types.string, // ISO DateTime
});

export const LlmQuotaStatusModel = types.model("LlmQuotaStatus", {
  fiveHour: QuotaCircleModel,
  weekly: QuotaCircleModel,
});

export const UserSubscriptionModel = types.model("UserSubscription", {
  userId: types.string,
  plan: types.string, // UserPlan enum value
  status: types.string, // SubscriptionStatus enum value
  // seatsMax/seatsUsed remain on the backend GraphQL type but are not
  // consumed by any Panel / Desktop surface. MST accepts them when present
  // (so nothing breaks if a caller re-selects them) and tolerates absence.
  seatsMax: types.maybe(types.integer),
  seatsUsed: types.maybe(types.integer),
  validUntil: types.string, // ISO DateTime
  stripeSubscriptionId: types.maybeNull(types.string),
});

export interface QuotaCircle extends Instance<typeof QuotaCircleModel> {}
export interface LlmQuotaStatus extends Instance<typeof LlmQuotaStatusModel> {}
export interface UserSubscription extends Instance<typeof UserSubscriptionModel> {}
