import { useTranslation } from "react-i18next";
import type { Surface, RunProfile } from "../account-types.js";

interface SurfacesSectionProps {
  surfaces: Surface[];
  profiles: RunProfile[];
  surfaceError: string | null;
  resolveSystemName: (name: string, isSystem: boolean) => string;
  toolDisplayLabel: (toolId: string) => string;
  refreshingTools: boolean;
  onRefreshTools: () => void;
  onCreateSurface: () => void;
  onEditSurface: (s: Surface) => void;
  onDeleteSurface: (id: string) => void;
  onOpenPreset: () => void;
}

export function SurfacesSection({
  surfaces,
  profiles,
  surfaceError,
  resolveSystemName,
  toolDisplayLabel,
  refreshingTools,
  onRefreshTools,
  onCreateSurface,
  onEditSurface,
  onDeleteSurface,
  onOpenPreset,
}: SurfacesSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="section-card">
      <div className="acct-section-header">
        <div>
          <h3>{t("surfaces.surfacesTitle")}</h3>
          <p className="acct-section-desc">{t("surfaces.description")}</p>
        </div>
        <div className="td-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={onRefreshTools}
            disabled={refreshingTools}
          >
            {refreshingTools ? t("common.loading") : t("surfaces.refreshTools")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={onCreateSurface}>
            {t("surfaces.createSurface")}
          </button>
          {surfaces.length > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenPreset}
            >
              {t("surfaces.createFromPreset")}
            </button>
          )}
        </div>
      </div>

      {surfaceError && <div className="error-alert">{surfaceError}</div>}

      {surfaces.length === 0 ? (
        <div className="empty-cell">{t("surfaces.noSurfaces")}</div>
      ) : (
        <div className="acct-item-list">
          {surfaces.map((s) => {
            const isSystem = !s.userId;
            const isDefault = isSystem && s.id === "Default";
            const profileCount = profiles.filter((p) => p.surfaceId === s.id).length;
            return (
              <div key={s.id} className={`acct-item${isSystem ? " acct-item-system" : ""}`}>
                <div className="acct-item-title-row">
                  <span className="acct-item-name">{resolveSystemName(s.name, isSystem)}</span>
                  {isSystem && <span className="acct-badge-system">{t("surfaces.system")}</span>}
                  {isDefault && (
                    <span className="acct-badge-subtle">{t("surfaces.unrestricted")}</span>
                  )}
                  {!isSystem && (
                    <div className="acct-item-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => onEditSurface(s)}>
                        {t("surfaces.editSurface")}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDeleteSurface(s.id)}>
                        {t("surfaces.deleteSurface")}
                      </button>
                    </div>
                  )}
                </div>
                <div className="acct-item-meta">
                  {profileCount > 0 && (
                    <span>{profileCount} {t("surfaces.runProfilesTitle").toLowerCase()}</span>
                  )}
                  {!isDefault && s.allowedToolIds.length > 0 && (
                    <span>{t("surfaces.toolCount", { count: s.allowedToolIds.length })}</span>
                  )}
                </div>
                {!isDefault && s.allowedToolIds.length > 0 && (
                  <div className="acct-tool-chips">
                    {s.allowedToolIds.map((toolId) => (
                      <span key={toolId} className="acct-tool-chip">
                        {toolDisplayLabel(toolId)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
