import { useTranslation } from "react-i18next";
import type { OpenClawStateDirInfo } from "../../../api/index.js";

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

export function StateDirectorySection({ dataDirInfo, dataDirRestartNeeded, saving, isLoggedIn, uploading, handleChangeDataDir, handleResetDataDir, handleUpload }: StateDirectorySectionProps) {
  const { t } = useTranslation();

  return (
    <div className="section-card">
      <h3>{t("settings.dataDir.title")}</h3>

      <div>
        <div className="settings-toggle-label settings-toggle-label-static">
          <span>{t("settings.dataDir.label")}</span>
        </div>
        <div className="data-dir-display">
          <code className="data-dir-path">{dataDirInfo.override ?? dataDirInfo.effective}</code>
          {dataDirInfo.override && <span className="badge">{t("settings.dataDir.custom")}</span>}
          {!dataDirInfo.override && <span className="badge badge-muted">{t("settings.dataDir.default")}</span>}
        </div>
        <div className="form-hint">
          {t("settings.dataDir.hint")}
        </div>
      </div>

      <div className="data-dir-actions">
        <button className="btn btn-secondary" onClick={handleChangeDataDir} disabled={saving}>
          {t("settings.dataDir.change")}
        </button>
        {dataDirInfo.override && (
          <button className="btn btn-secondary" onClick={handleResetDataDir} disabled={saving}>
            {t("settings.dataDir.reset")}
          </button>
        )}
      </div>

      {dataDirRestartNeeded && (
        <div className="data-dir-restart-notice">
          {t("settings.dataDir.restartNotice")}
        </div>
      )}

      {isLoggedIn && (
        <div>
          <div className="settings-toggle-label settings-toggle-label-static">
            <span>{t("settings.logUpload.title")}</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? t("settings.logUpload.uploading") : t("settings.logUpload.button")}
            </button>
          </div>
          <div className="form-hint">
            {t("settings.logUpload.description")}
          </div>
        </div>
      )}
    </div>
  );
}
