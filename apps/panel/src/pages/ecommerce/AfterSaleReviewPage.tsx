import { useEffect } from "react";
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
import { useEntityStore } from "../../store/EntityStoreProvider.js";
import { AfterSaleDetailModal } from "./components/after-sale/AfterSaleDetailModal.js";
import { AfterSaleFilters } from "./components/after-sale/AfterSaleFilters.js";
import { AfterSaleTable } from "./components/after-sale/AfterSaleTable.js";
import { useVisibleInterval } from "./hooks/useVisibleInterval.js";
import { afterSaleKindLabel } from "./after-sale-labels.js";
import "./AfterSaleReview.css";

/** How often the open workspace re-reads its rows (ADR-099 Decision 12). */
const AUTO_REFRESH_MS = 60_000;

export const AfterSaleReviewPage = observer(function AfterSaleReviewPage() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const afterSale = entityStore.ecommerceAfterSale;
  const signedIn = Boolean(entityStore.currentUser);
  const authChecking = (entityStore as any).authBootstrap?.status === "loading";
  const querySignature = afterSale.querySignature;

  // Every filter change is a new query; the signature is the only dependency that carries them.
  useEffect(() => {
    if (!signedIn) {
      afterSale.reset();
      return;
    }
    afterSale.fetchRequests().catch(() => {});
  }, [afterSale, signedIn, querySignature]);

  // Webhook and sync changes appear without a manual refresh. The store is read when the tick
  // runs, never captured by the timer.
  useVisibleInterval(
    () => entityStore.ecommerceAfterSale.refreshInBackground().catch(() => {}),
    AUTO_REFRESH_MS,
    signedIn,
  );

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

  const notice = afterSale.notice;
  return (
    <TkPageFrame className="after-sale-page">
      <TkPageHeader
        data-tutorial-id="after-sale-header"
        title={t("ecommerce.afterSale.pageTitle")}
        description={t("ecommerce.afterSale.pageSubtitle")}
        actions={
          <>
            {afterSale.loaded ? (
              <TkBadge tone="info">
                {t("ecommerce.afterSale.totalCount", { count: afterSale.totalCount })}
              </TkBadge>
            ) : null}
            <TkButton
              variant="secondary"
              disabled={afterSale.loading}
              aria-busy={afterSale.loading || undefined}
              onClick={() => afterSale.fetchRequests().catch(() => {})}
            >
              {t("common.refresh")}
            </TkButton>
          </>
        }
      />
      <AfterSaleFilters />
      {notice ? (
        <TkAlert
          tone="success"
          actions={
            <TkButton variant="ghost" size="sm" onClick={() => afterSale.dismissNotice()}>
              {t("ecommerce.afterSale.notice.dismiss")}
            </TkButton>
          }
        >
          {t(`ecommerce.afterSale.notice.${notice.outcome}`, {
            kind: afterSaleKindLabel(t, notice.kind),
            requestId: notice.requestId,
          })}
        </TkAlert>
      ) : null}
      {afterSale.error ? (
        <TkAlert tone="danger" title={t("ecommerce.afterSale.loadFailed")}>
          {afterSale.error}
        </TkAlert>
      ) : null}
      <AfterSaleTable />
      <AfterSaleDetailModal />
    </TkPageFrame>
  );
});
