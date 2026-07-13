import { describe, expect, it } from "vitest";
import {
  defaultVisibleCurveSeries,
  isCurvePointReliable,
} from "./ExperimentPaymentProgressChart.js";

describe("ExperimentPaymentProgressChart", () => {
  it("requires both a narrow confidence interval and sufficient coverage", () => {
    expect(
      isCurvePointReliable({
        confidenceIntervalLow: 0.7,
        confidenceIntervalHigh: 0.8,
        coverageRate: 0.8,
      }),
    ).toBe(true);
    expect(
      isCurvePointReliable({
        confidenceIntervalLow: 0.69,
        confidenceIntervalHigh: 0.8,
        coverageRate: 0.9,
      }),
    ).toBe(false);
    expect(
      isCurvePointReliable({
        confidenceIntervalLow: 0.7,
        confidenceIntervalHigh: 0.79,
        coverageRate: 0.79,
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
});
