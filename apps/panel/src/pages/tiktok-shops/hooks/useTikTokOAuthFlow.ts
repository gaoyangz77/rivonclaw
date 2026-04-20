import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { panelEventBus } from "../../../lib/event-bus.js";
import { useToast } from "../../../components/Toast.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { OAUTH_TIMEOUT_MS, hasUpgradeRequired } from "../tiktok-shops-utils.js";

interface UseTikTokOAuthFlowParams {
  setUpgradePrompt: (v: boolean) => void;
}

export function useTikTokOAuthFlow({ setUpgradePrompt }: UseTikTokOAuthFlowParams) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const { showToast } = useToast();

  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedPlatformAppId, setSelectedPlatformAppId] = useState<string>("");

  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubscribeOAuthRef = useRef<(() => void) | null>(null);

  const cleanupOAuthWait = useCallback(() => {
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current);
      oauthTimeoutRef.current = null;
    }
    if (unsubscribeOAuthRef.current) {
      unsubscribeOAuthRef.current();
      unsubscribeOAuthRef.current = null;
    }
    setOauthWaiting(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
      if (unsubscribeOAuthRef.current) unsubscribeOAuthRef.current();
    };
  }, []);

  // Auto-select first platform app when list loads
  const platformApps = entityStore.platformApps;
  useEffect(() => {
    if (platformApps.length > 0 && !selectedPlatformAppId) {
      setSelectedPlatformAppId(platformApps[0].id);
    }
  }, [platformApps, selectedPlatformAppId]);

  function handleError(err: unknown, fallbackKey: string) {
    if (hasUpgradeRequired(err)) {
      setUpgradePrompt(true);
    } else {
      setUpgradePrompt(false);
      showToast(err instanceof Error ? err.message : t(fallbackKey), "error");
    }
  }

  function startOAuthSSEListener() {
    unsubscribeOAuthRef.current = panelEventBus.subscribe("oauth-complete", (raw) => {
      // Shops auto-update via MST/SSE — no manual fetch needed
      void raw;
      cleanupOAuthWait();
      showToast(t("tiktokShops.oauthSuccess"), "success");
    });

    oauthTimeoutRef.current = setTimeout(() => {
      cleanupOAuthWait();
      showToast(t("tiktokShops.oauthTimeout"), "error");
    }, OAUTH_TIMEOUT_MS);
  }

  async function handleConnectShop() {
    if (!selectedPlatformAppId) return;
    setOauthLoading(true);
    setUpgradePrompt(false);
    try {
      const { authUrl } = await entityStore.initiateTikTokOAuth(selectedPlatformAppId);
      setConnectModalOpen(false);
      startOAuthSSEListener();
      setOauthWaiting(true);
      window.open(authUrl, "_blank");
    } catch (err) {
      handleError(err, "tiktokShops.oauthFailed");
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleReauthorize(shopId: string) {
    const shops = entityStore.shops;
    const shop = shops.find((s) => s.id === shopId);
    const appId = shop?.platformAppId || (platformApps.length > 0 ? platformApps[0].id : "");
    if (!appId) {
      showToast(t("tiktokShops.oauthFailed"), "error");
      return;
    }

    setOauthLoading(true);
    setUpgradePrompt(false);
    try {
      const { authUrl } = await entityStore.initiateTikTokOAuth(appId);
      startOAuthSSEListener();
      setOauthWaiting(true);
      window.open(authUrl, "_blank");
    } catch (err) {
      handleError(err, "tiktokShops.oauthFailed");
    } finally {
      setOauthLoading(false);
    }
  }

  return {
    oauthLoading,
    oauthWaiting,
    connectModalOpen,
    setConnectModalOpen,
    selectedPlatformAppId,
    setSelectedPlatformAppId,
    cleanupOAuthWait,
    handleConnectShop,
    handleReauthorize,
    handleError,
  };
}
