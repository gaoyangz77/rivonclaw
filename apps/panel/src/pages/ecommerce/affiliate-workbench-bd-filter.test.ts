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
  it("offers only mine/public to BD staff, regardless of loaded developers", () => {
    expect(affiliateWorkbenchBdOptions(true, developers, labels)).toEqual([
      { value: AFFILIATE_WORKBENCH_MY_BD_VALUE, label: "Mine" },
      { value: AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE, label: "Public" },
    ]);
  });
  it("offers all, one developer or public to supervisors", () => {
    expect(
      affiliateWorkbenchBdOptions(false, developers, labels).map((option) => option.value),
    ).toEqual(["", "a", "b", AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE]);
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
