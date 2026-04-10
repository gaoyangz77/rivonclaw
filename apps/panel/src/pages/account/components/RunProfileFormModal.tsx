import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modals/Modal.js";
import { ToolMultiSelect } from "../../../components/inputs/ToolMultiSelect.js";
import { Select } from "../../../components/inputs/Select.js";
import type { Surface, RunProfile } from "../account-types.js";

interface RunProfileFormModalProps {
  isOpen: boolean;
  editingProfile: RunProfile | null;
  profileName: string;
  profileToolIds: Set<string>;
  profileSurfaceId: string;
  savingProfile: boolean;
  surfaces: Surface[];
  resolveSystemName: (name: string, isSystem: boolean) => string;
  onNameChange: (name: string) => void;
  onToolIdsChange: (toolIds: Set<string>) => void;
  onSurfaceIdChange: (surfaceId: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function RunProfileFormModal({
  isOpen,
  editingProfile,
  profileName,
  profileToolIds,
  profileSurfaceId,
  savingProfile,
  surfaces,
  resolveSystemName,
  onNameChange,
  onToolIdsChange,
  onSurfaceIdChange,
  onSave,
  onClose,
}: RunProfileFormModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingProfile ? t("surfaces.editRunProfile") : t("surfaces.createRunProfile")}
    >
      <div className="modal-form-col">
        {!editingProfile && (
          <div>
            <label className="form-label-block">
              {t("surfaces.surfacesTitle")}
            </label>
            <Select
              value={profileSurfaceId}
              onChange={onSurfaceIdChange}
              className="input-full"
              options={surfaces.map((s) => ({
                value: s.id,
                label: resolveSystemName(s.name, !s.userId),
              }))}
            />
          </div>
        )}
        <div>
          <label className="form-label-block">
            {t("surfaces.profileName")}
          </label>
          <input
            type="text"
            value={profileName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("surfaces.profileNamePlaceholder")}
            className="input-full"
          />
        </div>
        <div>
          <label className="form-label-block">
            {t("surfaces.selectedToolIds")}
          </label>
          <div className="form-hint">{t("surfaces.selectedToolIdsHint")}</div>
          <ToolMultiSelect
            selected={profileToolIds}
            onChange={onToolIdsChange}
            allowedToolIds={surfaces.find((s) => s.id === profileSurfaceId)?.allowedToolIds}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={!profileName.trim() || !profileSurfaceId || savingProfile}
          >
            {savingProfile ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
