import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { TkChoiceSelect } from "../design-system/index.js";
import type { SelectOption } from "../inputs/Select.js";

export const AFFILIATE_BUSINESS_DEVELOPER_ALL_VALUE = "";
export const AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE = "__UNASSIGNED__";

type BusinessDeveloperOptionSource = Pick<
  GQL.AffiliateBusinessDeveloper,
  "id" | "displayName" | "creatorDisplayName" | "archivedAt"
>;

interface BusinessDeveloperOptionLabels {
  all: string;
  unassigned: string;
  unassignedDescription: string;
  archived: string;
}

export function affiliateBusinessDeveloperSelectOptions({
  developers,
  purpose,
  includeAll,
  includeUnassigned,
  labels,
}: {
  developers: readonly BusinessDeveloperOptionSource[];
  purpose: "FILTER" | "ASSIGNMENT";
  includeAll: boolean;
  includeUnassigned: boolean;
  labels: BusinessDeveloperOptionLabels;
}): SelectOption[] {
  const options: SelectOption[] = [];
  if (includeAll) {
    options.push({ value: AFFILIATE_BUSINESS_DEVELOPER_ALL_VALUE, label: labels.all });
  }
  if (includeUnassigned) {
    options.push({
      value: AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE,
      label: labels.unassigned,
      description: labels.unassignedDescription,
    });
  }
  options.push(
    ...developers
      .filter((developer) => purpose === "FILTER" || !developer.archivedAt)
      .slice()
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map((developer) => ({
        value: developer.id,
        label: developer.displayName,
        searchTerms: developer.creatorDisplayName ? [developer.creatorDisplayName] : undefined,
        badge: developer.archivedAt ? labels.archived : undefined,
        badgeTone: developer.archivedAt ? ("neutral" as const) : undefined,
      })),
  );
  return options;
}

export function AffiliateBusinessDeveloperSelect({
  developers,
  value,
  onChange,
  purpose = "FILTER",
  includeAll = purpose === "FILTER",
  includeUnassigned = false,
  label,
  className,
  disabled,
}: {
  developers: readonly BusinessDeveloperOptionSource[];
  value: string;
  onChange: (value: string) => void;
  purpose?: "FILTER" | "ASSIGNMENT";
  includeAll?: boolean;
  includeUnassigned?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const options = affiliateBusinessDeveloperSelectOptions({
    developers,
    purpose,
    includeAll,
    includeUnassigned,
    labels: {
      all: t("ecommerce.affiliateWorkspace.allBusinessDevelopers"),
      unassigned: t("ecommerce.affiliateTeam.aiTeam"),
      unassignedDescription: t("ecommerce.affiliateTeam.aiTeamHint"),
      archived: t("ecommerce.affiliateTeam.archivedStatus"),
    },
  });

  return (
    <TkChoiceSelect
      label={label ?? t("ecommerce.affiliateWorkspace.businessDeveloperFilter")}
      value={value}
      onChange={onChange}
      options={options}
      searchable
      searchPlaceholder={t("ecommerce.affiliateWorkspace.businessDeveloperSearchPlaceholder")}
      className={className}
      disabled={disabled}
    />
  );
}
