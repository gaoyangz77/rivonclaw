import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../components/modals/Modal.js";
import { Select } from "../components/inputs/Select.js";
import { useAuth, usePanelStore } from "../stores/index.js";

/** OAuth authorization timeout in milliseconds (5 minutes). */
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

export function TikTokShopsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const shops = usePanelStore((s) => s.shops);
  const shopsLoading = usePanelStore((s) => s.shopsLoading);
  const platformApps = usePanelStore((s) => s.platformApps);
  const storeFetchShops = usePanelStore((s) => s.fetchShops);
  const storeFetchPlatformApps = usePanelStore((s) => s.fetchPlatformApps);
  const storeUpdateShop = usePanelStore((s) => s.updateShop);
  const storeDeleteShop = usePanelStore((s) => s.deleteShop);
  const storeInitiateOAuth = usePanelStore((s) => s.initiateTikTokOAuth);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthWaiting, setOauthWaiting] = useState(false);

  // ── Connect Shop modal state ──
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedPlatformAppId, setSelectedPlatformAppId] = useState<string>("");

  // ── Service toggle loading state ──
  const [togglingServiceId, setTogglingServiceId] = useState<string | null>(null);

  // ── SSE listener for oauth_complete ──
  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const cleanupOAuthWait = useCallback(() => {
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current);
      oauthTimeoutRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    setOauthWaiting(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  // Fetch shops and platform apps on mount
  useEffect(() => {
    if (user) {
      storeFetchShops();
      storeFetchPlatformApps();
    }
  }, [user]);

  // Auto-select first platform app when list loads
  useEffect(() => {
    if (platformApps.length > 0 && !selectedPlatformAppId) {
      setSelectedPlatformAppId(platformApps[0].id);
    }
  }, [platformApps, selectedPlatformAppId]);

  function startOAuthSSEListener() {
    // Connect to the desktop SSE endpoint to listen for oauth-complete events
    const sse = new EventSource("/api/chat/events");
    sseRef.current = sse;

    sse.addEventListener("oauth-complete", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { shopId: string; shopName: string; platform: string };
        cleanupOAuthWait();
        setSuccessMsg(t("tiktokShops.oauthSuccess"));
        storeFetchShops();
        void data; // consumed for logging/future use
      } catch {
        // Ignore malformed data
      }
    });

    sse.addEventListener("error", () => {
      // EventSource auto-reconnects; only warn if permanently closed
      if (sse.readyState === EventSource.CLOSED) {
        console.warn("[TikTokShopsPage] OAuth SSE connection closed");
      }
    });

    // Set a timeout — if no response within 5 minutes, show timeout message
    oauthTimeoutRef.current = setTimeout(() => {
      cleanupOAuthWait();
      setError(t("tiktokShops.oauthTimeout"));
    }, OAUTH_TIMEOUT_MS);
  }

  async function handleConnectShop() {
    if (!selectedPlatformAppId) return;
    setOauthLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { authUrl } = await storeInitiateOAuth(selectedPlatformAppId);
      setConnectModalOpen(false);

      // Start listening for oauth_complete via SSE before opening browser
      startOAuthSSEListener();
      setOauthWaiting(true);

      // Open TikTok auth URL in system browser via Electron's setWindowOpenHandler
      window.open(authUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tiktokShops.oauthFailed"));
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleReauthorize(shopId: string) {
    // Find the platformAppId from the shop being re-authorized
    const shop = shops.find((s) => s.id === shopId);
    const appId = shop?.platformAppId || (platformApps.length > 0 ? platformApps[0].id : "");
    if (!appId) {
      setError(t("tiktokShops.oauthFailed"));
      return;
    }

    setOauthLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { authUrl } = await storeInitiateOAuth(appId);

      // Start listening for oauth_complete via SSE before opening browser
      startOAuthSSEListener();
      setOauthWaiting(true);

      // Open TikTok auth URL in system browser
      window.open(authUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tiktokShops.oauthFailed"));
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleDeleteShop(shopId: string) {
    if (!window.confirm(t("tiktokShops.confirmDisconnect"))) return;
    setError(null);
    try {
      await storeDeleteShop(shopId);
    } catch {
      setError(t("tiktokShops.deleteFailed"));
    }
  }

  async function handleToggleCustomerService(shopId: string, currentValue: boolean) {
    setTogglingServiceId(shopId);
    setError(null);
    try {
      await storeUpdateShop(shopId, {
        services: { customerService: !currentValue },
      });
    } catch {
      setError(t("tiktokShops.updateFailed"));
    } finally {
      setTogglingServiceId(null);
    }
  }

  function getAuthStatusBadgeClass(status: string): string {
    switch (status) {
      case "AUTHORIZED":
        return "badge badge-active";
      case "TOKEN_EXPIRED":
        return "badge badge-warning";
      case "REVOKED":
      case "PENDING_AUTH":
        return "badge badge-danger";
      default:
        return "badge badge-muted";
    }
  }

  if (!user) {
    return (
      <div className="page-enter">
        <div className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <h1>{t("tiktokShops.title")}</h1>
      <p>{t("tiktokShops.description")}</p>

      {error && (
        <div className="error-alert">{error}</div>
      )}
      {successMsg && (
        <div className="info-box info-box-green">
          {successMsg}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSuccessMsg(null)}
          >
            {t("common.close")}
          </button>
        </div>
      )}

      {/* ── OAuth Waiting State ── */}
      {oauthWaiting && (
        <div className="info-box">
          <span>{t("tiktokShops.oauthWaiting")}</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              cleanupOAuthWait();
              setError(null);
            }}
          >
            {t("common.cancel")}
          </button>
        </div>
      )}

      {/* ── Connected Shops ── */}
      <div className="section-card">
        <div className="acct-section-header">
          <div>
            <h3>{t("tiktokShops.connectedShops")}</h3>
          </div>
          <div className="td-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setConnectModalOpen(true); }}
              disabled={oauthLoading || oauthWaiting}
            >
              {t("tiktokShops.connectShop")}
            </button>
          </div>
        </div>

        {shopsLoading && shops.length === 0 ? (
          <div className="empty-cell">{t("common.loading")}</div>
        ) : shops.length === 0 ? (
          <div className="empty-cell">{t("tiktokShops.noShops")}</div>
        ) : (
          <div className="acct-item-list">
            {shops.map((shop) => (
              <div key={shop.id} className="acct-item">
                <div className="acct-item-title-row">
                  <span className="acct-item-name">{shop.shopName}</span>
                  <span className={getAuthStatusBadgeClass(shop.authStatus)}>
                    {t(`tiktokShops.authStatus_${shop.authStatus}`)}
                  </span>
                  <div className="acct-item-actions">
                    {shop.authStatus === "TOKEN_EXPIRED" && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleReauthorize(shop.id)}
                        disabled={oauthLoading || oauthWaiting}
                      >
                        {t("tiktokShops.reauthorize")}
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteShop(shop.id)}
                    >
                      {t("tiktokShops.disconnect")}
                    </button>
                  </div>
                </div>
                <div className="acct-item-meta">
                  <span>{shop.region}</span>
                  <span>{shop.platform === "TIKTOK_SHOP" ? "TikTok Shop" : shop.platform}</span>
                  <span>
                    {t("tiktokShops.lastUpdated", {
                      date: new Date(shop.updatedAt).toLocaleDateString(),
                    })}
                  </span>
                </div>

                {/* ── Service Activation (C3) ── */}
                <div className="shop-services-row">
                  <div className="shop-service-toggle">
                    <span className="shop-service-label">
                      {t("tiktokShops.customerServiceLabel")}
                    </span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={shop.services.customerService}
                        onChange={() => handleToggleCustomerService(shop.id, shop.services.customerService)}
                        disabled={togglingServiceId === shop.id}
                      />
                      <span
                        className={`toggle-track ${shop.services.customerService ? "toggle-track-on" : "toggle-track-off"} ${togglingServiceId === shop.id ? "toggle-track-disabled" : ""}`}
                      >
                        <span
                          className={`toggle-thumb ${shop.services.customerService ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                        />
                      </span>
                    </label>
                    <span className={shop.services.customerService ? "badge badge-active" : "badge badge-muted"}>
                      {shop.services.customerService
                        ? t("common.enabled")
                        : t("common.disabled")}
                    </span>
                  </div>
                  {shop.services.customerService && (
                    <span className="form-hint">
                      {t("tiktokShops.customerServiceActiveHint")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Connect Shop Modal (C1) ── */}
      <Modal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        title={t("tiktokShops.connectShopTitle")}
      >
        <div className="modal-form-col">
          <p>{t("tiktokShops.connectShopDesc")}</p>
          <div>
            <label className="form-label-block">
              {t("tiktokShops.platformAppLabel")}
            </label>
            {platformApps.length === 0 ? (
              <div className="form-hint">{t("tiktokShops.noPlatformApps")}</div>
            ) : platformApps.length === 1 ? (
              <div className="form-hint">{platformApps[0].label}</div>
            ) : (
              <Select
                value={selectedPlatformAppId}
                onChange={(v) => setSelectedPlatformAppId(v)}
                className="input-full"
                options={platformApps.map((app) => ({
                  value: app.id,
                  label: app.label,
                }))}
              />
            )}
            <div className="form-hint">{t("tiktokShops.platformAppHint")}</div>
          </div>
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setConnectModalOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConnectShop}
              disabled={oauthLoading || !selectedPlatformAppId}
            >
              {oauthLoading ? t("common.loading") : t("tiktokShops.authorizeButton")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
