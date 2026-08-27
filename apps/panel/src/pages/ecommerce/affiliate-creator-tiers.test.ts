import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  CREATOR_SAMPLE_TIER_ORDER,
  creatorSampleTierDisplay,
  creatorSampleTierLabel,
  creatorSampleTierMedal,
  creatorSampleTierName,
  highestCreatorSampleTier,
} from "./affiliate-creator-tiers.js";

const t = (key: string, options?: Record<string, unknown>) =>
  (options?.defaultValue as string | undefined) ?? key;

describe("creator sample tiers", () => {
  it("covers every backend rung exactly once, in ladder order", () => {
    expect([...CREATOR_SAMPLE_TIER_ORDER]).toEqual([
      GQL.CreatorSampleTier.SampleShipped,
      GQL.CreatorSampleTier.SampleDelivered,
      GQL.CreatorSampleTier.SampleFulfilled,
      GQL.CreatorSampleTier.AttributableOrder,
    ]);
    expect(new Set(CREATOR_SAMPLE_TIER_ORDER).size).toBe(
      Object.values(GQL.CreatorSampleTier).length,
    );
  });

  it("gives every rung a distinct medal", () => {
    const medals = CREATOR_SAMPLE_TIER_ORDER.map(creatorSampleTierMedal);
    expect(new Set(medals).size).toBe(medals.length);
  });

  it("renders a rung as its medal plus the business term", () => {
    for (const tier of CREATOR_SAMPLE_TIER_ORDER) {
      expect(creatorSampleTierLabel(t, tier)).toBe(
        `${creatorSampleTierMedal(tier)} ${creatorSampleTierName(t, tier)}`,
      );
    }
  });

  it("renders no rung as an em dash, never as the lowest rung", () => {
    // Absent means no rung was reached anywhere. Falling back to SAMPLE_SHIPPED
    // would claim a sample was sent when none was.
    expect(creatorSampleTierDisplay(t, null)).toBe("—");
    expect(creatorSampleTierDisplay(t, undefined)).toBe("—");
    expect(creatorSampleTierDisplay(t, null)).not.toContain(
      creatorSampleTierMedal(GQL.CreatorSampleTier.SampleShipped),
    );
  });

  it("derives the highest current rung from shop-scoped relationship facts", () => {
    expect(
      highestCreatorSampleTier([
        GQL.CreatorSampleTier.SampleDelivered,
        null,
        GQL.CreatorSampleTier.AttributableOrder,
        GQL.CreatorSampleTier.SampleShipped,
      ]),
    ).toBe(GQL.CreatorSampleTier.AttributableOrder);
    expect(highestCreatorSampleTier([null, undefined])).toBeNull();
  });
});
