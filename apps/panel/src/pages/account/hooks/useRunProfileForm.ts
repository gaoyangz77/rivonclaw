import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import type { RunProfile } from "../account-types.js";

interface UseRunProfileFormParams {
  onDefaultProfileCleared: () => Promise<void>;
}

export function useRunProfileForm({ onDefaultProfileCleared }: UseRunProfileFormParams) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const user = entityStore.currentUser;
  const surfaces = entityStore.allSurfaces;

  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RunProfile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileToolIds, setProfileToolIds] = useState<Set<string>>(new Set());
  const [profileSurfaceId, setProfileSurfaceId] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

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
    setProfileError(null);
    try {
      const profile = entityStore.runProfiles.find((p) => p.id === profileId);
      if (!profile) throw new Error(`RunProfile ${profileId} not found`);
      await profile.delete();
      // If the deleted profile was the default, clear it
      if (user?.defaultRunProfileId === profileId) {
        await onDefaultProfileCleared();
      }
    } catch {
      setProfileError(t("surfaces.failedToDeleteProfile"));
    }
  }

  return {
    profileError,
    profileModalOpen,
    editingProfile,
    profileName,
    setProfileName,
    profileToolIds,
    setProfileToolIds,
    profileSurfaceId,
    setProfileSurfaceId,
    savingProfile,
    openCreateProfile,
    openEditProfile,
    closeProfileModal,
    handleSaveProfile,
    handleDeleteProfile,
  };
}
