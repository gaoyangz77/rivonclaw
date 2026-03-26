import { useTranslation } from "react-i18next";
import { Select } from "./Select.js";
import { usePanelStore } from "../../stores/index.js";

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
export function RunProfileSelector({ value, onChange, className }: RunProfileSelectorProps) {
  const { t } = useTranslation();
  const profiles = usePanelStore((s) => s.runProfiles);

  const options = [
    { value: "", label: t("runProfileSelector.allTools") },
    ...profiles.map((p) => ({
      value: p.id,
      label: p.userId === null
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
}
