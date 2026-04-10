import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { trackEvent } from "../../api/index.js";
import { ConfirmDialog } from "../../components/modals/ConfirmDialog.js";
import { useToast } from "../../components/Toast.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { useBrowserProfilesData } from "./hooks/useBrowserProfilesData.js";
import { useBrowserProfileForm } from "./hooks/useBrowserProfileForm.js";
import { useBrowserProfileSelection } from "./hooks/useBrowserProfileSelection.js";
import { BrowserProfilesToolbar } from "./components/BrowserProfilesToolbar.js";
import { BrowserProfilesTable } from "./components/BrowserProfilesTable.js";
import { BrowserProfileFormModal } from "./components/BrowserProfileFormModal.js";
import { BrowserProfilesPagination } from "./components/BrowserProfilesPagination.js";

export function BrowserProfilesPage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const { showToast } = useToast();

  const data = useBrowserProfilesData();
  const formHook = useBrowserProfileForm(data.loadProfiles, t);
  const selection = useBrowserProfileSelection(data.profiles, data.loadProfiles);

  // Delete confirm state
  const [deletingProfile, setDeletingProfile] = useState<GQL.BrowserProfile | null>(null);

  // Archive confirm state
  const [archivingProfile, setArchivingProfile] = useState<GQL.BrowserProfile | null>(null);

  // Proxy test state
  const [testingProxy, setTestingProxy] = useState<string | null>(null);
  const [proxyTestResult, setProxyTestResult] = useState<{
    id: string;
    ok: boolean;
    message: string;
  } | null>(null);

  async function handleTestProxy(id: string) {
    setTestingProxy(id);
    setProxyTestResult(null);
    try {
      const result = await entityStore.testBrowserProfileProxy(id);
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
      await entityStore.deleteBrowserProfile(deletingProfile.id);
      trackEvent("browser_profile.deleted");
      setDeletingProfile(null);
      await data.loadProfiles();
    } catch (err) {
      setDeletingProfile(null);
      showToast(String(err), "error");
    }
  }

  async function handleArchiveConfirm() {
    if (!archivingProfile) return;
    try {
      await entityStore.updateBrowserProfile(archivingProfile.id, { status: "ARCHIVED" });
      trackEvent("browser_profile.archived");
      setArchivingProfile(null);
      await data.loadProfiles();
    } catch (err) {
      setArchivingProfile(null);
      showToast(String(err), "error");
    }
  }

  async function handleUnarchive(profile: GQL.BrowserProfile) {
    try {
      await entityStore.updateBrowserProfile(profile.id, { status: "ACTIVE" });
      await data.loadProfiles();
    } catch (err) {
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
            <button className="btn btn-primary" onClick={formHook.openCreateModal} type="button">
              {t("browserProfiles.createProfile")}
            </button>
          </div>
        </div>
        <p className="form-hint">{t("browserProfiles.description")}</p>
      </div>

      {data.loadError && (
        <div className="error-alert">
          {data.loadError}
          <div className="error-alert-actions">
            <button className="btn btn-danger" onClick={data.loadProfiles} type="button">
              {t("browserProfiles.retry")}
            </button>
          </div>
        </div>
      )}

      {data.loading && (
        <div className="centered-muted">{t("common.loading")}</div>
      )}

      {!data.loading && !data.loadError && data.totalProfiles === 0 && !data.searchQuery && data.statusFilter === "all" && (
        <div className="section-card bp-empty-state">
          <p className="centered-muted">{t("browserProfiles.emptyState")}</p>
        </div>
      )}

      {!data.loading && (data.totalProfiles > 0 || data.searchQuery || data.statusFilter !== "all") && (
        <div className="section-card bp-table-card">
          <BrowserProfilesToolbar
            searchInput={data.searchInput}
            onSearchChange={data.setSearchInput}
            statusFilter={data.statusFilter}
            onStatusFilterChange={data.setStatusFilter}
          />

          <BrowserProfilesTable
            profiles={data.profiles}
            selectedIds={selection.selectedIds}
            testingProxy={testingProxy}
            proxyTestResult={proxyTestResult}
            onToggleSelect={selection.toggleSelect}
            onToggleSelectAll={selection.toggleSelectAll}
            onClearSelection={selection.clearSelection}
            onEdit={formHook.openEditModal}
            onTestProxy={handleTestProxy}
            onArchive={setArchivingProfile}
            onUnarchive={handleUnarchive}
            onDelete={setDeletingProfile}
            onBatchArchive={() => selection.setBatchAction("archive")}
            onBatchDelete={() => selection.setBatchAction("delete")}
            onDismissProxyResult={() => setProxyTestResult(null)}
          />

          <BrowserProfilesPagination
            currentPage={data.currentPage}
            pageSize={data.pageSize}
            totalProfiles={data.totalProfiles}
            pageSizeOptions={data.pageSizeOptions}
            onPageChange={data.setCurrentPage}
            onPageSizeChange={data.setPageSize}
          />
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
        isOpen={!!selection.batchAction}
        onConfirm={selection.handleBatchConfirm}
        onCancel={() => selection.setBatchAction(null)}
        title={
          selection.batchAction === "delete"
            ? t("browserProfiles.batchDeleteTitle")
            : t("browserProfiles.batchArchiveTitle")
        }
        message={
          selection.batchAction === "delete"
            ? t("browserProfiles.batchDeleteConfirm", { count: selection.selectedIds.size })
            : t("browserProfiles.batchArchiveConfirm", { count: selection.selectedIds.size })
        }
        confirmLabel={
          selection.batchAction === "delete"
            ? t("browserProfiles.delete")
            : t("browserProfiles.archive")
        }
        cancelLabel={t("common.cancel")}
        confirmVariant={selection.batchAction === "delete" ? "danger" : "primary"}
      />

      {/* Create/Edit Modal */}
      {formHook.modalOpen && (
        <BrowserProfileFormModal
          editingId={formHook.editingId}
          form={formHook.form}
          formError={formHook.formError}
          saving={formHook.saving}
          mouseDownOnBackdrop={formHook.mouseDownOnBackdrop}
          onUpdateField={formHook.updateField}
          onSave={formHook.handleSave}
          onClose={formHook.closeModal}
        />
      )}
    </div>
  );
}
