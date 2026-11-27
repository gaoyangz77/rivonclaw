import { graphQLErrorCode } from "./graphql-error-code.js";

/**
 * i18n keys for the error codes the backend's customer-service one-shots
 * (conversation summary, reply translation) can return. Anything else, such as
 * a network failure or an unclassified error, falls back to the generic message.
 */
const SUMMARY_ERROR_KEYS: Record<string, string> = {
  CS_ONE_SHOT_SUBSCRIPTION_REQUIRED: "ecommerce.customerServiceWorkspace.summarySubscriptionRequired",
  CS_ONE_SHOT_QUOTA_EXHAUSTED: "ecommerce.customerServiceWorkspace.summaryQuotaExhausted",
  CS_SUMMARY_NO_MESSAGES: "ecommerce.customerServiceWorkspace.summaryNoMessages",
};
const SUMMARY_FAILED_KEY = "ecommerce.customerServiceWorkspace.summaryFailed";

const REPLY_TRANSLATION_ERROR_KEYS: Record<string, string> = {
  CS_ONE_SHOT_SUBSCRIPTION_REQUIRED:
    "ecommerce.customerServiceWorkspace.messageTranslationSubscriptionRequired",
  CS_ONE_SHOT_QUOTA_EXHAUSTED: "ecommerce.customerServiceWorkspace.messageTranslationQuotaExhausted",
  CS_REPLY_TRANSLATION_TEXT_LENGTH: "messageTranslation.textLength",
};
const REPLY_TRANSLATION_FAILED_KEY = "messageTranslation.failed";

/** The error code the model stores for a failed summary read or generation. */
export function csSummaryErrorCode(error: unknown): string {
  return graphQLErrorCode(error) ?? "CS_SUMMARY_FAILED";
}

export function csSummaryErrorKey(code: string | null | undefined): string {
  return (code && SUMMARY_ERROR_KEYS[code]) || SUMMARY_FAILED_KEY;
}

export function replyTranslationErrorKey(error: unknown): string {
  const code = graphQLErrorCode(error);
  return (code && REPLY_TRANSLATION_ERROR_KEYS[code]) || REPLY_TRANSLATION_FAILED_KEY;
}
