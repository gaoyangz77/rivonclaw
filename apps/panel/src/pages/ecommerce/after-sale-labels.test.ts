import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { afterSaleDecisionErrorText } from "./after-sale-labels.js";

const t = ((key: string, options?: { code?: string }) => `${key}|${options?.code}`) as unknown as TFunction;
const PREFIX = "ecommerce.afterSale.decision.platformErrors";

describe("afterSaleDecisionErrorText", () => {
  it.each([
    ["25011035", "could not reject parcel now", "parcelNotRejectable"],
    ["25011010", "Operation Not Allowed. Cannot process this return request", "withPlatform"],
    ["25001003", "Resource Conflict. The `reverse order` conflicts", "stateChanged"],
  ])("explains TikTok code %s", (code, text, key) => {
    expect(afterSaleDecisionErrorText(t, `TikTok API error ${code}: ${text} (request_id: 1)`)).toBe(
      `${PREFIX}.${key}|${code}`,
    );
  });

  it("keeps the text of any other failure", () => {
    for (const message of ["TikTok API error 99999999: new refusal", "Network down"]) {
      expect(afterSaleDecisionErrorText(t, message)).toBe(message);
    }
  });
});
