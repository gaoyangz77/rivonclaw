import { describe, expect, it } from "vitest";
import { csSummaryErrorCode, csSummaryErrorKey, replyTranslationErrorKey } from "./cs-one-shot-error.js";

const coded = (code: string) => Object.assign(new Error("raw"), { errors: [{ extensions: { code } }] });

describe("cs one-shot error mapping", () => {
  it("maps summary error codes and falls back to the generic summary message", () => {
    expect(csSummaryErrorKey(csSummaryErrorCode(coded("CS_ONE_SHOT_SUBSCRIPTION_REQUIRED")))).toBe(
      "ecommerce.customerServiceWorkspace.summarySubscriptionRequired",
    );
    expect(csSummaryErrorKey("CS_ONE_SHOT_QUOTA_EXHAUSTED")).toBe(
      "ecommerce.customerServiceWorkspace.summaryQuotaExhausted",
    );
    expect(csSummaryErrorKey("CS_SUMMARY_NO_MESSAGES")).toBe("ecommerce.customerServiceWorkspace.summaryNoMessages");
    expect(csSummaryErrorKey(csSummaryErrorCode(new Error("network")))).toBe(
      "ecommerce.customerServiceWorkspace.summaryFailed",
    );
    expect(csSummaryErrorKey(null)).toBe("ecommerce.customerServiceWorkspace.summaryFailed");
  });

  it("maps reply-translation error codes and falls back to the generic translation message", () => {
    expect(replyTranslationErrorKey(coded("CS_ONE_SHOT_SUBSCRIPTION_REQUIRED"))).toBe(
      "ecommerce.customerServiceWorkspace.messageTranslationSubscriptionRequired",
    );
    expect(replyTranslationErrorKey(coded("CS_ONE_SHOT_QUOTA_EXHAUSTED"))).toBe(
      "ecommerce.customerServiceWorkspace.messageTranslationQuotaExhausted",
    );
    expect(replyTranslationErrorKey(coded("CS_REPLY_TRANSLATION_TEXT_LENGTH"))).toBe("messageTranslation.textLength");
    expect(replyTranslationErrorKey(coded("SOMETHING_ELSE"))).toBe("messageTranslation.failed");
    expect(replyTranslationErrorKey(new Error("Model unavailable"))).toBe("messageTranslation.failed");
  });
});
