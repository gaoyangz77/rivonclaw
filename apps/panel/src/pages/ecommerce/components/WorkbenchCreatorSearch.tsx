import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TkButton, TkField } from "../../../components/design-system/index.js";
import "./WorkbenchCreatorSearch.css";

export function WorkbenchCreatorSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [searchDraft, setSearchDraft] = useState(value);
  return (
    <form
      className="workbench-creator-search"
      onSubmit={(event) => {
        event.preventDefault();
        onChange(searchDraft.trim());
      }}
    >
      <TkField
        className="workbench-creator-search-field"
        label={t("ecommerce.affiliateWorkspace.workbench.creatorSearch")}
        placeholder={t("ecommerce.affiliateWorkspace.workbench.creatorSearchPlaceholder")}
        type="search"
        maxLength={200}
        value={searchDraft}
        onChange={(event) => {
          setSearchDraft(event.target.value);
          if (!event.target.value) onChange("");
        }}
      />
      <TkButton type="submit" size="sm">
        {t("ecommerce.affiliateWorkspace.workbench.searchCreator")}
      </TkButton>
      {value && (
        <TkButton
          size="sm"
          variant="ghost"
          onClick={() => {
            setSearchDraft("");
            onChange("");
          }}
        >
          {t("ecommerce.affiliateWorkspace.workbench.clearCreatorSearch")}
        </TkButton>
      )}
    </form>
  );
}
