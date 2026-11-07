import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import {
  TkAlert,
  TkBadge,
  TkButton,
  TkPageFrame,
  TkPageHeader,
  TkPanel,
} from "../../components/design-system/index.js";
import { DownloadIcon } from "../../components/icons.js";
import { useToast } from "../../components/Toast.js";
import { openPanelRoute } from "../../lib/open-route.js";
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { downloadAfterSaleWorkbook } from "./after-sale-export.js";
import {
  BAD_REVIEW_TEMPLATE_FILENAME,
  buildBadReviewTemplateWorkbook,
} from "./bad-review-template.js";
import { BadReviewBulkFollowUpModal } from "./components/bad-review/BadReviewBulkFollowUpModal.js";
import { BadReviewDetailModal } from "./components/bad-review/BadReviewDetailModal.js";
import { BadReviewFilters } from "./components/bad-review/BadReviewFilters.js";
import { BadReviewImportModal } from "./components/bad-review/BadReviewImportModal.js";
import { BadReviewTable } from "./components/bad-review/BadReviewTable.js";
import { useVisibleInterval } from "./hooks/useVisibleInterval.js";
// The order cell reuses the after-sale copy control, whose styles live there.
import "./AfterSaleReview.css";
import "./BadReviewManagement.css";

/** The page that shows the opened conversation. */
const CONVERSATIONS_PATH = "/commerce/customer-service/conversations";
/** How often the open page re-reads its rows, the same as After-Sales. */
const AUTO_REFRESH_MS = 60_000;

export const BadReviewManagementPage = observer(function BadReviewManagementPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const badReview = entityStore.ecommerceBadReview;
  const signedIn = Boolean(entityStore.currentUser);
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const querySignature = badReview.querySignature;
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Every filter change is a new query; the signature is the only dependency that carries them.
  useEffect(() => {
    if (!signedIn) {
      badReview.reset();
      return;
    }
    badReview.fetchReviews().catch(() => {});
  }, [badReview, signedIn, querySignature]);

  useVisibleInterval(
    () => entityStore.ecommerceBadReview.refreshInBackground().catch(() => {}),
    AUTO_REFRESH_MS,
    signedIn,
  );

  /** Only reads: AI, the status and TikTok are left alone. */
  const openConversation = (orderId: string) => {
    entityStore.customerServiceWorkspace.focusConversationOrder(orderId);
    openPanelRoute(CONVERSATIONS_PATH);
  };

  const startFollowUp = (shopId: string, reviewId: string) => {
    const orderId = entityStore.ecommerceBadReview.rows.find((row) => row.id === reviewId)?.orderId;
    entityStore.ecommerceBadReview
      .startFollowUp(shopId, reviewId)
      .then(() => {
        if (orderId) openConversation(orderId);
      })
      .catch(() => {});
  };

  const downloadTemplate = async () => {
    const { default: ExcelJS } = await import("exceljs");
    await downloadAfterSaleWorkbook(
      buildBadReviewTemplateWorkbook(ExcelJS, t),
      BAD_REVIEW_TEMPLATE_FILENAME,
    );
  };

  if (authChecking) {
    return (
      <TkPageFrame>
        <TkPanel className="section-card">
          <p>{t("common.loading")}</p>
        </TkPanel>
      </TkPageFrame>
    );
  }

  if (!signedIn) {
    return (
      <TkPageFrame>
        <TkPanel className="section-card">
          <h2>{t("auth.loginRequired")}</h2>
          <p>{t("auth.loginFromSidebar")}</p>
        </TkPanel>
      </TkPageFrame>
    );
  }

  return (
    <TkPageFrame className="bad-review-page">
      <TkPageHeader
        data-tutorial-id="bad-review-header"
        title={t("ecommerce.badReview.pageTitle")}
        description={t("ecommerce.badReview.pageSubtitle")}
        actions={
          <>
            {badReview.loaded ? (
              <TkBadge tone="info">
                {t("ecommerce.badReview.totalCount", { count: badReview.totalCount })}
              </TkBadge>
            ) : null}
            <TkButton
              variant="secondary"
              disabled={badReview.loading}
              aria-busy={badReview.loading || undefined}
              onClick={() => badReview.fetchReviews().catch(() => {})}
            >
              {t("common.refresh")}
            </TkButton>
            <TkButton
              variant="secondary"
              leadingIcon={<DownloadIcon />}
              onClick={() => {
                downloadTemplate().catch((err: unknown) =>
                  showToast(err instanceof Error ? err.message : String(err), "error"),
                );
              }}
            >
              {t("ecommerce.badReview.downloadTemplate")}
            </TkButton>
            <TkButton
              variant="secondary"
              disabled={badReview.bulkSelectedIds.length === 0}
              onClick={() => setBulkOpen(true)}
            >
              {t("ecommerce.badReview.bulk.button", { count: badReview.bulkSelectedIds.length })}
            </TkButton>
            <TkButton
              variant="primary"
              data-tutorial-id="bad-review-import"
              onClick={() => setImportOpen(true)}
            >
              {t("ecommerce.badReview.importButton")}
            </TkButton>
          </>
        }
      />
      <TkAlert tone="info">{t("ecommerce.badReview.coverageNotice")}</TkAlert>
      <BadReviewFilters />
      {badReview.error ? (
        <TkAlert tone="danger" title={t("ecommerce.badReview.loadFailed")}>
          {badReview.error}
        </TkAlert>
      ) : null}
      {badReview.actionError && !badReview.selectedReviewId ? (
        <TkAlert
          tone="danger"
          title={t("ecommerce.badReview.actions.failed")}
          actions={
            <TkButton variant="ghost" size="sm" onClick={() => badReview.dismissActionError()}>
              {t("common.close")}
            </TkButton>
          }
        >
          {badReview.actionError}
        </TkAlert>
      ) : null}
      <BadReviewTable onStart={startFollowUp} onOpenConversation={openConversation} />
      <BadReviewDetailModal onStart={startFollowUp} onOpenConversation={openConversation} />
      <BadReviewImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
      <BadReviewBulkFollowUpModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} />
    </TkPageFrame>
  );
});
