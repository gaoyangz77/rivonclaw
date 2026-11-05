import { useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import {
  TkAlert,
  TkButton,
  TkChoiceSelect,
  TkConfirmDialog,
  TkLoadingState,
} from "../../../../components/design-system/index.js";
import { MessageAttachmentPreviews } from "../../../../components/inputs/MessageAttachmentPreviews.js";
import { useToast } from "../../../../components/Toast.js";
import { useMessageAttachmentDrafts } from "../../../../hooks/useMessageAttachmentDrafts.js";
import {
  AFTER_SALE_REJECT_IMAGE_MAX_BYTES,
  AFTER_SALE_REJECT_IMAGE_TYPES,
  AFTER_SALE_REJECT_IMAGES_MAX_TOTAL_BYTES,
  toRejectImage,
} from "../../../../lib/after-sale.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import type { AfterSaleRequestNode } from "../../../../store/models/EcommerceAfterSaleModel.js";

const MB = 1024 * 1024;

/** Approve / reject controls for the open request, offered only when a backend decision maps to it. */
export const AfterSaleDecisionPanel = observer(function AfterSaleDecisionPanel({
  request,
}: {
  request: AfterSaleRequestNode;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const afterSale = useEntityStore().ecommerceAfterSale;
  const detail = afterSale.detail;
  const fileInput = useRef<HTMLInputElement>(null);
  const [preparingImages, setPreparingImages] = useState(false);
  // Unsaved evidence files are a draft: they live in React and are discarded when another request
  // opens or the reject form closes. Only base64 snapshots cross into the MST action.
  const evidence = useMessageAttachmentDrafts({
    scopeKey: `${request.key}:${detail.decisionMode}`,
    disabled: detail.deciding,
    imageTypes: AFTER_SALE_REJECT_IMAGE_TYPES,
    maxImageBytes: AFTER_SALE_REJECT_IMAGE_MAX_BYTES,
    onError: (message) => showToast(message, "error"),
  });

  if (!request.needsReview) {
    return <p className="after-sale-muted">{t("ecommerce.afterSale.decision.notAwaiting")}</p>;
  }
  if (!request.decision) {
    return <p className="after-sale-muted">{t("ecommerce.afterSale.decision.readOnly")}</p>;
  }

  const rejecting = detail.decisionMode === "reject";
  const evidenceBytes = evidence.items.reduce((total, item) => total + item.file.size, 0);
  const evidenceTooLarge = evidenceBytes > AFTER_SALE_REJECT_IMAGES_MAX_TOTAL_BYTES;
  const busy = detail.deciding || preparingImages;

  async function submitReject(): Promise<void> {
    setPreparingImages(true);
    let images;
    try {
      images = await Promise.all(evidence.items.map((item) => toRejectImage(item.file)));
    } finally {
      setPreparingImages(false);
    }
    await afterSale.reject(images);
  }
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
              disabled={busy}
              onChange={(value) => afterSale.setRejectReason(value)}
            />
          )}
          <label className="tk-v1-field">
            <span className="tk-v1-label">{t("ecommerce.afterSale.decision.rejectComment")}</span>
            <textarea
              className="form-input"
              rows={3}
              value={detail.rejectCommentDraft}
              disabled={busy}
              onChange={(event) => afterSale.setRejectComment(event.target.value)}
              onPaste={evidence.onPaste}
            />
          </label>
          <div className="tk-v1-field after-sale-evidence">
            <span className="tk-v1-label">{t("ecommerce.afterSale.decision.evidenceImages")}</span>
            <MessageAttachmentPreviews
              items={evidence.items}
              onRemove={evidence.remove}
              disabled={busy}
            />
            <div className="after-sale-evidence-actions">
              <TkButton
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {t("ecommerce.afterSale.decision.addEvidenceImages")}
              </TkButton>
              <span className="tk-v1-field-support">
                {t("ecommerce.afterSale.decision.evidenceImagesHint", {
                  imageMb: AFTER_SALE_REJECT_IMAGE_MAX_BYTES / MB,
                  totalMb: AFTER_SALE_REJECT_IMAGES_MAX_TOTAL_BYTES / MB,
                })}
              </span>
            </div>
            {evidenceTooLarge ? (
              <p className="after-sale-evidence-error" role="alert">
                {t("ecommerce.afterSale.decision.evidenceImagesTooLarge", {
                  totalMb: AFTER_SALE_REJECT_IMAGES_MAX_TOTAL_BYTES / MB,
                })}
              </p>
            ) : null}
            <input
              ref={fileInput}
              className="message-attachment-file-input"
              type="file"
              accept={AFTER_SALE_REJECT_IMAGE_TYPES.join(",")}
              multiple
              disabled={busy}
              aria-label={t("ecommerce.afterSale.decision.addEvidenceImages")}
              onChange={(event) => {
                void evidence.addFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </div>
          <div className="after-sale-decision-actions">
            <TkButton
              variant="secondary"
              disabled={busy}
              onClick={() => afterSale.cancelDecision()}
            >
              {t("common.cancel")}
            </TkButton>
            <TkButton
              variant="danger"
              disabled={
                busy || detail.reasonsLoading || !detail.rejectReasonDraft || evidenceTooLarge
              }
              aria-busy={busy || undefined}
              onClick={() => submitReject().catch(() => {})}
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
