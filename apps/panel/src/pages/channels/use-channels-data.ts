import { useEffect } from "react";
import { useEntityStore } from "../../store/EntityStoreProvider.js";

/**
 * Thin React bridge for channel status state.
 *
 * The actual snapshot, loading/error flags, and 30s polling lifecycle live in
 * `entityStore.channelManager` so channel runtime state has one MST home.
 */
export function useChannelsData() {
  const entityStore = useEntityStore();
  const manager = entityStore.channelManager;

  useEffect(() => {
    manager.startStatusPolling();
    return () => manager.stopStatusPolling();
  }, [manager]);

  return {
    snapshot: manager.statusSnapshot,
    loading: manager.statusLoading,
    error: manager.statusError,
    refreshing: manager.statusRefreshing,
    loadChannelStatus: manager.loadChannelStatus,
    retryUntilReady: manager.retryUntilReady,
    handleRefresh: manager.handleRefresh,
  };
}
