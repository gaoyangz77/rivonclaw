import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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

export function SurfacesPage() {
  const { t } = useTranslation();
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [presets, setPresets] = useState<SurfacePreset[]>([]);
  const [profiles, setProfiles] = useState<Record<string, RunProfile[]>>({});
  const [expandedSurfaceId, setExpandedSurfaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Surface form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSurface, setEditingSurface] = useState<Surface | null>(null);
  const [surfaceName, setSurfaceName] = useState("");
  const [surfaceDescription, setSurfaceDescription] = useState("");
  const [surfaceToolIds, setSurfaceToolIds] = useState("");
  const [surfaceCategories, setSurfaceCategories] = useState("");
  const [savingSurface, setSavingSurface] = useState(false);

  // Preset form state
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");

  // RunProfile form state
  const [showProfileForm, setShowProfileForm] = useState<string | null>(null); // surfaceId
  const [editingProfile, setEditingProfile] = useState<RunProfile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileToolIds, setProfileToolIds] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    loadSurfaces();
    loadPresets();
  }, []);

  async function loadSurfaces() {
    try {
      const list = await fetchSurfaces();
      setSurfaces(list);
      setError(null);
    } catch (err) {
      setError(t("surfaces.failedToLoad"));
    }
  }

  async function loadPresets() {
    try {
      const list = await fetchSurfacePresets();
      setPresets(list);
    } catch {
      // Presets are optional; ignore errors
    }
  }

  async function loadProfiles(surfaceId: string) {
    try {
      const list = await fetchRunProfiles(surfaceId);
      setProfiles((prev) => ({ ...prev, [surfaceId]: list }));
    } catch (err) {
      setError(t("surfaces.failedToLoadProfiles"));
    }
  }

  function handleExpandSurface(surfaceId: string) {
    if (expandedSurfaceId === surfaceId) {
      setExpandedSurfaceId(null);
      return;
    }
    setExpandedSurfaceId(surfaceId);
    if (!profiles[surfaceId]) {
      loadProfiles(surfaceId);
    }
  }

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
    setError(null);
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
    } catch (err) {
      setError(t("surfaces.failedToSave"));
    } finally {
      setSavingSurface(false);
    }
  }

  async function handleCreateFromPreset() {
    if (!selectedPresetId) return;
    setSavingSurface(true);
    setError(null);
    try {
      await createSurfaceFromPreset(selectedPresetId);
      setShowPresetForm(false);
      setSelectedPresetId("");
      await loadSurfaces();
    } catch (err) {
      setError(t("surfaces.failedToSave"));
    } finally {
      setSavingSurface(false);
    }
  }

  async function handleDeleteSurface(id: string) {
    if (!window.confirm(t("surfaces.confirmDeleteSurface"))) return;
    setError(null);
    try {
      await deleteSurface(id);
      if (expandedSurfaceId === id) setExpandedSurfaceId(null);
      setProfiles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadSurfaces();
    } catch (err) {
      setError(t("surfaces.failedToDelete"));
    }
  }

  // RunProfile handlers
  function resetProfileForm() {
    setShowProfileForm(null);
    setEditingProfile(null);
    setProfileName("");
    setProfileToolIds("");
  }

  function startEditProfile(p: RunProfile) {
    setEditingProfile(p);
    setProfileName(p.name);
    setProfileToolIds(p.selectedToolIds.join(", "));
    setShowProfileForm(p.surfaceId);
  }

  async function handleSaveProfile(surfaceId: string) {
    if (!profileName.trim()) return;
    setSavingProfile(true);
    setError(null);
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
          surfaceId,
        });
      }
      resetProfileForm();
      await loadProfiles(surfaceId);
    } catch (err) {
      setError(t("surfaces.failedToSaveProfile"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDeleteProfile(profileId: string, surfaceId: string) {
    if (!window.confirm(t("surfaces.confirmDeleteRunProfile"))) return;
    setError(null);
    try {
      await deleteRunProfile(profileId);
      await loadProfiles(surfaceId);
    } catch (err) {
      setError(t("surfaces.failedToDeleteProfile"));
    }
  }

  return (
    <div className="page-enter">
      <h1>{t("surfaces.title")}</h1>
      <p>{t("surfaces.description")}</p>

      {error && <div className="error-alert">{error}</div>}

      {/* Create Surface actions */}
      <div className="section-card">
        <h3>{t("surfaces.surfacesTitle")}</h3>
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
              const isExpanded = expandedSurfaceId === s.id;
              const surfaceProfiles = profiles[s.id] || [];
              return (
                <div key={s.id} className="key-card">
                  <div className="key-row">
                    <div className="key-info">
                      <div className="key-meta">
                        <strong className="text-sm">{s.name}</strong>
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
                    <div className="td-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleExpandSurface(s.id)}
                      >
                        {isExpanded ? t("common.close") : t("common.edit")}
                      </button>
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
                  </div>

                  {/* Expanded: Run Profiles */}
                  {isExpanded && (
                    <div className="key-expanded">
                      <div className="key-meta">
                        <strong className="text-sm">{t("surfaces.runProfilesTitle")}</strong>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            resetProfileForm();
                            setShowProfileForm(s.id);
                          }}
                        >
                          {t("surfaces.createRunProfile")}
                        </button>
                      </div>

                      {/* Create/Edit Profile form */}
                      {showProfileForm === s.id && (
                        <div className="key-expanded">
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
                              onClick={() => handleSaveProfile(s.id)}
                              disabled={!profileName.trim() || savingProfile}
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

                      {/* Profile list */}
                      {surfaceProfiles.length === 0 ? (
                        <div className="empty-cell">{t("surfaces.noRunProfiles")}</div>
                      ) : (
                        <div className="flex-col-gap-1">
                          {surfaceProfiles.map((p) => (
                            <div key={p.id} className="key-card">
                              <div className="key-row">
                                <div className="key-info">
                                  <div className="key-meta">
                                    <strong className="text-sm">{p.name}</strong>
                                    <span className="badge badge-muted">
                                      {t("surfaces.toolCount", { count: p.selectedToolIds.length })}
                                    </span>
                                  </div>
                                </div>
                                <div className="td-actions">
                                  <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => startEditProfile(p)}
                                  >
                                    {t("surfaces.editRunProfile")}
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDeleteProfile(p.id, s.id)}
                                  >
                                    {t("surfaces.deleteRunProfile")}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
