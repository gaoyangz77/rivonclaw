import { useTranslation } from "react-i18next";
import { Select } from "../../../components/inputs/Select.js";

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
    <div className="section-card settings-section-agent">
      <h3>{t("settings.agent.title")}</h3>

      <div>
        <label className="form-label-block">
          {t("settings.browser.mode")}
        </label>
        <Select
          value={browserMode}
          onChange={handleBrowserModeChange}
          options={[
            { value: "standalone", label: t("settings.browser.modeStandalone"), description: t("settings.browser.modeStandaloneDesc") },
            { value: "cdp", label: t("settings.browser.modeCdp"), description: t("settings.browser.modeCdpDesc") },
          ]}
          disabled={saving || !settingsReady}
        />
        <div className="form-hint">
          {t("settings.browser.modeHint")}
        </div>
      </div>
    </div>
  );
}
