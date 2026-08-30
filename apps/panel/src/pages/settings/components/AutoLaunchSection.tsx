import { useTranslation } from "react-i18next";
import { TkSection, TkSwitch } from "../../../components/design-system/index.js";

interface AutoLaunchSectionProps {
  autoLaunchEnabled: boolean;
  saving: boolean;
  settingsReady: boolean;
  handleToggleAutoLaunch: (enabled: boolean) => void;
}

export function AutoLaunchSection({
  autoLaunchEnabled,
  saving,
  settingsReady,
  handleToggleAutoLaunch,
}: AutoLaunchSectionProps) {
  const { t } = useTranslation();

  return (
    <TkSection
      className="tk-settings-section settings-section-auto-launch"
      data-tutorial-id="settings-auto-launch"
      headingLevel={2}
      title={t("settings.autoLaunch.title")}
      variant="framed"
    >
      <TkSwitch
        label={t("settings.autoLaunch.toggle")}
        description={t("settings.autoLaunch.hint") || undefined}
        checked={autoLaunchEnabled}
        onChange={handleToggleAutoLaunch}
        disabled={saving || !settingsReady}
      />
    </TkSection>
  );
}
