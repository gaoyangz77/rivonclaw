import { useTranslation } from "react-i18next";
import { TkChoiceSelect, TkSection } from "../../../components/design-system/index.js";

interface AgentSettingsSectionProps {
  saving: boolean;
  settingsReady: boolean;
  browserMode: "standalone" | "cdp";
  handleBrowserModeChange: (value: string) => void;
}

export function AgentSettingsSection({
  saving,
  settingsReady,
  browserMode,
  handleBrowserModeChange,
}: AgentSettingsSectionProps) {
  const { t } = useTranslation();

  return (
    <TkSection
      className="tk-settings-section settings-section-agent"
      data-tutorial-id="settings-agent"
      headingLevel={2}
      title={t("settings.agent.title")}
      variant="framed"
    >
      <TkChoiceSelect
        label={t("settings.browser.mode")}
        value={browserMode}
        onChange={handleBrowserModeChange}
        options={[
          {
            value: "standalone",
            label: t("settings.browser.modeStandalone"),
            description: t("settings.browser.modeStandaloneDesc"),
          },
          {
            value: "cdp",
            label: t("settings.browser.modeCdp"),
            description: t("settings.browser.modeCdpDesc"),
          },
        ]}
        hint={t("settings.browser.modeHint")}
        disabled={saving || !settingsReady}
      />
    </TkSection>
  );
}
