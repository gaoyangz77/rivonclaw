import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import {
  TkAlert,
  TkBadge,
  TkButton,
  TkConfirmDialog,
  TkModal,
} from "../../../../components/design-system/index.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";

const PREFIX = "ecommerce.badReview.bulk";
const MAX_MESSAGE_LENGTH = 1000;
const PROGRESS_POLL_MS = 3000;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Bulk "Start follow-up": one first message per buyer, in each site's language (ADR-102). Everything
 * here is a draft of this run; reviews themselves are read back from the store when it finishes.
 */
export const BadReviewBulkFollowUpModal = observer(function BadReviewBulkFollowUpModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const entityStore = useEntityStore();
  // The ticks of the moment it opened: a background refresh must not change what gets sent.
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<GQL.EcomBadReviewBulkPreview | null>(null);
  const [message, setMessage] = useState("");
  const [translations, setTranslations] = useState<GQL.EcomBadReviewBulkMessageInput[]>([]);
  const [batch, setBatch] = useState<GQL.EcomBadReviewBulkFollowUp | null>(null);
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPreview(null);
    setMessage("");
    setTranslations([]);
    setBatch(null);
    setError(null);
    const chosen = [...entityStore.ecommerceBadReview.bulkSelectedIds];
    setReviewIds(chosen);
    entityStore.ecommerceBadReview
      .previewBulkFollowUp(chosen)
      .then(setPreview)
      .catch((err: unknown) => setError(errorText(err)));
  }, [isOpen, entityStore]);

  const batchId = batch?.id ?? null;
  const finished = batch?.finished ?? false;
  useEffect(() => {
    if (!batchId || finished) return undefined;
    const timer = setInterval(() => {
      entityStore.ecommerceBadReview
        .readBulkFollowUp(batchId)
        .then((latest) => {
          setBatch(latest);
          if (latest.finished) entityStore.ecommerceBadReview.fetchReviews().catch(() => {});
        })
        .catch((err: unknown) => setError(errorText(err)));
    }, PROGRESS_POLL_MS);
    return () => clearInterval(timer);
  }, [batchId, finished, entityStore]);

  // GraphQL enum names use "_" (ZH_HANT); Intl accepts only BCP 47 tags, such as zh-Hant.
  const languageName = (language: string) =>
    new Intl.DisplayNames([i18n.language], { type: "language" }).of(language.replace("_", "-")) ??
    language;

  /** Sending still waits for the confirmation: messages cannot be recalled. */
  const translateAndSend = async () => {
    if (!preview) return;
    setWorking(true);
    setError(null);
    try {
      setTranslations(
        await entityStore.ecommerceBadReview.translateBulkMessage(
          message.trim(),
          preview.languages.map((entry) => entry.language),
        ),
      );
      setConfirming(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setWorking(false);
    }
  };

  const send = async () => {
    setConfirming(false);
    setWorking(true);
    setError(null);
    try {
      setBatch(await entityStore.ecommerceBadReview.startBulkFollowUp(reviewIds, translations));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setWorking(false);
    }
  };

  const buyers = preview?.buyers ?? 0;
  const translationsReady =
    translations.length > 0 &&
    translations.every((entry) => entry.text.trim() && entry.text.length <= MAX_MESSAGE_LENGTH);

  return (
    <TkModal
      isOpen={isOpen}
      onClose={onClose}
      title={t(`${PREFIX}.title`)}
      closeLabel={t("common.close")}
      maxWidth={720}
    >
      <div className="bad-review-import">
        {error ? (
          <TkAlert tone="danger" title={t(`${PREFIX}.failed`)}>
            {error}
          </TkAlert>
        ) : null}
        {!preview && !error ? <p className="bad-review-muted">{t("common.loading")}</p> : null}

        {preview && !batch ? (
          <>
            {buyers === 0 ? (
              <TkAlert tone="info">{t(`${PREFIX}.none`)}</TkAlert>
            ) : (
              <p>{t(`${PREFIX}.summary`, { buyers, reviews: preview.reviews })}</p>
            )}
            {preview.skippedUnavailable + preview.skippedNoBuyer + preview.skippedNotManual > 0 ? (
              <p className="bad-review-muted">
                {t(`${PREFIX}.skipped`, {
                  count:
                    preview.skippedUnavailable + preview.skippedNoBuyer + preview.skippedNotManual,
                })}
              </p>
            ) : null}
            <div className="bad-review-import-summary">
              {preview.languages.map((entry) => (
                <TkBadge key={entry.language} tone="neutral">
                  {t(`${PREFIX}.languageCount`, {
                    language: languageName(entry.language),
                    count: entry.buyers,
                  })}
                </TkBadge>
              ))}
            </div>
          </>
        ) : null}

        {preview && !batch && buyers > 0 ? (
          <>
            <label className="bad-review-bulk-field">
              <span className="form-label-block">{t(`${PREFIX}.messageLabel`)}</span>
              <textarea
                className="form-input"
                rows={4}
                maxLength={MAX_MESSAGE_LENGTH}
                value={message}
                disabled={working}
                onChange={(event) => {
                  setMessage(event.target.value);
                  // Translations of the old text must not go out with the new one.
                  setTranslations([]);
                }}
              />
            </label>
            <span className="form-hint">{t(`${PREFIX}.messageHint`)}</span>
            {translations.map((entry) => (
              <label key={entry.language} className="bad-review-bulk-field">
                <span className="form-label-block">{languageName(entry.language)}</span>
                <textarea
                  className="form-input"
                  rows={3}
                  maxLength={MAX_MESSAGE_LENGTH}
                  value={entry.text}
                  disabled={working}
                  onChange={(event) =>
                    setTranslations((current) =>
                      current.map((candidate) =>
                        candidate.language === entry.language
                          ? { ...candidate, text: event.target.value }
                          : candidate,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <TkAlert tone="warning">{t(`${PREFIX}.warning`)}</TkAlert>
            <div className="bad-review-bulk-actions">
              {translations.length > 0 ? (
                <TkButton
                  variant="primary"
                  disabled={!translationsReady}
                  loading={working}
                  onClick={() => setConfirming(true)}
                >
                  {t(`${PREFIX}.send`, { count: buyers })}
                </TkButton>
              ) : (
                <TkButton
                  variant="primary"
                  disabled={!message.trim()}
                  loading={working}
                  onClick={() => {
                    translateAndSend().catch(() => {});
                  }}
                >
                  {t(`${PREFIX}.translateAndSend`)}
                </TkButton>
              )}
            </div>
          </>
        ) : null}

        {batch ? (
          <>
            <TkAlert tone={batch.finished ? "success" : "info"}>
              {t(batch.finished ? `${PREFIX}.done` : `${PREFIX}.sending`, {
                done: batch.total - batch.waiting,
                total: batch.total,
              })}
            </TkAlert>
            <div className="bad-review-import-summary">
              <TkBadge tone="neutral">{t(`${PREFIX}.sent`, { count: batch.sent })}</TkBadge>
              <TkBadge tone="neutral">{t(`${PREFIX}.failedCount`, { count: batch.failed })}</TkBadge>
              <TkBadge tone="neutral">{t(`${PREFIX}.skippedCount`, { count: batch.skipped })}</TkBadge>
            </div>
            {batch.problems.map((entry) => (
              <p key={entry.problem} className="bad-review-muted">
                {t(`${PREFIX}.problem.${entry.problem}`, { count: entry.buyers })}
              </p>
            ))}
          </>
        ) : null}
      </div>
      <TkConfirmDialog
        isOpen={confirming}
        title={t(`${PREFIX}.confirmTitle`)}
        message={t(`${PREFIX}.confirmBody`, { count: buyers })}
        confirmLabel={t(`${PREFIX}.send`, { count: buyers })}
        cancelLabel={t("common.cancel")}
        confirmVariant="danger"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          send().catch(() => {});
        }}
      />
    </TkModal>
  );
});
