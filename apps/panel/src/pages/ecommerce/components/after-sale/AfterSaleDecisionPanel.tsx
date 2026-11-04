import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import {
  TkAlert,
  TkButton,
  TkChoiceSelect,
  TkConfirmDialog,
  TkLoadingState,
} from "../../../../components/design-system/index.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import type { AfterSaleRequestNode } from "../../../../store/models/EcommerceAfterSaleModel.js";

/** Approve / reject controls for the open request, offered only when a backend decision maps to it. */
export const AfterSaleDecisionPanel = observer(function AfterSaleDecisionPanel({
  request,
}: {
  request: AfterSaleRequestNode;
}) {
  const { t } = useTranslation();
  const afterSale = useEntityStore().ecommerceAfterSale;
  const detail = afterSale.detail;

  if (!request.needsReview) {
    return <p className="after-sale-muted">{t("ecommerce.afterSale.decision.notAwaiting")}</p>;
  }
  if (!request.decision) {
    return <p className="after-sale-muted">{t("ecommerce.afterSale.decision.readOnly")}</p>;
  }

  const rejecting = detail.decisionMode === "reject";
  const reasonOptions = detail.rejectReasons
    .filter((reason) => reason.reasonId)
    .map((reason) => ({
      value: reason.reasonId as string,
      label: reason.reasonText || (reason.reasonId as string),
    }));

  return (
    <div className="after-sale-decision">
      {detail.decisionError ? (
        <TkAlert tone="danger" title={t("ecommerce.afterSale.decision.failed")}>
          {detail.decisionError}
        </TkAlert>
      ) : null}
      {rejecting ? (
        <div className="after-sale-reject-form">
          <h3>{t("ecommerce.afterSale.decision.rejectTitle")}</h3>
          {detail.reasonsLoading ? (
            <TkLoadingState
              size="inline"
              label={t("ecommerce.afterSale.decision.reasonsLoading")}
            />
          ) : detail.reasonsError ? (
            <TkAlert tone="danger" title={t("ecommerce.afterSale.decision.reasonsFailed")}>
              {detail.reasonsError}
            </TkAlert>
          ) : reasonOptions.length === 0 ? (
            <p className="after-sale-muted">{t("ecommerce.afterSale.decision.reasonsEmpty")}</p>
          ) : (
            <TkChoiceSelect
              label={t("ecommerce.afterSale.decision.rejectReason")}
              placeholder={t("ecommerce.afterSale.decision.rejectReasonPlaceholder")}
              value={detail.rejectReasonDraft}
              options={reasonOptions}
              disabled={detail.deciding}
              onChange={(value) => afterSale.setRejectReason(value)}
            />
          )}
          <label className="tk-v1-field">
            <span className="tk-v1-label">{t("ecommerce.afterSale.decision.rejectComment")}</span>
            <textarea
              className="form-input"
              rows={3}
              value={detail.rejectCommentDraft}
              disabled={detail.deciding}
              onChange={(event) => afterSale.setRejectComment(event.target.value)}
            />
          </label>
          <div className="after-sale-decision-actions">
            <TkButton
              variant="secondary"
              disabled={detail.deciding}
              onClick={() => afterSale.cancelDecision()}
            >
              {t("common.cancel")}
            </TkButton>
            <TkButton
              variant="danger"
              disabled={detail.deciding || detail.reasonsLoading || !detail.rejectReasonDraft}
              aria-busy={detail.deciding || undefined}
              onClick={() => afterSale.reject().catch(() => {})}
            >
              {t("ecommerce.afterSale.decision.submitReject")}
            </TkButton>
          </div>
        </div>
      ) : (
        <div className="after-sale-decision-actions">
          <TkButton
            variant="danger"
            disabled={detail.deciding}
            onClick={() => afterSale.beginReject().catch(() => {})}
          >
            {t("ecommerce.afterSale.decision.reject")}
          </TkButton>
          <TkButton
            variant="primary"
            disabled={detail.deciding}
            aria-busy={detail.deciding || undefined}
            onClick={() => afterSale.beginApprove()}
          >
            {t("ecommerce.afterSale.decision.approve")}
          </TkButton>
        </div>
      )}
      <TkConfirmDialog
        isOpen={detail.decisionMode === "confirmApprove"}
        title={t("ecommerce.afterSale.decision.confirmTitle")}
        message={t("ecommerce.afterSale.decision.confirmBody")}
        confirmLabel={t("ecommerce.afterSale.decision.confirmApprove")}
        cancelLabel={t("common.cancel")}
        confirmVariant="primary"
        onCancel={() => afterSale.cancelDecision()}
        onConfirm={() => {
          afterSale.cancelDecision();
          afterSale.approve().catch(() => {});
        }}
      />
    </div>
  );
});
