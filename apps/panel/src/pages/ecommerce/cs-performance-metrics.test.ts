import { describe, expect, it } from "vitest";
import { completeSevenDayAverage, type DailyMoneyPoint } from "./cs-performance-metrics.js";

function sevenDays(): DailyMoneyPoint[] {
  return Array.from({ length: 7 }, (_, index) => ({
    dateKey: `2026-07-${String(index + 1).padStart(2, "0")}`,
    value: (index + 1) * 10,
    currency: "USD",
  }));
}

describe("completeSevenDayAverage", () => {
  it("averages exactly seven complete consecutive daily values", () => {
    expect(completeSevenDayAverage(sevenDays())).toBe(40);
  });

  it("requires all seven days", () => {
    expect(completeSevenDayAverage(sevenDays().slice(1))).toBeNull();
  });

  it("rejects a missing daily value", () => {
    const points = sevenDays();
    points[3].value = null;
    expect(completeSevenDayAverage(points)).toBeNull();
  });

  it("rejects a date gap", () => {
    const points = sevenDays();
    points[3].dateKey = "2026-07-08";
    expect(completeSevenDayAverage(points)).toBeNull();
  });

  it("rejects mixed currencies", () => {
    const points = sevenDays();
    points[3].currency = "EUR";
    expect(completeSevenDayAverage(points)).toBeNull();
  });
});
