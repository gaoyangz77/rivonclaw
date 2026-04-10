import { useTranslation } from "react-i18next";
import { DEFAULTS } from "@rivonclaw/core";
import type { BrowserProfileFormState } from "../browser-profile-types.js";

interface BrowserProfileFormModalProps {
  editingId: string | null;
  form: BrowserProfileFormState;
  formError: string | null;
  saving: boolean;
  mouseDownOnBackdrop: React.MutableRefObject<boolean>;
  onUpdateField: <K extends keyof BrowserProfileFormState>(key: K, value: BrowserProfileFormState[K]) => void;
  onSave: () => void;
  onClose: () => void;
}

export function BrowserProfileFormModal({
  editingId,
  form,
  formError,
  saving,
  mouseDownOnBackdrop,
  onUpdateField,
  onSave,
  onClose,
}: BrowserProfileFormModalProps) {
  const { t } = useTranslation();
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownOnBackdrop.current) onClose();
        mouseDownOnBackdrop.current = false;
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            {editingId
              ? t("browserProfiles.editTitle")
              : t("browserProfiles.createTitle")}
          </h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            type="button"
          >
            &times;
          </button>
        </div>

        <div className="form-group">
          <label className="form-label-block">
            {t("browserProfiles.fieldName")} *
          </label>
          <input
            className="input-full"
            type="text"
            value={form.name}
            onChange={(e) => onUpdateField("name", e.target.value)}
            placeholder={t("browserProfiles.fieldNamePlaceholder")}
          />
        </div>

        <div className="form-group">
          <label className="bp-checkbox-label">
            <input
              type="checkbox"
              checked={form.proxyEnabled}
              onChange={(e) => onUpdateField("proxyEnabled", e.target.checked)}
            />
            <span>{t("browserProfiles.fieldProxyEnabled")}</span>
          </label>
        </div>

        {form.proxyEnabled && (
          <div className="form-group">
            <label className="form-label-block">
              {t("browserProfiles.fieldProxyBaseUrl")}
            </label>
            <input
              className="input-full"
              type="text"
              value={form.proxyBaseUrl}
              onChange={(e) => onUpdateField("proxyBaseUrl", e.target.value)}
              placeholder="https://proxy.example.com:8080"
            />
            <div className="form-hint">
              {t("browserProfiles.proxyUrlHint")}
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label-block">
            {t("browserProfiles.fieldTags")}
          </label>
          <input
            className="input-full"
            type="text"
            value={form.tags}
            onChange={(e) => onUpdateField("tags", e.target.value)}
            placeholder={t("browserProfiles.fieldTagsPlaceholder")}
          />
          <div className="form-hint">
            {t("browserProfiles.tagsHint")}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label-block">
            {t("browserProfiles.fieldNotes")}
          </label>
          <textarea
            className="input-full bp-notes-textarea"
            value={form.notes}
            onChange={(e) => onUpdateField("notes", e.target.value)}
            placeholder={t("browserProfiles.fieldNotesPlaceholder")}
          />
        </div>

        {editingId && (
          <div className="form-group">
            <label className="form-label-block">
              {t("browserProfiles.fieldStatus")}
            </label>
            <select
              className="input-full"
              value={form.status}
              onChange={(e) => onUpdateField("status", e.target.value)}
            >
              <option value="active">
                {t("browserProfiles.status_active")}
              </option>
              <option value="disabled">
                {t("browserProfiles.status_disabled")}
              </option>
              <option value="archived">
                {t("browserProfiles.status_archived")}
              </option>
            </select>
          </div>
        )}

        {/* Session State Policy */}
        {(
          <div className="form-group">
            <h4>{t("browserProfiles.sessionStateTitle")}</h4>

            <label className="bp-checkbox-label">
              <input
                type="checkbox"
                checked={form.sessionEnabled}
                onChange={(e) => onUpdateField("sessionEnabled", e.target.checked)}
              />
              <span>{t("browserProfiles.sessionStateEnabled")}</span>
            </label>
            <div className="form-hint">
              {t("browserProfiles.sessionStateEnabledHint")}
            </div>

            {form.sessionEnabled && (
              <>
                <label className="form-label-block">
                  {t("browserProfiles.sessionStateStorage")}
                </label>
                <select
                  className="input-full"
                  value={form.sessionStorage}
                  onChange={(e) => onUpdateField("sessionStorage", e.target.value as "local" | "cloud")}
                >
                  <option value="local">{t("browserProfiles.sessionStorageLocal")}</option>
                  <option value="cloud">{t("browserProfiles.sessionStorageCloud")}</option>
                </select>
                <div className="form-hint">
                  {t("browserProfiles.sessionStorageHint")}
                </div>

                <label className="form-label-block">
                  {t("browserProfiles.sessionStateInterval")}
                </label>
                <input
                  className="input-full"
                  type="number"
                  min={30}
                  max={3600}
                  value={form.sessionCheckpointIntervalSec}
                  onChange={(e) => onUpdateField("sessionCheckpointIntervalSec", Number(e.target.value) || DEFAULTS.browserProfiles.defaultCheckpointIntervalSec)}
                />
                <div className="form-hint">
                  {t("browserProfiles.sessionStateIntervalHint")}
                </div>
              </>
            )}
          </div>
        )}

        {formError && <div className="error-alert">{formError}</div>}

        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            type="button"
          >
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving}
            type="button"
          >
            {saving ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
