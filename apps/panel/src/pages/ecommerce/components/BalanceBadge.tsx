import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import type { Shop } from "@rivonclaw/core/models";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { useRuntimeStatus } from "../../../store/RuntimeStatusProvider.js";
import { entitlementStatusLabel } from "../../../components/billing/billing-labels.js";

const ASSIGNMENT_BADGE = {
  unassigned: {
    className: "badge badge-warning",
    labelKey: "ecommerce.customerServiceDeviceStatus.notRunning",
  },
  current_device: {
    className: "badge badge-success",
    labelKey: "ecommerce.customerServiceDeviceStatus.currentDevice",
  },
  other_device: {
    className: "badge badge-info",
    labelKey: "ecommerce.customerServiceDeviceStatus.otherDevice",
  },
} as const;

export const BalanceBadge = observer(function BalanceBadge({ shop }: { shop: Shop }): JSX.Element | null {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const runtimeStatus = useRuntimeStatus();
  if (!shop.services?.customerService?.enabled) {
    return <span className="badge badge-muted">{t("common.disabled")}</span>;
  }
  const entitlement = entityStore.billingOverview?.shops.find((item) => item.shopId === shop.id)?.customerService ?? null;
  if (!entitlement) return null;

  const assignment = shop.customerServiceDeviceAssignment(runtimeStatus.deviceId);
  const assignmentBadge = ASSIGNMENT_BADGE[assignment];

  return (
    <div className="shop-service-badges">
      {entitlement.allowed
        ? <span className="badge badge-active">{t("billing.allowed")}</span>
        : <span className="badge badge-warning">{entitlementStatusLabel(t, entitlement)}</span>}
      {entitlement.allowed ? (
        <span className={assignmentBadge.className}>{t(assignmentBadge.labelKey)}</span>
      ) : null}
    </div>
  );
});
