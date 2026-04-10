import { useState } from "react";
import type { GQL } from "@rivonclaw/core";
import { useToast } from "../../../components/Toast.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

export function useBrowserProfileSelection(profiles: GQL.BrowserProfile[], loadProfiles: () => Promise<void>) {
  const entityStore = useEntityStore();
  const { showToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<"archive" | "delete" | null>(null);

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

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBatchConfirm() {
    if (!batchAction || selectedIds.size === 0) return;
    try {
      if (batchAction === "archive") {
        await entityStore.batchArchiveBrowserProfiles([...selectedIds]);
      } else {
        await entityStore.batchDeleteBrowserProfiles([...selectedIds]);
      }
      setSelectedIds(new Set());
      setBatchAction(null);
      await loadProfiles();
    } catch (err) {
      setBatchAction(null);
      showToast(String(err), "error");
    }
  }

  return {
    selectedIds,
    batchAction,
    setBatchAction,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    handleBatchConfirm,
  };
}
