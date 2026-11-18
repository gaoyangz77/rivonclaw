import { GQL } from "@rivonclaw/core";
import { describe, expect, it } from "vitest";
import {
  applyCampaignAiSuggestion,
  campaignAiButtonLabelKey,
  campaignInvitationTextIssue,
  campaignInvitationTextLength,
} from "./affiliate-campaign-invitation-text.js";

describe("campaign invitation text validation", () => {
  it("counts code points of the trimmed, LF-normalised text", () => {
    expect(campaignInvitationTextLength("  a\r\nb  ")).toBe(3);
    expect(campaignInvitationTextLength("😀".repeat(500))).toBe(500);
    expect("😀".repeat(500).length).toBe(1000);
  });

  it("allows empty text, 500 code points and line breaks", () => {
    expect(campaignInvitationTextIssue("   ")).toBeNull();
    expect(campaignInvitationTextIssue("😀".repeat(500))).toBeNull();
    expect(campaignInvitationTextIssue("one\n\n\ntwo")).toBeNull();
  });

  it("rejects over-long text, placeholders, HTML and URLs", () => {
    expect(campaignInvitationTextIssue("😀".repeat(501))).toBe("invitationTextTooLong");
    expect(campaignInvitationTextIssue("Hi {{creator_name}}")).toBe(
      "invitationTextContainsPlaceholder",
    );
    expect(campaignInvitationTextIssue("<b>Hi</b>")).toBe("invitationTextContainsHtml");
    expect(campaignInvitationTextIssue("see https://example.com")).toBe(
      "invitationTextContainsUrl",
    );
  });
});

describe("applying an AI suggestion", () => {
  const form = {
    templateText: "my own {{creator_name}} draft",
    templateSource: GQL.AffiliateCampaignMessageTemplateSource.UserAuthored,
    messageProductName: "my name",
    collaborationInvitationText: "old note",
    firstTouchMode: GQL.AffiliateCampaignFirstTouchMode.DirectMessage,
  };
  const suggestion = {
    text: "ai {{creator_name}} text",
    productShortName: "ai name",
    collaborationInvitationText: "ai note",
  };

  it("applies template, product name, source and note when a direct message is sent", () => {
    expect(applyCampaignAiSuggestion(form, suggestion)).toEqual({
      ...form,
      templateText: "ai {{creator_name}} text",
      messageProductName: "ai name",
      templateSource: GQL.AffiliateCampaignMessageTemplateSource.AiGenerated,
      collaborationInvitationText: "ai note",
    });
  });

  it("applies only the note in COLLABORATION_ONLY and keeps the retained template", () => {
    const collaborationOnly = {
      ...form,
      firstTouchMode: GQL.AffiliateCampaignFirstTouchMode.CollaborationOnly,
    };
    expect(applyCampaignAiSuggestion(collaborationOnly, suggestion)).toEqual({
      ...collaborationOnly,
      collaborationInvitationText: "ai note",
    });
  });

  it("keeps the seller's note when the suggestion carries none", () => {
    const applied = applyCampaignAiSuggestion(form, {
      ...suggestion,
      collaborationInvitationText: "",
    });
    expect(applied.collaborationInvitationText).toBe("old note");
    expect(applied.templateText).toBe("ai {{creator_name}} text");
  });
});

describe("the shared AI button label", () => {
  const base = {
    templateText: "",
    collaborationInvitationText: "",
    firstTouchMode: GQL.AffiliateCampaignFirstTouchMode.DirectMessage,
  };

  it("offers both drafts when a direct message is sent, judged on the template", () => {
    expect(campaignAiButtonLabelKey(base)).toBe("ecommerce.affiliateCampaign.generateWithAi");
    expect(campaignAiButtonLabelKey({ ...base, templateText: "Hi {{creator_name}}" })).toBe(
      "ecommerce.affiliateCampaign.generateAlternative",
    );
  });

  it("offers only the invitation intro in COLLABORATION_ONLY, judged on the intro", () => {
    const collaborationOnly = {
      ...base,
      templateText: "retained",
      firstTouchMode: GQL.AffiliateCampaignFirstTouchMode.CollaborationOnly,
    };
    expect(campaignAiButtonLabelKey(collaborationOnly)).toBe(
      "ecommerce.affiliateCampaign.generateInvitationWithAi",
    );
    expect(
      campaignAiButtonLabelKey({ ...collaborationOnly, collaborationInvitationText: "intro" }),
    ).toBe("ecommerce.affiliateCampaign.generateInvitationAlternative");
  });
});
