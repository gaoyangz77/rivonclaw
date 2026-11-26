import { AFFILIATE_CAMPAIGN_NAME_MAX_LENGTH } from "./affiliate-campaign-name.js";

/**
 * ADR-120: renders the seller's default Campaign name. The variable set is validated by the Backend on
 * save (`server/backend/src/ecommerce/affiliate/AffiliateCampaignNameTemplate.ts`); keep both lists in
 * step. One renderer serves the wizard and the settings preview.
 */

export const CAMPAIGN_NAME_TEMPLATE_VARIABLES = [
  "bd_name",
  "bd_english_name",
  "product_id",
  "date:YYYYMMDD",
  "date:YYYY-MM-DD",
  "date:YYMMDD",
  "date:MMDD",
  "date:MM.DD",
  "date:M.D",
  "sequence",
] as const;

export type CampaignNameTemplateVariable = (typeof CAMPAIGN_NAME_TEMPLATE_VARIABLES)[number];

/** The recommended convention: BD English name, product id, month.day, that day's sequence. */
export const RECOMMENDED_CAMPAIGN_NAME_TEMPLATE =
  "{{bd_english_name}}-{{product_id}}-{{date:MM.DD}}-{{sequence}}";

export interface CampaignNameTemplateValues {
  /** Null (not a BD, or no English name) renders as the empty string. */
  businessDeveloperName: string | null;
  businessDeveloperEnglishName: string | null;
  productId: string;
  /** Read with the local clock: the date is the person's own. */
  date: Date;
  sequence: number;
}

const VARIABLE_PATTERN = /\{\{([^{}]*)\}\}/g;

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function variableValue(name: string, values: CampaignNameTemplateValues): string | null {
  const year = values.date.getFullYear();
  const month = values.date.getMonth() + 1;
  const day = values.date.getDate();
  switch (name) {
    case "bd_name":
      return values.businessDeveloperName ?? "";
    case "bd_english_name":
      return values.businessDeveloperEnglishName ?? "";
    case "product_id":
      return values.productId;
    case "sequence":
      return String(values.sequence);
    case "date:YYYYMMDD":
      return `${year}${twoDigits(month)}${twoDigits(day)}`;
    case "date:YYYY-MM-DD":
      return `${year}-${twoDigits(month)}-${twoDigits(day)}`;
    case "date:YYMMDD":
      return `${twoDigits(year % 100)}${twoDigits(month)}${twoDigits(day)}`;
    case "date:MMDD":
      return `${twoDigits(month)}${twoDigits(day)}`;
    case "date:MM.DD":
      return `${twoDigits(month)}.${twoDigits(day)}`;
    case "date:M.D":
      return `${month}.${day}`;
    default:
      return null;
  }
}

/** Cuts to `maxLength` UTF-16 units (the Backend's maxlength) without splitting a character. */
function cutToLength(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  let result = "";
  for (const character of value) {
    if (result.length + character.length > maxLength) break;
    result += character;
  }
  return result;
}

/**
 * Replaces every variable, keeps every separator exactly as typed (`Rosa--Magcom-C--11.26` shows the
 * double separators around an empty value are deliberate), trims, and cuts to the name limit. An
 * unknown `{{…}}` is left as typed: the Backend refuses to store one, so it can only be a stale value.
 */
export function renderCampaignNameTemplate(
  template: string,
  values: CampaignNameTemplateValues,
): string {
  const rendered = template.replace(
    VARIABLE_PATTERN,
    (match, name: string) => variableValue(name, values) ?? match,
  );
  return cutToLength(rendered.trim(), AFFILIATE_CAMPAIGN_NAME_MAX_LENGTH);
}

export type CampaignNameTemplateIssue =
  | { kind: "controlCharacters" }
  | { kind: "unknownVariable"; variables: string[] }
  | { kind: "unterminated" };

/**
 * What the Backend would refuse about a template, found before the seller saves: a control character,
 * a `{{…}}` outside the variable set, or braces left over once every variable is read. A blank
 * template is off and has no issue.
 */
export function campaignNameTemplateIssue(template: string): CampaignNameTemplateIssue | null {
  if (template.trim() === "") return null;
  if (/\p{Cc}/u.test(template)) return { kind: "controlCharacters" };
  const known: ReadonlySet<string> = new Set(CAMPAIGN_NAME_TEMPLATE_VARIABLES);
  const unknown: string[] = [];
  const literal = template.replace(VARIABLE_PATTERN, (match, name: string) => {
    if (!known.has(name)) unknown.push(match);
    return "";
  });
  if (unknown.length > 0) return { kind: "unknownVariable", variables: [...new Set(unknown)] };
  if (literal.includes("{{") || literal.includes("}}")) return { kind: "unterminated" };
  return null;
}
