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
      const data = raw as { shops?: unknown[] };
      if (!Array.isArray(data.shops) || data.shops.length === 0) {
        cleanupOAuthWait();
        showToast(t("tiktokShops.oauthFailed"), "error");
        return;
      }
      cleanupOAuthWait();
      void entityStore.fetchShops()
        .then(() => {
          showToast(t("tiktokShops.oauthSuccess"), "success");
        })
        .catch((err: unknown) => {
          showToast(err instanceof Error ? err.message : t("tiktokShops.oauthFailed"), "error");
        });
    });

    oauthTimeoutRef.current = setTimeout(() => {
      cleanupOAuthWait();
      showToast(t("tiktokShops.oauthTimeout"), "error");
    }, OAUTH_TIMEOUT_MS);
  }

  async function handleConnectShop(platformAppId: string) {
    if (!platformAppId) return;
    setOauthLoading(true);
    setUpgradePrompt(false);
    try {
      const { authUrl } = await entityStore.initiateTikTokOAuth(platformAppId);
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
    const appId = shop?.platformAppId ?? "";
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
    cleanupOAuthWait,
    handleConnectShop,
    handleReauthorize,
    handleError,
  };
}
