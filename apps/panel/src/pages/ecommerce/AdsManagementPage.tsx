import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../../components/modals/ConfirmDialog.js";
import { Modal } from "../../components/modals/Modal.js";
import { AdsIcon, CheckIcon, CopyIcon, InfoIcon, RefreshIcon } from "../../components/icons.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { useToast } from "../../components/Toast.js";
import { panelEventBus } from "../../lib/event-bus.js";
import { OAUTH_TIMEOUT_MS } from "./ecommerce-utils.js";
import { getReadinessBadgeClass, resolveShopAdsReadiness } from "./ads-readiness.js";
import { formatShopRegionLabel } from "../../lib/ecommerce-labels.js";

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function statusClass(status?: string | null): string {
  if (status === "AUTHORIZED") return "status-badge status-authorized";
  if (status === "DISCONNECTED") return "status-badge status-disconnected";
  if (status === "TOKEN_EXPIRED" || status === "REVOKED") return "status-badge status-error";
  return "status-badge status-neutral";
}

export const AdsManagementPage = observer(function AdsManagementPage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const { showToast } = useToast();
  const advertisers = entityStore.adsAdvertisers;
  const storeAccesses = entityStore.adsStoreBindings;
  const shops = entityStore.shops;

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const [oauthAuthUrl, setOauthAuthUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);

  const baselineAdvertiserIdsRef = useRef<Set<string>>(new Set());
  const baselineAdvertiserStatusRef = useRef<Map<string, string>>(new Map());
  const oauthCompletionHandledRef = useRef(false);
  const unsubscribeAdsOAuthRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authorizedAdvertisers = advertisers.filter((advertiser) => advertiser.auth.status === "AUTHORIZED");
  const shopCoverageRows = shops.map((shop) => ({
    shop,
    readiness: resolveShopAdsReadiness(shop, advertisers, storeAccesses),
  }));
  const coveredShopCount = shopCoverageRows.filter((row) => row.readiness.status === "connected").length;
  const onboardedStoreIds = new Set(shops.map((shop) => shop.platformShopId).filter(Boolean));
  const unonboardedStoreAccessCount = storeAccesses.filter((access) => !onboardedStoreIds.has(access.storeId)).length;

  function storeAccessCountForAdvertiser(advertiser: { id: string; advertiserId: string }): number {
    return storeAccesses.filter((access) => (
      access.adsAdvertiserId === advertiser.id ||
      access.advertiserId === advertiser.advertiserId
    )).length;
  }

  function cleanupOAuthWait() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (unsubscribeAdsOAuthRef.current) {
      unsubscribeAdsOAuthRef.current();
      unsubscribeAdsOAuthRef.current = null;
    }
    setOauthWaiting(false);
    setOauthAuthUrl(null);
    setLinkCopied(false);
  }

  useEffect(() => {
    void handleRefresh();
    return cleanupOAuthWait;
  }, []);

  useEffect(() => {
    if (!oauthWaiting) return;
    if (oauthCompletionHandledRef.current) return;
    const hasNewAdvertiser = advertisers.some((advertiser) =>
      !baselineAdvertiserIdsRef.current.has(advertiser.id)
    );
    const hasReauthorizedAdvertiser = advertisers.some((advertiser) => (
      baselineAdvertiserStatusRef.current.get(advertiser.id) !== "AUTHORIZED" &&
      advertiser.auth.status === "AUTHORIZED"
    ));
    if (hasNewAdvertiser || hasReauthorizedAdvertiser) {
      oauthCompletionHandledRef.current = true;
      cleanupOAuthWait();
      showToast(t("adsManagement.oauthSuccess"), "success");
    }
  }, [advertisers, oauthWaiting, showToast, t]);

  function startAdsOAuthListener() {
    if (unsubscribeAdsOAuthRef.current) {
      unsubscribeAdsOAuthRef.current();
    }
    unsubscribeAdsOAuthRef.current = panelEventBus.subscribe("ads-oauth-complete", (raw) => {
      if (oauthCompletionHandledRef.current) return;
      const payload = raw as { advertiserCount?: unknown };
      const advertiserCount =
        typeof payload.advertiserCount === "number" ? payload.advertiserCount : undefined;
      if (advertiserCount !== undefined && advertiserCount <= 0) {
        oauthCompletionHandledRef.current = true;
        cleanupOAuthWait();
        showToast(t("adsManagement.oauthFailed"), "error");
        return;
      }

      oauthCompletionHandledRef.current = true;
      cleanupOAuthWait();
      void handleRefresh();
      showToast(t("adsManagement.oauthSuccess"), "success");
    });
  }

  async function handleRefresh() {
    setLoading(true);
    try {
      await Promise.all([
        entityStore.fetchAdsAdvertisers(),
        entityStore.fetchAdsStoreAccesses(),
        entityStore.fetchShops(),
      ]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("adsManagement.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectBusiness() {
    setOauthLoading(true);
    oauthCompletionHandledRef.current = false;
    baselineAdvertiserIdsRef.current = new Set(advertisers.map((advertiser) => advertiser.id));
    baselineAdvertiserStatusRef.current = new Map(
      advertisers.map((advertiser) => [advertiser.id, advertiser.auth.status]),
    );

    try {
      const { authUrl } = await entityStore.initiateTikTokAdsOAuth();
      setOauthAuthUrl(authUrl);
      startAdsOAuthListener();
      setOauthWaiting(true);

      timeoutRef.current = setTimeout(() => {
        oauthCompletionHandledRef.current = true;
        cleanupOAuthWait();
        showToast(t("adsManagement.oauthTimeout"), "error");
      }, OAUTH_TIMEOUT_MS);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("adsManagement.oauthFailed"), "error");
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleCopyAuthUrl() {
    if (!oauthAuthUrl) return;
    try {
      await navigator.clipboard.writeText(oauthAuthUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2_000);
    } catch {
      showToast(t("adsManagement.copyFailed"), "error");
    }
  }

  async function handleDisconnect(id: string) {
    setConfirmDisconnectId(null);
    try {
      const advertiser = advertisers.find((item) => item.id === id);
      if (!advertiser) throw new Error(`Ads advertiser ${id} not found`);
      await advertiser.disconnect();
      await Promise.all([
        entityStore.fetchAdsAdvertisers(),
        entityStore.fetchAdsStoreAccesses(),
      ]);
      showToast(t("adsManagement.disconnectSuccess"), "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("adsManagement.disconnectFailed"), "error");
    }
  }

  return (
    <div>
      <div className="ecommerce-page-header">
        <div>
          <h1>{t("adsManagement.title")}</h1>
          <p className="ecommerce-page-subtitle">{t("adsManagement.subtitle")}</p>
        </div>
        <div className="ecommerce-header-actions">
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading || oauthWaiting}>
            <RefreshIcon />
            {loading ? t("common.loading") : t("common.refresh")}
          </button>
          <button className="btn btn-primary" onClick={handleConnectBusiness} disabled={oauthLoading || oauthWaiting}>
            <AdsIcon />
            {oauthLoading ? t("common.loading") : t("adsManagement.connectBusiness")}
          </button>
        </div>
      </div>

      <div className="ads-summary-strip ads-summary-strip-four">
        <div className="ads-summary-item">
          <span>{t("adsManagement.totalAdvertisers")}</span>
          <strong>{advertisers.length}</strong>
        </div>
        <div className="ads-summary-item">
          <span>{t("adsManagement.authorizedAdvertisers")}</span>
          <strong>{authorizedAdvertisers.length}</strong>
        </div>
        <div className="ads-summary-item">
          <span>{t("adsManagement.adsReadyShops")}</span>
          <strong>{coveredShopCount}</strong>
        </div>
        <div className="ads-summary-note">
          <InfoIcon />
          <span>{t("adsManagement.businessAccountHint")}</span>
        </div>
      </div>

      <section className="panel-card ads-advertiser-section">
        <div className="ecommerce-section-header">
          <div>
            <h3>{t("adsManagement.advertiserTableTitle")}</h3>
            <p className="ecommerce-section-subtitle">{t("adsManagement.advertiserTableSubtitle")}</p>
          </div>
        </div>

        {advertisers.length === 0 ? (
          <div className="empty-cell ads-empty-state">
            <AdsIcon />
            <strong>{t("adsManagement.emptyAdvertisersTitle")}</strong>
            <span>{t("adsManagement.emptyAdvertisersBody")}</span>
            <button className="btn btn-primary" onClick={handleConnectBusiness} disabled={oauthLoading || oauthWaiting}>
              {oauthLoading ? t("common.loading") : t("adsManagement.connectBusiness")}
            </button>
          </div>
        ) : (
          <div className="shop-table-wrap">
            <table className="shop-table ads-advertiser-table">
              <thead>
                <tr>
                  <th>{t("adsManagement.columns.name")}</th>
                  <th>{t("adsManagement.columns.advertiserId")}</th>
                  <th>{t("adsManagement.columns.status")}</th>
                  <th>{t("adsManagement.columns.role")}</th>
                  <th>{t("adsManagement.columns.currency")}</th>
                  <th>{t("adsManagement.columns.visibleStores")}</th>
                  <th>{t("adsManagement.columns.tokenExpiry")}</th>
                  <th>{t("adsManagement.columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {advertisers.map((advertiser) => (
                  <tr className="table-hover-row" key={advertiser.id}>
                    <td>
                      <div className="shop-table-name">
                        {advertiser.advertiserName || advertiser.advertiserId}
                      </div>
                      <div className="td-muted">{advertiser.platform}</div>
                    </td>
                    <td className="td-code">{advertiser.advertiserId}</td>
                    <td>
                      <span className={statusClass(advertiser.auth.status)}>
                        {t(`adsManagement.authStatus.${advertiser.auth.status}`, {
                          defaultValue: advertiser.auth.status,
                        })}
                      </span>
                    </td>
                    <td>{advertiser.advertiserRole || "-"}</td>
                    <td>{advertiser.currency || "-"}</td>
                    <td>{storeAccessCountForAdvertiser(advertiser)}</td>
                    <td className="td-date">{formatDate(advertiser.auth.accessTokenExpiresAt)}</td>
                    <td>
                      <div className="shop-table-actions">
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => setConfirmDisconnectId(advertiser.id)}
                        >
                          {t("adsManagement.disconnect")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel-card ads-advertiser-section ads-shop-readiness-section">
        <div className="ecommerce-section-header">
          <div>
            <h3>{t("adsManagement.shopCoverageTitle")}</h3>
            <p className="ecommerce-section-subtitle">{t("adsManagement.shopCoverageSubtitle")}</p>
          </div>
          {unonboardedStoreAccessCount > 0 ? (
            <span className="status-badge status-neutral">
              {t("adsManagement.unonboardedStoreCount", { count: unonboardedStoreAccessCount })}
            </span>
          ) : null}
        </div>

        {shops.length === 0 ? (
          <div className="empty-cell">{t("adsManagement.noShops")}</div>
        ) : (
          <div className="shop-table-wrap">
            <table className="shop-table ads-advertiser-table">
              <thead>
                <tr>
                  <th>{t("adsManagement.shopColumns.shop")}</th>
                  <th>{t("adsManagement.shopColumns.storeId")}</th>
                  <th>{t("adsManagement.shopColumns.region")}</th>
                  <th>{t("adsManagement.shopColumns.coverage")}</th>
                  <th>{t("adsManagement.shopColumns.advertiser")}</th>
                  <th>{t("adsManagement.shopColumns.gmvMax")}</th>
                </tr>
              </thead>
              <tbody>
                {shopCoverageRows.map(({ shop, readiness }) => {
                  const access = readiness.binding;
                  const advertiser = access
                    ? advertisers.find((item) => item.id === access.adsAdvertiserId || item.advertiserId === access.advertiserId)
                    : null;
                  return (
                    <tr className="table-hover-row" key={shop.id}>
                      <td>
                        <div className="shop-table-name">{shop.alias || shop.shopName}</div>
                        <div className="td-muted">{shop.shopName}</div>
                      </td>
                      <td className="td-code">{shop.platformShopId}</td>
                      <td>{formatShopRegionLabel(shop.region, t)}</td>
                      <td>
                        <span className={getReadinessBadgeClass(readiness.status)}>
                          {t(`adsManagement.shopAdsStatus.${readiness.status}`)}
                        </span>
                      </td>
                      <td>
                        {advertiser ? (
                          <>
                            <div className="shop-table-name">{advertiser.advertiserName || advertiser.advertiserId}</div>
                            <div className="td-muted td-code">{advertiser.advertiserId}</div>
                          </>
                        ) : "-"}
                      </td>
                      <td>{access?.isGmvMaxAvailable == null ? "-" : (
                        access.isGmvMaxAvailable ? t("common.yes") : t("common.no")
                      )}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        isOpen={oauthWaiting}
        onClose={cleanupOAuthWait}
        title={t("adsManagement.oauthModalTitle")}
        preventBackdropClose={oauthWaiting}
      >
        <div className="oauth-flow">
          <div className="oauth-flow-step">
            <span className="oauth-flow-step-num">1</span>
            <span className="oauth-flow-step-text">{t("adsManagement.openAuthLink")}</span>
          </div>
          <div className="auth-link-box">
            <div className="auth-link-url-row">
              <div className="auth-link-url">{oauthAuthUrl}</div>
              <button
                className={`auth-link-copy-btn${linkCopied ? " auth-link-copy-btn-success" : ""}`}
                onClick={handleCopyAuthUrl}
              >
                {linkCopied ? <CheckIcon /> : <CopyIcon />}
                {linkCopied ? t("common.copied") : t("common.copy")}
              </button>
            </div>
          </div>
          <div className="auth-link-hint">
            <InfoIcon />
            <span>{t("adsManagement.oauthHint")}</span>
          </div>
          <div className="oauth-flow-step">
            <span className="oauth-flow-step-num">2</span>
            <span className="oauth-flow-step-text">{t("adsManagement.waitingAuth")}</span>
          </div>
          <div className="oauth-waiting-indicator">
            <span className="oauth-waiting-spinner" />
            <span className="oauth-waiting-text">{t("adsManagement.waitingAuth")}</span>
          </div>
          <div className="oauth-flow-actions">
            <button className="btn btn-secondary" onClick={cleanupOAuthWait}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDisconnectId !== null}
        title={t("adsManagement.disconnect")}
        message={t("adsManagement.confirmDisconnect")}
        confirmLabel={t("adsManagement.disconnect")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => confirmDisconnectId && handleDisconnect(confirmDisconnectId)}
        onCancel={() => setConfirmDisconnectId(null)}
      />
    </div>
  );
});
