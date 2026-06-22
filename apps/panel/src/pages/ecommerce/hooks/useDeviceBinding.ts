import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../components/Toast.js";
import { fetchJson } from "../../../api/client.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

export function useDeviceBinding() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();

  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [bindConflictShopId, setBindConflictShopId] = useState<string | null>(null);
  const [togglingBindShopId, setTogglingBindShopId] = useState<string | null>(null);

  // Fetch deviceId from desktop on mount
  useEffect(() => {
    fetchJson<{ deviceId?: string }>("/status")
      .then((status) => setMyDeviceId(status.deviceId || null))
      .catch(() => setMyDeviceId(null));
  }, []);

  async function handleBindDevice(shopId: string) {
    if (!myDeviceId) return;
    const shop = entityStore.shops.find((s) => s.id === shopId);
    if (!shop) return;
    const existingDeviceId = shop.services?.customerService?.csDeviceId;
    if (existingDeviceId && existingDeviceId !== myDeviceId) {
      // Another device is handling this shop — ask for confirmation
      setBindConflictShopId(shopId);
      return;
    }
    setTogglingBindShopId(shopId);
    try {
      await shop.update({
        services: { customerService: { csDeviceId: myDeviceId } },
      });
    } catch {
      showToast(t("ecommerce.updateFailed"), "error");
    } finally {
      setTogglingBindShopId(null);
    }
  }

  async function handleForceBindConfirmed() {
    const shopId = bindConflictShopId;
    setBindConflictShopId(null);
    if (!shopId || !myDeviceId) return;
    const shop = entityStore.shops.find((s) => s.id === shopId);
    if (!shop) return;
    setTogglingBindShopId(shopId);
    try {
      await shop.update({
        services: { customerService: { csDeviceId: myDeviceId } },
      });
    } catch {
      showToast(t("ecommerce.updateFailed"), "error");
    } finally {
      setTogglingBindShopId(null);
    }
  }

  async function handleUnbindDevice(shopId: string) {
    const shop = entityStore.shops.find((s) => s.id === shopId);
    if (!shop) return;
    setTogglingBindShopId(shopId);
    try {
      await shop.update({
        services: { customerService: { csDeviceId: "" } },
      });
    } catch {
      showToast(t("ecommerce.updateFailed"), "error");
    } finally {
      setTogglingBindShopId(null);
    }
  }

  return {
    myDeviceId,
    bindConflictShopId,
    togglingBindShopId,
    setBindConflictShopId,
    handleBindDevice,
    handleForceBindConfirmed,
    handleUnbindDevice,
  };
}
