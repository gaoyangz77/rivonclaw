import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { TkConfirmDialog as ConfirmDialog } from "../../components/design-system/index.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { useToolDisplayLabel } from "../../lib/tool-display.js";
import { useSurfaceForm } from "./hooks/useSurfaceForm.js";
import { useRunProfileForm } from "./hooks/useRunProfileForm.js";
import { useDefaultRunProfile } from "./hooks/useDefaultRunProfile.js";
import { AccountProfileCard } from "./components/AccountProfileCard.js";
import { SurfacesSection } from "./components/SurfacesSection.js";
import { SurfaceFormModal } from "./components/SurfaceFormModal.js";
import { SurfacePresetModal } from "./components/SurfacePresetModal.js";
import { RunProfilesSection } from "./components/RunProfilesSection.js";
import { RunProfileFormModal } from "./components/RunProfileFormModal.js";
import { RunProfilePresetModal } from "./components/RunProfilePresetModal.js";
import { SubAccountsSection } from "./components/SubAccountsSection.js";
import { TkPageFrame, TkPageHeader, TkPanel } from "../../components/design-system/index.js";

/** Resolve a display name for system-provided surfaces/profiles via i18n. */
function useSystemName() {
  const { t } = useTranslation();
  return (name: string, isSystem: boolean) =>
    isSystem ? (t(`surfaces.systemNames.${name}`, { defaultValue: name }) as string) : name;
}

