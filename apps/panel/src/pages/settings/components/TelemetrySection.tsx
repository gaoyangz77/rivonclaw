import { useTranslation } from "react-i18next";
import { TkSection, TkSwitch } from "../../../components/design-system/index.js";

interface TelemetrySectionProps {
  telemetryEnabled: boolean;
  saving: boolean;
  settingsReady: boolean;
  handleToggleTelemetry: (enabled: boolean) => void;
}

export function TelemetrySection({
  telemetryEnabled,
  saving,
  settingsReady,
  handleToggleTelemetry,
}: TelemetrySectionProps) {
  const { t } = useTranslation();

  return (
    <TkSection
      className="tk-settings-section settings-section-telemetry"
      data-tutorial-id="settings-telemetry"
      description={t("settings.telemetry.description")}
      headingLevel={2}
      title={t("settings.telemetry.title")}
      variant="framed"
    >
      <TkSwitch
        label={t("settings.telemetry.toggle")}
        checked={telemetryEnabled}
        onChange={handleToggleTelemetry}
        disabled={saving || !settingsReady}
      />

      <div className="tk-settings-details">
        <h4>{t("settings.telemetry.whatWeCollect")}</h4>
        <ul>
          <li>{t("settings.telemetry.collect.appLifecycle")}</li>
          <li>{t("settings.telemetry.collect.featureUsage")}</li>
          <li>{t("settings.telemetry.collect.errors")}</li>
          <li>{t("settings.telemetry.collect.runtime")}</li>
        </ul>

        <h4>{t("settings.telemetry.whatWeDontCollect")}</h4>
        <ul>
          <li>{t("settings.telemetry.dontCollect.conversations")}</li>
          <li>{t("settings.telemetry.dontCollect.apiKeys")}</li>
          <li>{t("settings.telemetry.dontCollect.customPrompts")}</li>
          <li>{t("settings.telemetry.dontCollect.personalInfo")}</li>
        </ul>
      </div>
    </TkSection>
  );
}
