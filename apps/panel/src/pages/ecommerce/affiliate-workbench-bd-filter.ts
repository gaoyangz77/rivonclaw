import { GQL } from "@rivonclaw/core";
import { AFFILIATE_BUSINESS_DEVELOPER_OWN_VALUE, AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE } from "../../components/ecommerce/AffiliateBusinessDeveloperSelect.js";

export const AFFILIATE_WORKBENCH_MY_BD_VALUE = AFFILIATE_BUSINESS_DEVELOPER_OWN_VALUE;

/**
 * Every Creator owned by some BD. Manual workbench only: the samples and messages
 * queries accept it, the Agent workbench's proposal and escalation queries do not.
 */
export const AFFILIATE_WORKBENCH_ASSIGNED_BD_VALUE = "__ASSIGNED_BD__";

/** The own sentinel is UI-only; Backend resolves the authenticated BD, never a client identity. */
export function affiliateWorkbenchBdInput(value: string) {
  return {
    businessDeveloperId:
      value &&
      value !== AFFILIATE_WORKBENCH_MY_BD_VALUE &&
      value !== AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE &&
      value !== AFFILIATE_WORKBENCH_ASSIGNED_BD_VALUE
        ? value
        : null,
    ...(value === AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE
      ? { unassignedBusinessDeveloperOnly: true }
      : {}),
    ...(value === AFFILIATE_WORKBENCH_ASSIGNED_BD_VALUE
      ? { assignedBusinessDeveloperOnly: true }
      : {}),
  };
}

export function affiliateWorkbenchBdOptions(
  bdOnly: boolean,
  developers: readonly Pick<GQL.AffiliateBusinessDeveloper, "id" | "displayName">[],
  labels: { all: string; own: string; public: string; assigned: string },
  kind: "AGENT" | "MANUAL" = "AGENT",
) {
  const publicOption = {
    value: AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE,
    label: labels.public,
  };
  if (bdOnly && kind === "AGENT") {
    return [{ value: AFFILIATE_WORKBENCH_MY_BD_VALUE, label: labels.own }, publicOption];
  }
  const allOption = { value: "", label: labels.all };
  // Supervisors only: the complement of the public pool, beside it.
  const assignedOption = { value: AFFILIATE_WORKBENCH_ASSIGNED_BD_VALUE, label: labels.assigned };
  return [
    ...(kind === "MANUAL"
      ? [allOption, publicOption, ...(bdOnly ? [] : [assignedOption])]
      : [publicOption, allOption]),
    ...developers
      .slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((bd) => ({ value: bd.id, label: bd.displayName })),
  ];
}
