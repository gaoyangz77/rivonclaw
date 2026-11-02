import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { useRuntimeStatus } from "../../../store/RuntimeStatusProvider.js";
import { entitlementStatusLabel } from "../../../components/billing/billing-labels.js";
import { TkBadge } from "../../../components/design-system/index.js";

const ASSIGNMENT_BADGE = {
  unassigned: {
    tone: "warning",
    labelKey: "ecommerce.customerServiceDeviceStatus.notRunning",
  },
  current_device: {
    tone: "success",
    labelKey: "ecommerce.customerServiceDeviceStatus.currentDevice",
  },
  other_device: {
    tone: "info",
    labelKey: "ecommerce.customerServiceDeviceStatus.otherDevice",
  },
} as const;

export const BalanceBadge = observer(function BalanceBadge({
  shop,
}: {
  shop: Shop;
}): JSX.Element | null {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const runtimeStatus = useRuntimeStatus();
  if (!shop.services?.customerService?.enabled) {
    return <TkBadge tone="neutral">{t("common.disabled")}</TkBadge>;
  }
  const entitlement =
    entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ??
    null;
  if (!entitlement) return null;

  const assignment = shop.customerServiceDeviceAssignment(runtimeStatus.deviceId);
  const assignmentBadge = ASSIGNMENT_BADGE[assignment];

  return (
    <div className="shop-service-badges">
      <TkBadge tone={entitlement.allowed ? "success" : "warning"}>
        {entitlementStatusLabel(t, entitlement)}
      </TkBadge>
      {entitlement.allowed ? (
        <TkBadge tone={assignmentBadge.tone}>{t(assignmentBadge.labelKey)}</TkBadge>
      ) : null}
    </div>
  );
});
