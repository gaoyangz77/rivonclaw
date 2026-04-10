import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modals/Modal.js";
import { ToolMultiSelect } from "../../../components/inputs/ToolMultiSelect.js";
import type { Surface, RunProfile } from "../account-types.js";

interface SurfaceFormModalProps {
  isOpen: boolean;
  editingSurface: Surface | null;
  surfaceName: string;
  surfaceDescription: string;
  surfaceToolIds: Set<string>;
  savingSurface: boolean;
  profiles: RunProfile[];
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onToolIdsChange: (toolIds: Set<string>) => void;
  onSave: () => void;
  onClose: () => void;
}

export function SurfaceFormModal({
  isOpen,
  editingSurface,
  surfaceName,
  surfaceDescription,
  surfaceToolIds,
  savingSurface,
  profiles,
  onNameChange,
  onDescriptionChange,
  onToolIdsChange,
  onSave,
  onClose,
}: SurfaceFormModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSurface ? t("surfaces.editSurface") : t("surfaces.createSurface")}
    >
      <div className="modal-form-col">
        <div>
          <label className="form-label-block">
            {t("surfaces.name")}
          </label>
          <input
            type="text"
            value={surfaceName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("surfaces.namePlaceholder")}
            className="input-full"
          />
        </div>
        <div>
          <label className="form-label-block">
            {t("surfaces.descriptionLabel")}
          </label>
          <input
            type="text"
            value={surfaceDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={t("surfaces.descriptionPlaceholder")}
            className="input-full"
          />
        </div>
        <div>
          <label className="form-label-block">
            {t("surfaces.allowedToolIds")}
          </label>
          <div className="form-hint">{t("surfaces.allowedToolIdsHint")}</div>
          <ToolMultiSelect selected={surfaceToolIds} onChange={onToolIdsChange} />
        </div>

        {editingSurface && (() => {
          const currentAllowed = surfaceToolIds;
          const childProfiles = profiles.filter((p) => p.surfaceId === editingSurface.id);
          const affectedProfiles = childProfiles.filter((p) =>
            p.selectedToolIds.some((tid) => currentAllowed.size > 0 && !currentAllowed.has(tid)),
          );
          if (affectedProfiles.length === 0) return null;
          return (
            <div className="form-warning">
              {t("surfaces.surfaceNarrowWarning", { count: affectedProfiles.length })}
              <ul className="form-warning-list">
                {affectedProfiles.map((p) => <li key={p.id}>{p.name}</li>)}
              </ul>
            </div>
          );
        })()}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={!surfaceName.trim() || savingSurface}
          >
            {savingSurface ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
