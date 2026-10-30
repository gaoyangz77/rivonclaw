import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../../i18n/index.js";
import { useTimeZone } from "../../../test/use-time-zone.js";
import {
  AFFILIATE_DETAIL_COLUMNS,
  EMPTY_AFFILIATE_DETAIL_FILTERS,
  affiliateDetailCell,
  affiliateReviewerSelectOptions,
  AFFILIATE_REVIEWER_UNRECORDED_KEY,
  buildAffiliateDetailInput,
  type AffiliateDetailEntity,
} from "./affiliate-detail-query.js";

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(async () => {
  await i18n.changeLanguage("zh");
});

const t = i18n.t.bind(i18n);
const reviewerCell = (value: unknown) =>
  affiliateDetailCell(t, "zh", { AFFILIATE_SAMPLE_REVIEWER: value }, "AFFILIATE_SAMPLE_REVIEWER");

describe("reviewer cell", () => {
  it("renders the structured reviewer as its name and an unreviewed row as a dash", () => {
    const actor = (kind: string, displayName: string | null) => ({
      key: "k",
      kind,
      displayName,
      businessDeveloperId: null,
    });
    expect(reviewerCell(actor("BUSINESS_DEVELOPER", "孙浩鹏"))).toBe("孙浩鹏");
    expect(reviewerCell(actor("MEMBER", "李四"))).toBe("李四");
    expect(reviewerCell(actor("OWNER", null))).toBe("主账号");
    expect(reviewerCell(actor("DELETED_MEMBER", null))).toBe("已删除的账号");
    expect(reviewerCell(actor("UNKNOWN_HUMAN", null))).toBe("人工");
    expect(reviewerCell(actor("AGENT", null))).toBe("Agent");
    expect(reviewerCell(actor("SYSTEM", null))).toBe("系统");
    expect(reviewerCell(null)).toBe("—");
    expect(affiliateDetailCell(t, "zh", {}, "AFFILIATE_SAMPLE_REVIEWER")).toBe("—");
  });
});

describe("reviewer in the detail query", () => {
  const build = (entity: AffiliateDetailEntity, reviewer: string) =>
    buildAffiliateDetailInput({
      entity,
      shopIds: ["shop-1"],
      window: { basis: "APPLICATION_DATE", startDateGe: "2026-09-01", endDateLt: "2026-10-01" },
      filters: { ...EMPTY_AFFILIATE_DETAIL_FILTERS, reviewer },
    });

  it.each(["REVIEW", "FULFILLMENT"] as const)(
    "requests the reviewer dimension, shows its column and filters by key for %s",
    (entity) => {
      const input = build(entity, "HUMAN:user-1");
      expect(input.dimensions).toContain("AFFILIATE_SAMPLE_REVIEWER");
      expect(AFFILIATE_DETAIL_COLUMNS[entity]).toContain("AFFILIATE_SAMPLE_REVIEWER");
      expect(input.filters).toEqual([
        { dimension: "AFFILIATE_SAMPLE_REVIEWER", operator: "IN", values: ["HUMAN:user-1"] },
      ]);
    },
  );

  it("sends no reviewer filter for the default 全部", () => {
    expect(build("REVIEW", "").filters).toEqual([]);
    expect(build("FULFILLMENT", "").filters).toEqual([]);
  });

  it("filters decided Samples without a recorded reviewer by the filter-only UNRECORDED key", () => {
    expect(build("REVIEW", AFFILIATE_REVIEWER_UNRECORDED_KEY).filters).toEqual([
      { dimension: "AFFILIATE_SAMPLE_REVIEWER", operator: "IN", values: ["UNRECORDED"] },
    ]);
  });

  it("builds the dropdown: all, no record, then the backend options", () => {
    const options = affiliateReviewerSelectOptions(t, [
      {
        key: "HUMAN:user-1",
        actor: { kind: "BUSINESS_DEVELOPER", displayName: "孙浩鹏", businessDeveloperId: "bd-1" },
      },
      { key: "AGENT", actor: { kind: "AGENT", displayName: null, businessDeveloperId: null } },
      { key: "SYSTEM", actor: { kind: "SYSTEM", displayName: null, businessDeveloperId: null } },
    ]);
    expect(options).toEqual([
      { value: "", label: "全部" },
      { value: "UNRECORDED", label: "无记录" },
      { value: "HUMAN:user-1", label: "孙浩鹏" },
      { value: "AGENT", label: "Agent" },
      { value: "SYSTEM", label: "系统" },
    ]);
  });
});

describe("review action time in the detail query", () => {
  useTimeZone("Asia/Shanghai");

  const reviewWindow = {
    basis: "REVIEW_ACTION",
    reviewActionAtGe: "2026-10-29T16:00:00.000Z",
    reviewActionAtLt: "2026-10-30T16:00:00.000Z",
  } as const;

  it.each(["REVIEW", "FULFILLMENT"] as const)(
    "sends only the instants, requests the action time and shows its column for %s",
    (entity) => {
      const input = buildAffiliateDetailInput({
        entity,
        shopIds: ["shop-1"],
        window: reviewWindow,
        filters: EMPTY_AFFILIATE_DETAIL_FILTERS,
      });
      expect(input.reviewActionAtGe).toBe("2026-10-29T16:00:00.000Z");
      expect(input.reviewActionAtLt).toBe("2026-10-30T16:00:00.000Z");
      expect("startDateGe" in input).toBe(false);
      expect("endDateLt" in input).toBe(false);
      expect(input.dimensions).toContain("SAMPLE_REVIEW_ACTION_AT");
      const columns = AFFILIATE_DETAIL_COLUMNS[entity];
      expect(columns.indexOf("SAMPLE_REVIEW_ACTION_AT")).toBe(
        columns.indexOf("SAMPLE_DECISION_BUCKET") + 1,
      );
    },
  );

  it("requests the action time in application-date mode too, without instants", () => {
    const input = buildAffiliateDetailInput({
      entity: "REVIEW",
      shopIds: ["shop-1"],
      window: { basis: "APPLICATION_DATE", startDateGe: "2026-09-01", endDateLt: "2026-10-01" },
      filters: EMPTY_AFFILIATE_DETAIL_FILTERS,
    });
    expect(input.dimensions).toContain("SAMPLE_REVIEW_ACTION_AT");
    expect(input).toMatchObject({ startDateGe: "2026-09-01", endDateLt: "2026-10-01" });
    expect("reviewActionAtGe" in input).toBe(false);
    expect("reviewActionAtLt" in input).toBe(false);
  });

  it("renders the action time as device-local time and a missing one as a dash", () => {
    const cell = (value: unknown) =>
      affiliateDetailCell(t, "zh", { SAMPLE_REVIEW_ACTION_AT: value }, "SAMPLE_REVIEW_ACTION_AT");
    expect(cell("2026-10-30T08:15:42.123Z")).toBe("2026-10-30 16:15:42");
    expect(cell(null)).toBe("—");
    expect(affiliateDetailCell(t, "zh", {}, "SAMPLE_REVIEW_ACTION_AT")).toBe("—");
  });
});
