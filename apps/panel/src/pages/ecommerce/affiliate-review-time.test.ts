import { describe, expect, it } from "vitest";
import { useTimeZone } from "../../../test/use-time-zone.js";
import {
  defaultReviewActionRange,
  deviceTimeZoneLabel,
  deviceUtcOffsetLabel,
  formatLocalDateTime,
  parseReviewActionAt,
  reviewActionBounds,
  toLocalWallClockDate,
} from "./affiliate-review-time.js";

describe("review action time under a UTC+8 device", () => {
  useTimeZone("Asia/Shanghai");

  it("defaults to today 00:00 through tomorrow 00:00 on the device clock", () => {
    // 2026-10-30 18:30 in Shanghai is still 10:30 UTC the same day.
    expect(defaultReviewActionRange(new Date("2026-10-30T10:30:00.000Z"))).toEqual({
      start: "2026-10-30T00:00",
      end: "2026-10-31T00:00",
    });
    // 2026-10-30 23:30 UTC is already the 31st in Shanghai.
    expect(defaultReviewActionRange(new Date("2026-10-30T23:30:00.000Z"))).toEqual({
      start: "2026-10-31T00:00",
      end: "2026-11-01T00:00",
    });
  });

  it("converts typed device-local bounds to UTC instants", () => {
    expect(reviewActionBounds({ start: "2026-10-30T00:00", end: "2026-10-31T00:00" })).toEqual({
      reviewActionAtGe: "2026-10-29T16:00:00.000Z",
      reviewActionAtLt: "2026-10-30T16:00:00.000Z",
    });
  });

  it("refuses an empty, reversed, zero-length or over-366-day window", () => {
    expect(reviewActionBounds({ start: "", end: "2026-10-31T00:00" })).toBeNull();
    expect(reviewActionBounds({ start: "2026-10-31T00:00", end: "2026-10-30T00:00" })).toBeNull();
    expect(reviewActionBounds({ start: "2026-10-30T00:00", end: "2026-10-30T00:00" })).toBeNull();
    // 367 days is refused; exactly 366 days is still allowed.
    expect(reviewActionBounds({ start: "2025-10-29T00:00", end: "2026-10-31T00:00" })).toBeNull();
    expect(reviewActionBounds({ start: "2025-10-30T00:00", end: "2026-10-31T00:00" })).not.toBeNull();
  });

  it("shows an instant as device-local wall-clock time and as a spreadsheet wall-clock date", () => {
    const instant = parseReviewActionAt("2026-10-30T08:15:42.123Z")!;
    expect(formatLocalDateTime(instant)).toBe("2026-10-30 16:15:42");
    expect(toLocalWallClockDate(instant).toISOString()).toBe("2026-10-30T16:15:42.123Z");
    expect(parseReviewActionAt(null)).toBeNull();
    expect(parseReviewActionAt("")).toBeNull();
    expect(parseReviewActionAt("not a date")).toBeNull();
  });

  it("names the device timezone by its offset and zone", () => {
    expect(deviceUtcOffsetLabel()).toBe("GMT+08:00");
    expect(deviceTimeZoneLabel()).toBe("GMT+08:00 (Asia/Shanghai)");
  });
});

describe("review action time under a UTC-3:30 device", () => {
  useTimeZone("America/St_Johns");

  it("keeps the half-hour offset in the label and the conversion", () => {
    const winter = new Date("2026-01-15T12:00:00.000Z");
    expect(deviceUtcOffsetLabel(winter)).toBe("GMT-03:30");
    expect(reviewActionBounds({ start: "2026-01-15T00:00", end: "2026-01-16T00:00" })).toEqual({
      reviewActionAtGe: "2026-01-15T03:30:00.000Z",
      reviewActionAtLt: "2026-01-16T03:30:00.000Z",
    });
  });
});
