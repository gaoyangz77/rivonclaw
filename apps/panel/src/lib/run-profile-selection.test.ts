import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import { isStaffSelectableRunProfile, staffRunProfileChoices } from "./run-profile-selection.js";

const shopOps = { id: GQL.SystemRunProfile.ShopOperations, userId: "" };
const customerService = { id: GQL.SystemRunProfile.CustomerService, userId: "" };
const affiliate = { id: GQL.SystemRunProfile.AffiliateOperator, userId: "" };
const userProfile = { id: "6650f0c0a1b2c3d4e5f60789", userId: "user-1" };

describe("isStaffSelectableRunProfile", () => {
  it("allows the shop operations system profile", () => {
    expect(isStaffSelectableRunProfile(shopOps)).toBe(true);
  });

  it("rejects the customer service and affiliate system profiles", () => {
    expect(isStaffSelectableRunProfile(customerService)).toBe(false);
    expect(isStaffSelectableRunProfile(affiliate)).toBe(false);
  });

  it("rejects an unknown system profile until it is allowlisted", () => {
    expect(isStaffSelectableRunProfile({ id: "FUTURE_PROFILE", userId: "" })).toBe(false);
  });

  it("allows every user-created profile, whatever its id", () => {
    expect(isStaffSelectableRunProfile(userProfile)).toBe(true);
    // A user profile is identified by its owner, never by an id that happens
    // to collide with a system profile name.
    expect(isStaffSelectableRunProfile({ id: "CUSTOMER_SERVICE", userId: "user-1" })).toBe(true);
  });
});

describe("staffRunProfileChoices", () => {
  const profiles = [shopOps, customerService, affiliate, userProfile];

  it("offers only selectable profiles, in their original order", () => {
    expect(staffRunProfileChoices(profiles, "")).toEqual([
      { profile: shopOps, selectable: true },
      { profile: userProfile, selectable: true },
    ]);
    expect(staffRunProfileChoices(profiles, null)).toEqual(staffRunProfileChoices(profiles, ""));
    expect(staffRunProfileChoices(profiles, undefined)).toEqual(
      staffRunProfileChoices(profiles, ""),
    );
  });

  it("keeps a restricted current value in place, marked not selectable", () => {
    expect(staffRunProfileChoices(profiles, customerService.id)).toEqual([
      { profile: shopOps, selectable: true },
      { profile: customerService, selectable: false },
      { profile: userProfile, selectable: true },
    ]);
  });

  it("does not mark a selectable current value", () => {
    expect(staffRunProfileChoices(profiles, shopOps.id)).toEqual([
      { profile: shopOps, selectable: true },
      { profile: userProfile, selectable: true },
    ]);
  });

  it("ignores a current id that matches no profile", () => {
    expect(staffRunProfileChoices(profiles, "deleted-profile")).toEqual([
      { profile: shopOps, selectable: true },
      { profile: userProfile, selectable: true },
    ]);
  });
});
