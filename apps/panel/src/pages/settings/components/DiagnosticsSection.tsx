import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { TkBadge, TkButton, TkSection } from "../../../components/design-system/index.js";
import type { DoctorStatus } from "../settings-types.js";

interface DiagnosticsSectionProps {
  doctorStatus: DoctorStatus;
  doctorOutput: string[];
  doctorExitCode: number | null;
  doctorOutputRef: RefObject<HTMLPreElement | null>;
  runDoctor: (fix: boolean) => void;
}

export function DiagnosticsSection({
  doctorStatus,
  doctorOutput,
  doctorExitCode,
  doctorOutputRef,
  runDoctor,
}: DiagnosticsSectionProps) {
  const { t } = useTranslation();

  return (
    <TkSection
      className="tk-settings-section settings-section-diagnostics"
      data-tutorial-id="settings-diagnostics"
      description={t("settings.diagnostics.description")}
      headingLevel={2}
      title={t("settings.diagnostics.title")}
      variant="framed"
    >
      {doctorOutput.length > 0 && (
        <pre ref={doctorOutputRef} className="tk-settings-doctor-output">
          {doctorOutput.join("\n")}
        </pre>
      )}

      <div className="tk-settings-actions">
        <TkButton
          variant="primary"
          onClick={() => runDoctor(false)}
          loading={doctorStatus === "running"}
        >
          {t("settings.diagnostics.runButton")}
        </TkButton>
        <TkButton
          variant="secondary"
          onClick={() => runDoctor(true)}
          disabled={doctorStatus === "running"}
        >
          {t("settings.diagnostics.fixButton")}
        </TkButton>
        {doctorStatus === "running" && (
          <TkBadge tone="accent" dot>
            {t("settings.diagnostics.statusRunning")}
          </TkBadge>
        )}
        {doctorStatus === "done" && (
          <TkBadge tone="success" dot>
            {t("settings.diagnostics.statusDone")}
            {doctorExitCode !== null &&
              ` (${t("settings.diagnostics.statusExitCode", { code: doctorExitCode })})`}
          </TkBadge>
        )}
        {doctorStatus === "error" && (
          <TkBadge tone="danger" dot>
            {t("settings.diagnostics.statusError")}
            {doctorExitCode !== null &&
              ` (${t("settings.diagnostics.statusExitCode", { code: doctorExitCode })})`}
          </TkBadge>
        )}
      </div>
    </TkSection>
  );
}
