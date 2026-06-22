import { useEffect } from "react";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

export function useTikTokShopData() {
  const entityStore = useEntityStore();

  async function fetchPlatformApps() {
    try { await entityStore.fetchPlatformApps(); } catch { /* ignore */ }
  }

  async function fetchShops() {
    try { await entityStore.fetchShops(); } catch { /* ignore */ }
  }

  // Fetch platform apps on mount when user exists
  const user = entityStore.currentUser;
  useEffect(() => {
    if (user) {
      fetchShops();
      fetchPlatformApps();
    }
  }, [user]);

  return {
    fetchShops,
    fetchPlatformApps,
  };
}
