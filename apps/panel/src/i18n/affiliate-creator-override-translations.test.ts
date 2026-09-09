import { describe, expect, it } from "vitest";
import { AFFILIATE_TEAM_TRANSLATIONS } from "./affiliate-team-translations.js";

describe("Creator Excel override copy", () => {
  it("explains clearing and target sets in every locale, including exported template instructions", () => {
    expect(Object.keys(AFFILIATE_TEAM_TRANSLATIONS).sort()).toEqual(["de", "en", "es", "fr", "id", "it", "th", "zh"]);
    for (const locale of Object.values(AFFILIATE_TEAM_TRANSLATIONS)) {
      const copy = locale.ecommerce.affiliateTeam;
      expect(copy.creatorOverrideHint.length).toBeGreaterThan(50);
      expect(copy.protectionTemplateHint).toBe(copy.creatorOverrideHint);
      expect(copy.templateProtectionActionHint).toContain("UNPROTECT");
      expect(copy.templateDeveloperHint).toContain("AI Team");
      expect(copy.creatorOverrideClearBd).toContain("AI Team");
      expect(locale.ecommerce.affiliateWorkspace.lifecycleEvents.RELATIONSHIP_BD_UNASSIGNED).toBeTruthy();
    }
    const en = AFFILIATE_TEAM_TRANSLATIONS.en.ecommerce.affiliateTeam;
    expect(en.templateManualTagHint).toContain("replace");
    expect(en.templateDeveloperHint).not.toContain("no BD change");
  });
});
