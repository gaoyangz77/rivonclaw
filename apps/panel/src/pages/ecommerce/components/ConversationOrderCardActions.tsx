import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { Instance } from "mobx-state-tree";
import { GQL } from "@rivonclaw/core";
import { TkButton } from "../../../components/design-system/index.js";
import { useToast } from "../../../components/Toast.js";
import type {
  CustomerServiceWorkspaceModel,
  OrderCardSendInput,
} from "../../../store/models/CustomerServiceWorkspaceModel.js";

/**
 * One-click buttons that send the expanded order to the buyer as a TikTok
 * order card, and its shipment as a logistics card (one per package). The
 * logistics button only appears once the order has a package.
 */
export const ConversationOrderCardActions = observer(function ConversationOrderCardActions({
  workspace,
  shopId,
  conversationId,
  orderId,
  packageIds,
}: {
  workspace: Instance<typeof CustomerServiceWorkspaceModel>;
  shopId: string;
  conversationId: string;
  orderId: string;
  packageIds: string[];
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const send = async (input: OrderCardSendInput, sentKey: string) => {
    try {
      if (await workspace.sendOrderCard(input, i18n.language)) {
        showToast(t(sentKey), "success");
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("ecommerce.customerServiceWorkspace.sendCardFailed"),
        "error",
      );
    }
  };

  const orderCard: OrderCardSendInput = {
    shopId,
    conversationId,
    orderId,
    type: GQL.EcomCustomerServiceCardType.OrderCard,
  };
  const logisticsCard: OrderCardSendInput = {
    shopId,
    conversationId,
    orderId,
    type: GQL.EcomCustomerServiceCardType.LogisticsCard,
    packageIds,
  };

  return (
    <>
      <TkButton
        size="sm"
        loading={workspace.isCardSending(orderCard)}
        onClick={() => void send(orderCard, "ecommerce.customerServiceWorkspace.orderCardSent")}
      >
        {t("ecommerce.customerServiceWorkspace.sendOrderCard")}
      </TkButton>
      {packageIds.length > 0 && (
        <TkButton
          size="sm"
          loading={workspace.isCardSending(logisticsCard)}
          onClick={() =>
            void send(logisticsCard, "ecommerce.customerServiceWorkspace.logisticsCardSent")
          }
        >
          {t("ecommerce.customerServiceWorkspace.sendLogisticsCard")}
        </TkButton>
      )}
    </>
  );
});
