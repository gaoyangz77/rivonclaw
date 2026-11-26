import { describe, expect, it } from "vitest";
import {
  campaignNameTemplateIssue,
  CAMPAIGN_NAME_TEMPLATE_VARIABLES,
  RECOMMENDED_CAMPAIGN_NAME_TEMPLATE,
  renderCampaignNameTemplate,
  type CampaignNameTemplateValues,
} from "./affiliate-campaign-name-template.js";
import { AFFILIATE_CAMPAIGN_NAME_MAX_LENGTH } from "./affiliate-campaign-name.js";

const values: CampaignNameTemplateValues = {
  businessDeveloperName: "黄海燕",
  businessDeveloperEnglishName: "Rosa",
  productId: "1737647724406212416",
  date: new Date(2026, 10, 26, 9, 30),
  sequence: 3,
};

describe("renderCampaignNameTemplate (ADR-120)", () => {
  it("renders every variable", () => {
    const render = (template: string) => renderCampaignNameTemplate(template, values);
    expect(render("{{bd_name}}")).toBe("黄海燕");
    expect(render("{{bd_english_name}}")).toBe("Rosa");
    expect(render("{{product_id}}")).toBe("1737647724406212416");
    expect(render("{{sequence}}")).toBe("3");
    expect(render("{{date:YYYYMMDD}}")).toBe("20261126");
    expect(render("{{date:YYYY-MM-DD}}")).toBe("2026-11-26");
    expect(render("{{date:YYMMDD}}")).toBe("261126");
    expect(render("{{date:MMDD}}")).toBe("1126");
    expect(render("{{date:MM.DD}}")).toBe("11.26");
    expect(render("{{date:M.D}}")).toBe("11.26");
  });

  it("covers every variable the settings panel offers", () => {
    const template = CAMPAIGN_NAME_TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join("|");
    expect(renderCampaignNameTemplate(template, values)).not.toContain("{{");
  });

  it("zero-pads the numeric dates but not M.D", () => {
    const early = { ...values, date: new Date(2026, 0, 5) };
    expect(renderCampaignNameTemplate("{{date:MM.DD}} {{date:M.D}} {{date:YYMMDD}}", early)).toBe(
      "01.05 1.5 260105",
    );
  });

  it("fills the recommended format", () => {
    expect(renderCampaignNameTemplate(RECOMMENDED_CAMPAIGN_NAME_TEMPLATE, values)).toBe(
      "Rosa-1737647724406212416-11.26-3",
    );
  });

  it("keeps separators exactly as typed, including around an empty value", () => {
    expect(
      renderCampaignNameTemplate("{{bd_english_name}}--Magcom-C--{{date:MM.DD}}", values),
    ).toBe("Rosa--Magcom-C--11.26");
    const noBd = { ...values, businessDeveloperName: null, businessDeveloperEnglishName: null };
    expect(
      renderCampaignNameTemplate("{{bd_english_name}}--{{product_id}}--{{date:MM.DD}}", noBd),
    ).toBe("--1737647724406212416--11.26");
    expect(renderCampaignNameTemplate("{{bd_name}}-{{bd_english_name}}-{{sequence}}", noBd)).toBe(
      "--3",
    );
  });

  it("trims the result but not the inside", () => {
    expect(renderCampaignNameTemplate("  {{bd_english_name}} | {{sequence}}  ", values)).toBe(
      "Rosa | 3",
    );
  });

  it("leaves an unknown variable as typed", () => {
    expect(renderCampaignNameTemplate("{{creator_name}}-{{sequence}}", values)).toBe(
      "{{creator_name}}-3",
    );
  });

  it("cuts to the name limit without splitting a character", () => {
    const long = renderCampaignNameTemplate(`${"a".repeat(119)}😀{{sequence}}`, values);
    expect(long).toBe("a".repeat(119));
    expect(renderCampaignNameTemplate("b".repeat(300), values)).toHaveLength(
      AFFILIATE_CAMPAIGN_NAME_MAX_LENGTH,
    );
  });
});

describe("campaignNameTemplateIssue (ADR-120)", () => {
  it("accepts a blank template and every known variable", () => {
    expect(campaignNameTemplateIssue("")).toBeNull();
    expect(campaignNameTemplateIssue("   ")).toBeNull();
    expect(campaignNameTemplateIssue(RECOMMENDED_CAMPAIGN_NAME_TEMPLATE)).toBeNull();
    expect(
      campaignNameTemplateIssue(
        CAMPAIGN_NAME_TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join(""),
      ),
    ).toBeNull();
  });

  it("names the unknown variables once each", () => {
    expect(campaignNameTemplateIssue("{{creator_name}}-{{creator_name}}-{{ sequence }}")).toEqual({
      kind: "unknownVariable",
      variables: ["{{creator_name}}", "{{ sequence }}"],
    });
  });

  it("flags unterminated braces and control characters like the Backend", () => {
    for (const template of ["{{bd_name", "bd_name}}", "{{{{bd_name}}"]) {
      expect(campaignNameTemplateIssue(template)).toEqual({ kind: "unterminated" });
    }
    expect(campaignNameTemplateIssue("a\tb")).toEqual({ kind: "controlCharacters" });
  });
});
