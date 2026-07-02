import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { AdsAdvertiser, Shop } from "@rivonclaw/core/models";
import { ConfirmDialog } from "../../components/modals/ConfirmDialog.js";
import { Modal } from "../../components/modals/Modal.js";
import { AdsIcon, CheckIcon, ChevronRightIcon, CopyIcon, InfoIcon, RefreshIcon, ShopIcon } from "../../components/icons.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { useToast } from "../../components/Toast.js";
import { panelEventBus } from "../../lib/event-bus.js";
import { OAUTH_TIMEOUT_MS } from "./ecommerce-utils.js";
import { getReadinessBadgeClass, resolveShopAdsReadiness } from "./ads-readiness.js";
import { formatShopRegionLabel } from "../../lib/ecommerce-labels.js";
import {
  groupShopsByCollection,
  shopCollectionDisplayName,
  shopCollectionRegions,
} from "../../lib/shop-collections.js";

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

function syncHealthClass(status?: string | null, issueCode?: string | null): string {
  if (status === "FAILED" && issueCode === "PERMISSION_DENIED") return "status-badge status-warning";
  if (status === "FAILED") return "status-badge status-error";
  return "status-badge status-authorized";
}

type AdvertiserFilter = "all" | "attention" | "authorized";
type CoverageFilter = "partial" | "needs_link" | "connected" | "all";
type CoverageStatus = "connected" | "partial" | "needs_link" | "needs_advertiser";

interface AdvertiserViewGroup {
  id: "attention" | "authorized" | "disconnected";
  label: string;
  tone: "warning" | "healthy" | "neutral";
  advertisers: AdsAdvertiser[];
}

interface ShopCoverageRow {
  shop: Shop;
  readiness: ReturnType<typeof resolveShopAdsReadiness>;
  advertiser: AdsAdvertiser | null;
}

interface ShopCoverageGroup {
  key: string;
  shops: Shop[];
  rows: ShopCoverageRow[];
  status: CoverageStatus;
  connectedCount: number;
  advertisers: AdsAdvertiser[];
}

function advertiserNeedsAttention(advertiser: AdsAdvertiser): boolean {
  return advertiser.syncHealthStatus === "FAILED" || advertiser.auth.status !== "AUTHORIZED";
}

function coverageRank(status: CoverageStatus): number {
  if (status === "needs_advertiser") return 0;
  if (status === "needs_link") return 1;
  if (status === "partial") return 2;
  return 3;
}

