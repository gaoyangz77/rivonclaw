import { useTranslation } from "react-i18next";

export function ModalityCheckboxGroup({
  inputModalities,
  setInputModalities,
}: {
  inputModalities: string[];
  setInputModalities: (v: string[]) => void;
}) {
  const { t } = useTranslation();

  function toggleModality(modality: string, checked: boolean) {
    if (!checked && inputModalities.length <= 1) return;
    setInputModalities(
      checked
        ? [...inputModalities, modality]
        : inputModalities.filter((m) => m !== modality),
    );
  }

  return (
    <div className="mb-sm">
      <div className="form-label text-secondary">{t("providers.modelCapabilities")}</div>
      <div className="form-checkbox-group">
        <label className="form-checkbox-row">
          <input
            type="checkbox"
            checked={inputModalities.includes("text")}
            onChange={(e) => toggleModality("text", e.target.checked)}
            className="checkbox-sm"
          />
          <span className="form-checkbox-label">{t("providers.modalityText")}</span>
        </label>
        <label className="form-checkbox-row">
          <input
            type="checkbox"
            checked={inputModalities.includes("image")}
            onChange={(e) => toggleModality("image", e.target.checked)}
            className="checkbox-sm"
          />
          <span className="form-checkbox-label">{t("providers.modalityImage")}</span>
        </label>
      </div>
      <small className="form-help-sm">{t("providers.modelCapabilitiesHelp")}</small>
    </div>
  );
}
