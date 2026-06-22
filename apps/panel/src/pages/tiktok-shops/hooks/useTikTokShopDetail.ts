import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../components/Toast.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import type { ModalTab } from "../tiktok-shops-types.js";

interface UseTikTokShopDetailParams {
  handleError: (err: unknown, fallbackKey: string) => void;
  setUpgradePrompt: (v: boolean) => void;
}

export function useTikTokShopDetail({
  handleError,
  setUpgradePrompt,
}: UseTikTokShopDetailParams) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const { showToast } = useToast();
  const shops = entityStore.shops;

  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>("overview");
  const [editBusinessPrompt, setEditBusinessPrompt] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [togglingServiceId, setTogglingServiceId] = useState<string | null>(null);
  const [confirmDeleteShopId, setConfirmDeleteShopId] = useState<string | null>(null);

  const selectedShop = shops.find((s) => s.id === selectedShopId) ?? null;

  // Set business prompt when shop selection changes
  useEffect(() => {
    if (selectedShop) {
      setEditBusinessPrompt(selectedShop.services?.customerService?.businessPrompt ?? "");
    }
  }, [selectedShop?.id]);

  async function handleDeleteShop(shopId: string) {
    setConfirmDeleteShopId(null);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === shopId);
      if (!shop) throw new Error(`Shop ${shopId} not found`);
      await shop.delete();
      await entityStore.fetchShops();
      if (selectedShopId === shopId) {
        setSelectedShopId(null);
      }
      showToast(t("tiktokShops.disconnectSuccess"), "success");
    } catch (err) {
      handleError(err, "tiktokShops.deleteFailed");
    }
  }

  async function handleToggleCustomerService(shopId: string, currentValue: boolean) {
    setTogglingServiceId(shopId);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === shopId);
      if (!shop) throw new Error(`Shop ${shopId} not found`);
      await shop.update({
        services: { customerService: { enabled: !currentValue } },
      });
    } catch (err) {
      handleError(err, "tiktokShops.updateFailed");
    } finally {
      setTogglingServiceId(null);
    }
  }

  async function handleSaveBusinessPrompt() {
    if (!selectedShopId) return;
    setSavingSettings(true);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === selectedShopId);
      if (!shop) throw new Error(`Shop ${selectedShopId} not found`);
      await shop.update({
        services: { customerService: { businessPrompt: editBusinessPrompt } },
      });
      showToast(t("common.saved"), "success");
    } catch (err) {
      handleError(err, "tiktokShops.updateFailed");
    } finally {
      setSavingSettings(false);
    }
  }

  function openDetailModal(shopId: string) {
    setSelectedShopId(shopId);
    setActiveTab("overview");
    setUpgradePrompt(false);
  }

  function closeDetailModal() {
    setSelectedShopId(null);
    setUpgradePrompt(false);
  }

  return {
    selectedShopId,
    activeTab,
    setActiveTab,
    editBusinessPrompt,
    setEditBusinessPrompt,
    savingSettings,
    togglingServiceId,
    confirmDeleteShopId,
    setConfirmDeleteShopId,
    openDetailModal,
    closeDetailModal,
    handleSaveBusinessPrompt,
    handleToggleCustomerService,
    handleDeleteShop,
  };
}
