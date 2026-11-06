import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import {
  TkAlert,
  TkButton,
  TkChoiceSelect,
  TkField,
  TkModal,
  TkPrivate,
} from "../../../../components/design-system/index.js";
import {
  BAD_REVIEW_PICKABLE_STATUSES,
  type BadReviewHandlingStatus,
} from "../../../../lib/bad-review.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import {
  badReviewAiProgressLabel,
  badReviewSourceLabel,
  badReviewStatusLabel,
} from "../../bad-review-labels.js";
import { formatCompactDateTime } from "../../customer-service-order-utils.js";
import { BadReviewActions } from "./BadReviewActions.js";

const PREFIX = "ecommerce.badReview";

export const BadReviewDetailModal = observer(function BadReviewDetailModal({
  onStart,
  onOpenConversation,
}: {
  onStart: (shopId: string, reviewId: string) => void;
  onOpenConversation: (shopId: string, orderId: string) => void;
}) {
  const { t } = useTranslation();
  const badReview = useEntityStore().ecommerceBadReview;
  const review = badReview.selectedReview;
  const reviewId = review?.id ?? null;
  // Unsaved input only; the saved status and history are read from the store row.
  const [draftStatus, setDraftStatus] = useState("");
  const [draftNote, setDraftNote] = useState("");
  useEffect(() => {
    setDraftStatus("");
    setDraftNote("");
  }, [reviewId]);

  const save = () => {
    const current = badReview.selectedReview;
    if (!current) return;
    const status = (draftStatus || current.handlingStatus) as BadReviewHandlingStatus | null;
    if (!status) return;
    badReview
      .updateFollowUpStatus(current.shopId, current.id, status, draftNote)
      .then(() => {
        setDraftStatus("");
        setDraftNote("");
      })
      .catch(() => {});
  };

  const facts: Array<[string, string]> = review
    ? [
        [t(`${PREFIX}.columns.shop`), review.shopName],
        [t(`${PREFIX}.columns.order`), review.orderId ?? "-"],
        [t(`${PREFIX}.columns.rating`), review.rating == null ? "-" : String(review.rating)],
        [
          t(`${PREFIX}.columns.reviewTime`),
          review.reviewTime ? formatCompactDateTime(review.reviewTime) : "-",
        ],
        [t(`${PREFIX}.columns.source`), badReviewSourceLabel(t, review.source)],
        [t(`${PREFIX}.columns.ai`), badReviewAiProgressLabel(t, review)],
      ]
    : [];

  return (
    <TkModal
      isOpen={review != null}
      onClose={() => badReview.selectReview(null)}
      title={t(`${PREFIX}.detail.title`)}
      closeLabel={t("common.close")}
      maxWidth={720}
    >
      {review ? (
        <div className="bad-review-detail">
          {badReview.actionError ? (
            <TkAlert tone="danger" title={t(`${PREFIX}.actions.failed`)}>
              {badReview.actionError}
            </TkAlert>
          ) : null}
          <dl className="bad-review-facts">
            {facts.map(([label, value]) => (
              <div key={label} className="bad-review-fact">
                <dt>{label}</dt>
                <dd>
                  <TkPrivate>{value}</TkPrivate>
                </dd>
              </div>
            ))}
          </dl>
          <section>
            <h3>{t(`${PREFIX}.detail.content`)}</h3>
            <p>
              <TkPrivate>{review.content || review.title || t(`${PREFIX}.detail.noContent`)}</TkPrivate>
            </p>
          </section>
          <section>
            <h3>{t(`${PREFIX}.detail.statusSection`)}</h3>
            <div className="bad-review-status-form">
              <TkChoiceSelect
                label={t(`${PREFIX}.columns.status`)}
                value={draftStatus || review.handlingStatus || ""}
                options={[
                  ...(review.handlingStatus &&
                  !BAD_REVIEW_PICKABLE_STATUSES.includes(review.handlingStatus)
                    ? [
                        {
                          value: review.handlingStatus,
                          label: badReviewStatusLabel(t, review.handlingStatus),
                        },
                      ]
                    : []),
                  ...(review.handlingStatus
                    ? []
                    : [{ value: "", label: badReviewStatusLabel(t, null) }]),
                  ...BAD_REVIEW_PICKABLE_STATUSES.map((status) => ({
                    value: status,
                    label: badReviewStatusLabel(t, status),
                  })),
                ]}
                onChange={setDraftStatus}
              />
              <TkField
                label={t(`${PREFIX}.detail.note`)}
                value={draftNote}
                maxLength={2000}
                onChange={(event) => setDraftNote(event.target.value)}
              />
              <TkButton
                variant="primary"
                disabled={!draftStatus && !draftNote.trim()}
                loading={badReview.busyReviewIds.includes(review.id)}
                onClick={save}
              >
                {t(`${PREFIX}.detail.save`)}
              </TkButton>
            </div>
            <BadReviewActions
              review={review}
              busy={badReview.busyReviewIds.includes(review.id)}
              onStart={onStart}
              onOpenConversation={onOpenConversation}
            />
          </section>
          <section>
            <h3>{t(`${PREFIX}.detail.history`)}</h3>
            {review.handlingEvents.length === 0 ? (
              <p className="bad-review-muted">{t(`${PREFIX}.detail.noHistory`)}</p>
            ) : (
              <ol className="bad-review-history">
                {[...review.handlingEvents].reverse().map((event) => (
                  <li key={`${event.at}:${event.to}:${event.note ?? ""}`}>
                    <strong>{badReviewStatusLabel(t, event.to)}</strong>
                    <span className="bad-review-muted">
                      {formatCompactDateTime(event.at)} · {t(`${PREFIX}.eventSource.${event.source}`)}
                    </span>
                    {event.note ? (
                      <p>
                        <TkPrivate>{event.note}</TkPrivate>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      ) : null}
    </TkModal>
  );
});
