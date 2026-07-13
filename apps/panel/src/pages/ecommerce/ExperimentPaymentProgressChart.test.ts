import { describe, expect, it } from "vitest";
import {
  curveYAxisDomain,
  defaultVisibleCurveSeries,
  firstPositiveCurveMinute,
  isCurvePointReliable,
} from "./ExperimentPaymentProgressChart.js";

describe("ExperimentPaymentProgressChart", () => {
  it("requires both a narrow confidence interval and sufficient coverage", () => {
    expect(
      isCurvePointReliable({
        assignedUnits: 100,
        confidenceIntervalLow: 0.7,
        confidenceIntervalHigh: 0.8,
        coverageRate: 0.8,
      }),
    ).toBe(true);
    expect(
      isCurvePointReliable({
        assignedUnits: 100,
        confidenceIntervalLow: 0.69,
        confidenceIntervalHigh: 0.8,
        coverageRate: 0.9,
      }),
    ).toBe(false);
    expect(
      isCurvePointReliable({
        assignedUnits: 100,
        confidenceIntervalLow: 0.7,
        confidenceIntervalHigh: 0.79,
        coverageRate: 0.79,
      }),
    ).toBe(false);
    expect(
      isCurvePointReliable({
        assignedUnits: 68,
        confidenceIntervalLow: 0,
        confidenceIntervalHigh: 0.053,
        coverageRate: 1,
      }),
    ).toBe(false);
  });

  it("shows all small experiments and keeps control in the first six for large experiments", () => {
    const small = Array.from({ length: 2 }, (_, index) => ({
      seriesKey: `V${index}`,
      seriesRole: "CONFIG_VARIANT" as const,
    }));
    expect(defaultVisibleCurveSeries(small)).toEqual(["V0", "V1"]);

    const large = [
      ...Array.from({ length: 19 }, (_, index) => ({
        seriesKey: `V${index}`,
        seriesRole: "CONFIG_VARIANT" as const,
      })),
      { seriesKey: "CONTROL", seriesRole: "CONTROL" as const },
    ];
    expect(defaultVisibleCurveSeries(large)).toEqual(["CONTROL", "V0", "V1", "V2", "V3", "V4"]);
  });

  it("zooms to post-origin visible estimates instead of the forced 100% origin", () => {
    const series = [
      {
        seriesKey: "CONTROL",
        points: [
          { elapsedMinutes: 0, estimate: 1 },
          { elapsedMinutes: 1, estimate: 0.031 },
          { elapsedMinutes: 2_880, estimate: 0.031 },
        ],
      },
      {
        seriesKey: "TREATMENT",
        points: [
          { elapsedMinutes: 0, estimate: 1 },
          { elapsedMinutes: 1, estimate: 0.035 },
          { elapsedMinutes: 2_880, estimate: 0.035 },
        ],
      },
    ];
    expect(curveYAxisDomain(series, ["CONTROL", "TREATMENT"])).toEqual([2.5, 4]);
    expect(curveYAxisDomain(series, ["CONTROL"])).toEqual([2.5, 4]);
  });

  it("uses a safe fallback when no visible post-origin values exist", () => {
    expect(curveYAxisDomain([], [])).toEqual([0, 100]);
    expect(
      curveYAxisDomain(
        [{ seriesKey: "CONTROL", points: [{ elapsedMinutes: 0, estimate: 1 }] }],
        ["CONTROL"],
      ),
    ).toEqual([0, 100]);
  });

  it("keeps confidence bounds out of the axis domain so the outcome signal stays legible", () => {
    expect(
      curveYAxisDomain(
        [
          {
            seriesKey: "CONTROL",
            points: [
              { elapsedMinutes: 0, estimate: 1 },
              {
                elapsedMinutes: 3,
                estimate: 0,
                confidenceIntervalLow: 0,
                confidenceIntervalHigh: 0.0528,
              },
            ],
          },
          {
            seriesKey: "TREATMENT",
            points: [
              { elapsedMinutes: 0, estimate: 1 },
              {
                elapsedMinutes: 3,
                estimate: 0.005,
                confidenceIntervalLow: 0.002,
                confidenceIntervalHigh: 0.009,
              },
            ],
          },
        ],
        ["CONTROL", "TREATMENT"],
      ),
    ).toEqual([0, 1]);
  });

  it("starts the visible curve at the first positive minute", () => {
    expect(
      firstPositiveCurveMinute([
        { elapsedMinutes: 10 },
        { elapsedMinutes: 0 },
        { elapsedMinutes: 1 },
      ]),
    ).toBe(1);
    expect(firstPositiveCurveMinute([{ elapsedMinutes: 0 }])).toBe(1);
  });
});
