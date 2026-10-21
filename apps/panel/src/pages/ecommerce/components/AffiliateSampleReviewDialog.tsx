import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { TkAlert, TkModal } from "../../../components/design-system/index.js";
import { Select } from "../../../components/inputs/Select.js";
import "./AffiliateSampleReview.css";

const NOTE_MAX_LENGTH = 1_000;
type ReviewKind = "APPROVE" | "PLATFORM_REJECT" | "SOFT_REJECT" | "REOPEN";

export function AffiliateSampleReviewDialog({
  open,
  kind,
  busy,
  ignorePhase,
  rejectReason,
  rejectExplanation,
  reviewNote,
  onRejectReason,
  onRejectExplanation,
  onReviewNote,
  onClose,
  onConfirm,
  onCheck,
}: {
  open: boolean;
  kind: ReviewKind;
  busy: boolean;
  ignorePhase: "idle" | "saving" | "checking" | "unconfirmed";
  rejectReason: GQL.AffiliateSampleRejectReason;
  rejectExplanation: string;
  reviewNote: string;
  onRejectReason: (reason: GQL.AffiliateSampleRejectReason) => void;
  onRejectExplanation: (text: string) => void;
  onReviewNote: (text: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onCheck: () => void;
}) {
  const { t } = useTranslation();
  const prefix = "ecommerce.affiliateWorkspace.workbench";
  const locked = busy || ignorePhase === "unconfirmed";
  const rejecting = kind === "PLATFORM_REJECT" || kind === "SOFT_REJECT";
  return (
    <TkModal
      isOpen={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t(`${prefix}.reviewTitles.${kind}`)}
      maxWidth={520}
      portal
    >
      <div className="affiliate-workbench-review-dialog">
        {ignorePhase === "checking" || ignorePhase === "unconfirmed" ? (
          <TkAlert
            tone="info"
            actions={
              ignorePhase === "unconfirmed" ? (
                <button className="btn btn-secondary" type="button" onClick={onCheck}>
                  {t(`${prefix}.ignoreCheckAgain`)}
                </button>
              ) : undefined
            }
          >
            {t(`${prefix}.${ignorePhase === "checking" ? "ignoreChecking" : "ignoreUnconfirmed"}`)}
          </TkAlert>
        ) : null}
        <p>{t(`${prefix}.reviewDescriptions.${kind}`)}</p>
        {rejecting ? (
          <>
            <label className="affiliate-filter-field">
              <span>{t(`${prefix}.rejectReason`)}</span>
              <Select
                value={rejectReason}
                disabled={locked}
                onChange={(value) => onRejectReason(value as GQL.AffiliateSampleRejectReason)}
                options={Object.values(GQL.AffiliateSampleRejectReason).map((reason) => ({
                  value: reason,
                  label: t(`ecommerce.affiliateWorkspace.rejectReasons.${reason}`),
                }))}
              />
            </label>
            {rejectReason === GQL.AffiliateSampleRejectReason.Other ? (
              <textarea
                className="form-input"
                disabled={locked}
                value={rejectExplanation}
                onChange={(event) => onRejectExplanation(event.target.value)}
                placeholder={t(`${prefix}.rejectExplanation`)}
                rows={3}
              />
            ) : null}
          </>
        ) : null}
        {kind !== "REOPEN" ? (
          <label className="affiliate-workbench-review-note-field">
            <span>{t(`${prefix}.reviewNote`)}</span>
            <textarea
              className="form-input"
              disabled={locked}
              aria-label={t(`${prefix}.reviewNote`)}
              value={reviewNote}
              onChange={(event) => onReviewNote(event.target.value)}
              placeholder={t(`${prefix}.reviewNotePlaceholder`)}
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
            />
            <small>
              {t(`${prefix}.reviewNoteCount`, { count: reviewNote.length, max: NOTE_MAX_LENGTH })}
            </small>
          </label>
        ) : null}
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className={`btn ${kind === "PLATFORM_REJECT" ? "btn-danger" : "btn-primary"}`}
            type="button"
            disabled={
              locked ||
              (rejecting &&
                rejectReason === GQL.AffiliateSampleRejectReason.Other &&
                !rejectExplanation.trim())
            }
            onClick={onConfirm}
          >
            {busy ? t("common.loading") : t("common.confirm")}
          </button>
        </div>
      </div>
    </TkModal>
  );
}
