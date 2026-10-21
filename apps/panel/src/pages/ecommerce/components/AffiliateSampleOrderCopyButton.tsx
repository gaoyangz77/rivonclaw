import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { TkIconButton, TkTooltip } from "../../../components/design-system/index.js";
import { CopyIcon } from "../../../components/icons.js";
import { useToast } from "../../../components/Toast.js";
import { sampleOrderIdForCard } from "../affiliate-sample-order-id.js";

/** Uses the same persisted order ID as the Sample card, never the application ID. */
export function AffiliateSampleOrderCopyButton({ orderId }: { orderId?: string | null }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [copying, setCopying] = useState(false);
  const value = sampleOrderIdForCard(orderId);
  if (!value) return null;

  async function copyOrderId(event: MouseEvent<HTMLButtonElement>, orderNumber: string) {
    event.preventDefault();
    event.stopPropagation();
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(orderNumber);
      showToast(t("common.copied"), "success");
    } catch {
      showToast(t("ecommerce.affiliateWorkspace.copyFailed"), "error");
    } finally {
      setCopying(false);
    }
  }

  const label = t("ecommerce.affiliateWorkspace.sampleApplication.copyOrderId");
  return (
    <TkTooltip
      label={label}
      trigger={(props) => (
        <TkIconButton
          {...props}
          label={label}
          title={label}
          size="sm"
          variant="ghost"
          loading={copying}
          onClick={(event) => void copyOrderId(event, value)}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <CopyIcon />
        </TkIconButton>
      )}
    />
  );
}
