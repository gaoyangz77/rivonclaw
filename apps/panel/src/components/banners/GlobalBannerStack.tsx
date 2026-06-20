import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { panelEventBus } from "../../lib/event-bus.js";
import { useToast } from "../Toast.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { useRuntimeStatus } from "../../store/RuntimeStatusProvider.js";
import { CloudLlmQuotaBanner } from "./CloudLlmQuotaBanner.js";
import {
  CustomerServiceBridgeBanner,
  CustomerServiceRoutingBanner,
  type CustomerServiceRoutingProblem,
} from "./CustomerServiceBanners.js";
import { LlmUnavailableBanner } from "./LlmUnavailableBanner.js";
import { UpdateBanner } from "./UpdateBanner.js";

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

  // CS bridge warning: show when shops need CS on this device but bridge isn't connected.
  // Derived from entity store + device identity — mirrors CS bridge's syncFromCache() filter.
  const csBridgeState = runtimeStatus.csBridge.state;
  const showCsBridgeBanner =
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
      return {
        shopId: shop.id,
        shopName: shop.alias || shop.shopName || shop.platformShopId || shop.id,
        issue,
      };
    })
    .filter((item): item is CustomerServiceRoutingProblem => item !== null);

  return (
    <>
      <UpdateBanner onCurrentVersionChange={onCurrentVersionChange} />
      <CloudLlmQuotaBanner onNavigate={onNavigate} />
      <LlmUnavailableBanner show={showLlmUnavailableBanner} />
      <CustomerServiceBridgeBanner
        show={showCsBridgeBanner}
        state={csBridgeState}
        reconnectAttempt={runtimeStatus.csBridge.reconnectAttempt}
      />
      <CustomerServiceRoutingBanner problems={customerServiceRoutingProblems} />
    </>
  );
});
