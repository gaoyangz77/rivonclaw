import { useTranslation } from "react-i18next";
import { TkBadge, TkButton, TkSection } from "../../../components/design-system/index.js";

interface DependenciesSectionProps {
  depsInstalling: boolean;
  handleInstallDeps: () => void;
}

export function DependenciesSection({
  depsInstalling,
  handleInstallDeps,
}: DependenciesSectionProps) {
  const { t } = useTranslation();

  return (
    <TkSection
      className="tk-settings-section settings-section-deps"
      data-tutorial-id="settings-dependencies"
      description={t("settings.deps.description")}
      headingLevel={2}
      title={t("settings.deps.title")}
      variant="framed"
    >
      <div className="tk-settings-actions">
        <TkButton variant="primary" onClick={handleInstallDeps} loading={depsInstalling}>
          {t("settings.deps.installButton")}
        </TkButton>
        {depsInstalling && (
          <TkBadge tone="accent" dot>
            {t("settings.deps.statusRunning")}
          </TkBadge>
        )}
      </div>
    </TkSection>
  );
}
