import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { panelEventBus } from "../../lib/event-bus.js";
import { shopDisplayLabel } from "../../lib/shop-display.js";
import { useToast } from "../Toast.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { useRuntimeStatus } from "../../store/RuntimeStatusProvider.js";
import { AffiliateBdDeviceBanner } from "./AffiliateBdDeviceBanner.js";
import { CloudLlmQuotaBanner } from "./CloudLlmQuotaBanner.js";
import { CloudToolsBanner } from "./CloudToolsBanner.js";
import { GatewayStartupFailureBanner } from "./GatewayStartupFailureBanner.js";
import {
  CustomerServiceBridgeBanner,
  CustomerServiceRoutingBanner,
  type CustomerServiceRoutingProblem,
} from "./CustomerServiceBanners.js";
import { LlmUnavailableBanner } from "./LlmUnavailableBanner.js";
import { UpdateBanner } from "./UpdateBanner.js";
import { AccountSwitchBanner } from "./AccountSwitchBanner.js";

interface GlobalBannerStackProps {
  onNavigate: (path: string) => void;
  onCurrentVersionChange: (version: string) => void;
}

export const GlobalBannerStack = observer(function GlobalBannerStack({
  onNavigate,
  onCurrentVersionChange,
}: GlobalBannerStackProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const runtimeStatus = useRuntimeStatus();
  const user = entityStore.currentUser;
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";

  useEffect(() => {
    const unsubscribeShop = panelEventBus.subscribe("shop-updated", (raw) => {
      const { shopName } = raw as { shopId: string; shopName: string };
      showToast(t("ecommerce.shopUpdatedToast", { shopName }), "success");
    });
    return () => {
      unsubscribeShop();
    };
  }, [showToast, t]);

  const hasActiveLlmProvider = entityStore.providerKeys.some((key) => key.isDefault);
  const showLlmUnavailableBanner = Boolean(user) && !authChecking && !hasActiveLlmProvider;

  // A gateway that cannot start is the root cause of every downstream
  // disconnect, so its own reason replaces the generic CS bridge warning.
  const gatewayStartupFailure = runtimeStatus.openClawConnector.startupFailure;

  // CS bridge warning: show when shops need CS on this device but bridge isn't connected.
  // Derived from entity store + device identity — mirrors CS bridge's syncFromCache() filter.
  const csBridgeState = runtimeStatus.csBridge.state;
  const showCsBridgeBanner =
    gatewayStartupFailure === "" &&
    csBridgeState !== "connected" &&
    runtimeStatus.deviceId !== "" &&
    entityStore.shops.some((shop) => {
      const cs = shop.services?.customerService;
      return shop.handlesCustomerServiceOnDevice(runtimeStatus.deviceId) && cs?.assembledPrompt;
    });

  const customerServiceRoutingProblems: CustomerServiceRoutingProblem[] = entityStore.shops
    .map((shop) => {
      const issue = shop.getCustomerServiceRoutingIssue({
        currentDeviceId: runtimeStatus.deviceId || null,
        channelAccounts: entityStore.channelAccounts,
      });
      if (!issue) return null;
      const label = shopDisplayLabel(shop, shop.id);
      return {
        shopId: shop.id,
        shopName: label.text,
        shopNameSensitive: label.sensitive,
        issue,
      };
    })
    .filter((item): item is CustomerServiceRoutingProblem => item !== null);

  return (
    <>
      <AccountSwitchBanner />
      <UpdateBanner onCurrentVersionChange={onCurrentVersionChange} />
      <CloudLlmQuotaBanner onNavigate={onNavigate} />
      <CloudToolsBanner state={runtimeStatus.cloudTools.state} />
      <LlmUnavailableBanner show={showLlmUnavailableBanner} />
      <GatewayStartupFailureBanner reason={gatewayStartupFailure} />
      <AffiliateBdDeviceBanner onNavigate={onNavigate} />
      <CustomerServiceBridgeBanner
        show={showCsBridgeBanner}
        state={csBridgeState}
        reconnectAttempt={runtimeStatus.csBridge.reconnectAttempt}
      />
      <CustomerServiceRoutingBanner problems={customerServiceRoutingProblems} />
    </>
  );
});
