import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { CloseIcon, ShopIcon } from "../../../components/icons.js";
import { formatShopRegionLabel } from "../../../lib/ecommerce-labels.js";
import { getAuthStatusBadgeClass } from "../ecommerce-utils.js";
import { getReadinessBadgeClass, navigateToAdsManagement, resolveShopAdsReadiness } from "../ads-readiness.js";
import { AiCustomerServiceTab } from "./AiCustomerServiceTab.js";
import { InventoryManagementTab } from "./InventoryManagementTab.js";
import { AffiliateManagementTab } from "./AffiliateManagementTab.js";
import { CustomerServiceBillingCta } from "../../../components/billing/CustomerServiceBillingCta.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import type { DrawerTab } from "../ecommerce-types.js";

const workspaceSectionId = (tab: DrawerTab, section: string) => `shop-workspace-${tab}-${section}`;

interface ShopDrawerProps {
  shop: Shop | null;
  isOpen: boolean;
  onClose: () => void;
  activeTab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  upgradePrompt: boolean;
  // Overview tab: service toggle
  togglingServiceId: string | null;
  onToggleCustomerService: (shopId: string, currentValue: boolean) => void;
  togglingInventoryServiceId: string | null;
  onToggleInventoryManagement: (shopId: string, currentValue: boolean) => void;
  togglingAffiliateServiceId: string | null;
  onToggleAffiliateService: (shopId: string, currentValue: boolean) => void;
  // AI CS tab props
  editBusinessPrompt: string;
  onEditBusinessPrompt: (value: string) => void;
  savingSettings: boolean;
  onSaveBusinessPrompt: () => void;
  selectedRunProfileId: string;
  runProfileOptions: Array<{ value: string; label: string }>;
  selectedRunProfile: { selectedToolIds: string[] } | null;
  savingRunProfile: boolean;
  onRunProfileChange: (profileId: string) => void;
  selectedCSProvider: string;
  selectedCSModel: string;
  savingModel: boolean;
  onCSModelChange: (provider: string, model: string) => void;
  draftUnpaidReachoutEnabled: boolean;
  draftUnpaidReachoutDelayHours: string;
  editUnpaidOrderReminderTemplate: string;
  savingUnpaidReachoutSettings: boolean;
  onToggleUnpaidReachoutEnabled: (value: boolean) => void;
  onDraftUnpaidReachoutDelayHoursChange: (value: string) => void;
  onEditUnpaidOrderReminderTemplate: (value: string) => void;
  onSaveUnpaidReachoutSettings: () => void;
  savingEscalation: boolean;
  draftEscalationChannel: string;
  draftEscalationRecipient: string;
  escalationChannelSelectOptions: Array<{ value: string; label: string }>;
  escalationRecipientOptions: Array<{ value: string; label: string }>;
  onDraftEscalationChannelChange: (value: string) => void;
  onEscalationRecipientChange: (value: string) => void;
  myDeviceId: string | null;
  togglingBindShopId: string | null;
  onBindDevice: (shopId: string) => void;
  onUnbindDevice: (shopId: string) => void;
  selectedAffiliateRunProfileId: string;
  selectedAffiliateRunProfile: { selectedToolIds: string[] } | null;
  savingAffiliateRunProfile: boolean;
  onAffiliateRunProfileChange: (profileId: string) => void;
  editAffiliateBusinessPrompt: string;
  onEditAffiliateBusinessPrompt: (value: string) => void;
  editAffiliateMinExpectedSalesUnits: string;
  onEditAffiliateMinExpectedSalesUnits: (value: string) => void;
  onCommitAffiliateMinExpectedSalesUnits: () => void;
  editAffiliateModelUsageScope: "USER_LEVEL" | "SHOP_LEVEL";
  onEditAffiliateModelUsageScope: (value: "USER_LEVEL" | "SHOP_LEVEL") => void;
  savingAffiliateSettings: boolean;
  onSaveAffiliateBusinessPrompt: () => void;
  togglingAffiliateBindShopId: string | null;
  onBindAffiliateDevice: (shopId: string) => void;
  onUnbindAffiliateDevice: (shopId: string) => void;
}

