import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { GQL } from "@rivonclaw/core";
import {
  TkAlert,
  TkButton,
  TkConfirmDialog as ConfirmDialog,
  TkField,
  TkFormStack,
  TkModal as Modal,
  TkStatus,
} from "../../../components/design-system/index.js";
import { useToast } from "../../../components/Toast.js";
import { graphQLErrorCode } from "../../../lib/graphql-error-code.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import {
  PROVISION_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION,
  REMOVE_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION,
  RESET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_PASSWORD_MUTATION,
  SET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_DISABLED_MUTATION,
} from "../../../api/shops-queries.js";
import "./AffiliateBusinessDeveloperLoginPanel.css";

type LoginDialog = "CREATE" | "RESET" | "REMOVE" | null;

/** Backend refusals that have their own explanation; anything else shows the backend message. */
const LOGIN_ERROR_KEYS: Record<string, string> = {
  AFFILIATE_BUSINESS_DEVELOPER_ARCHIVED: "ecommerce.affiliateTeam.login.errors.archived",
  AFFILIATE_BUSINESS_DEVELOPER_LOGIN_EXISTS: "ecommerce.affiliateTeam.login.errors.loginExists",
  AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MISSING: "ecommerce.affiliateTeam.login.errors.loginMissing",
};

export function loginErrorMessage(error: unknown, t: TFunction): string {
  const code = graphQLErrorCode(error);
  const key = code ? LOGIN_ERROR_KEYS[code] : undefined;
  if (key) return t(key);
  return t("common.operationFailed", {
    message: error instanceof Error ? error.message : String(error),
  });
}

/**
 * The sign-in of one business developer (ADR 085): create it, reset its
 * password, disable or enable it, or remove it.
 *
 * A BD's login is created only here — the Account page cannot hand out the
 * Business Developer role. The panel holds the developer id and re-reads the
 * developer from the Affiliate workspace store on every render; each mutation
 * returns the developer, which is upserted into that store.
 */
