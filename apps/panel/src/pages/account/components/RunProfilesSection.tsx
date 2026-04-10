import { useTranslation } from "react-i18next";
import { Select } from "../../../components/inputs/Select.js";
import type { Surface, RunProfile } from "../account-types.js";

interface RunProfilesSectionProps {
  profiles: RunProfile[];
  surfaces: Surface[];
  profileError: string | null;
  defaultRunProfileId: string | null | undefined;
  resolveSystemName: (name: string, isSystem: boolean) => string;
  toolDisplayLabel: (toolId: string) => string;
  surfaceNameById: Record<string, string>;
  savingDefault: boolean;
  defaultProfileError: string | null;
  onDefaultProfileChange: (profileId: string) => void;
  onCreateProfile: () => void;
  onEditProfile: (p: RunProfile) => void;
  onDeleteProfile: (id: string) => void;
}

export function RunProfilesSection({
  profiles,
  surfaces,
  profileError,
  defaultRunProfileId,
  resolveSystemName,
  toolDisplayLabel,
  surfaceNameById,
  savingDefault,
  defaultProfileError,
  onDefaultProfileChange,
  onCreateProfile,
  onEditProfile,
  onDeleteProfile,
}: RunProfilesSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="section-card">
      <div className="acct-section-header">
        <div>
          <h3>{t("surfaces.runProfilesTitle")}</h3>
          <p className="acct-section-desc">{t("account.runProfilesDesc")}</p>
        </div>
        <div className="td-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={onCreateProfile}
            disabled={surfaces.length === 0}
          >
            {t("surfaces.createRunProfile")}
          </button>
        </div>
      </div>

      {profileError && <div className="error-alert">{profileError}</div>}

      {profiles.length > 0 && (
        <div className="acct-default-profile">
          <label className="form-label-block">{t("account.defaultRunProfile")}</label>
          <div className="form-hint">{t("account.defaultRunProfileHint")}</div>
          {defaultProfileError && <div className="error-alert">{defaultProfileError}</div>}
          <Select
            value={defaultRunProfileId ?? ""}
            onChange={onDefaultProfileChange}
            disabled={savingDefault}
            className="input-full"
            options={[
              { value: "", label: t("account.noDefault") },
              ...profiles.map((p) => ({
                value: p.id,
                label: resolveSystemName(p.name, !p.userId),
                description: surfaceNameById[p.surfaceId] || p.surfaceId,
              })),
            ]}
          />
        </div>
      )}

      {profiles.length === 0 ? (
        <div className="empty-cell">{t("surfaces.noRunProfiles")}</div>
      ) : (
        <div className="acct-item-list">
          {profiles.map((p) => {
            const isSystem = !p.userId;
            const surfName = surfaceNameById[p.surfaceId] || p.surfaceId;
            return (
              <div key={p.id} className={`acct-item${isSystem ? " acct-item-system" : ""}`}>
                <div className="acct-item-title-row">
                  <span className="acct-item-name">{resolveSystemName(p.name, isSystem)}</span>
                  {isSystem && <span className="acct-badge-system">{t("surfaces.system")}</span>}
                  {!isSystem && (
                    <div className="acct-item-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => onEditProfile(p)}>
                        {t("surfaces.editRunProfile")}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDeleteProfile(p.id)}>
                        {t("surfaces.deleteRunProfile")}
                      </button>
                    </div>
                  )}
                </div>
                <div className="acct-item-meta">
                  <span>{surfName}</span>
                  <span>{t("surfaces.toolCount", { count: p.selectedToolIds.length })}</span>
                </div>
                {p.selectedToolIds.length > 0 && (() => {
                  const parentSurface = surfaces.find((s) => s.id === p.surfaceId);
                  const restricted = parentSurface && parentSurface.allowedToolIds.length > 0;
                  const allowedSet = restricted ? new Set(parentSurface.allowedToolIds) : null;
                  return (
                    <div className="acct-tool-chips">
                      {p.selectedToolIds.map((toolId) => {
                        const outOfScope = allowedSet && !allowedSet.has(toolId);
                        return (
                          <span
                            key={toolId}
                            className={`acct-tool-chip${outOfScope ? " acct-tool-chip-warn" : ""}`}
                            title={outOfScope ? t("surfaces.toolOutOfScope") : undefined}
                          >
                            {toolDisplayLabel(toolId)}
                            {outOfScope && <span className="acct-tool-chip-icon">{"\u26A0"}</span>}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
