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
  TkIconButton,
  TkModal as Modal,
  TkPanel,
  TkStatus,
} from "../../../components/design-system/index.js";
import { CopyIcon, RefreshIcon } from "../../../components/icons.js";
import { useToast } from "../../../components/Toast.js";
import { graphQLErrorCode } from "../../../lib/graphql-error-code.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import {
  PROVISION_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION,
  REMOVE_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION,
  RESET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_PASSWORD_MUTATION,
  SET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_DISABLED_MUTATION,
} from "../../../api/shops-queries.js";
import {
  buildLoginCredentialsText,
  generateLoginPassword,
} from "../affiliate-login-credentials.js";
import "./AffiliateBusinessDeveloperLoginPanel.css";

/** CREDENTIALS is the one-time login-info card shown after a create or a reset. */
type LoginDialog = "CREATE" | "RESET" | "CREDENTIALS" | "REMOVE" | null;

/**
 * The sign-in just set, held only while the login-info card is open. The
 * backend keeps a bcrypt hash, so this is the last place the password exists.
 */
interface IssuedCredentials {
  email: string;
  password: string;
}

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
    const [issued, setIssued] = useState<IssuedCredentials | null>(null);

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

    function openDialog(next: "CREATE" | "RESET") {
      setEmailDraft("");
      setPasswordDraft(generateLoginPassword());
      setIssued(null);
      setDialog(next);
    }

    /** Closing drops every copy of the password, draft and issued alike. */
    function closeDialog() {
      if (busy) return;
      setDialog(null);
      setEmailDraft("");
      setPasswordDraft("");
      setIssued(null);
    }

    function showCredentials(email: string, password: string) {
      setIssued({ email, password });
      setEmailDraft("");
      setPasswordDraft("");
      setDialog("CREDENTIALS");
    }

    async function copyText(value: string, successKey: string) {
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(value);
        showToast(t(successKey), "success");
      } catch {
        showToast(t("ecommerce.affiliateTeam.login.copyFailed"), "error");
      }
    }

    function credentialsText(credentials: IssuedCredentials): string {
      const brand = t("common.brandName");
      return buildLoginCredentialsText({
        heading: t("ecommerce.affiliateTeam.login.credentialsHeading", {
          brand,
          name: displayName,
        }),
        instructions: t("ecommerce.affiliateTeam.login.credentialsInstructions", { brand }),
        emailLabel: t("ecommerce.affiliateTeam.login.credentialsEmail"),
        email: credentials.email,
        passwordLabel: t("ecommerce.affiliateTeam.login.credentialsPassword"),
        password: credentials.password,
      });
    }

    /**
     * Run one login mutation and upsert the developer it returns. The store is
     * re-read from the root after the await rather than through a node read
     * before it, so a store refresh in between cannot leave a dead reference.
     */
    async function run(
      action: () => Promise<GQL.AffiliateBusinessDeveloper | undefined>,
      successKey: string,
    ): Promise<GQL.AffiliateBusinessDeveloper | null> {
      try {
        const updated = await action();
        if (!updated) throw new Error("AffiliateBusinessDeveloper was not returned");
        entityStore.affiliateWorkspace.upsertAffiliateBusinessDeveloper(updated);
        showToast(t(successKey), "success");
        return updated;
      } catch (error) {
        showToast(loginErrorMessage(error, t), "error");
        return null;
      }
    }

    /** The login email of a developer a login mutation returned; a login mutation always sets one. */
    function issuedEmail(updated: GQL.AffiliateBusinessDeveloper): string {
      const email = updated.login?.email;
      if (!email) throw new Error("AffiliateBusinessDeveloper was returned without its login");
      return email;
    }

    async function handleCreate() {
      const email = emailDraft.trim();
      const password = passwordDraft;
      if (!email || !password) return;
      const updated = await run(
        async () =>
          (
            await provisionLogin({
              variables: { input: { businessDeveloperId: developerId, email, password } },
            })
          ).data?.provisionAffiliateBusinessDeveloperLogin,
        "ecommerce.affiliateTeam.login.created",
      );
      if (updated) showCredentials(issuedEmail(updated), password);
    }

    async function handleReset() {
      const password = passwordDraft;
      if (!password) return;
      const updated = await run(
        async () =>
          (
            await resetPassword({
              variables: { businessDeveloperId: developerId, password },
            })
          ).data?.resetAffiliateBusinessDeveloperLoginPassword,
        "ecommerce.affiliateTeam.login.passwordReset",
      );
      if (updated) showCredentials(issuedEmail(updated), password);
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
          <div className="affiliate-bd-login-status">
            <TkStatus
              tone={loginDisabled ? "warning" : "success"}
              label={
                loginDisabled
                  ? t("ecommerce.affiliateTeam.login.statusDisabled")
                  : t("ecommerce.affiliateTeam.login.statusActive")
              }
              detail={loginEmail}
            />
            <TkIconButton
              label={t("ecommerce.affiliateTeam.login.copyEmail")}
              size="sm"
              variant="ghost"
              onClick={() => void copyText(loginEmail, "ecommerce.affiliateTeam.login.emailCopied")}
            >
              <CopyIcon />
            </TkIconButton>
          </div>
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
          isOpen={dialog === "CREATE" || dialog === "RESET" || dialog === "CREDENTIALS"}
          onClose={closeDialog}
          preventBackdropClose={dialog === "CREDENTIALS"}
          title={
            dialog === "CREDENTIALS"
              ? t("ecommerce.affiliateTeam.login.credentialsTitle", { name: displayName })
              : dialog === "RESET"
                ? t("ecommerce.affiliateTeam.login.resetTitle", { name: displayName })
                : t("ecommerce.affiliateTeam.login.createTitle", { name: displayName })
          }
          maxWidth={480}
        >
          {dialog === "CREDENTIALS" && issued ? (
            <LoginCredentialsCard
              email={issued.email}
              password={issued.password}
              instructions={t("ecommerce.affiliateTeam.login.credentialsInstructions", {
                brand: t("common.brandName"),
              })}
              onCopyAll={() =>
                void copyText(
                  credentialsText(issued),
                  "ecommerce.affiliateTeam.login.credentialsCopied",
                )
              }
              onCopyEmail={() =>
                void copyText(issued.email, "ecommerce.affiliateTeam.login.emailCopied")
              }
              onCopyPassword={() =>
                void copyText(issued.password, "ecommerce.affiliateTeam.login.passwordCopied")
              }
              onClose={closeDialog}
            />
          ) : (
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
                <div className="affiliate-bd-login-password">
                  <div className="affiliate-bd-login-password-row">
                    {/* Shown in clear text: the owner is about to hand this password over. */}
                    <TkField
                      className="affiliate-bd-login-password-field"
                      label={
                        dialog === "RESET"
                          ? t("ecommerce.affiliateTeam.login.newPassword")
                          : t("ecommerce.affiliateTeam.login.password")
                      }
                      type="text"
                      value={passwordDraft}
                      onChange={(event) => setPasswordDraft(event.target.value)}
                      placeholder={t("ecommerce.affiliateTeam.login.passwordPlaceholder")}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <TkButton
                      type="button"
                      leadingIcon={<RefreshIcon />}
                      onClick={() => setPasswordDraft(generateLoginPassword())}
                      disabled={busy}
                    >
                      {t("ecommerce.affiliateTeam.login.regeneratePassword")}
                    </TkButton>
                  </div>
                  <p className="affiliate-bd-login-copy">
                    {t("ecommerce.affiliateTeam.login.generatedPasswordHint")}
                  </p>
                </div>
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
          )}
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

/**
 * The one-time login-info card: the sign-in just set and how to use it. The
 * password is not stored anywhere, so this is the only time it is shown.
 */
function LoginCredentialsCard({
  email,
  password,
  instructions,
  onCopyAll,
  onCopyEmail,
  onCopyPassword,
  onClose,
}: {
  email: string;
  password: string;
  instructions: string;
  onCopyAll: () => void;
  onCopyEmail: () => void;
  onCopyPassword: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <TkFormStack>
      <TkAlert tone="warning">{t("ecommerce.affiliateTeam.login.credentialsOnceNote")}</TkAlert>
      <p className="affiliate-bd-login-copy">{instructions}</p>
      <TkPanel variant="subtle" padding="md">
        <dl className="affiliate-bd-login-credentials">
          <div className="affiliate-bd-login-credential">
            <dt>{t("ecommerce.affiliateTeam.login.credentialsEmail")}</dt>
            <dd>
              <span className="affiliate-bd-login-credential-value">{email}</span>
              <TkIconButton
                label={t("ecommerce.affiliateTeam.login.copyEmail")}
                size="sm"
                variant="ghost"
                onClick={onCopyEmail}
              >
                <CopyIcon />
              </TkIconButton>
            </dd>
          </div>
          <div className="affiliate-bd-login-credential">
            <dt>{t("ecommerce.affiliateTeam.login.credentialsPassword")}</dt>
            <dd>
              <span className="affiliate-bd-login-credential-value">{password}</span>
              <TkIconButton
                label={t("ecommerce.affiliateTeam.login.copyPassword")}
                size="sm"
                variant="ghost"
                onClick={onCopyPassword}
              >
                <CopyIcon />
              </TkIconButton>
            </dd>
          </div>
        </dl>
      </TkPanel>
      <div className="tk-v1-modal-actions">
        <TkButton type="button" onClick={onClose}>
          {t("common.done")}
        </TkButton>
        <TkButton type="button" variant="primary" leadingIcon={<CopyIcon />} onClick={onCopyAll}>
          {t("ecommerce.affiliateTeam.login.copyAll")}
        </TkButton>
      </div>
    </TkFormStack>
  );
}
