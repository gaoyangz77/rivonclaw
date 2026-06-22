import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import type { Surface } from "../account-types.js";

export function useSurfaceForm() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const allTools = entityStore.availableTools;
  const surfaces = entityStore.allSurfaces;

  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [surfaceModalOpen, setSurfaceModalOpen] = useState(false);
  const [editingSurfaceId, setEditingSurfaceId] = useState<string | null>(null);
  const [surfaceName, setSurfaceName] = useState("");
  const [surfaceDescription, setSurfaceDescription] = useState("");
  const [surfaceToolIds, setSurfaceToolIds] = useState<Set<string>>(new Set());
  const [savingSurface, setSavingSurface] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");

  function openCreateSurface() {
    setEditingSurfaceId(null);
    setSurfaceName("");
    setSurfaceDescription("");
    setSurfaceToolIds(new Set());
    setSurfaceModalOpen(true);
  }

  function openEditSurface(s: Surface) {
    setEditingSurfaceId(s.id);
    setSurfaceName(s.name);
    setSurfaceDescription("");
    setSurfaceToolIds(new Set(s.allowedToolIds));
    setSurfaceModalOpen(true);
  }

  function closeSurfaceModal() {
    setSurfaceModalOpen(false);
    setEditingSurfaceId(null);
  }

  async function handleSaveSurface() {
    if (!surfaceName.trim()) return;
    setSavingSurface(true);
    setSurfaceError(null);
    try {
      if (editingSurfaceId) {
        const surface = entityStore.surfaces.find((s) => s.id === editingSurfaceId);
        if (!surface) throw new Error(`Surface ${editingSurfaceId} not found`);
        await surface.update({
          name: surfaceName.trim(),
          description: surfaceDescription.trim() || undefined,
          allowedToolIds: Array.from(surfaceToolIds),
        });
      } else {
        await entityStore.createSurface({
          name: surfaceName.trim(),
          description: surfaceDescription.trim() || undefined,
          allowedToolIds: Array.from(surfaceToolIds),
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
    setEditingSurfaceId(null);
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
    setSurfaceError(null);
    try {
      const surface = entityStore.surfaces.find((s) => s.id === id);
      if (!surface) throw new Error(`Surface ${id} not found`);
      await surface.delete();
    } catch {
      setSurfaceError(t("surfaces.failedToDelete"));
    }
  }

  function openPresetModal() {
    setSelectedPresetId("");
    setPresetModalOpen(true);
  }

  function closePresetModal() {
    setPresetModalOpen(false);
  }

  return {
    surfaceError,
    surfaceModalOpen,
    editingSurfaceId,
    surfaceName,
    setSurfaceName,
    surfaceDescription,
    setSurfaceDescription,
    surfaceToolIds,
    setSurfaceToolIds,
    savingSurface,
    presetModalOpen,
    selectedPresetId,
    setSelectedPresetId,
    openCreateSurface,
    openEditSurface,
    closeSurfaceModal,
    handleSaveSurface,
    handleCreateFromPreset,
    handleDeleteSurface,
    openPresetModal,
    closePresetModal,
  };
}
