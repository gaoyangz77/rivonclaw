import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import {
  fetchBrowserProfiles,
  createBrowserProfile,
  updateBrowserProfile,
  deleteBrowserProfile,
  batchArchiveBrowserProfiles,
  batchDeleteBrowserProfiles,
  testBrowserProfileProxy,
} from "../api/browser-profiles.js";
import { trackEvent } from "../api/index.js";
import { ConfirmDialog } from "../components/modals/ConfirmDialog.js";
import { DEFAULTS } from "@rivonclaw/core";
import { useToast } from "../components/Toast.js";

interface BrowserProfileFormState {
  name: string;
  proxyEnabled: boolean;
  proxyBaseUrl: string;
  tags: string;
  notes: string;
  status: string;
  sessionEnabled: boolean;
  sessionCheckpointIntervalSec: number;
  sessionStorage: "local" | "cloud";
}

const EMPTY_FORM: BrowserProfileFormState = {
  name: "",
  proxyEnabled: false,
  proxyBaseUrl: "",
  tags: "",
  notes: "",
  status: "active",
  sessionEnabled: true,
  sessionCheckpointIntervalSec: DEFAULTS.browserProfiles.defaultCheckpointIntervalSec,
  sessionStorage: "local",
};

export function BrowserProfilesPage() {
  const { t } = useTranslation();

  // Profile list state
  const [profiles, setProfiles] = useState<GQL.BrowserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrowserProfileFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirm state
  const [deletingProfile, setDeletingProfile] = useState<GQL.BrowserProfile | null>(null);

  // Archive confirm state
  const [archivingProfile, setArchivingProfile] = useState<GQL.BrowserProfile | null>(null);

  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "ARCHIVED">("all");

  // Pagination state
  const PAGE_SIZE_OPTIONS = DEFAULTS.pagination.browserProfilesOptions;
  const [currentPage, setCurrentPage] = useState(0);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<"archive" | "delete" | null>(null);

  // Proxy test state
  const [testingProxy, setTestingProxy] = useState<string | null>(null);
  const [proxyTestResult, setProxyTestResult] = useState<{
    id: string;
    ok: boolean;
    message: string;
  } | null>(null);

  const mouseDownOnBackdrop = useRef(false);

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  // Reset page when filter or page size changes
  useEffect(() => {
    setCurrentPage(0);
  }, [statusFilter, pageSize]);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (statusFilter !== "all") filter.status = [statusFilter];
      if (searchQuery) filter.query = searchQuery;

      const data = await fetchBrowserProfiles(
        Object.keys(filter).length > 0 ? filter : undefined,
        { offset: currentPage * pageSize, limit: pageSize },
      );
      setProfiles(data.items);
      setTotalProfiles(data.total);
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, currentPage, pageSize]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  function openCreateModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(profile: GQL.BrowserProfile) {
    setEditingId(profile.id);
    const sp = profile.sessionStatePolicy;
    setForm({
      name: profile.name,
      proxyEnabled: profile.proxyPolicy.enabled,
      proxyBaseUrl: profile.proxyPolicy.baseUrl ?? "",
      tags: (profile.tags ?? []).join(", "),
      notes: profile.notes ?? "",
      status: profile.status,
      sessionEnabled: sp?.enabled ?? true,
      sessionCheckpointIntervalSec: sp?.checkpointIntervalSec ?? DEFAULTS.browserProfiles.defaultCheckpointIntervalSec,
      sessionStorage: (sp?.storage as "local" | "cloud") ?? "local",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  }

  function updateField<K extends keyof BrowserProfileFormState>(
    key: K,
    value: BrowserProfileFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateProxyUrl(url: string): boolean {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async function handleSave() {
    setFormError(null);

    if (!form.name.trim()) {
      setFormError(t("browserProfiles.nameRequired"));
      return;
    }

    if (form.proxyEnabled && form.proxyBaseUrl.trim()) {
      if (!validateProxyUrl(form.proxyBaseUrl.trim())) {
        setFormError(t("browserProfiles.invalidProxyUrl"));
        return;
      }
    }

    setSaving(true);
    const tags = form.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const sessionStatePolicy = {
      enabled: form.sessionEnabled,
      checkpointIntervalSec: form.sessionCheckpointIntervalSec,
      storage: form.sessionStorage,
    };

    try {
      if (editingId) {
        await updateBrowserProfile(editingId, {
          name: form.name.trim(),
          proxyEnabled: form.proxyEnabled,
          proxyBaseUrl: form.proxyEnabled ? form.proxyBaseUrl.trim() || null : null,
          tags,
          notes: form.notes.trim() || null,
          status: form.status,
          sessionStatePolicy,
        });
        trackEvent("browser_profile.updated");
      } else {
        await createBrowserProfile({
          name: form.name.trim(),
          proxyEnabled: form.proxyEnabled,
          proxyBaseUrl: form.proxyEnabled ? form.proxyBaseUrl.trim() || null : null,
          tags,
          notes: form.notes.trim() || null,
          sessionStatePolicy,
        });
        trackEvent("browser_profile.created");
      }
      closeModal();
      await loadProfiles();
    } catch (err) {
      setFormError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestProxy(id: string) {
    setTestingProxy(id);
    setProxyTestResult(null);
    try {
      const result = await testBrowserProfileProxy(id);
      trackEvent("browser_profile.proxy_tested", { success: result.ok });
      setProxyTestResult({ id, ok: result.ok, message: result.message });
    } catch (err) {
      trackEvent("browser_profile.proxy_tested", { success: false });
      setProxyTestResult({ id, ok: false, message: String(err) });
    } finally {
      setTestingProxy(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingProfile) return;
    try {
      await deleteBrowserProfile(deletingProfile.id);
      trackEvent("browser_profile.deleted");
      setDeletingProfile(null);
      await loadProfiles();
    } catch (err) {
      setDeletingProfile(null);
      showToast(String(err), "error");
    }
  }

  async function handleArchiveConfirm() {
    if (!archivingProfile) return;
    try {
      await updateBrowserProfile(archivingProfile.id, { status: "ARCHIVED" });
      trackEvent("browser_profile.archived");
      setArchivingProfile(null);
      await loadProfiles();
    } catch (err) {
      setArchivingProfile(null);
      showToast(String(err), "error");
    }
  }

  async function handleUnarchive(profile: GQL.BrowserProfile) {
    try {
      await updateBrowserProfile(profile.id, { status: "ACTIVE" });
      await loadProfiles();
    } catch (err) {
      showToast(String(err), "error");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === profiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(profiles.map((p) => p.id)));
    }
  }

  async function handleBatchConfirm() {
    if (!batchAction || selectedIds.size === 0) return;
    try {
      if (batchAction === "archive") {
        await batchArchiveBrowserProfiles([...selectedIds]);
      } else {
        await batchDeleteBrowserProfiles([...selectedIds]);
      }
      setSelectedIds(new Set());
      setBatchAction(null);
      await loadProfiles();
    } catch (err) {
      setBatchAction(null);
      showToast(String(err), "error");
    }
  }

  // --- Full UI ---
  return (
    <div className="bp-page">
      <div className="bp-header">
        <div className="bp-title-row">
          <h1>{t("browserProfiles.title")}</h1>
          <div className="bp-title-actions">
            <button className="btn btn-primary" onClick={openCreateModal} type="button">
              {t("browserProfiles.createProfile")}
            </button>
          </div>
        </div>
        <p className="form-hint">{t("browserProfiles.description")}</p>
      </div>

      {loadError && (
        <div className="error-alert">
          {loadError}
          <div className="error-alert-actions">
            <button className="btn btn-danger" onClick={loadProfiles} type="button">
              {t("browserProfiles.retry")}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="centered-muted">{t("common.loading")}</div>
      )}

      {!loading && !loadError && totalProfiles === 0 && !searchQuery && statusFilter === "all" && (
        <div className="section-card bp-empty-state">
          <p className="centered-muted">{t("browserProfiles.emptyState")}</p>
        </div>
      )}

      {!loading && (totalProfiles > 0 || searchQuery || statusFilter !== "all") && (
        <div className="section-card bp-table-card">
          <div className="bp-filter-bar">
            <input
              className="bp-search-input"
              type="text"
              placeholder={t("browserProfiles.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <div className="bp-status-chips">
              {(["all", "ACTIVE", "ARCHIVED"] as const).map((s) => (
                <button
                  key={s}
                  className={`btn btn-sm ${statusFilter === s ? "btn-outline" : "btn-secondary"}`}
                  onClick={() => setStatusFilter(s)}
                  type="button"
                >
                  {s === "all"
                    ? t("browserProfiles.filterAll")
                    : t(`browserProfiles.status_${s.toLowerCase()}`)}
                </button>
              ))}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="bp-batch-bar">
              <span className="bp-batch-count">
                {t("browserProfiles.selectedCount", { count: selectedIds.size })}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setBatchAction("archive")}
                type="button"
              >
                {t("browserProfiles.batchArchive")}
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setBatchAction("delete")}
                type="button"
              >
                {t("browserProfiles.batchDelete")}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedIds(new Set())}
                type="button"
              >
                {t("browserProfiles.clearSelection")}
              </button>
            </div>
          )}

          <table className="bp-table">
            <thead>
              <tr>
                <th className="bp-col-checkbox">
                  <input
                    type="checkbox"
                    checked={profiles.length > 0 && selectedIds.size === profiles.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>{t("browserProfiles.colName")}</th>
                <th>{t("browserProfiles.colProxy")}</th>
                <th>{t("browserProfiles.colSession")}</th>
                <th>{t("browserProfiles.colStatus")}</th>
                <th>{t("browserProfiles.colTags")}</th>
                <th>{t("browserProfiles.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="centered-muted">
                    {t("browserProfiles.noMatchingProfiles")}
                  </td>
                </tr>
              ) : profiles.map((p) => (
                <tr key={p.id} className={p.status === "ARCHIVED" ? "bp-row-archived" : ""}>
                  <td className="bp-col-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                    />
                  </td>
                  <td className="bp-cell-name">{p.name}</td>
                  <td>
                    {p.proxyPolicy.enabled ? (
                      <span className="badge badge-active">
                        {t("browserProfiles.proxyOn")}
                      </span>
                    ) : (
                      <span className="badge badge-muted">
                        {t("browserProfiles.proxyOff")}
                      </span>
                    )}
                  </td>
                  <td>
                    {p.sessionStatePolicy?.enabled !== false ? (
                      <span className="badge badge-active">
                        {(p.sessionStatePolicy?.storage ?? "local").charAt(0).toUpperCase() +
                          (p.sessionStatePolicy?.storage ?? "local").slice(1)}
                      </span>
                    ) : (
                      <span className="badge badge-muted">
                        {t("browserProfiles.sessionOff")}
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        p.status === "ACTIVE"
                          ? "badge-success"
                          : p.status === "DISABLED"
                            ? "badge-warning"
                            : "badge-muted"
                      }`}
                    >
                      {t(`browserProfiles.status_${p.status.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="td-meta">
                    {p.tags && p.tags.length > 0 ? p.tags.join(", ") : "-"}
                  </td>
                  <td className="td-actions">
                    {p.status !== "ARCHIVED" && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(p)}
                        type="button"
                      >
                        {t("common.edit")}
                      </button>
                    )}
                    {p.proxyPolicy.enabled && p.status !== "ARCHIVED" && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleTestProxy(p.id)}
                        disabled={testingProxy === p.id}
                        type="button"
                      >
                        {testingProxy === p.id
                          ? t("browserProfiles.testing")
                          : t("browserProfiles.testProxy")}
                      </button>
                    )}
                    {p.status === "ARCHIVED" ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleUnarchive(p)}
                        title={t("browserProfiles.unarchiveTooltip")}
                        type="button"
                      >
                        {t("browserProfiles.unarchive")}
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setArchivingProfile(p)}
                        title={t("browserProfiles.archiveTooltip")}
                        type="button"
                      >
                        {t("browserProfiles.archive")}
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeletingProfile(p)}
                      type="button"
                    >
                      {t("browserProfiles.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Proxy test result banner */}
          {proxyTestResult && (
            <div
              className={`bp-proxy-result ${proxyTestResult.ok ? "bp-proxy-result-ok" : "bp-proxy-result-fail"}`}
            >
              <span>
                {proxyTestResult.ok
                  ? t("browserProfiles.proxyTestSuccess")
                  : t("browserProfiles.proxyTestFail")}
                {": "}
                {proxyTestResult.message}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setProxyTestResult(null)}
                type="button"
              >
                {t("common.close")}
              </button>
            </div>
          )}

          {/* Pagination controls */}
          {totalProfiles > 0 && (
            <div className="bp-pagination">
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => p - 1)}
                type="button"
              >
                &larr;
              </button>
              <span className="bp-pagination-info">
                {currentPage * pageSize + 1}&ndash;{Math.min((currentPage + 1) * pageSize, totalProfiles)} / {totalProfiles}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={(currentPage + 1) * pageSize >= totalProfiles}
                onClick={() => setCurrentPage((p) => p + 1)}
                type="button"
              >
                &rarr;
              </button>
              <select
                className="bp-page-size-select"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / {t("browserProfiles.page")}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deletingProfile}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingProfile(null)}
        title={t("browserProfiles.deleteTitle")}
        message={t("browserProfiles.deleteConfirm", { name: deletingProfile?.name })}
        confirmLabel={t("browserProfiles.delete")}
        cancelLabel={t("common.cancel")}
        confirmVariant="danger"
      />

      {/* Archive Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!archivingProfile}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchivingProfile(null)}
        title={t("browserProfiles.archiveTitle")}
        message={t("browserProfiles.archiveConfirm", { name: archivingProfile?.name })}
        confirmLabel={t("browserProfiles.archive")}
        cancelLabel={t("common.cancel")}
      />

      {/* Batch Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!batchAction}
        onConfirm={handleBatchConfirm}
        onCancel={() => setBatchAction(null)}
        title={
          batchAction === "delete"
            ? t("browserProfiles.batchDeleteTitle")
            : t("browserProfiles.batchArchiveTitle")
        }
        message={
          batchAction === "delete"
            ? t("browserProfiles.batchDeleteConfirm", { count: selectedIds.size })
            : t("browserProfiles.batchArchiveConfirm", { count: selectedIds.size })
        }
        confirmLabel={
          batchAction === "delete"
            ? t("browserProfiles.delete")
            : t("browserProfiles.archive")
        }
        cancelLabel={t("common.cancel")}
        confirmVariant={batchAction === "delete" ? "danger" : "primary"}
      />

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
          onClick={(e) => {
            if (e.target === e.currentTarget && mouseDownOnBackdrop.current) closeModal();
            mouseDownOnBackdrop.current = false;
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingId
                  ? t("browserProfiles.editTitle")
                  : t("browserProfiles.createTitle")}
              </h2>
              <button
                className="modal-close-btn"
                onClick={closeModal}
                type="button"
              >
                &times;
              </button>
            </div>

            <div className="form-group">
              <label className="form-label-block">
                {t("browserProfiles.fieldName")} *
              </label>
              <input
                className="input-full"
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder={t("browserProfiles.fieldNamePlaceholder")}
              />
            </div>

            <div className="form-group">
              <label className="bp-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.proxyEnabled}
                  onChange={(e) => updateField("proxyEnabled", e.target.checked)}
                />
                <span>{t("browserProfiles.fieldProxyEnabled")}</span>
              </label>
            </div>

            {form.proxyEnabled && (
              <div className="form-group">
                <label className="form-label-block">
                  {t("browserProfiles.fieldProxyBaseUrl")}
                </label>
                <input
                  className="input-full"
                  type="text"
                  value={form.proxyBaseUrl}
                  onChange={(e) => updateField("proxyBaseUrl", e.target.value)}
                  placeholder="https://proxy.example.com:8080"
                />
                <div className="form-hint">
                  {t("browserProfiles.proxyUrlHint")}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label-block">
                {t("browserProfiles.fieldTags")}
              </label>
              <input
                className="input-full"
                type="text"
                value={form.tags}
                onChange={(e) => updateField("tags", e.target.value)}
                placeholder={t("browserProfiles.fieldTagsPlaceholder")}
              />
              <div className="form-hint">
                {t("browserProfiles.tagsHint")}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label-block">
                {t("browserProfiles.fieldNotes")}
              </label>
              <textarea
                className="input-full bp-notes-textarea"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder={t("browserProfiles.fieldNotesPlaceholder")}
              />
            </div>

            {editingId && (
              <div className="form-group">
                <label className="form-label-block">
                  {t("browserProfiles.fieldStatus")}
                </label>
                <select
                  className="input-full"
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                >
                  <option value="active">
                    {t("browserProfiles.status_active")}
                  </option>
                  <option value="disabled">
                    {t("browserProfiles.status_disabled")}
                  </option>
                  <option value="archived">
                    {t("browserProfiles.status_archived")}
                  </option>
                </select>
              </div>
            )}

            {/* Session State Policy */}
            {(
              <div className="form-group">
                <h4>{t("browserProfiles.sessionStateTitle")}</h4>

                <label className="bp-checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.sessionEnabled}
                    onChange={(e) => updateField("sessionEnabled", e.target.checked)}
                  />
                  <span>{t("browserProfiles.sessionStateEnabled")}</span>
                </label>
                <div className="form-hint">
                  {t("browserProfiles.sessionStateEnabledHint")}
                </div>

                {form.sessionEnabled && (
                  <>
                    <label className="form-label-block">
                      {t("browserProfiles.sessionStateStorage")}
                    </label>
                    <select
                      className="input-full"
                      value={form.sessionStorage}
                      onChange={(e) => updateField("sessionStorage", e.target.value as "local" | "cloud")}
                    >
                      <option value="local">{t("browserProfiles.sessionStorageLocal")}</option>
                      <option value="cloud">{t("browserProfiles.sessionStorageCloud")}</option>
                    </select>
                    <div className="form-hint">
                      {t("browserProfiles.sessionStorageHint")}
                    </div>

                    <label className="form-label-block">
                      {t("browserProfiles.sessionStateInterval")}
                    </label>
                    <input
                      className="input-full"
                      type="number"
                      min={30}
                      max={3600}
                      value={form.sessionCheckpointIntervalSec}
                      onChange={(e) => updateField("sessionCheckpointIntervalSec", Number(e.target.value) || DEFAULTS.browserProfiles.defaultCheckpointIntervalSec)}
                    />
                    <div className="form-hint">
                      {t("browserProfiles.sessionStateIntervalHint")}
                    </div>
                  </>
                )}
              </div>
            )}

            {formError && <div className="error-alert">{formError}</div>}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={closeModal}
                type="button"
              >
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                type="button"
              >
                {saving ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
