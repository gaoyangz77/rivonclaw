import { useTranslation } from "react-i18next";
import { ModuleIcon } from "../../../components/icons.js";

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
    <div className="section-card">
      <div className="acct-section-header">
        <div>
          <h3>{t("modules.title")}</h3>
          <p className="acct-section-desc">{t("modules.description")}</p>
        </div>
      </div>

      <div className="acct-item-list">
        <div className="module-card">
          <div className="module-card-icon">
            <ModuleIcon size={22} />
          </div>
          <div className="module-card-body">
            <span className="module-card-name">{t("modules.globalEcommerceSeller.name")}</span>
            <span className="module-card-desc">{t("modules.globalEcommerceSeller.description")}</span>
          </div>
          <div className="module-card-toggle">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={isEnrolled}
                disabled={moduleToggling}
                onChange={onToggle}
              />
              <span
                className={`toggle-track ${isEnrolled ? "toggle-track-on" : "toggle-track-off"} ${moduleToggling ? "toggle-track-disabled" : ""}`}
              >
                <span
                  className={`toggle-thumb ${isEnrolled ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                />
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
