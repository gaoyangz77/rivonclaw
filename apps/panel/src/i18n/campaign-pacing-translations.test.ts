import { describe, expect, it } from "vitest";
import { campaignPacingCopy } from "./campaign-pacing-translations.js";

describe("Campaign pacing translations", () => {
  it("provides the same nonempty keys in all eight languages", () => {
    expect(Object.keys(campaignPacingCopy)).toHaveLength(8);
    for (const translations of Object.values(campaignPacingCopy)) {
      expect(Object.keys(translations).sort()).toEqual(Object.keys(campaignPacingCopy.en).sort());
      for (const value of Object.values(translations))
        expect(value.trim().length).toBeGreaterThan(0);
      expect(translations.allDay).toContain("24");
    }
    expect(campaignPacingCopy.zh.fastHint).toContain("立即开始");
    expect(campaignPacingCopy.zh.uniformHint).toContain("08:00–22:00");
  });
});
