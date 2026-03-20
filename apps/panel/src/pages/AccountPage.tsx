import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import { useAuth } from "../providers/AuthProvider.js";
import { SUBSCRIPTION_STATUS_QUERY } from "../api/auth-queries.js";
import { getUserInitial } from "../lib/user-manager.js";
import {
  fetchSurfaces,
  fetchSurfacePresets,
  createSurface,
  createSurfaceFromPreset,
  updateSurface,
  deleteSurface,
} from "../api/surfaces.js";
import type { Surface, SurfacePreset } from "../api/surfaces.js";
import {
  fetchRunProfiles,
  createRunProfile,
  updateRunProfile,
  deleteRunProfile,
} from "../api/run-profiles.js";
import type { RunProfile } from "../api/run-profiles.js";

function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function AccountPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const { data: subData } = useQuery<{
    subscriptionStatus: GQL.UserSubscription | null;
  }>(SUBSCRIPTION_STATUS_QUERY, { skip: !user });

  const subscription = subData?.subscriptionStatus;

  // ── Surface state ──
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [presets, setPresets] = useState<SurfacePreset[]>([]);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSurface, setEditingSurface] = useState<Surface | null>(null);
  const [surfaceName, setSurfaceName] = useState("");
  const [surfaceDescription, setSurfaceDescription] = useState("");
  const [surfaceToolIds, setSurfaceToolIds] = useState("");
  const [surfaceCategories, setSurfaceCategories] = useState("");
  const [savingSurface, setSavingSurface] = useState(false);
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");

  // ── Run Profile state ──
  const [profiles, setProfiles] = useState<RunProfile[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RunProfile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileToolIds, setProfileToolIds] = useState("");
  const [profileSurfaceId, setProfileSurfaceId] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadSurfaces();
    loadPresets();
    loadProfiles();
  }, [user]);

  async function loadSurfaces() {
    try {
      const list = await fetchSurfaces();
      setSurfaces(list);
      setSurfaceError(null);
    } catch {
      setSurfaceError(t("surfaces.failedToLoad"));
    }
  }

  async function loadPresets() {
    try {
      const list = await fetchSurfacePresets();
      setPresets(list);
    } catch {
      // Presets are optional
    }
  }

  async function loadProfiles() {
    try {
      const list = await fetchRunProfiles();
      setProfiles(list);
      setProfileError(null);
    } catch {
      setProfileError(t("surfaces.failedToLoadProfiles"));
    }
  }

  // ── Surface handlers ──
  function resetSurfaceForm() {
    setShowCreateForm(false);
    setEditingSurface(null);
    setSurfaceName("");
    setSurfaceDescription("");
    setSurfaceToolIds("");
    setSurfaceCategories("");
  }

  function startEditSurface(s: Surface) {
    setEditingSurface(s);
    setSurfaceName(s.name);
    setSurfaceDescription(s.description || "");
    setSurfaceToolIds(s.allowedToolIds.join(", "));
    setSurfaceCategories(s.allowedCategories.join(", "));
    setShowCreateForm(true);
    setShowPresetForm(false);
  }

  async function handleSaveSurface() {
    if (!surfaceName.trim()) return;
    setSavingSurface(true);
    setSurfaceError(null);
    try {
      if (editingSurface) {
        await updateSurface(editingSurface.id, {
          name: surfaceName.trim(),
          description: surfaceDescription.trim() || undefined,
          allowedToolIds: parseCommaSeparated(surfaceToolIds),
          allowedCategories: parseCommaSeparated(surfaceCategories),
        });
      } else {
        await createSurface({
          name: surfaceName.trim(),
          description: surfaceDescription.trim() || undefined,
          allowedToolIds: parseCommaSeparated(surfaceToolIds),
          allowedCategories: parseCommaSeparated(surfaceCategories),
        });
      }
      resetSurfaceForm();
      await loadSurfaces();
    } catch {
      setSurfaceError(t("surfaces.failedToSave"));
    } finally {
      setSavingSurface(false);
    }
  }

  async function handleCreateFromPreset() {
    if (!selectedPresetId) return;
    setSavingSurface(true);
    setSurfaceError(null);
    try {
      await createSurfaceFromPreset(selectedPresetId);
      setShowPresetForm(false);
      setSelectedPresetId("");
      await loadSurfaces();
    } catch {
      setSurfaceError(t("surfaces.failedToSave"));
    } finally {
      setSavingSurface(false);
    }
  }

  async function handleDeleteSurface(id: string) {
    if (!window.confirm(t("surfaces.confirmDeleteSurface"))) return;
    setSurfaceError(null);
    try {
      await deleteSurface(id);
      await loadSurfaces();
      await loadProfiles();
    } catch {
      setSurfaceError(t("surfaces.failedToDelete"));
    }
  }

  // ── Run Profile handlers ──
  function resetProfileForm() {
    setShowProfileForm(false);
    setEditingProfile(null);
    setProfileName("");
    setProfileToolIds("");
    setProfileSurfaceId("");
  }

  function startEditProfile(p: RunProfile) {
    setEditingProfile(p);
    setProfileName(p.name);
    setProfileToolIds(p.selectedToolIds.join(", "));
    setProfileSurfaceId(p.surfaceId);
    setShowProfileForm(true);
  }

  async function handleSaveProfile() {
    if (!profileName.trim() || !profileSurfaceId) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      if (editingProfile) {
        await updateRunProfile(editingProfile.id, {
          name: profileName.trim(),
          selectedToolIds: parseCommaSeparated(profileToolIds),
        });
      } else {
        await createRunProfile({
          name: profileName.trim(),
          selectedToolIds: parseCommaSeparated(profileToolIds),
          surfaceId: profileSurfaceId,
        });
      }
      resetProfileForm();
      await loadProfiles();
    } catch {
      setProfileError(t("surfaces.failedToSaveProfile"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDeleteProfile(profileId: string) {
    if (!window.confirm(t("surfaces.confirmDeleteRunProfile"))) return;
    setProfileError(null);
    try {
      await deleteRunProfile(profileId);
      await loadProfiles();
    } catch {
      setProfileError(t("surfaces.failedToDeleteProfile"));
    }
  }

  function handleLogout() {
    logout();
    onNavigate("/");
  }

  if (!user) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  const initial = getUserInitial(user);
  const seatsUsed = subscription?.seatsUsed ?? 0;
  const seatsMax = subscription?.seatsMax ?? 1;
  const seatsPct = Math.round((seatsUsed / seatsMax) * 100);

  // Build a lookup from surface id to name for the profiles card
  const surfaceNameById: Record<string, string> = {};
  for (const s of surfaces) {
    surfaceNameById[s.id] = s.name;
  }

  // Group profiles by surface name for display
  const profilesBySurface: Record<string, RunProfile[]> = {};
  for (const p of profiles) {
    const groupName = surfaceNameById[p.surfaceId] || p.surfaceId;
    if (!profilesBySurface[groupName]) profilesBySurface[groupName] = [];
    profilesBySurface[groupName].push(p);
  }
  const profileGroupNames = Object.keys(profilesBySurface).sort();

  // User surfaces only (for the "create profile" surface selector)
  const userSurfaces = surfaces.filter((s) => s.userId !== null);

  return (
    <div className="page-enter">
      <h1>{t("account.title")}</h1>
      <p className="page-description">{t("account.description")}</p>

      {/* ── Card 1: Profile ── */}
      <div className="section-card">
        <h3>{t("account.profile")}</h3>

        <div className="acct-profile-row">
          <div className="acct-avatar">{initial}</div>
          <div className="acct-profile-info">
            {user.name && <span className="acct-name">{user.name}</span>}
            <span className="acct-email">{user.email}</span>
            <span className="acct-member-since">
              {t("account.memberSince")}: {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            {t("auth.logout")}
          </button>
        </div>
      </div>

      {/* ── Card 2: Subscription ── */}
      <div className="section-card">
        <h3>{t("account.subscription")}</h3>

        <div className="settings-toggle-card">
          <div className="settings-toggle-label settings-toggle-label-static">
            <span>{t("account.plan")}</span>
            <span className="acct-badge acct-badge-plan">{subscription?.plan ?? user.plan}</span>
          </div>
        </div>

        <div className="settings-toggle-card">
          <div className="settings-toggle-label settings-toggle-label-static">
            <span>{t("account.validUntil")}</span>
            <span>
              {subscription
                ? new Date(subscription.validUntil).toLocaleDateString()
                : "—"}
            </span>
          </div>
        </div>

        {/* Seats progress */}
        {subscription && (
          <div className="acct-seats">
            <div className="settings-toggle-label settings-toggle-label-static">
              <span>{t("account.seats")}</span>
              <span>{seatsUsed} / {seatsMax}</span>
            </div>
            <div className="acct-seats-track">
              <div className="acct-seats-fill" style={{ width: `${seatsPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Card 3: Surfaces ── */}
      <div className="section-card">
        <h3>{t("surfaces.surfacesTitle")}</h3>

        {surfaceError && <div className="error-alert">{surfaceError}</div>}

        <div className="td-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              resetSurfaceForm();
              setShowCreateForm(true);
              setShowPresetForm(false);
            }}
          >
            {t("surfaces.createSurface")}
          </button>
          {presets.length > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowPresetForm(true);
                setShowCreateForm(false);
                resetSurfaceForm();
              }}
            >
              {t("surfaces.createFromPreset")}
            </button>
          )}
        </div>

        {/* Preset form */}
        {showPresetForm && (
          <div className="key-expanded">
            <label className="form-label-block">
              {t("surfaces.presetLabel")}
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
              >
                <option value="">{t("surfaces.selectPreset")}</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.description}
                  </option>
                ))}
              </select>
            </label>
            <div className="td-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCreateFromPreset}
                disabled={!selectedPresetId || savingSurface}
              >
                {t("common.add")}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowPresetForm(false);
                  setSelectedPresetId("");
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Create/Edit Surface form */}
        {showCreateForm && (
          <div className="key-expanded">
            <label className="form-label-block">
              {t("surfaces.name")}
              <input
                type="text"
                value={surfaceName}
                onChange={(e) => setSurfaceName(e.target.value)}
                placeholder={t("surfaces.namePlaceholder")}
              />
            </label>
            <label className="form-label-block">
              {t("surfaces.descriptionLabel")}
              <input
                type="text"
                value={surfaceDescription}
                onChange={(e) => setSurfaceDescription(e.target.value)}
                placeholder={t("surfaces.descriptionPlaceholder")}
              />
            </label>
            <label className="form-label-block">
              {t("surfaces.allowedToolIds")}
              <input
                type="text"
                value={surfaceToolIds}
                onChange={(e) => setSurfaceToolIds(e.target.value)}
                placeholder={t("surfaces.allowedToolIdsPlaceholder")}
              />
              <small className="form-hint">{t("surfaces.allowedToolIdsHint")}</small>
            </label>
            <label className="form-label-block">
              {t("surfaces.allowedCategories")}
              <input
                type="text"
                value={surfaceCategories}
                onChange={(e) => setSurfaceCategories(e.target.value)}
                placeholder={t("surfaces.allowedCategoriesPlaceholder")}
              />
              <small className="form-hint">{t("surfaces.allowedCategoriesHint")}</small>
            </label>
            <div className="td-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveSurface}
                disabled={!surfaceName.trim() || savingSurface}
              >
                {savingSurface ? t("common.loading") : t("common.save")}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={resetSurfaceForm}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Surfaces list */}
        {surfaces.length === 0 ? (
          <div className="empty-cell">{t("surfaces.noSurfaces")}</div>
        ) : (
          <div className="flex-col-gap-1">
            {surfaces.map((s) => {
              const isSystem = s.userId === null;
              return (
                <div key={s.id} className="key-card">
                  <div className="key-row">
                    <div className="key-info">
                      <div className="key-meta">
                        <strong className="text-sm">{s.name}</strong>
                        {isSystem && (
                          <span className="badge badge-muted">{t("surfaces.system")}</span>
                        )}
                        {s.presetId && (
                          <span className="badge badge-muted">{t("surfaces.presetLabel")}</span>
                        )}
                        <span className="badge badge-muted">
                          {t("surfaces.toolCount", { count: s.allowedToolIds.length })}
                        </span>
                        {s.allowedCategories.length > 0 && (
                          <span className="badge badge-muted">
                            {t("surfaces.categoryCount", { count: s.allowedCategories.length })}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <div className="key-details">
                          <span className="text-secondary text-sm">{s.description}</span>
                        </div>
                      )}
                    </div>
                    {!isSystem && (
                      <div className="td-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => startEditSurface(s)}
                        >
                          {t("surfaces.editSurface")}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteSurface(s.id)}
                        >
                          {t("surfaces.deleteSurface")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Card 4: Run Profiles ── */}
      <div className="section-card">
        <h3>{t("surfaces.runProfilesTitle")}</h3>

        {profileError && <div className="error-alert">{profileError}</div>}

        <div className="td-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              resetProfileForm();
              setShowProfileForm(true);
            }}
            disabled={userSurfaces.length === 0}
          >
            {t("surfaces.createRunProfile")}
          </button>
        </div>

        {/* Create/Edit Profile form */}
        {showProfileForm && (
          <div className="key-expanded">
            {!editingProfile && (
              <label className="form-label-block">
                {t("surfaces.surfacesTitle")}
                <select
                  value={profileSurfaceId}
                  onChange={(e) => setProfileSurfaceId(e.target.value)}
                >
                  <option value="">{t("surfaces.selectPreset")}</option>
                  {userSurfaces.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="form-label-block">
              {t("surfaces.profileName")}
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder={t("surfaces.profileNamePlaceholder")}
              />
            </label>
            <label className="form-label-block">
              {t("surfaces.selectedToolIds")}
              <input
                type="text"
                value={profileToolIds}
                onChange={(e) => setProfileToolIds(e.target.value)}
                placeholder={t("surfaces.selectedToolIdsPlaceholder")}
              />
              <small className="form-hint">{t("surfaces.selectedToolIdsHint")}</small>
            </label>
            <div className="td-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveProfile}
                disabled={!profileName.trim() || (!editingProfile && !profileSurfaceId) || savingProfile}
              >
                {savingProfile ? t("common.loading") : t("common.save")}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={resetProfileForm}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Profiles list grouped by surface */}
        {profiles.length === 0 ? (
          <div className="empty-cell">{t("surfaces.noRunProfiles")}</div>
        ) : (
          <div className="flex-col-gap-1">
            {profileGroupNames.map((groupName) => (
              <div key={groupName}>
                <div className="key-meta">
                  <strong className="text-sm">{groupName}</strong>
                </div>
                {profilesBySurface[groupName].map((p) => {
                  const isSystem = p.userId === null;
                  return (
                    <div key={p.id} className="key-card">
                      <div className="key-row">
                        <div className="key-info">
                          <div className="key-meta">
                            <strong className="text-sm">{p.name}</strong>
                            {isSystem && (
                              <span className="badge badge-muted">{t("surfaces.system")}</span>
                            )}
                            <span className="badge badge-muted">
                              {t("surfaces.toolCount", { count: p.selectedToolIds.length })}
                            </span>
                          </div>
                        </div>
                        {!isSystem && (
                          <div className="td-actions">
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => startEditProfile(p)}
                            >
                              {t("surfaces.editRunProfile")}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteProfile(p.id)}
                            >
                              {t("surfaces.deleteRunProfile")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
