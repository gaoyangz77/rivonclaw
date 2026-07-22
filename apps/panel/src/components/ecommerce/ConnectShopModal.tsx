import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../modals/Modal.js";
import { Select } from "../inputs/Select.js";
import { CopyIcon, CheckIcon, InfoIcon } from "../icons.js";
import { GQL } from "@rivonclaw/core";
import type { PlatformApp } from "@rivonclaw/core/models";
import {
  onboardingMarkets,
  onboardingPlatforms,
  onboardingSellerTypes,
  platformAppsForOnboardingSelection,
} from "../../lib/shop-onboarding-options.js";

interface ConnectShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  platformApps: PlatformApp[];
  oauthLoading: boolean;
  oauthWaiting: boolean;
  oauthAuthUrl: string | null;
  linkCopied: boolean;
  onConnectShop: (platformAppId: string) => void;
  onCopyAuthUrl: () => void;
  onCancelOAuth: () => void;
}

export function ConnectShopModal({
  isOpen,
  onClose,
  platformApps,
  oauthLoading,
  oauthWaiting,
  oauthAuthUrl,
  linkCopied,
  onConnectShop,
  onCopyAuthUrl,
  onCancelOAuth,
}: ConnectShopModalProps) {
  const { t } = useTranslation();

  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [selectedSellerType, setSelectedSellerType] = useState<string>("");
  const prevOpenRef = useRef(false);

  const availablePlatforms = onboardingPlatforms(platformApps);
  const availableMarkets = onboardingMarkets(platformApps, selectedPlatform);
  const availableSellerTypes = onboardingSellerTypes(
    platformApps,
    selectedPlatform,
    selectedMarket,
  );
  const preferredPlatform = availablePlatforms.includes(GQL.PlatformType.TiktokShop)
    ? GQL.PlatformType.TiktokShop
    : (availablePlatforms[0] ?? "");

  // TikTok Shop is the primary onboarding platform; market remains explicit.
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setSelectedPlatform(preferredPlatform);
      setSelectedMarket("");
      setSelectedSellerType("");
    } else if (isOpen && !selectedPlatform && preferredPlatform) {
      // PlatformApps may finish loading after the modal opens.
      setSelectedPlatform(preferredPlatform);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, preferredPlatform, selectedPlatform]);

  const matchedApps = platformAppsForOnboardingSelection(
    platformApps,
    selectedPlatform,
    selectedMarket,
    selectedSellerType,
  );

  const selectedPlatformAppId = matchedApps.length === 1 ? matchedApps[0].id : "";

  const matchError = !selectedMarket || !selectedSellerType || !selectedPlatform
    ? null
    : matchedApps.length === 0
      ? t("ecommerce.addShopModal.noMatch")
      : matchedApps.length > 1
        ? t("ecommerce.addShopModal.multipleMatch")
        : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (oauthWaiting) {
          onCancelOAuth();
        }
        onClose();
      }}
      title={t("ecommerce.addShopModal.title")}
      preventBackdropClose={oauthWaiting}
    >
      <div className="modal-form-col">
        {!oauthWaiting ? (
          <>
            <div>
              <label className="form-label-block">
                {t("ecommerce.addShopModal.platformLabel")} <span className="required">*</span>
              </label>
              {platformApps.length === 0 ? (
                <div className="form-hint">{t("tiktokShops.noPlatformApps")}</div>
              ) : (
                <Select
                  value={selectedPlatform}
                  onChange={(value) => {
                    setSelectedPlatform(value);
                    setSelectedMarket("");
                    setSelectedSellerType("");
                  }}
                  className="input-full"
                  ariaLabel={t("ecommerce.addShopModal.platformLabel")}
                  placeholder={t("ecommerce.addShopModal.platformPlaceholder")}
                  options={availablePlatforms.map((platform) => ({
                    value: platform,
                    label: t(`ecommerce.platform.${platform}`, { defaultValue: platform }),
                  }))}
                />
              )}
            </div>
            <div>
              <label className="form-label-block">
                {t("ecommerce.addShopModal.marketLabel")} <span className="required">*</span>
              </label>
              <Select
                value={selectedMarket}
                onChange={(value) => {
                  setSelectedMarket(value);
                  const sellerTypes = onboardingSellerTypes(
                    platformApps,
                    selectedPlatform,
                    value,
                  );
                  setSelectedSellerType(sellerTypes[0] ?? "");
                }}
                className="input-full"
                ariaLabel={t("ecommerce.addShopModal.marketLabel")}
                placeholder={t("ecommerce.addShopModal.marketPlaceholder")}
                searchable
                searchPlaceholder={t("ecommerce.addShopModal.marketSearchPlaceholder")}
                disabled={!selectedPlatform}
                options={availableMarkets.map((market) => ({
                  value: market,
                  label: t(`ecommerce.market.${market}`, { defaultValue: market }),
                }))}
              />
            </div>
            <div>
              <label className="form-label-block">
                {t("ecommerce.addShopModal.sellerTypeLabel")} <span className="required">*</span>
              </label>
              <Select
                value={selectedSellerType}
                onChange={setSelectedSellerType}
                className="input-full"
                ariaLabel={t("ecommerce.addShopModal.sellerTypeLabel")}
                placeholder={t("ecommerce.addShopModal.sellerTypePlaceholder")}
                disabled={!selectedPlatform || !selectedMarket}
                options={availableSellerTypes.map((sellerType) => ({
                  value: sellerType,
                  label: t(`ecommerce.sellerType.${sellerType}`, { defaultValue: sellerType }),
                }))}
              />
            </div>
            {matchError && (
              <div className="form-hint form-hint-error">{matchError}</div>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={onClose}
              >
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => onConnectShop(selectedPlatformAppId)}
                disabled={oauthLoading || !selectedPlatformAppId}
              >
                {oauthLoading ? t("common.loading") : t("ecommerce.addShopModal.addButton")}
              </button>
            </div>
          </>
        ) : (
          <div className="oauth-flow">
            <div className="oauth-flow-step">
              <span className="oauth-flow-step-num">1</span>
              <span className="oauth-flow-step-text">{t("ecommerce.addShopModal.authLink")}</span>
            </div>
            <div className="auth-link-box">
              <div className="auth-link-url-row">
                <div className="auth-link-url">{oauthAuthUrl}</div>
                <button
                  className={`auth-link-copy-btn${linkCopied ? " auth-link-copy-btn-success" : ""}`}
                  onClick={onCopyAuthUrl}
                >
                  {linkCopied ? <CheckIcon /> : <CopyIcon />}
                  {linkCopied
                    ? t("ecommerce.addShopModal.copySuccess")
                    : t("ecommerce.addShopModal.copyButton")}
                </button>
              </div>
            </div>
            <div className="auth-link-hint">
              <InfoIcon />
              <span>{t("ecommerce.addShopModal.tooltip")}</span>
            </div>

            <div className="oauth-flow-step">
              <span className="oauth-flow-step-num">2</span>
              <span className="oauth-flow-step-text">{t("ecommerce.addShopModal.waitingAuth")}</span>
            </div>
            <div className="oauth-waiting-indicator">
              <span className="oauth-waiting-spinner" />
              <span className="oauth-waiting-text">{t("ecommerce.addShopModal.waitingAuth")}</span>
            </div>

            <div className="oauth-flow-actions">
              <button
                className="btn btn-secondary"
                onClick={onCancelOAuth}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
