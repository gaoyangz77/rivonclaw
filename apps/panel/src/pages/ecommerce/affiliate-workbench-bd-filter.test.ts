import { describe, expect, it } from "vitest";
import {
  affiliateWorkbenchBdInput,
  affiliateWorkbenchBdOptions,
  AFFILIATE_WORKBENCH_MY_BD_VALUE,
} from "./affiliate-workbench-bd-filter.js";
import { AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE } from "../../components/ecommerce/AffiliateBusinessDeveloperSelect.js";
import i18n from "../../i18n/index.js";

const labels = { own: "Mine", all: "All", public: "Public" };
const developers = [
  { id: "a", displayName: "A" },
  { id: "b", displayName: "B" },
];
describe("single-scope workbench BD filter", () => {
  it("offers all, public, self and colleagues to BD staff in the manual workbench only", () => {
    expect(affiliateWorkbenchBdOptions(true, developers, labels, "MANUAL").map(option => option.value))
      .toEqual(["", AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE, "a", "b"]);
    expect(affiliateWorkbenchBdOptions(true, developers, labels, "AGENT").map(option => option.value))
      .toEqual([AFFILIATE_WORKBENCH_MY_BD_VALUE, AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE]);
  });
  it("offers only mine/public to BD staff, regardless of loaded developers", () => {
    expect(affiliateWorkbenchBdOptions(true, developers, labels)).toEqual([
      { value: AFFILIATE_WORKBENCH_MY_BD_VALUE, label: "Mine" },
      { value: AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE, label: "Public" },
    ]);
  });
  it("puts all above public in the manual workbench for both staff and supervisors", () => {
    for (const bdOnly of [true, false]) {
      expect(affiliateWorkbenchBdOptions(bdOnly, [...developers].reverse(), labels, "MANUAL"))
        .toEqual([
          { value: "", label: "All" },
          { value: AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE, label: "Public" },
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]);
    }
  });
  it("puts public first, then all and sorted developers for supervisors", () => {
    expect(
      affiliateWorkbenchBdOptions(false, developers, labels).map((option) => option.value),
    ).toEqual([AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE, "", "a", "b"]);
  });
  it("never passes UI sentinels as ObjectIds or combines public with a BD", () => {
    expect(affiliateWorkbenchBdInput(AFFILIATE_WORKBENCH_MY_BD_VALUE)).toEqual({
      businessDeveloperId: null,
    });
    expect(affiliateWorkbenchBdInput(AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE)).toEqual({
      businessDeveloperId: null,
      unassignedBusinessDeveloperOnly: true,
    });
    expect(affiliateWorkbenchBdInput("a")).toEqual({
      businessDeveloperId: "a",
    });
    expect(affiliateWorkbenchBdInput("")).toEqual({
      businessDeveloperId: null,
    });
  });
  it.each(["en", "zh", "de", "es", "fr", "id", "it", "th"])(
    "has explicit labels in %s",
    (language) => {
      for (const key of ["myCreatorsFilter", "publicCreatorsFilter"]) {
        expect(
          i18n.getResource(language, "translation", `ecommerce.affiliateWorkspace.${key}`),
        ).toBeTypeOf("string");
      }
    },
  );
});
