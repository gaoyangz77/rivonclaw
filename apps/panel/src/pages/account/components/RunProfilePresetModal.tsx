import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modals/Modal.js";
import { Select } from "../../../components/inputs/Select.js";
import type { RunProfile } from "../account-types.js";

interface RunProfilePresetModalProps {
  isOpen: boolean;
  profiles: RunProfile[];
  selectedPresetId: string;
  savingProfile: boolean;
  resolveSystemName: (name: string, isSystem: boolean) => string;
  surfaceNameById: Record<string, string>;
  onSelectedPresetIdChange: (id: string) => void;
  onCreateFromPreset: () => void;
  onClose: () => void;
}

export function RunProfilePresetModal({
  isOpen,
  profiles,
  selectedPresetId,
  savingProfile,
  resolveSystemName,
  surfaceNameById,
  onSelectedPresetIdChange,
  onCreateFromPreset,
  onClose,
}: RunProfilePresetModalProps) {
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
            options={profiles.map((p) => ({
              value: p.id,
              label: resolveSystemName(p.name, !p.userId),
              description: surfaceNameById[p.surfaceId] || p.surfaceId,
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
            disabled={!selectedPresetId || savingProfile}
          >
            {savingProfile ? t("common.loading") : t("common.add")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
