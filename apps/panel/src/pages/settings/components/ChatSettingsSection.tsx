import { useTranslation } from "react-i18next";
import { TkSection, TkSwitch } from "../../../components/design-system/index.js";

interface ChatSettingsSectionProps {
  showAgentEvents: boolean;
  preserveToolEvents: boolean;
  collapseMessages: boolean;
  saving: boolean;
  settingsReady: boolean;
  handleToggleShowAgentEvents: (enabled: boolean) => void;
  handleTogglePreserveToolEvents: (enabled: boolean) => void;
  handleToggleCollapseMessages: (enabled: boolean) => void;
}

export function ChatSettingsSection({
  showAgentEvents,
  preserveToolEvents,
  collapseMessages,
  saving,
  settingsReady,
  handleToggleShowAgentEvents,
  handleTogglePreserveToolEvents,
  handleToggleCollapseMessages,
}: ChatSettingsSectionProps) {
  const { t } = useTranslation();

  return (
    <TkSection
      className="tk-settings-section settings-section-chat"
      data-tutorial-id="settings-chat"
      headingLevel={2}
      title={t("settings.chat.title")}
      variant="framed"
    >
      <div className="tk-settings-switch-list">
        <TkSwitch
          label={t("settings.chat.showAgentEvents")}
          description={t("settings.chat.showAgentEventsHint")}
          checked={showAgentEvents}
          onChange={handleToggleShowAgentEvents}
          disabled={saving || !settingsReady}
        />
        <TkSwitch
          label={t("settings.chat.preserveToolEvents")}
          description={t("settings.chat.preserveToolEventsHint")}
          checked={preserveToolEvents}
          onChange={handleTogglePreserveToolEvents}
          disabled={saving || !settingsReady}
        />
        <TkSwitch
          label={t("settings.chat.collapseMessages")}
          description={t("settings.chat.collapseMessagesHint")}
          checked={collapseMessages}
          onChange={handleToggleCollapseMessages}
          disabled={saving || !settingsReady}
        />
      </div>
    </TkSection>
  );
}