export const AffiliateBusinessDeveloperLoginPanel = observer(
  function AffiliateBusinessDeveloperLoginPanel({ developerId }: { developerId: string }) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const entityStore = useEntityStore();
    const [dialog, setDialog] = useState<LoginDialog>(null);
    const [emailDraft, setEmailDraft] = useState("");
    const [passwordDraft, setPasswordDraft] = useState("");

    const [provisionLogin, provisionState] = useMutation<
      { provisionAffiliateBusinessDeveloperLogin: GQL.AffiliateBusinessDeveloper },
      GQL.MutationProvisionAffiliateBusinessDeveloperLoginArgs
    >(PROVISION_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION);
    const [resetPassword, resetState] = useMutation<
      { resetAffiliateBusinessDeveloperLoginPassword: GQL.AffiliateBusinessDeveloper },
      GQL.MutationResetAffiliateBusinessDeveloperLoginPasswordArgs
    >(RESET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_PASSWORD_MUTATION);
    const [setLoginDisabled, disableState] = useMutation<
      { setAffiliateBusinessDeveloperLoginDisabled: GQL.AffiliateBusinessDeveloper },
      GQL.MutationSetAffiliateBusinessDeveloperLoginDisabledArgs
    >(SET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_DISABLED_MUTATION);
    const [removeLogin, removeState] = useMutation<
      { removeAffiliateBusinessDeveloperLogin: GQL.AffiliateBusinessDeveloper },
      GQL.MutationRemoveAffiliateBusinessDeveloperLoginArgs
    >(REMOVE_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION);

    const developer = entityStore.affiliateWorkspace.getBusinessDeveloper(developerId);
    if (!developer) return null;
    const displayName = developer.displayName;
    const archived = Boolean(developer.archivedAt);
    const loginEmail = developer.login?.email ?? null;
    const loginDisabled = developer.login?.disabled ?? false;
    const busy =
      provisionState.loading || resetState.loading || disableState.loading || removeState.loading;

    function openDialog(next: Exclude<LoginDialog, null>) {
      setEmailDraft("");
      setPasswordDraft("");
      setDialog(next);
    }

    function closeDialog() {
      if (busy) return;
      setDialog(null);
    }

    /**
     * Run one login mutation and upsert the developer it returns. The store is
     * re-read from the root after the await rather than through a node read
     * before it, so a store refresh in between cannot leave a dead reference.
     */
    async function run(
      action: () => Promise<GQL.AffiliateBusinessDeveloper | undefined>,
      successKey: string,
    ): Promise<boolean> {
      try {
        const updated = await action();
        if (!updated) throw new Error("AffiliateBusinessDeveloper was not returned");
        entityStore.affiliateWorkspace.upsertAffiliateBusinessDeveloper(updated);
        showToast(t(successKey), "success");
        return true;
      } catch (error) {
        showToast(loginErrorMessage(error, t), "error");
        return false;
      }
    }

    async function handleCreate() {
      const email = emailDraft.trim();
      const password = passwordDraft;
      if (!email || !password) return;
      const ok = await run(
        async () =>
          (
            await provisionLogin({
              variables: { input: { businessDeveloperId: developerId, email, password } },
            })
          ).data?.provisionAffiliateBusinessDeveloperLogin,
        "ecommerce.affiliateTeam.login.created",
      );
      if (ok) setDialog(null);
    }

    async function handleReset() {
      const password = passwordDraft;
      if (!password) return;
      const ok = await run(
        async () =>
          (
            await resetPassword({
              variables: { businessDeveloperId: developerId, password },
            })
          ).data?.resetAffiliateBusinessDeveloperLoginPassword,
        "ecommerce.affiliateTeam.login.passwordReset",
      );
      if (ok) setDialog(null);
    }

    async function handleSetDisabled(disabled: boolean) {
      await run(
        async () =>
          (
            await setLoginDisabled({
              variables: { businessDeveloperId: developerId, disabled },
            })
          ).data?.setAffiliateBusinessDeveloperLoginDisabled,
        disabled
          ? "ecommerce.affiliateTeam.login.disabledToast"
          : "ecommerce.affiliateTeam.login.enabledToast",
      );
    }

    async function handleRemove() {
      setDialog(null);
      await run(
        async () =>
          (
            await removeLogin({
              variables: { businessDeveloperId: developerId },
            })
          ).data?.removeAffiliateBusinessDeveloperLogin,
        "ecommerce.affiliateTeam.login.removed",
      );
    }

    return (
      <div className="affiliate-bd-login">
        {loginEmail === null ? (
          <TkStatus
            tone="neutral"
            label={t("ecommerce.affiliateTeam.login.statusNone")}
            detail={t("ecommerce.affiliateTeam.login.statusNoneDetail")}
          />
        ) : (
          <TkStatus
            tone={loginDisabled ? "warning" : "success"}
            label={
              loginDisabled
                ? t("ecommerce.affiliateTeam.login.statusDisabled")
                : t("ecommerce.affiliateTeam.login.statusActive")
            }
            detail={loginEmail}
          />
        )}

        <p className="affiliate-bd-login-copy">{t("ecommerce.affiliateTeam.login.description")}</p>

        {archived && (
          <TkAlert tone="warning">
            {loginEmail === null
              ? t("ecommerce.affiliateTeam.login.archivedNoLoginHint")
              : t("ecommerce.affiliateTeam.login.archivedHint")}
          </TkAlert>
        )}

        <div className="affiliate-bd-login-actions">
          {loginEmail === null ? (
            <TkButton
              variant="primary"
              size="sm"
              onClick={() => openDialog("CREATE")}
              disabled={archived || busy}
            >
              {t("ecommerce.affiliateTeam.login.create")}
            </TkButton>
          ) : (
            <>
              <TkButton size="sm" onClick={() => openDialog("RESET")} disabled={busy}>
                {t("ecommerce.affiliateTeam.login.resetPassword")}
              </TkButton>
              {loginDisabled ? (
                <TkButton
                  size="sm"
                  onClick={() => void handleSetDisabled(false)}
                  disabled={archived || busy}
                  loading={disableState.loading}
                >
                  {t("ecommerce.affiliateTeam.login.enable")}
                </TkButton>
              ) : (
                <TkButton
                  size="sm"
                  onClick={() => void handleSetDisabled(true)}
                  disabled={busy}
                  loading={disableState.loading}
                >
                  {t("ecommerce.affiliateTeam.login.disable")}
                </TkButton>
              )}
              <TkButton
                variant="danger"
                size="sm"
                onClick={() => setDialog("REMOVE")}
                disabled={busy}
              >
                {t("ecommerce.affiliateTeam.login.remove")}
              </TkButton>
            </>
          )}
        </div>

        <Modal
          isOpen={dialog === "CREATE" || dialog === "RESET"}
          onClose={closeDialog}
          title={
            dialog === "RESET"
              ? t("ecommerce.affiliateTeam.login.resetTitle", { name: displayName })
              : t("ecommerce.affiliateTeam.login.createTitle", { name: displayName })
          }
          maxWidth={480}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void (dialog === "RESET" ? handleReset() : handleCreate());
            }}
          >
            <TkFormStack>
              {dialog === "RESET" ? (
                <p className="affiliate-bd-login-copy">
                  {t("ecommerce.affiliateTeam.login.resetHint", { email: loginEmail ?? "" })}
                </p>
              ) : (
                <>
                  <p className="affiliate-bd-login-copy">
                    {t("ecommerce.affiliateTeam.login.createHint")}
                  </p>
                  <TkField
                    label={t("ecommerce.affiliateTeam.login.email")}
                    type="email"
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    placeholder={t("ecommerce.affiliateTeam.login.emailPlaceholder")}
                    autoComplete="off"
                  />
                </>
              )}
              <TkField
                label={
                  dialog === "RESET"
                    ? t("ecommerce.affiliateTeam.login.newPassword")
                    : t("ecommerce.affiliateTeam.login.password")
                }
                type="password"
                value={passwordDraft}
                onChange={(event) => setPasswordDraft(event.target.value)}
                placeholder={t("ecommerce.affiliateTeam.login.passwordPlaceholder")}
                autoComplete="new-password"
              />
              <div className="tk-v1-modal-actions">
                <TkButton type="button" onClick={closeDialog} disabled={busy}>
                  {t("common.cancel")}
                </TkButton>
                <TkButton
                  type="submit"
                  variant="primary"
                  loading={provisionState.loading || resetState.loading}
                  disabled={!passwordDraft || (dialog === "CREATE" && !emailDraft.trim()) || busy}
                >
                  {dialog === "RESET"
                    ? t("ecommerce.affiliateTeam.login.resetSubmit")
                    : t("ecommerce.affiliateTeam.login.createSubmit")}
                </TkButton>
              </div>
            </TkFormStack>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={dialog === "REMOVE"}
          title={t("ecommerce.affiliateTeam.login.removeTitle")}
          message={t("ecommerce.affiliateTeam.login.removeMessage", {
            email: loginEmail ?? "",
            name: displayName,
          })}
          confirmLabel={t("ecommerce.affiliateTeam.login.remove")}
          cancelLabel={t("common.cancel")}
          onConfirm={() => void handleRemove()}
          onCancel={() => setDialog(null)}
        />
      </div>
    );
  },
);
