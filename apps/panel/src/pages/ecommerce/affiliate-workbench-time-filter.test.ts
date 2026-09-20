import { describe, expect, it } from "vitest";
import {
  ALL_TIME_WORKBENCH_FILTER,
  affiliateWorkbenchTimeBounds,
  affiliateWorkbenchTimeFilterKey,
  affiliateWorkbenchTimeSelection,
  localDayStart,
  localDayStartFromInput,
  localDayText,
  type AffiliateWorkbenchTimeFilter,
} from "./affiliate-workbench-time-filter.js";

function custom(
  customStartDate: string,
  customEndDate: string,
): AffiliateWorkbenchTimeFilter {
  return { preset: "CUSTOM", customStartDate, customEndDate };
}

/** 2026-09-20 14:30 local — deliberately mid-afternoon, not midnight. */
const NOW = new Date(2026, 8, 20, 14, 30, 15, 250);

describe("workbench time filter", () => {
  it("sends no bound at all for the default all-time filter", () => {
    const selection = affiliateWorkbenchTimeSelection(ALL_TIME_WORKBENCH_FILTER, NOW);
    expect(selection).toEqual({ state: "ALL_TIME" });
    expect(affiliateWorkbenchTimeBounds(selection)).toBeNull();
    expect(affiliateWorkbenchTimeFilterKey(selection)).toBe("");
  });

  it("anchors every preset to LOCAL midnight, never to a UTC calendar date", () => {
    // The tables render browser-local wall clock, so "today" must start at the
    // operator's own midnight. Asserted against locally constructed instants so
    // the expectation holds in any test TZ.
    const today = new Date(2026, 8, 20);
    const tomorrow = new Date(2026, 8, 21);

    expect(
      affiliateWorkbenchTimeSelection({ ...ALL_TIME_WORKBENCH_FILTER, preset: "TODAY" }, NOW),
    ).toEqual({ state: "RANGE", geIso: today.toISOString(), ltIso: tomorrow.toISOString() });

    expect(
      affiliateWorkbenchTimeSelection({ ...ALL_TIME_WORKBENCH_FILTER, preset: "LAST_7_DAYS" }, NOW),
    ).toEqual({
      state: "RANGE",
      geIso: new Date(2026, 8, 14).toISOString(),
      ltIso: tomorrow.toISOString(),
    });

    expect(
      affiliateWorkbenchTimeSelection(
        { ...ALL_TIME_WORKBENCH_FILTER, preset: "LAST_30_DAYS" },
        NOW,
      ),
    ).toEqual({
      state: "RANGE",
      geIso: new Date(2026, 7, 22).toISOString(),
      ltIso: tomorrow.toISOString(),
    });
  });

  it("keeps a preset stable for the whole local day so render-time resolution cannot thrash", () => {
    const early = affiliateWorkbenchTimeSelection(
      { ...ALL_TIME_WORKBENCH_FILTER, preset: "TODAY" },
      new Date(2026, 8, 20, 0, 0, 1),
    );
    const late = affiliateWorkbenchTimeSelection(
      { ...ALL_TIME_WORKBENCH_FILTER, preset: "TODAY" },
      new Date(2026, 8, 20, 23, 59, 59),
    );
    expect(early).toEqual(late);
  });

  it("turns an inclusive custom end day into the next local midnight", () => {
    expect(affiliateWorkbenchTimeSelection(custom("2026-09-01", "2026-09-07"), NOW)).toEqual({
      state: "RANGE",
      geIso: new Date(2026, 8, 1).toISOString(),
      ltIso: new Date(2026, 8, 8).toISOString(),
    });
  });

  it("treats a single custom day as that whole day", () => {
    expect(affiliateWorkbenchTimeSelection(custom("2026-09-20", "2026-09-20"), NOW)).toEqual({
      state: "RANGE",
      geIso: new Date(2026, 8, 20).toISOString(),
      ltIso: new Date(2026, 8, 21).toISOString(),
    });
  });

  it("sends nothing while a custom range is incomplete or unparseable", () => {
    // The backend rejects `ge >= lt`, so a half-typed range must stay unsent
    // rather than become a BAD_USER_INPUT.
    for (const filter of [
      custom("", ""),
      custom("2026-09-01", ""),
      custom("", "2026-09-07"),
      custom("2026-02-31", "2026-03-05"),
      custom("not-a-date", "2026-03-05"),
    ]) {
      const selection = affiliateWorkbenchTimeSelection(filter, NOW);
      expect(selection).toEqual({ state: "INCOMPLETE" });
      expect(affiliateWorkbenchTimeBounds(selection)).toBeNull();
    }
  });

  it("refuses an inverted custom range instead of sending ge >= lt", () => {
    const selection = affiliateWorkbenchTimeSelection(custom("2026-09-20", "2026-09-10"), NOW);
    expect(selection).toEqual({ state: "INVALID_ORDER" });
    expect(affiliateWorkbenchTimeBounds(selection)).toBeNull();
    expect(affiliateWorkbenchTimeFilterKey(selection)).toBe("");
  });

  it("keys the page buffer by the bounds actually sent", () => {
    const today = affiliateWorkbenchTimeSelection(
      { ...ALL_TIME_WORKBENCH_FILTER, preset: "TODAY" },
      NOW,
    );
    const sameRangeTypedByHand = affiliateWorkbenchTimeSelection(
      custom("2026-09-20", "2026-09-20"),
      NOW,
    );
    // A cursor is bound to the range that minted it; two filter states that
    // send the same range may therefore share one page stream.
    expect(affiliateWorkbenchTimeFilterKey(today)).toBe(
      affiliateWorkbenchTimeFilterKey(sameRangeTypedByHand),
    );
    expect(affiliateWorkbenchTimeFilterKey(today)).not.toBe(
      affiliateWorkbenchTimeFilterKey(
        affiliateWorkbenchTimeSelection({ ...ALL_TIME_WORKBENCH_FILTER, preset: "LAST_7_DAYS" }, NOW),
      ),
    );
  });

  it("round-trips a local calendar day through the date-input text form", () => {
    expect(localDayText(localDayStart(NOW))).toBe("2026-09-20");
    expect(localDayStartFromInput("2026-09-20")).toEqual(new Date(2026, 8, 20));
    expect(localDayStartFromInput("2026-9-2")).toBeNull();
    expect(localDayStartFromInput("0099-01-01")).toBeNull();
  });
});
