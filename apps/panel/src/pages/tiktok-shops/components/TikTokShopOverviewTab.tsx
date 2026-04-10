import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { getAuthStatusBadgeClass } from "../tiktok-shops-utils.js";

interface TikTokShopOverviewTabProps {
  shop: Shop;
  togglingServiceId: string | null;
  editBusinessPrompt: string;
  onEditBusinessPrompt: (value: string) => void;
  savingSettings: boolean;
  onToggleCustomerService: (shopId: string, currentValue: boolean) => void;
  onSaveBusinessPrompt: () => void;
}

export function TikTokShopOverviewTab({
  shop,
  togglingServiceId,
  editBusinessPrompt,
  onEditBusinessPrompt,
  savingSettings,
  onToggleCustomerService,
  onSaveBusinessPrompt,
}: TikTokShopOverviewTabProps) {
  const { t } = useTranslation();

  return (
    <div className="shop-detail-section">
      {/* Shop Info */}
      <div className="shop-detail-grid">
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.tableHeaders.name")}</span>
          <span>{shop.shopName}</span>
        </div>
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.tableHeaders.region")}</span>
          <span>{shop.region}</span>
        </div>
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.detail.platform")}</span>
          <span>{shop.platform === "TIKTOK_SHOP" ? "TikTok Shop" : shop.platform}</span>
        </div>
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.tableHeaders.authStatus")}</span>
          <span className={getAuthStatusBadgeClass(shop.authStatus)}>
            {t(`tiktokShops.authStatus_${shop.authStatus}`)}
          </span>
        </div>
      </div>

      {/* Token Info */}
      <div className="shop-detail-grid">
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.detail.accessTokenExpiry")}</span>
          <span>
            {shop.accessTokenExpiresAt
              ? new Date(shop.accessTokenExpiresAt).toLocaleString()
              : "\u2014"}
          </span>
        </div>
        <div className="shop-detail-field">
          <span className="form-label-block">{t("tiktokShops.detail.refreshTokenExpiry")}</span>
          <span>
            {shop.refreshTokenExpiresAt
              ? new Date(shop.refreshTokenExpiresAt).toLocaleString()
              : "\u2014"}
          </span>
        </div>
      </div>

      {/* Service Toggle */}
      <div className="shop-services-row">
        <div className="shop-service-toggle">
          <span className="shop-service-label">
            {t("tiktokShops.customerServiceLabel")}
          </span>
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
          <span className={shop.services?.customerService?.enabled ? "badge badge-active" : "badge badge-muted"}>
            {shop.services?.customerService?.enabled
              ? t("common.enabled")
              : t("common.disabled")}
          </span>
        </div>
      </div>

      {/* Business Prompt */}
      {shop.services?.customerService?.enabled && (
        <div>
          <label className="form-label-block">
            {t("tiktokShops.detail.businessPrompt")}
          </label>
          <div className="form-hint">{t("tiktokShops.detail.businessPromptHint")}</div>
          <textarea
            className="input-full textarea-resize-vertical shop-prompt-textarea"
            value={editBusinessPrompt}
            onChange={(e) => onEditBusinessPrompt(e.target.value)}
            rows={4}
          />
          <div className="modal-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={onSaveBusinessPrompt}
              disabled={savingSettings}
            >
              {savingSettings ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