export const ShopDrawer = observer(function ShopDrawer({
  shop,
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  upgradePrompt,
  togglingServiceId,
  onToggleCustomerService,
  togglingInventoryServiceId,
  onToggleInventoryManagement,
  togglingAffiliateServiceId,
  onToggleAffiliateService,
  editBusinessPrompt,
  onEditBusinessPrompt,
  savingSettings,
  onSaveBusinessPrompt,
  selectedRunProfileId,
  runProfileOptions,
  selectedRunProfile,
  savingRunProfile,
  onRunProfileChange,
  selectedCSProvider,
  selectedCSModel,
  savingModel,
  onCSModelChange,
  draftUnpaidReachoutEnabled,
  draftUnpaidReachoutDelayHours,
  editUnpaidOrderReminderTemplate,
  savingUnpaidReachoutSettings,
  onToggleUnpaidReachoutEnabled,
  onDraftUnpaidReachoutDelayHoursChange,
  onEditUnpaidOrderReminderTemplate,
  onSaveUnpaidReachoutSettings,
  savingEscalation,
  draftEscalationChannel,
  draftEscalationRecipient,
  escalationChannelSelectOptions,
  escalationRecipientOptions,
  onDraftEscalationChannelChange,
  onEscalationRecipientChange,
  myDeviceId,
  togglingBindShopId,
  onBindDevice,
  onUnbindDevice,
  selectedAffiliateRunProfileId,
  selectedAffiliateRunProfile,
  savingAffiliateRunProfile,
  onAffiliateRunProfileChange,
  editAffiliateBusinessPrompt,
  onEditAffiliateBusinessPrompt,
  editAffiliateMinExpectedSalesUnits,
  onEditAffiliateMinExpectedSalesUnits,
  onCommitAffiliateMinExpectedSalesUnits,
  editAffiliateModelUsageScope,
  onEditAffiliateModelUsageScope,
  savingAffiliateSettings,
  onSaveAffiliateBusinessPrompt,
  togglingAffiliateBindShopId,
  onBindAffiliateDevice,
  onUnbindAffiliateDevice,
}: ShopDrawerProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const customerServiceEntitlement = shop
    ? entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ?? null
    : null;
  const adsReadiness = shop
    ? resolveShopAdsReadiness(shop, entityStore.adsAdvertisers, entityStore.adsStoreBindings)
    : null;
  const workspaceSections = useMemo(() => {
    if (!shop) {
      return [];
    }

    if (activeTab === "overview") {
      return [
        { id: workspaceSectionId(activeTab, "shop-info"), label: t("ecommerce.shopDrawer.overview.shopInfo") },
        { id: workspaceSectionId(activeTab, "ads"), label: t("ecommerce.shopDrawer.overview.adsReadiness") },
        { id: workspaceSectionId(activeTab, "tokens"), label: t("ecommerce.shopDrawer.overview.tokenExpiry") },
        { id: workspaceSectionId(activeTab, "services"), label: t("ecommerce.shopDrawer.overview.services") },
      ];
    }

    if (activeTab === "aiCustomerService" && shop.services?.customerService?.enabled) {
      return [
        { id: workspaceSectionId(activeTab, "service"), label: t("ecommerce.shopDrawer.aiCS.serviceStatus") },
        { id: workspaceSectionId(activeTab, "device"), label: t("ecommerce.shopDrawer.aiCS.csBindDevice") },
        { id: workspaceSectionId(activeTab, "run-profile"), label: t("ecommerce.shopDrawer.aiCS.runProfile") },
        { id: workspaceSectionId(activeTab, "model"), label: t("ecommerce.shopDrawer.aiCS.csModelOverride") },
        { id: workspaceSectionId(activeTab, "unpaid-reachout"), label: t("ecommerce.shopDrawer.aiCS.unpaidReachout") },
        { id: workspaceSectionId(activeTab, "escalation"), label: t("tiktokShops.detail.escalationRouting") },
        { id: workspaceSectionId(activeTab, "prompt"), label: t("ecommerce.shopDrawer.aiCS.businessPrompt") },
        { id: workspaceSectionId(activeTab, "credits"), label: t("ecommerce.shopDrawer.aiCS.credits") },
      ];
    }

    if (activeTab === "warehouseMapping" && shop.services?.wms?.enabled) {
      return [
        { id: workspaceSectionId(activeTab, "warehouses"), label: t("ecommerce.inventory.shopWarehouses") },
      ];
    }

    if (activeTab === "affiliateManagement" && shop.services?.affiliateService?.enabled) {
      return [
        { id: workspaceSectionId(activeTab, "service"), label: t("ecommerce.shopDrawer.affiliate.serviceStatus") },
        { id: workspaceSectionId(activeTab, "run-profile"), label: t("ecommerce.shopDrawer.affiliate.runProfile") },
        { id: workspaceSectionId(activeTab, "model"), label: t("ecommerce.shopDrawer.affiliate.modelUsageScope") },
        { id: workspaceSectionId(activeTab, "thresholds"), label: t("ecommerce.shopDrawer.affiliate.decisionThresholds") },
        { id: workspaceSectionId(activeTab, "policies"), label: t("ecommerce.affiliateWorkspace.policies.title") },
        { id: workspaceSectionId(activeTab, "prompt"), label: t("ecommerce.shopDrawer.affiliate.businessPrompt") },
      ];
    }

    return [];
  }, [
    activeTab,
    shop,
    shop?.services?.affiliateService?.enabled,
    shop?.services?.customerService?.enabled,
    shop?.services?.wms?.enabled,
    t,
  ]);
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState("");

  useEffect(() => {
    setActiveWorkspaceSection(workspaceSections[0]?.id ?? "");
  }, [workspaceSections]);

  const handleWorkspaceSectionClick = (sectionId: string) => {
    setActiveWorkspaceSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div
        className={`drawer-overlay${isOpen ? " drawer-overlay-visible" : ""}`}
        onClick={onClose}
      />
      <div className={`drawer-panel${isOpen ? " drawer-panel-open" : ""}`}>
        <div className="drawer-header">
          <div className="drawer-header-left">
            <span className="drawer-header-icon">
              <ShopIcon size={20} />
            </span>
            <div className="drawer-header-info">
              <h3 className="drawer-header-title">{shop?.shopName ?? ""}</h3>
              {shop && (
                <span className={getAuthStatusBadgeClass(shop.authStatus)}>
                  {t(`tiktokShops.authStatus_${shop.authStatus}`)}
                </span>
              )}
            </div>
          </div>
          {shop && (
            <div className="drawer-tab-bar drawer-tab-bar-header">
              <button
                className={`drawer-tab-btn ${activeTab === "overview" ? "drawer-tab-btn-active" : ""}`}
                onClick={() => onTabChange("overview")}
              >
                {t("ecommerce.shopDrawer.tabs.overview")}
              </button>
              {shop.services?.customerService?.enabled && (
                <button
                  className={`drawer-tab-btn ${activeTab === "aiCustomerService" ? "drawer-tab-btn-active" : ""}`}
                  onClick={() => onTabChange("aiCustomerService")}
                >
                  {t("ecommerce.shopDrawer.tabs.aiCustomerService")}
                </button>
              )}
              {shop.services?.wms?.enabled && (
                <button
                  className={`drawer-tab-btn ${activeTab === "warehouseMapping" ? "drawer-tab-btn-active" : ""}`}
                  onClick={() => onTabChange("warehouseMapping")}
                >
                  {t("ecommerce.inventory.shopMappings")}
                </button>
              )}
              {shop.services?.affiliateService?.enabled && (
                <button
                  className={`drawer-tab-btn ${activeTab === "affiliateManagement" ? "drawer-tab-btn-active" : ""}`}
                  onClick={() => onTabChange("affiliateManagement")}
                >
                  {t("ecommerce.shopDrawer.tabs.affiliateManagement")}
                </button>
              )}
            </div>
          )}
          <button className="drawer-close-btn" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </div>

        {shop && (
          <div className="drawer-body">
            {upgradePrompt && (
              <div className="info-box info-box-blue">
                {t("ecommerce.upgradeRequired")}
              </div>
            )}
            <div className="shop-workspace-shell">
              <aside className="shop-workspace-side-menu" aria-label={t("ecommerce.shopDrawer.tabs.overview")}>
                {workspaceSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={`shop-workspace-side-menu-item${activeWorkspaceSection === section.id ? " shop-workspace-side-menu-item-active" : ""}`}
                    onClick={() => handleWorkspaceSectionClick(section.id)}
                  >
                    {section.label}
                  </button>
                ))}
              </aside>

              <div className="shop-workspace-main">
                {/* Tab: Overview */}
                {activeTab === "overview" && (
                  <div className="shop-detail-section">
                    <section id={workspaceSectionId("overview", "shop-info")} className="shop-workspace-section">
                      <div className="drawer-section-label">{t("ecommerce.shopDrawer.overview.shopInfo")}</div>
                      <div className="shop-info-card">
                        <div className="shop-info-row">
                          <span className="shop-info-label">{t("ecommerce.table.headers.name")}</span>
                          <span className="shop-info-value">{shop.shopName}</span>
                        </div>
                        <div className="shop-info-row">
                          <span className="shop-info-label">{t("ecommerce.table.headers.region")}</span>
                          <span className="shop-info-value">{formatShopRegionLabel(shop.region, t)}</span>
                        </div>
                        <div className="shop-info-row">
                          <span className="shop-info-label">{t("ecommerce.table.headers.platform")}</span>
                          <span className="shop-info-value">{shop.platform === "TIKTOK_SHOP" ? "TikTok Shop" : shop.platform}</span>
                        </div>
                        <div className="shop-info-row">
                          <span className="shop-info-label">{t("ecommerce.table.headers.authStatus")}</span>
                          <span className={getAuthStatusBadgeClass(shop.authStatus)}>
                            {t(`tiktokShops.authStatus_${shop.authStatus}`)}
                          </span>
                        </div>
                      </div>
                    </section>

                    <section id={workspaceSectionId("overview", "ads")} className="shop-workspace-section">
                      <div className="drawer-section-label">{t("ecommerce.shopDrawer.overview.adsReadiness")}</div>
                      <div className="shop-info-card">
                        <div className="shop-info-row">
                          <span className="shop-info-label">{t("ecommerce.table.headers.adsStatus")}</span>
                          <span className="shop-info-value">
                            {adsReadiness && (
                              <span className={getReadinessBadgeClass(adsReadiness.status)}>
                                {t(`ecommerce.shopAdsStatus.${adsReadiness.status}`)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="shop-info-row">
                          <span className="shop-info-label">{t("adsManagement.shopColumns.advertiser")}</span>
                          <span className="shop-info-value td-code">
                            {adsReadiness?.binding?.advertiserId ?? "-"}
                          </span>
                        </div>
                        <div className="shop-info-row">
                          <span className="shop-info-label">{t("adsManagement.shopColumns.gmvMax")}</span>
                          <span className="shop-info-value">
                            {adsReadiness?.binding?.isGmvMaxAvailable == null
                              ? "-"
                              : adsReadiness.binding.isGmvMaxAvailable ? t("common.yes") : t("common.no")}
                          </span>
                        </div>
                        <div className="shop-info-card-hint">
                          {adsReadiness && t(`ecommerce.shopAdsStatus.hint_${adsReadiness.status}`)}
                        </div>
                        <div className="shop-info-card-actions">
                          <button className="btn btn-secondary btn-sm" onClick={navigateToAdsManagement}>
                            {t("ecommerce.table.manageAds")}
                          </button>
                        </div>
                      </div>
                    </section>

                    <section id={workspaceSectionId("overview", "tokens")} className="shop-workspace-section">
                      <div className="drawer-section-label">{t("ecommerce.shopDrawer.overview.tokenExpiry")}</div>
                      <div className="shop-info-card">
                        <div className="shop-info-row">
                          <span className="shop-info-label">{t("tiktokShops.detail.accessTokenExpiry")}</span>
                          <span className={`shop-info-value${shop.accessTokenExpiresAt && new Date(shop.accessTokenExpiresAt).getTime() < Date.now() ? " shop-info-value-danger" : ""}`}>
                            {shop.accessTokenExpiresAt
                              ? new Date(shop.accessTokenExpiresAt).toLocaleString()
                              : "\u2014"}
                          </span>
                        </div>
                        <div className="shop-info-row">
                          <span className="shop-info-label">{t("tiktokShops.detail.refreshTokenExpiry")}</span>
                          <span className={`shop-info-value${shop.refreshTokenExpiresAt && new Date(shop.refreshTokenExpiresAt).getTime() < Date.now() ? " shop-info-value-danger" : ""}`}>
                            {shop.refreshTokenExpiresAt
                              ? new Date(shop.refreshTokenExpiresAt).toLocaleString()
                              : "\u2014"}
                          </span>
                        </div>
                      </div>
                    </section>

                    <section id={workspaceSectionId("overview", "services")} className="shop-workspace-section">
                      <div className="drawer-section-label">{t("ecommerce.shopDrawer.overview.services")}</div>
                      <div className="shop-toggle-card">
                        <div className="shop-toggle-card-left">
                          <span className="shop-toggle-card-label">
                            {t("ecommerce.shopDrawer.overview.csToggle")}
                          </span>
                          <span className={shop.services?.customerService?.enabled ? "badge badge-active" : "badge badge-muted"}>
                            {shop.services?.customerService?.enabled
                              ? t("common.enabled")
                              : t("common.disabled")}
                          </span>
                          <span className="shop-info-card-hint">
                            {t("ecommerce.shopDrawer.overview.csToggleHint")}
                          </span>
                          {!customerServiceEntitlement?.allowed && (
                            <CustomerServiceBillingCta
                              shopId={shop.id}
                              shopName={shop.alias || shop.shopName}
                              entitlement={customerServiceEntitlement}
                              variant="inline"
                            />
                          )}
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={shop.services?.customerService?.enabled}
                            onChange={() =>
                              onToggleCustomerService(
                                shop.id,
                                shop.services?.customerService?.enabled ?? false,
                              )
                            }
                            disabled={togglingServiceId === shop.id}
                          />
                          <span
                            className={`toggle-track ${shop.services?.customerService?.enabled ? "toggle-track-on" : "toggle-track-off"} ${togglingServiceId === shop.id ? "toggle-track-disabled" : ""}`}
                          >
                            <span
                              className={`toggle-thumb ${shop.services?.customerService?.enabled ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                            />
                          </span>
                        </label>
                      </div>

                      <div className="shop-toggle-card">
                        <div className="shop-toggle-card-left">
                          <span className="shop-toggle-card-label">
                            {t("ecommerce.shopDrawer.overview.inventoryToggle")}
                          </span>
                          <span className={shop.services?.wms?.enabled ? "badge badge-active" : "badge badge-muted"}>
                            {shop.services?.wms?.enabled
                              ? t("common.enabled")
                              : t("common.disabled")}
                          </span>
                          <span className="shop-info-card-hint">
                            {t("ecommerce.inventory.enableShopHint")}
                          </span>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={shop.services?.wms?.enabled ?? false}
                            onChange={() =>
                              onToggleInventoryManagement(
                                shop.id,
                                shop.services?.wms?.enabled ?? false,
                              )
                            }
                            disabled={togglingInventoryServiceId === shop.id}
                          />
                          <span
                            className={`toggle-track ${shop.services?.wms?.enabled ? "toggle-track-on" : "toggle-track-off"} ${togglingInventoryServiceId === shop.id ? "toggle-track-disabled" : ""}`}
                          >
                            <span
                              className={`toggle-thumb ${shop.services?.wms?.enabled ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                            />
                          </span>
                        </label>
                      </div>

                      <div className="shop-toggle-card">
                        <div className="shop-toggle-card-left">
                          <span className="shop-toggle-card-label">
                            {t("ecommerce.shopDrawer.overview.affiliateToggle")}
                          </span>
                          <span className={shop.services?.affiliateService?.enabled ? "badge badge-active" : "badge badge-muted"}>
                            {shop.services?.affiliateService?.enabled
                              ? t("common.enabled")
                              : t("common.disabled")}
                          </span>
                          <span className="shop-info-card-hint">
                            {t("ecommerce.shopDrawer.overview.affiliateToggleHint")}
                          </span>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={shop.services?.affiliateService?.enabled ?? false}
                            onChange={() =>
                              onToggleAffiliateService(
                                shop.id,
                                shop.services?.affiliateService?.enabled ?? false,
                              )
                            }
                            disabled={togglingAffiliateServiceId === shop.id}
                          />
                          <span
                            className={`toggle-track ${shop.services?.affiliateService?.enabled ? "toggle-track-on" : "toggle-track-off"} ${togglingAffiliateServiceId === shop.id ? "toggle-track-disabled" : ""}`}
                          >
                            <span
                              className={`toggle-thumb ${shop.services?.affiliateService?.enabled ? "toggle-thumb-on" : "toggle-thumb-off"}`}
                            />
                          </span>
                        </label>
                      </div>
                    </section>
                  </div>
                )}

                {/* Tab: AI Customer Service */}
                {activeTab === "aiCustomerService" && shop.services?.customerService?.enabled && (
                  <AiCustomerServiceTab
                    shop={shop}
                    editBusinessPrompt={editBusinessPrompt}
                    onEditBusinessPrompt={onEditBusinessPrompt}
                    savingSettings={savingSettings}
                    onSaveBusinessPrompt={onSaveBusinessPrompt}
                    selectedRunProfileId={selectedRunProfileId}
                    runProfileOptions={runProfileOptions}
                    selectedRunProfile={selectedRunProfile}
                    savingRunProfile={savingRunProfile}
                    onRunProfileChange={onRunProfileChange}
                    selectedCSProvider={selectedCSProvider}
                    selectedCSModel={selectedCSModel}
                    savingModel={savingModel}
                    onCSModelChange={onCSModelChange}
                    draftUnpaidReachoutEnabled={draftUnpaidReachoutEnabled}
                    draftUnpaidReachoutDelayHours={draftUnpaidReachoutDelayHours}
                    editUnpaidOrderReminderTemplate={editUnpaidOrderReminderTemplate}
                    savingUnpaidReachoutSettings={savingUnpaidReachoutSettings}
                    onToggleUnpaidReachoutEnabled={onToggleUnpaidReachoutEnabled}
                    onDraftUnpaidReachoutDelayHoursChange={onDraftUnpaidReachoutDelayHoursChange}
                    onEditUnpaidOrderReminderTemplate={onEditUnpaidOrderReminderTemplate}
                    onSaveUnpaidReachoutSettings={onSaveUnpaidReachoutSettings}
                    savingEscalation={savingEscalation}
                    draftEscalationChannel={draftEscalationChannel}
                    draftEscalationRecipient={draftEscalationRecipient}
                    escalationChannelSelectOptions={escalationChannelSelectOptions}
                    escalationRecipientOptions={escalationRecipientOptions}
                    onDraftEscalationChannelChange={onDraftEscalationChannelChange}
                    onEscalationRecipientChange={onEscalationRecipientChange}
                    myDeviceId={myDeviceId}
                    togglingBindShopId={togglingBindShopId}
                    onBindDevice={onBindDevice}
                    onUnbindDevice={onUnbindDevice}
                  />
                )}

                {activeTab === "warehouseMapping" && shop.services?.wms?.enabled && (
                  <InventoryManagementTab shop={shop} />
                )}

                {activeTab === "affiliateManagement" && shop.services?.affiliateService?.enabled && (
                  <AffiliateManagementTab
                    shop={shop}
                    selectedRunProfileId={selectedAffiliateRunProfileId}
                    runProfileOptions={runProfileOptions}
                    selectedRunProfile={selectedAffiliateRunProfile}
                    savingRunProfile={savingAffiliateRunProfile}
                    onRunProfileChange={onAffiliateRunProfileChange}
                    editBusinessPrompt={editAffiliateBusinessPrompt}
                    onEditBusinessPrompt={onEditAffiliateBusinessPrompt}
                    editMinExpectedSalesUnits={editAffiliateMinExpectedSalesUnits}
                    onEditMinExpectedSalesUnits={onEditAffiliateMinExpectedSalesUnits}
                    onCommitMinExpectedSalesUnits={onCommitAffiliateMinExpectedSalesUnits}
                    editModelUsageScope={editAffiliateModelUsageScope}
                    onEditModelUsageScope={onEditAffiliateModelUsageScope}
                    savingSettings={savingAffiliateSettings}
                    onSaveBusinessPrompt={onSaveAffiliateBusinessPrompt}
                    myDeviceId={myDeviceId}
                    togglingBindShopId={togglingAffiliateBindShopId}
                    onBindDevice={onBindAffiliateDevice}
                    onUnbindDevice={onUnbindAffiliateDevice}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
});
