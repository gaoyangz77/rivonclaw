import { useTranslation } from "react-i18next";
import { ModuleIcon } from "../../../components/icons.js";
import {
  TkPanel,
  TkPanelBody,
  TkPanelHeader,
  TkSwitchControl,
} from "../../../components/design-system/index.js";

interface ModulesSectionProps {
  isEnrolled: boolean;
  moduleToggling: boolean;
  onToggle: () => void;
}

export function ModulesSection({
  isEnrolled,
  moduleToggling,
  onToggle,
}: ModulesSectionProps) {
  const { t } = useTranslation();

  return (
    <TkPanel as="section" padding="none" clip className="section-card">
      <TkPanelHeader title={t("modules.title")} description={t("modules.description")} />

      <TkPanelBody className="acct-section-body">
        <div className="acct-item-list">
          <div className="module-card">
            <div className="module-card-icon">
              <ModuleIcon size={22} />
            </div>
            <div className="module-card-body">
              <span className="module-card-name">{t("modules.globalEcommerceSeller.name")}</span>
              <span className="module-card-desc">
                {t("modules.globalEcommerceSeller.description")}
              </span>
            </div>
            <div className="module-card-toggle">
              <TkSwitchControl
                label={t("modules.globalEcommerceSeller.name")}
                checked={isEnrolled}
                disabled={moduleToggling}
                onChange={onToggle}
              />
            </div>
          </div>
        </div>
      </TkPanelBody>
    </TkPanel>
  );
}