function coverageGroupStatus(rows: ShopCoverageRow[]): CoverageStatus {
  const connectedCount = rows.filter((row) => row.readiness.status === "connected").length;
  if (connectedCount === rows.length) return "connected";
  if (connectedCount > 0) return "partial";
  if (rows.some((row) => row.readiness.status === "needs_advertiser")) return "needs_advertiser";
  return "needs_link";
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
  const [advertiserFilter, setAdvertiserFilter] = useState<AdvertiserFilter>("all");
  const [advertiserQuery, setAdvertiserQuery] = useState("");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [expandedAdvertiserGroups, setExpandedAdvertiserGroups] = useState<Record<string, boolean>>({
    attention: true,
  });
  const [expandedCoverageGroups, setExpandedCoverageGroups] = useState<Record<string, boolean>>({});

  const baselineAdvertiserIdsRef = useRef<Set<string>>(new Set());
  const baselineAdvertiserStatusRef = useRef<Map<string, string>>(new Map());
  const oauthCompletionHandledRef = useRef(false);
  const unsubscribeAdsOAuthRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authorizedAdvertisers = advertisers.filter((advertiser) => advertiser.auth.status === "AUTHORIZED");
  const attentionAdvertisers = advertisers.filter(advertiserNeedsAttention);
  const shopCoverageGroups = useMemo<ShopCoverageGroup[]>(() => {
    return groupShopsByCollection(shops).map((group) => {
      const rows = group.shops.map((shop) => {
        const readiness = resolveShopAdsReadiness(shop, advertisers, storeAccesses);
        const access = readiness.binding;
        const advertiser = access
          ? advertisers.find((item) => item.id === access.adsAdvertiserId || item.advertiserId === access.advertiserId) ?? null
          : null;
        return { shop, readiness, advertiser };
      });
      const advertiserMap = new Map<string, AdsAdvertiser>();
      for (const row of rows) {
        if (row.advertiser) advertiserMap.set(row.advertiser.id, row.advertiser);
      }
      return {
        key: group.key,
        shops: group.shops,
        rows,
        status: coverageGroupStatus(rows),
        connectedCount: rows.filter((row) => row.readiness.status === "connected").length,
        advertisers: [...advertiserMap.values()],
      };
    }).sort((a, b) => {
      const rankDelta = coverageRank(a.status) - coverageRank(b.status);
      if (rankDelta !== 0) return rankDelta;
      return shopCollectionDisplayName(a.shops).localeCompare(shopCollectionDisplayName(b.shops), undefined, { numeric: true });
    });
  }, [advertisers, shops, storeAccesses]);

  const coveredShopCount = shopCoverageGroups.reduce((sum, group) => sum + group.connectedCount, 0);
  const incompleteCoverageGroupCount = shopCoverageGroups.filter((group) => group.status !== "connected").length;

  const filteredAdvertisers = useMemo(() => {
    const query = advertiserQuery.trim().toLowerCase();
    return advertisers.filter((advertiser) => {
      if (advertiserFilter === "attention" && !advertiserNeedsAttention(advertiser)) return false;
      if (advertiserFilter === "authorized" && advertiser.auth.status !== "AUTHORIZED") return false;
      if (!query) return true;
      return [
        advertiser.advertiserName,
        advertiser.advertiserId,
        advertiser.advertiserRole,
        advertiser.currency,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [advertiserFilter, advertiserQuery, advertisers]);

  const advertiserGroups = useMemo<AdvertiserViewGroup[]>(() => {
    const attention = filteredAdvertisers.filter(advertiserNeedsAttention);
    const authorized = filteredAdvertisers.filter((advertiser) => advertiser.auth.status === "AUTHORIZED" && advertiser.syncHealthStatus !== "FAILED");
    const disconnected = filteredAdvertisers.filter((advertiser) => advertiser.auth.status !== "AUTHORIZED" && advertiser.syncHealthStatus !== "FAILED");
    const groups: AdvertiserViewGroup[] = [
      { id: "attention", label: t("adsManagement.needsAttention"), tone: "warning", advertisers: attention },
      { id: "authorized", label: t("adsManagement.authorizedAdvertisers"), tone: "healthy", advertisers: authorized },
      { id: "disconnected", label: t("adsManagement.authStatus.DISCONNECTED", { defaultValue: "Disconnected" }), tone: "neutral", advertisers: disconnected },
    ];
    return groups.filter((group) => group.advertisers.length > 0);
  }, [filteredAdvertisers, t]);

  const filteredCoverageGroups = useMemo(() => {
    return shopCoverageGroups.filter((group) => {
      if (coverageFilter === "partial") return group.status === "partial";
      if (coverageFilter === "needs_link") return group.status === "needs_link" || group.status === "needs_advertiser";
      if (coverageFilter === "connected") return group.status === "connected";
      return true;
    });
  }, [coverageFilter, shopCoverageGroups]);

  function toggleAdvertiserGroup(groupId: string) {
    setExpandedAdvertiserGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  function toggleCoverageGroup(groupKey: string) {
    setExpandedCoverageGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
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

      <div className="ads-summary-strip ads-summary-strip-five">
        <div className="ads-summary-item">
          <span>{t("adsManagement.totalAdvertisers")}</span>
          <strong>{advertisers.length}</strong>
        </div>
        <div className="ads-summary-item">
          <span>{t("adsManagement.authorizedAdvertisers")}</span>
          <strong>{authorizedAdvertisers.length}</strong>
        </div>
        <div className="ads-summary-item">
          <span>{t("adsManagement.needsAttention")}</span>
          <strong>{attentionAdvertisers.length}</strong>
        </div>
        <div className="ads-summary-item">
          <span>{t("adsManagement.adsReadyShops")}</span>
          <strong>{coveredShopCount}/{shops.length}</strong>
        </div>
      </div>

      <section className="panel-card ads-advertiser-section">
        <div className="ecommerce-section-header">
          <div>
            <h3>{t("adsManagement.advertiserTableTitle")}</h3>
            <p className="ecommerce-section-subtitle">{t("adsManagement.advertiserTableSubtitle")}</p>
          </div>
          {advertisers.length > 0 ? (
            <div className="ads-section-tools">
              <input
                className="ads-search-input"
                value={advertiserQuery}
                placeholder={t("adsManagement.searchPlaceholder", { defaultValue: "Search ad accounts" })}
                onChange={(event) => setAdvertiserQuery(event.target.value)}
              />
              <div className="ads-segmented-control">
                {([
                  ["all", t("adsManagement.filters.all", { defaultValue: "All" })],
                  ["attention", t("adsManagement.needsAttention")],
                  ["authorized", t("adsManagement.authorizedAdvertisers")],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    className={advertiserFilter === value ? "active" : undefined}
                    onClick={() => setAdvertiserFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
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
        ) : advertiserGroups.length === 0 ? (
          <div className="empty-cell">{t("adsManagement.noMatchingResults", { defaultValue: "No matching results." })}</div>
        ) : (
          <div className="table-scroll-wrap shop-table-wrap ads-compact-table-wrap">
            <table className="shop-table ads-advertiser-table ads-compact-table">
              <thead>
                <tr>
                  <th>{t("adsManagement.columns.name")}</th>
                  <th>{t("adsManagement.columns.status")}</th>
                  <th>{t("adsManagement.columns.syncHealth")}</th>
                  <th>{t("adsManagement.columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {advertiserGroups.map((group) => {
                  const expanded = expandedAdvertiserGroups[group.id] ?? group.id !== "authorized";
                  return (
                    <Fragment key={group.id}>
                      <tr className={`ads-group-row ads-group-row-${group.tone}`}>
                        <td colSpan={4}>
                          <button className="ads-group-toggle" onClick={() => toggleAdvertiserGroup(group.id)}>
                            <ChevronRightIcon className={expanded ? "ads-chevron-open" : undefined} />
                            <span className="ads-group-title">{group.label}</span>
                            <span className="ads-group-count">{group.advertisers.length}</span>
                          </button>
                        </td>
                      </tr>
                      {expanded && group.advertisers.map((advertiser) => (
                        <tr className="table-hover-row" key={advertiser.id}>
                          <td title={advertiser.syncIssueMessage || advertiser.lastBiSyncError || undefined}>
                            <div className="shop-table-name">
                              {advertiser.advertiserName || advertiser.advertiserId}
                            </div>
                            <div className="td-muted ads-inline-meta">
                              <span className="td-code">{advertiser.advertiserId}</span>
                              <span>{advertiser.advertiserRole || "-"}</span>
                              <span>{advertiser.currency || "-"}</span>
                              <span>{advertiser.platform}</span>
                            </div>
                          </td>
                          <td>
                            <span className={statusClass(advertiser.auth.status)}>
                              {t(`adsManagement.authStatus.${advertiser.auth.status}`, {
                                defaultValue: advertiser.auth.status,
                              })}
                            </span>
                          </td>
                          <td>
                            <div className="ads-sync-health-cell">
                              <span className={syncHealthClass(advertiser.syncHealthStatus, advertiser.syncIssueCode)}>
                                {t(`adsManagement.syncHealth.${advertiser.syncHealthStatus || "HEALTHY"}`, {
                                  defaultValue: advertiser.syncHealthStatus || "HEALTHY",
                                })}
                              </span>
                              {advertiser.syncIssueCode ? (
                                <div className="td-muted">
                                  {t(`adsManagement.syncIssue.${advertiser.syncIssueCode}`, {
                                    defaultValue: advertiser.syncIssueCode,
                                  })}
                                </div>
                              ) : null}
                              <div className="td-muted td-date">
                                {t("adsManagement.columns.tokenExpiry")}: {formatDate(advertiser.auth.accessTokenExpiresAt)}
                              </div>
                            </div>
                          </td>
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
                    </Fragment>
                  );
                })}
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
          <div className="ads-section-tools">
            <div className="ads-segmented-control">
              {([
                ["all", t("adsManagement.filters.all", { defaultValue: "All" })],
                ["partial", t("adsManagement.shopAdsStatus.partial", { defaultValue: "Partially covered" })],
                ["needs_link", t("adsManagement.shopAdsStatus.needs_link")],
                ["connected", t("adsManagement.shopAdsStatus.connected")],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  className={coverageFilter === value ? "active" : undefined}
                  onClick={() => setCoverageFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {shops.length === 0 ? (
          <div className="empty-cell">{t("adsManagement.noShops")}</div>
        ) : filteredCoverageGroups.length === 0 ? (
          <div className="empty-cell">{t("adsManagement.noMatchingResults", { defaultValue: "No matching results." })}</div>
        ) : (
          <div className="table-scroll-wrap shop-table-wrap ads-coverage-table-wrap">
            <table className="shop-table ads-advertiser-table ads-coverage-table">
              <thead>
                <tr>
                  <th>{t("adsManagement.shopColumns.shop")}</th>
                  <th>{t("adsManagement.shopColumns.region")}</th>
                  <th>{t("adsManagement.shopColumns.coverage")}</th>
                  <th>{t("adsManagement.shopColumns.advertiser")}</th>
                  <th>{t("adsManagement.shopColumns.gmvMax")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoverageGroups.map((group) => {
                  const expanded = Boolean(expandedCoverageGroups[group.key]);
                  const regions = shopCollectionRegions(group.shops)
                    .map((region) => formatShopRegionLabel(region, t))
                    .join(", ");
                  const advertiserLabel = group.advertisers.length === 0
                    ? "-"
                    : group.advertisers.length === 1
                      ? (group.advertisers[0].advertiserName || group.advertisers[0].advertiserId)
                      : t("adsManagement.totalAdvertisers", { defaultValue: "Advertisers" }) + `: ${group.advertisers.length}`;
                  const gmvReadyCount = group.rows.filter((row) => row.readiness.binding?.isGmvMaxAvailable).length;
                  return (
                    <Fragment key={group.key}>
                      <tr className="table-hover-row ads-coverage-group-row">
                        <td>
                          <button className="ads-coverage-toggle" onClick={() => toggleCoverageGroup(group.key)}>
                            <ChevronRightIcon className={expanded ? "ads-chevron-open" : undefined} />
                            <ShopIcon />
                            <span>
                              <span className="shop-table-name">{shopCollectionDisplayName(group.shops)}</span>
                              <span className="td-muted">
                                {group.shops.length} {t("ecommerce.shops", { defaultValue: "shops" })}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td>{regions || "-"}</td>
                        <td>
                          <span className={getReadinessBadgeClass(group.status)}>
                            {t(`adsManagement.shopAdsStatus.${group.status}`, {
                              defaultValue: group.status === "partial" ? "Partially covered" : group.status,
                            })}
                          </span>
                          <div className="td-muted">{group.connectedCount}/{group.shops.length}</div>
                        </td>
                        <td>{advertiserLabel}</td>
                        <td>{gmvReadyCount > 0 ? `${gmvReadyCount}/${group.shops.length}` : "-"}</td>
                      </tr>
                      {expanded && group.rows.map(({ shop, readiness, advertiser }) => {
                        const access = readiness.binding;
                        return (
                          <tr className="ads-coverage-child-row" key={shop.id}>
                            <td>
                              <div className="shop-table-name">{shop.alias || shop.shopName}</div>
                              <div className="td-muted td-code">{shop.platformShopId}</div>
                            </td>
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
                    </Fragment>
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
