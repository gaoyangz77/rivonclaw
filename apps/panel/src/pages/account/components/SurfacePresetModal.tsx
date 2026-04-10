import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modals/Modal.js";
import { Select } from "../../../components/inputs/Select.js";
import type { Surface } from "../account-types.js";

interface SurfacePresetModalProps {
  isOpen: boolean;
  surfaces: Surface[];
  selectedPresetId: string;
  savingSurface: boolean;
  resolveSystemName: (name: string, isSystem: boolean) => string;
  onSelectedPresetIdChange: (id: string) => void;
  onCreateFromPreset: () => void;
  onClose: () => void;
}

export function SurfacePresetModal({
  isOpen,
  surfaces,
  selectedPresetId,
  savingSurface,
  resolveSystemName,
  onSelectedPresetIdChange,
  onCreateFromPreset,
  onClose,
}: SurfacePresetModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("surfaces.createFromPreset")}
    >
      <div className="modal-form-col">
        <div>
          <label className="form-label-block">
            {t("surfaces.presetLabel")}
          </label>
          <Select
            value={selectedPresetId}
            onChange={onSelectedPresetIdChange}
            placeholder={t("surfaces.selectPreset")}
            className="input-full"
            options={surfaces.map((s) => ({
              value: s.id,
              label: resolveSystemName(s.name, !s.userId),
            }))}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            onClick={onCreateFromPreset}
            disabled={!selectedPresetId || savingSurface}
          >
            {savingSurface ? t("common.loading") : t("common.add")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
