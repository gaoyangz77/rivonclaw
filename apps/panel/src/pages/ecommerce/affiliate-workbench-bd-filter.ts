import { GQL } from "@rivonclaw/core";
import { AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE } from "../../components/ecommerce/AffiliateBusinessDeveloperSelect.js";

export const AFFILIATE_WORKBENCH_MY_BD_VALUE = "__MY_BD__";

/** The own sentinel is UI-only; Backend resolves the authenticated BD, never a client identity. */
export function affiliateWorkbenchBdInput(value: string) {
  return {
    businessDeveloperId:
      value &&
      value !== AFFILIATE_WORKBENCH_MY_BD_VALUE &&
      value !== AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE
        ? value
        : null,
    ...(value === AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE
      ? { unassignedBusinessDeveloperOnly: true }
      : {}),
  };
}

export function affiliateWorkbenchBdOptions(
  bdOnly: boolean,
  developers: readonly Pick<GQL.AffiliateBusinessDeveloper, "id" | "displayName">[],
  labels: { all: string; own: string; public: string },
) {
  return [
    ...(bdOnly
      ? [{ value: AFFILIATE_WORKBENCH_MY_BD_VALUE, label: labels.own }]
      : [
          { value: "", label: labels.all },
          ...developers
            .slice()
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .map((bd) => ({ value: bd.id, label: bd.displayName })),
        ]),
    { value: AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE, label: labels.public },
  ];
}
