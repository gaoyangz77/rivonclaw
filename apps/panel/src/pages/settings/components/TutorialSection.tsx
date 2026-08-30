import { useTranslation } from "react-i18next";
import { TkSection, TkSwitch } from "../../../components/design-system/index.js";

interface TutorialSectionProps {
  tutorialEnabled: boolean;
  handleToggleTutorial: (enabled: boolean) => void;
}

export function TutorialSection({ tutorialEnabled, handleToggleTutorial }: TutorialSectionProps) {
  const { t } = useTranslation();

  return (
    <TkSection
      className="tk-settings-section settings-section-tutorial"
      data-tutorial-id="settings-tutorial"
      headingLevel={2}
      title={t("tutorial.settings.toggle")}
      variant="framed"
    >
      <TkSwitch
        label={t("tutorial.settings.toggle")}
        description={t("tutorial.settings.hint")}
        checked={tutorialEnabled}
        onChange={handleToggleTutorial}
      />
    </TkSection>
  );
}
