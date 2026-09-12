import { useTranslation } from "react-i18next";
import { TkChoiceSelect } from "../../../components/design-system/index.js";
import "./AffiliateProtectionFilter.css";

export function workbenchProtectionValue(value: string): boolean | null {
  return value === "PROTECTED" ? true : value === "UNPROTECTED" ? false : null;
}

export function AffiliateProtectionFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <TkChoiceSelect
      className="affiliate-protection-filter"
      label={t("ecommerce.affiliateWorkspace.workbench.protectionFilter")}
      value={value}
      onChange={onChange}
      options={[
        { value: "ALL", label: t("ecommerce.affiliateWorkspace.workbench.chipAll") },
        {
          value: "PROTECTED",
          label: t("ecommerce.affiliateWorkspace.workbench.protectedCreators"),
        },
        {
          value: "UNPROTECTED",
          label: t("ecommerce.affiliateWorkspace.workbench.unprotectedCreators"),
        },
      ]}
    />
  );
}
