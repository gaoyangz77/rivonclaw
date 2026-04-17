import { useTranslation } from "react-i18next";
import { Modal } from "./Modal.js";
import { updateTelemetrySetting, trackEvent } from "../../api/index.js";
import { useRuntimeStatus } from "../../store/RuntimeStatusProvider.js";

export function TelemetryConsentModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const runtimeStatus = useRuntimeStatus();

  function dismiss(enabled: boolean) {
    updateTelemetrySetting(enabled).catch(() => {});
    trackEvent("telemetry.toggled", { enabled });
    // Record consent via MST -> Desktop -> SQLite -> SSE patch back.
    // Best-effort: a backend failure shouldn't block the user; the modal
    // remains dismissed visually and will reappear next launch if unpersisted.
    runtimeStatus.appSettings.setTelemetryConsentShown().catch(() => {});
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("settings.telemetry.consent.title")}
      maxWidth={420}
    >
      <p className="consent-description">
        {t("settings.telemetry.consent.description")}
      </p>

      <div className="consent-info-box">
        <strong>{t("settings.telemetry.consent.collectLabel")}</strong>{" "}
        {t("settings.telemetry.consent.items")}
      </div>

      <div className="flex-row-end">
        <button
          onClick={() => dismiss(false)}
          className="btn-ghost"
        >
          {t("settings.telemetry.consent.disagree")}
        </button>
        <button
          onClick={() => dismiss(true)}
          className="btn btn-primary"
        >
          {t("settings.telemetry.consent.agree")}
        </button>
      </div>
    </Modal>
  );
}
