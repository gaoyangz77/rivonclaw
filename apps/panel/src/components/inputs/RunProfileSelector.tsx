import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { Select } from "./Select.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";

interface RunProfileSelectorProps {
  /** Currently selected RunProfile ID (empty string = default / baseline) */
  value: string;
  /** Called when selection changes */
  onChange: (runProfileId: string) => void;
  /** Optional CSS class for the wrapper */
  className?: string;
}

/**
 * Dropdown selector for RunProfiles.
 * Shows all available RunProfiles (system + user).
 * Empty selection means baseline tools only (system + extension).
 */
export const RunProfileSelector = observer(function RunProfileSelector({ value, onChange, className }: RunProfileSelectorProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const profiles = entityStore.allRunProfiles;

  const options = [
    { value: "", label: t("runProfileSelector.allTools") },
    ...profiles.map((p) => ({
      value: p.id,
      label: !p.userId
        ? `${t(`surfaces.systemNames.${p.name}`, { defaultValue: p.name })} · ${t("surfaces.system")}`
        : p.name,
    })),
  ];

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={t("runProfileSelector.placeholder")}
      className={className}
    />
  );
});
