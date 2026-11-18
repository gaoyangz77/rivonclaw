import { GQL } from "@rivonclaw/core";

/**
 * The collaboration invitation text (ADR-108) is the note a Creator reads on a
 * TikTok target-collaboration invitation. It is separate from the direct-message
 * template: one note is shared by every Creator on a collaboration, so it can
 * hold no placeholders, and it is sent in both first-touch modes.
 */
export const CAMPAIGN_INVITATION_TEXT_MAX_CODE_POINTS = 500;

export type CampaignInvitationTextIssue =
  | "invitationTextTooLong"
  | "invitationTextContainsPlaceholder"
  | "invitationTextContainsHtml"
  | "invitationTextContainsUrl";

/** The text as the Backend stores it: LF line breaks, trimmed, nothing collapsed. */
function normalizeInvitationText(text: string): string {
  return text.replace(/\r\n?/gu, "\n").trim();
}

/** Length in Unicode code points, the unit the Backend limit is expressed in. */
export function campaignInvitationTextLength(text: string): number {
  return [...normalizeInvitationText(text)].length;
}

/** Mirrors the Backend rules for the note. An empty note is valid (no note). */
export function campaignInvitationTextIssue(text: string): CampaignInvitationTextIssue | null {
  const normalized = normalizeInvitationText(text);
  if (!normalized) return null;
  if ([...normalized].length > CAMPAIGN_INVITATION_TEXT_MAX_CODE_POINTS) {
    return "invitationTextTooLong";
  }
  if (/\{\{[\s\S]*?\}\}/u.test(normalized)) return "invitationTextContainsPlaceholder";
  if (/<[a-z][\s\S]*>/iu.test(normalized)) return "invitationTextContainsHtml";
  if (/\b(?:https?:\/\/|www\.)\S+/iu.test(normalized)) return "invitationTextContainsUrl";
  return null;
}

type AiSuggestionFormFields = {
  templateText: string;
  templateSource: GQL.AffiliateCampaignMessageTemplateSource;
  messageProductName: string;
  collaborationInvitationText: string;
  firstTouchMode: GQL.AffiliateCampaignFirstTouchMode;
};

/**
 * Which form fields an AI suggestion overwrites. The note applies in both
 * first-touch modes; the template, product short name and source only when a
 * direct message is sent, so a retained template survives COLLABORATION_ONLY.
 */
export function applyCampaignAiSuggestion(
  form: AiSuggestionFormFields,
  suggestion: Pick<
    GQL.AffiliateCampaignMessageTemplateSuggestion,
    "text" | "productShortName" | "collaborationInvitationText"
  >,
): AiSuggestionFormFields {
  // Desktop returns "" when the model's note failed validation but the
  // template was still worth keeping; that must not erase the seller's note.
  const withNote = {
    ...form,
    collaborationInvitationText:
      suggestion.collaborationInvitationText || form.collaborationInvitationText,
  };
  if (form.firstTouchMode === GQL.AffiliateCampaignFirstTouchMode.CollaborationOnly) {
    return withNote;
  }
  return {
    ...withNote,
    templateText: suggestion.text,
    messageProductName: suggestion.productShortName,
    templateSource: GQL.AffiliateCampaignMessageTemplateSource.AiGenerated,
  };
}
