import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGE_CODES } from "./languages.js";
import i18n from "./index.js";
import { PICKUP_REMINDER_TRANSLATIONS } from "./pickup-reminder-translations.js";

describe("Customer reminder settings translations", () => {
  it("resolves the menu and pickup settings in every desktop language without fallback", () => {
    expect(Object.keys(PICKUP_REMINDER_TRANSLATIONS).sort()).toEqual([...SUPPORTED_LANGUAGE_CODES].sort());
    for (const locale of SUPPORTED_LANGUAGE_CODES) {
      const copy = PICKUP_REMINDER_TRANSLATIONS[locale].ecommerce;
      const t = i18n.getFixedT(locale);
      expect(copy.shopDrawer.aiCS.reminders.trim()).not.toBe("");
      expect(t("ecommerce.shopDrawer.aiCS.reminders")).toBe(copy.shopDrawer.aiCS.reminders);
      for (const key of ["title", "enabled", "hint", "saveFailed"] as const) {
        expect(copy.pickupReminder[key].trim()).not.toBe("");
        expect(t(`ecommerce.pickupReminder.${key}`)).toBe(copy.pickupReminder[key]);
      }
    }
  });
});
