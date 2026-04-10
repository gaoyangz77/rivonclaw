import { useState } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { getUserInitial } from "../../lib/user-manager.js";
import { Modal } from "../../components/modals/Modal.js";
import { ConfirmDialog } from "../../components/modals/ConfirmDialog.js";
import { ToolMultiSelect } from "../../components/inputs/ToolMultiSelect.js";
import { Select } from "../../components/inputs/Select.js";
import { ModuleIcon } from "../../components/icons.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { useToolDisplayLabel } from "../../lib/tool-display.js";
import type { SnapshotIn } from "mobx-state-tree";
import { SurfaceModel, RunProfileModel } from "@rivonclaw/core/models";

type Surface = SnapshotIn<typeof SurfaceModel>;
type RunProfile = SnapshotIn<typeof RunProfileModel>;

/** Resolve a display name for system-provided surfaces/profiles via i18n. */
function useSystemName() {
  const { t } = useTranslation();
  return (name: string, isSystem: boolean) =>
    isSystem ? (t(`surfaces.systemNames.${name}`, { defaultValue: name }) as string) : name;
}

export const AccountPage = observer(function AccountPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useTranslation();
  const resolveSystemName = useSystemName();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;

  const allTools = entityStore.availableTools;

  const toolDisplayLabel = useToolDisplayLabel();

  const subscription = entityStore.subscriptionStatus;
  const llmQuota = entityStore.llmQuotaStatus;

  // Read surfaces and run-profiles from MST store (auto-synced via SSE)
  const surfaces = entityStore.allSurfaces;
  const profiles = entityStore.allRunProfiles;

  // ── Module toggle state ──
  const [moduleToggling, setModuleToggling] = useState(false);

  // ── Refresh tools state ──
  const [refreshingTools, setRefreshingTools] = useState(false);

  // ── Surface modal state ──
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [surfaceModalOpen, setSurfaceModalOpen] = useState(false);
  const [editingSurface, setEditingSurface] = useState<Surface | null>(null);
  const [surfaceName, setSurfaceName] = useState("");
  const [surfaceDescription, setSurfaceDescription] = useState("");
  const [surfaceToolIds, setSurfaceToolIds] = useState<Set<string>>(new Set());
  const [savingSurface, setSavingSurface] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");

  // ── Confirm dialog state ──
  const [confirmDeleteSurfaceId, setConfirmDeleteSurfaceId] = useState<string | null>(null);
  const [confirmDeleteProfileId, setConfirmDeleteProfileId] = useState<string | null>(null);

  // ── Run Profile modal state ──
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RunProfile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileToolIds, setProfileToolIds] = useState<Set<string>>(new Set());
  const [profileSurfaceId, setProfileSurfaceId] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Default RunProfile state ──
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultProfileError, setDefaultProfileError] = useState<string | null>(null);

  // ── Refresh tools handler ──
  async function handleRefreshTools() {
    setRefreshingTools(true);
    try {
      await entityStore.refreshToolSpecs();
    } finally {
      setRefreshingTools(false);
    }
  }

  // ── Surface handlers ──
  function openCreateSurface() {
    setEditingSurface(null);
    setSurfaceName("");
    setSurfaceDescription("");
    setSurfaceToolIds(new Set());
    setSurfaceModalOpen(true);
  }

  function openEditSurface(s: Surface) {
    setEditingSurface(s);
    setSurfaceName(s.name);
    setSurfaceDescription("");
    setSurfaceToolIds(new Set(s.allowedToolIds));
    setSurfaceModalOpen(true);
  }

  function closeSurfaceModal() {
    setSurfaceModalOpen(false);
    setEditingSurface(null);
  }

  async function handleSaveSurface() {
    if (!surfaceName.trim()) return;
    setSavingSurface(true);
    setSurfaceError(null);
    try {
      if (editingSurface) {
        const surface = entityStore.surfaces.find((s) => s.id === editingSurface.id);
        if (!surface) throw new Error(`Surface ${editingSurface.id} not found`);
        await surface.update({
          name: surfaceName.trim(),
          description: surfaceDescription.trim() || undefined,
          allowedToolIds: Array.from(surfaceToolIds),
          allowedCategories: [],
        });
      } else {
        await entityStore.createSurface({
          name: surfaceName.trim(),
          description: surfaceDescription.trim() || undefined,
          allowedToolIds: Array.from(surfaceToolIds),
          allowedCategories: [],
        });
      }
      closeSurfaceModal();
    } catch {
      setSurfaceError(t("surfaces.failedToSave"));
    } finally {
      setSavingSurface(false);
    }
  }

  function handleCreateFromPreset() {
    const source = surfaces.find((s) => s.id === selectedPresetId);
    if (!source) return;
    setPresetModalOpen(false);
    setSelectedPresetId("");
    setEditingSurface(null);
    setSurfaceName(`${source.name} ${t("surfaces.copySuffix")}`);
    setSurfaceDescription("");
    // System Default Surface -> pre-select all available tools
    const isSystemDefault = !source.userId && source.allowedToolIds.length === 0;
    const prefilledIds = isSystemDefault
      ? new Set(allTools.map((t) => t.id))
      : new Set(source.allowedToolIds);
    setSurfaceToolIds(prefilledIds);
    setSurfaceModalOpen(true);
  }

  async function handleDeleteSurface(id: string) {
    setConfirmDeleteSurfaceId(null);
    setSurfaceError(null);
    try {
      const surface = entityStore.surfaces.find((s) => s.id === id);
      if (!surface) throw new Error(`Surface ${id} not found`);
      await surface.delete();
    } catch {
      setSurfaceError(t("surfaces.failedToDelete"));
    }
  }

  // ── Run Profile handlers ──
  function openCreateProfile() {
    setEditingProfile(null);
    setProfileName("");
    setProfileToolIds(new Set());
    setProfileSurfaceId(surfaces[0]?.id ?? "");
    setProfileModalOpen(true);
  }

  function openEditProfile(p: RunProfile) {
    setEditingProfile(p);
    setProfileName(p.name);
    setProfileToolIds(new Set(p.selectedToolIds));
    setProfileSurfaceId(p.surfaceId ?? "");
    setProfileModalOpen(true);
  }

  function closeProfileModal() {
    setProfileModalOpen(false);
    setEditingProfile(null);
  }

  async function handleSaveProfile() {
    if (!profileName.trim() || !profileSurfaceId) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      if (editingProfile) {
        const profile = entityStore.runProfiles.find((p) => p.id === editingProfile.id);
        if (!profile) throw new Error(`RunProfile ${editingProfile.id} not found`);
        await profile.update({
          name: profileName.trim(),
          selectedToolIds: Array.from(profileToolIds),
        });
      } else {
        await entityStore.createRunProfile({
          name: profileName.trim(),
          selectedToolIds: Array.from(profileToolIds),
          surfaceId: profileSurfaceId,
        });
      }
      closeProfileModal();
    } catch {
      setProfileError(t("surfaces.failedToSaveProfile"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDeleteProfile(profileId: string) {
    setConfirmDeleteProfileId(null);
    setProfileError(null);
    try {
      const profile = entityStore.runProfiles.find((p) => p.id === profileId);
      if (!profile) throw new Error(`RunProfile ${profileId} not found`);
      await profile.delete();
      // If the deleted profile was the default, clear it
      if (user?.defaultRunProfileId === profileId) {
        await handleDefaultProfileChange("");
      }
    } catch {
      setProfileError(t("surfaces.failedToDeleteProfile"));
    }
  }

  async function handleDefaultProfileChange(profileId: string) {
    setSavingDefault(true);
    setDefaultProfileError(null);
    try {
      await entityStore.currentUser!.setDefaultRunProfile(profileId || null);
    } catch {
      setDefaultProfileError(t("surfaces.failedToSaveProfile"));
    } finally {
      setSavingDefault(false);
    }
  }

  function handleLogout() {
    entityStore.logout();
    onNavigate("/");
  }

  if (!user) {
    return (
      <div className="account-page page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  const initial = getUserInitial(user);

  const surfaceNameById: Record<string, string> = {};
  for (const s of surfaces) {
    surfaceNameById[s.id] = resolveSystemName(s.name, !s.userId);
  }

  return (
    <div className="account-page page-enter">

      {/* ── Profile & Subscription ── */}
      <div className="section-card account-profile-card">
        <div className="account-profile-header">
          <div className="account-profile-identity">
            <div className="account-avatar">{initial}</div>
            <div className="account-profile-name-group">
              {user.name && <span className="account-profile-name">{user.name}</span>}
              <span className="account-profile-email">{user.email}</span>
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            {t("auth.logout")}
          </button>
        </div>

        <div className="account-info-grid">
          <div className="account-info-item">
            <span className="account-info-label">{t("account.plan")}</span>
            <span className="account-info-value">
              <span className="acct-badge acct-badge-plan">{t(`subscription.${(subscription?.plan ?? user.plan).toLowerCase()}`)}</span>
            </span>
          </div>
          <div className="account-info-item">
            <span className="account-info-label">{t("account.memberSince")}</span>
            <span className="account-info-value">
              {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="account-info-item">
            <span className="account-info-label">{t("account.validUntil")}</span>
            <span className="account-info-value">
              {subscription ? new Date(subscription.validUntil).toLocaleDateString() : "—"}
            </span>
          </div>
          {llmQuota && (
            <>
              <div className="account-info-item account-info-item-wide quota-five-hour">
                <div className="quota-header">
                  <span className="account-info-label">{t("account.quotaFiveHour")}</span>
                  <span className="quota-refresh-time">
                    {t("account.quotaRefreshAt", { time: new Date(llmQuota.fiveHour.refreshAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
                  </span>
                </div>
                <div className="quota-bar-wrap">
                  <progress
                    className={`quota-bar${llmQuota.fiveHour.remainingPercent < 20 ? " quota-bar-low" : ""}`}
                    value={llmQuota.fiveHour.remainingPercent}
                    max={100}
                  />
                  <span className="quota-bar-label">{Math.round(llmQuota.fiveHour.remainingPercent)}%</span>
                </div>
              </div>
              <div className="account-info-item account-info-item-wide quota-weekly">
                <div className="quota-header">
                  <span className="account-info-label">{t("account.quotaWeekly")}</span>
                  <span className="quota-refresh-time">
                    {t("account.quotaRefreshAt", { time: new Date(llmQuota.weekly.refreshAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) })}
                  </span>
                </div>
                <div className="quota-bar-wrap">
                  <progress
                    className={`quota-bar${llmQuota.weekly.remainingPercent < 20 ? " quota-bar-low" : ""}`}
                    value={llmQuota.weekly.remainingPercent}
                    max={100}
                  />
                  <span className="quota-bar-label">{Math.round(llmQuota.weekly.remainingPercent)}%</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Surfaces ── */}
      <div className="section-card">
        <div className="acct-section-header">
          <div>
            <h3>{t("surfaces.surfacesTitle")}</h3>
            <p className="acct-section-desc">{t("surfaces.description")}</p>
          </div>
          <div className="td-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleRefreshTools}
              disabled={refreshingTools}
            >
              {refreshingTools ? t("common.loading") : t("surfaces.refreshTools")}
            </button>
            <button className="btn btn-primary btn-sm" onClick={openCreateSurface}>
              {t("surfaces.createSurface")}
            </button>
            {surfaces.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSelectedPresetId(""); setPresetModalOpen(true); }}
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
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditSurface(s)}>
                          {t("surfaces.editSurface")}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDeleteSurfaceId(s.id)}>
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

      {/* ── Run Profiles ── */}
      <div className="section-card">
        <div className="acct-section-header">
          <div>
            <h3>{t("surfaces.runProfilesTitle")}</h3>
            <p className="acct-section-desc">{t("account.runProfilesDesc")}</p>
          </div>
          <div className="td-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={openCreateProfile}
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
              value={user?.defaultRunProfileId ?? ""}
              onChange={handleDefaultProfileChange}
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
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditProfile(p)}>
                          {t("surfaces.editRunProfile")}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDeleteProfileId(p.id)}>
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
                              {outOfScope && <span className="acct-tool-chip-icon">⚠</span>}
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

      {/* ── Modules ── */}
      <div className="section-card">
        <div className="acct-section-header">
          <div>
            <h3>{t("modules.title")}</h3>
            <p className="acct-section-desc">{t("modules.description")}</p>
          </div>
        </div>

        <div className="acct-item-list">
          <div className="module-card">
            <div className="module-card-icon">
              <ModuleIcon size={22} />
            </div>
            <div className="module-card-body">
              <span className="module-card-name">{t("modules.globalEcommerceSeller.name")}</span>
              <span className="module-card-desc">{t("modules.globalEcommerceSeller.description")}</span>
            </div>
            <div className="module-card-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={entityStore.isModuleEnrolled("GLOBAL_ECOMMERCE_SELLER")}
                  disabled={moduleToggling}
                  onChange={async () => {
                    setModuleToggling(true);
                    try {
                      if (entityStore.isModuleEnrolled("GLOBAL_ECOMMERCE_SELLER")) {
                        await entityStore.currentUser!.unenrollModule("GLOBAL_ECOMMERCE_SELLER");
                      } else {
                        await entityStore.currentUser!.enrollModule("GLOBAL_ECOMMERCE_SELLER");
                      }
                    } catch {
                      // Error will surface via network layer
                    } finally {
                      setModuleToggling(false);
                    }
                  }}
                />
                <span
                  className={`toggle-track ${entityStore.isModuleEnrolled("GLOBAL_ECOMMERCE_SELLER") ? "toggle-track-on" : "toggle-track-off"} ${moduleToggling ? "toggle-track-disabled" : ""}`}
                >
                  <span
                    className={`toggle-thumb ${entityStore.isModuleEnrolled("GLOBAL_ECOMMERCE_SELLER") ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                  />
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Surface Modal ── */}
      <Modal
        isOpen={surfaceModalOpen}
        onClose={closeSurfaceModal}
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
              onChange={(e) => setSurfaceName(e.target.value)}
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
              onChange={(e) => setSurfaceDescription(e.target.value)}
              placeholder={t("surfaces.descriptionPlaceholder")}
              className="input-full"
            />
          </div>
          <div>
            <label className="form-label-block">
              {t("surfaces.allowedToolIds")}
            </label>
            <div className="form-hint">{t("surfaces.allowedToolIdsHint")}</div>
            <ToolMultiSelect selected={surfaceToolIds} onChange={setSurfaceToolIds} />
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
            <button className="btn btn-secondary" onClick={closeSurfaceModal}>
              {t("common.cancel")}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveSurface}
              disabled={!surfaceName.trim() || savingSurface}
            >
              {savingSurface ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Preset Modal ── */}
      <Modal
        isOpen={presetModalOpen}
        onClose={() => setPresetModalOpen(false)}
        title={t("surfaces.createFromPreset")}
      >
        <div className="modal-form-col">
          <div>
            <label className="form-label-block">
              {t("surfaces.presetLabel")}
            </label>
            <Select
              value={selectedPresetId}
              onChange={setSelectedPresetId}
              placeholder={t("surfaces.selectPreset")}
              className="input-full"
              options={surfaces.map((s) => ({
                value: s.id,
                label: resolveSystemName(s.name, !s.userId),
              }))}
            />
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setPresetModalOpen(false)}>
              {t("common.cancel")}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateFromPreset}
              disabled={!selectedPresetId || savingSurface}
            >
              {savingSurface ? t("common.loading") : t("common.add")}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Surface Confirm ── */}
      <ConfirmDialog
        isOpen={confirmDeleteSurfaceId !== null}
        title={t("surfaces.deleteSurface")}
        message={t("surfaces.confirmDeleteSurface")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => confirmDeleteSurfaceId && handleDeleteSurface(confirmDeleteSurfaceId)}
        onCancel={() => setConfirmDeleteSurfaceId(null)}
      />

      {/* ── Delete RunProfile Confirm ── */}
      <ConfirmDialog
        isOpen={confirmDeleteProfileId !== null}
        title={t("surfaces.deleteRunProfile")}
        message={t("surfaces.confirmDeleteRunProfile")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => confirmDeleteProfileId && handleDeleteProfile(confirmDeleteProfileId)}
        onCancel={() => setConfirmDeleteProfileId(null)}
      />

      {/* ── RunProfile Modal ── */}
      <Modal
        isOpen={profileModalOpen}
        onClose={closeProfileModal}
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
                onChange={setProfileSurfaceId}
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
              onChange={(e) => setProfileName(e.target.value)}
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
              onChange={setProfileToolIds}
              allowedToolIds={surfaces.find((s) => s.id === profileSurfaceId)?.allowedToolIds}
            />
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={closeProfileModal}>
              {t("common.cancel")}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveProfile}
              disabled={!profileName.trim() || !profileSurfaceId || savingProfile}
            >
              {savingProfile ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
});
