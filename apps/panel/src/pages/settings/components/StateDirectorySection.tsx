import { useTranslation } from "react-i18next";
import type { OpenClawStateDirInfo } from "../../../api/index.js";
import { TkBadge, TkButton, TkSection } from "../../../components/design-system/index.js";

interface StateDirectorySectionProps {
  dataDirInfo: OpenClawStateDirInfo;
  dataDirRestartNeeded: boolean;
  saving: boolean;
  isLoggedIn: boolean;
  uploading: boolean;
  handleChangeDataDir: () => void;
  handleResetDataDir: () => void;
  handleUpload: () => void;
}

export function StateDirectorySection({
  dataDirInfo,
  dataDirRestartNeeded,
  saving,
  isLoggedIn,
  uploading,
  handleChangeDataDir,
  handleResetDataDir,
  handleUpload,
}: StateDirectorySectionProps) {
  const { t } = useTranslation();

  return (
    <TkSection
      className="tk-settings-section settings-section-data-dir"
      data-tutorial-id="settings-data"
      headingLevel={2}
      title={t("settings.dataDir.title")}
      variant="framed"
    >
      <div className="tk-settings-field">
        <span className="tk-v1-label">{t("settings.dataDir.label")}</span>
        <div className="tk-settings-data-dir-display">
          <code>{dataDirInfo.override ?? dataDirInfo.effective}</code>
          <TkBadge tone={dataDirInfo.override ? "accent" : "neutral"}>
            {dataDirInfo.override ? t("settings.dataDir.custom") : t("settings.dataDir.default")}
          </TkBadge>
        </div>
        <div className="tk-v1-field-support">{t("settings.dataDir.hint")}</div>
      </div>

      <div className="tk-settings-actions">
        <TkButton variant="secondary" onClick={handleChangeDataDir} disabled={saving}>
          {t("settings.dataDir.change")}
        </TkButton>
        {dataDirInfo.override && (
          <TkButton variant="secondary" onClick={handleResetDataDir} disabled={saving}>
            {t("settings.dataDir.reset")}
          </TkButton>
        )}
      </div>

      {dataDirRestartNeeded && (
        <div className="tk-settings-notice">{t("settings.dataDir.restartNotice")}</div>
      )}

      {isLoggedIn && (
        <div className="tk-settings-separated-row">
          <div className="tk-settings-inline-heading">
            <span>{t("settings.logUpload.title")}</span>
            <TkButton variant="secondary" size="sm" onClick={handleUpload} loading={uploading}>
              {uploading ? t("settings.logUpload.uploading") : t("settings.logUpload.button")}
            </TkButton>
          </div>
          <div className="tk-v1-field-support">{t("settings.logUpload.description")}</div>
        </div>
      )}
    </TkSection>
  );
}
