import { useState, useRef } from "react";
import type { GQL } from "@rivonclaw/core";
import { DEFAULTS } from "@rivonclaw/core";
import { trackEvent } from "../../../api/index.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import type { BrowserProfileFormState } from "../browser-profile-types.js";
import { EMPTY_FORM } from "../browser-profile-types.js";
import { validateProxyUrl, parseTags } from "../browser-profile-utils.js";

export function useBrowserProfileForm(loadProfiles: () => Promise<void>, t: (key: string) => string) {
  const entityStore = useEntityStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrowserProfileFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mouseDownOnBackdrop = useRef(false);

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

  function updateField<K extends keyof BrowserProfileFormState>(key: K, value: BrowserProfileFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    const tags = parseTags(form.tags);

    const sessionStatePolicy = {
      enabled: form.sessionEnabled,
      checkpointIntervalSec: form.sessionCheckpointIntervalSec,
      storage: form.sessionStorage,
    };

    try {
      if (editingId) {
        await entityStore.updateBrowserProfile(editingId, {
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
        await entityStore.createBrowserProfile({
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

  return {
    modalOpen,
    editingId,
    form,
    formError,
    saving,
    mouseDownOnBackdrop,
    openCreateModal,
    openEditModal,
    closeModal,
    updateField,
    handleSave,
  };
}
