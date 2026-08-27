import { describe, expect, it } from "vitest";
import {
  formatLocalizedDate,
  formatLocalizedDateTime,
  formatLocalizedMonthDay,
  formatLocalizedRelativeTime,
  formatLocalizedTime,
} from "./format-datetime.js";

const VALUE = new Date(2026, 4, 15, 13, 30, 0);

describe("localized panel date/time formatting", () => {
  it("uses different English and Chinese date ordering", () => {
    expect(formatLocalizedDate(VALUE, "en")).toBe("May 15, 2026");
    expect(formatLocalizedDate(VALUE, "zh")).toBe("2026年5月15日");
  });

  it("uses the active language for combined date and time", () => {
    expect(formatLocalizedDateTime(VALUE, "en-US")).toMatch(/^May 15, 2026,/u);
    expect(formatLocalizedDateTime(VALUE, "zh-CN")).toMatch(/^2026年5月15日/u);
  });

  it("formats time and month/day labels through the same locale protocol", () => {
    expect(formatLocalizedTime(VALUE, "en")).toMatch(/1:30\sPM/u);
    expect(formatLocalizedTime(VALUE, "zh")).toBe("13:30");
    expect(formatLocalizedMonthDay(VALUE, "en")).toBe("May 15");
    expect(formatLocalizedMonthDay(VALUE, "zh")).toBe("5月15日");
  });

  it("localizes relative times", () => {
    expect(formatLocalizedRelativeTime(120_000, 0, "en")).toContain("2 min");
    expect(formatLocalizedRelativeTime(120_000, 0, "zh")).toBe("2分钟后");
    expect(formatLocalizedRelativeTime(0, 86_400_000, "en", "auto")).toBe("yesterday");
    expect(formatLocalizedRelativeTime(0, 86_400_000, "zh", "auto")).toBe("昨天");
  });

  it("returns a stable empty value for missing or invalid input", () => {
    expect(formatLocalizedDateTime(null, "en")).toBe("—");
    expect(formatLocalizedDateTime("not-a-date", "zh")).toBe("—");
  });
});
