import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { Select } from "./Select.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { staffRunProfileChoices } from "../../lib/run-profile-selection.js";

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
 * Offers only the profiles staff may pick for their own sessions (see
 * `isStaffSelectableRunProfile`); a restricted current value stays visible,
 * marked, until the user switches away.
 * Empty selection means baseline tools only (system + extension).
 */
export const RunProfileSelector = observer(function RunProfileSelector({
  value,
  onChange,
  className,
}: RunProfileSelectorProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const profiles = entityStore.allRunProfiles;
  const choices = staffRunProfileChoices(profiles, value);

  const options = [
    { value: "", label: t("runProfileSelector.allTools") },
    ...choices.map(({ profile: p, selectable }) => ({
      value: p.id,
      label: !p.userId
        ? `${t(`surfaces.systemNames.${p.name}`, { defaultValue: p.name })} · ${t("surfaces.system")}`
        : p.name,
      ...(selectable
        ? {}
        : {
            badge: t("runProfileSelector.restrictedBadge"),
            badgeTone: "warning" as const,
            description: t("runProfileSelector.restrictedHint"),
          }),
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