export const AccountPage = observer(function AccountPage({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation();
  const resolveSystemName = useSystemName();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";

  const toolDisplayLabel = useToolDisplayLabel();

  // Refresh billing (subscription + LLM quota) on mount and whenever the
  // window becomes visible again. Quota changes as the user consumes LLM
  // calls elsewhere, and without a refetch the page would show stale
  // numbers from initSession time. No polling — visibility is enough
  // coverage for "I came back to check".
  useEffect(() => {
    entityStore.refreshBilling().catch(() => {});
    entityStore.refreshPlanDefinitions().catch(() => {});
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        entityStore.refreshBilling().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [entityStore]);

  // Read surfaces and run-profiles from MST store (auto-synced via SSE)
  const surfaces = entityStore.allSurfaces;
  const profiles = entityStore.allRunProfiles;

  // ── Refresh tools state ──
  const [refreshingTools, setRefreshingTools] = useState(false);

  // ── Confirm dialog state ──
  const [confirmDeleteSurfaceId, setConfirmDeleteSurfaceId] = useState<string | null>(null);
  const [confirmDeleteProfileId, setConfirmDeleteProfileId] = useState<string | null>(null);

  // ── Hooks ──
  const { savingDefault, defaultProfileError, handleDefaultProfileChange } = useDefaultRunProfile();

  const surfaceForm = useSurfaceForm();

  const profileForm = useRunProfileForm({
    onDefaultProfileCleared: () => handleDefaultProfileChange(""),
  });

  // ── Refresh tools handler ──
  async function handleRefreshTools() {
    setRefreshingTools(true);
    try {
      await entityStore.refreshToolSpecs();
    } finally {
      setRefreshingTools(false);
    }
  }

  function handleLogout() {
    entityStore.logout();
    onNavigate("/");
  }

  if (authChecking) {
    return (
      <TkPageFrame className="account-page">
        <TkPanel>
          <p>{t("common.loading")}</p>
        </TkPanel>
      </TkPageFrame>
    );
  }

  if (!user) {
    return (
      <TkPageFrame className="account-page">
        <TkPanel>
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </TkPanel>
      </TkPageFrame>
    );
  }

  const surfaceNameById: Record<string, string> = {};
  for (const s of surfaces) {
    surfaceNameById[s.id] = resolveSystemName(s.name, !s.userId);
  }

  return (
    <TkPageFrame className="account-page" data-tutorial-id="account-page">
      <TkPageHeader title={t("nav.account")} />
      {/* ── Profile & Subscription ── */}
      <AccountProfileCard onLogout={handleLogout} />

      {/* ── Sub-accounts (owner only) ── */}
      {user.isOwner && <SubAccountsSection />}

      {/* ── Surfaces ── */}
      <SurfacesSection
        surfaces={surfaces}
        profiles={profiles}
        surfaceError={surfaceForm.surfaceError}
        resolveSystemName={resolveSystemName}
        toolDisplayLabel={toolDisplayLabel}
        refreshingTools={refreshingTools}
        onRefreshTools={handleRefreshTools}
        onCreateSurface={surfaceForm.openCreateSurface}
        onEditSurface={surfaceForm.openEditSurface}
        onDeleteSurface={(id) => setConfirmDeleteSurfaceId(id)}
        onOpenPreset={surfaceForm.openPresetModal}
      />

      {/* ── Run Profiles ── */}
      <RunProfilesSection
        profiles={profiles}
        surfaces={surfaces}
        profileError={profileForm.profileError}
        defaultRunProfileId={user?.defaultRunProfileId}
        resolveSystemName={resolveSystemName}
        toolDisplayLabel={toolDisplayLabel}
        surfaceNameById={surfaceNameById}
        savingDefault={savingDefault}
        defaultProfileError={defaultProfileError}
        onDefaultProfileChange={handleDefaultProfileChange}
        onCreateProfile={profileForm.openCreateProfile}
        onOpenPreset={profileForm.openPresetModal}
        onEditProfile={profileForm.openEditProfile}
        onDeleteProfile={(id) => setConfirmDeleteProfileId(id)}
      />

      {/* ── Surface Modal ── */}
      <SurfaceFormModal
        isOpen={surfaceForm.surfaceModalOpen}
        editingSurfaceId={surfaceForm.editingSurfaceId}
        surfaceName={surfaceForm.surfaceName}
        surfaceDescription={surfaceForm.surfaceDescription}
        surfaceToolIds={surfaceForm.surfaceToolIds}
        savingSurface={surfaceForm.savingSurface}
        profiles={profiles}
        onNameChange={surfaceForm.setSurfaceName}
        onDescriptionChange={surfaceForm.setSurfaceDescription}
        onToolIdsChange={surfaceForm.setSurfaceToolIds}
        onSave={surfaceForm.handleSaveSurface}
        onClose={surfaceForm.closeSurfaceModal}
      />

      {/* ── Preset Modal ── */}
      <SurfacePresetModal
        isOpen={surfaceForm.presetModalOpen}
        surfaces={surfaces}
        selectedPresetId={surfaceForm.selectedPresetId}
        savingSurface={surfaceForm.savingSurface}
        resolveSystemName={resolveSystemName}
        onSelectedPresetIdChange={surfaceForm.setSelectedPresetId}
        onCreateFromPreset={surfaceForm.handleCreateFromPreset}
        onClose={surfaceForm.closePresetModal}
      />

      {/* ── Delete Surface Confirm ── */}
      <ConfirmDialog
        isOpen={confirmDeleteSurfaceId !== null}
        title={t("surfaces.deleteSurface")}
        message={t("surfaces.confirmDeleteSurface")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          if (confirmDeleteSurfaceId) {
            setConfirmDeleteSurfaceId(null);
            surfaceForm.handleDeleteSurface(confirmDeleteSurfaceId);
          }
        }}
        onCancel={() => setConfirmDeleteSurfaceId(null)}
      />

      {/* ── Delete RunProfile Confirm ── */}
      <ConfirmDialog
        isOpen={confirmDeleteProfileId !== null}
        title={t("surfaces.deleteRunProfile")}
        message={t("surfaces.confirmDeleteRunProfile")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          if (confirmDeleteProfileId) {
            setConfirmDeleteProfileId(null);
            profileForm.handleDeleteProfile(confirmDeleteProfileId);
          }
        }}
        onCancel={() => setConfirmDeleteProfileId(null)}
      />

      {/* ── RunProfile Preset Modal ── */}
      <RunProfilePresetModal
        isOpen={profileForm.presetModalOpen}
        profiles={profiles}
        selectedPresetId={profileForm.selectedPresetId}
        savingProfile={profileForm.savingProfile}
        resolveSystemName={resolveSystemName}
        surfaceNameById={surfaceNameById}
        onSelectedPresetIdChange={profileForm.setSelectedPresetId}
        onCreateFromPreset={() => profileForm.handleCreateFromPreset(profiles)}
        onClose={profileForm.closePresetModal}
      />

      {/* ── RunProfile Modal ── */}
      <RunProfileFormModal
        isOpen={profileForm.profileModalOpen}
        editingProfileId={profileForm.editingProfileId}
        profileName={profileForm.profileName}
        profileToolIds={profileForm.profileToolIds}
        profileSurfaceId={profileForm.profileSurfaceId}
        savingProfile={profileForm.savingProfile}
        surfaces={surfaces}
        resolveSystemName={resolveSystemName}
        onNameChange={profileForm.setProfileName}
        onToolIdsChange={profileForm.setProfileToolIds}
        onSurfaceIdChange={profileForm.setProfileSurfaceId}
        onSave={profileForm.handleSaveProfile}
        onClose={profileForm.closeProfileModal}
      />
    </TkPageFrame>
  );
});
