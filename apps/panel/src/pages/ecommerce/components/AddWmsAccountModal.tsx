import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import {
  TkModal as Modal,
  TkSegmented,
} from "../../../components/design-system/index.js";
import { Select } from "../../../components/inputs/Select.js";
import { HelpCircleIcon } from "../../../components/icons.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import {
  wmsCredentialFields,
  wmsCredentialIssue,
  type WmsCredentialMode,
} from "../wms-credentials.js";

const currencyOptions = Object.values(GQL.Currency).map((currency) => ({
  value: currency,
  label: `ecommerce.inventory.currencies.${currency}`,
}));

const wmsProviderOptions = [
  { value: "YEJOIN", labelKey: "ecommerce.inventory.providers.YEJOIN" },
  { value: "XLWMS", labelKey: "ecommerce.inventory.providers.XLWMS" },
  { value: "LINGXING", labelKey: "ecommerce.inventory.providers.LINGXING" },
  { value: "SELLFOX", labelKey: "ecommerce.inventory.providers.SELLFOX" },
  { value: "JFWMS", labelKey: "ecommerce.inventory.providers.JFWMS" },
];

export const AddWmsAccountModal = observer(function AddWmsAccountModal() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const inventory = entityStore.ecommerceInventory;
  const draft = inventory.addWmsAccountDraft;
  const isEdit = inventory.isEditingWmsAccount;

  const authorizationMode = draft.authorizationMode as WmsCredentialMode;
  const credentialIssue = wmsCredentialIssue(
    draft.provider,
    authorizationMode,
    draft,
    isEdit,
  );
  const requiredCredentialFields = wmsCredentialFields(
    draft.provider,
    authorizationMode,
  );
  const showApiToken = requiredCredentialFields.includes("apiToken");
  const showApiKey = requiredCredentialFields.includes("apiKey");
  const showApiSecret = requiredCredentialFields.includes("apiSecret");

  const canSubmit = Boolean(
    draft.provider &&
    draft.label.trim() &&
    draft.endpoint.trim() &&
    draft.declaredValueCurrency &&
    !credentialIssue,
  );

  return (
    <Modal
      isOpen={inventory.addWmsAccountModalOpen}
      onClose={() => {
        if (!inventory.addWmsAccountSaving) {
          inventory.setAddWmsAccountModalOpen(false);
        }
      }}
      title={
        isEdit
          ? t("ecommerce.inventory.editWmsAccount")
          : t("ecommerce.inventory.addWmsAccount")
      }
      preventBackdropClose={inventory.addWmsAccountSaving}
    >
      <form
        className="modal-form-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit || inventory.addWmsAccountSaving) return;
          inventory.saveWmsAccount().catch(() => {});
        }}
      >
        <div>
          <label className="form-label-block inventory-provider-label">
            <span>
              {t("ecommerce.inventory.provider")}{" "}
              <span className="required">*</span>
            </span>
            <span
              className="inventory-wms-help-icon inventory-wms-support-tooltip has-tooltip"
              data-tooltip={t("ecommerce.inventory.wmsProviderSupportTooltip")}
              aria-label={t("ecommerce.inventory.wmsProviderSupportTooltip")}
              tabIndex={0}
            >
              <HelpCircleIcon size={14} />
            </span>
          </label>
          <Select
            value={draft.provider}
            onChange={(provider) =>
              inventory.updateAddWmsAccountDraft({ provider })
            }
            className="input-full"
            options={wmsProviderOptions.map((option) => ({
              value: option.value,
              label: t(option.labelKey, { defaultValue: option.value }),
            }))}
          />
        </div>

        <div>
          <label className="form-label-block">
            {t("ecommerce.inventory.label")} <span className="required">*</span>
          </label>
          <input
            className="input-full"
            value={draft.label}
            onChange={(e) =>
              inventory.updateAddWmsAccountDraft({ label: e.target.value })
            }
            placeholder={t("ecommerce.inventory.labelPlaceholder")}
            disabled={inventory.addWmsAccountSaving}
            required
          />
        </div>

        <div>
          <label className="form-label-block">
            {t("ecommerce.inventory.endpoint")}{" "}
            <span className="required">*</span>
          </label>
          <input
            className="input-full input-mono"
            value={draft.endpoint}
            onChange={(e) =>
              inventory.updateAddWmsAccountDraft({ endpoint: e.target.value })
            }
            placeholder={t("ecommerce.inventory.endpointPlaceholder")}
            disabled={inventory.addWmsAccountSaving}
            required
          />
        </div>

        <div>
          <label className="form-label-block">
            {t("ecommerce.inventory.currency")}{" "}
            <span className="required">*</span>
          </label>
          <Select
            value={draft.declaredValueCurrency}
            onChange={(declaredValueCurrency) =>
              inventory.updateAddWmsAccountDraft({ declaredValueCurrency })
            }
            className="input-full"
            placeholder={t("ecommerce.inventory.selectCurrency")}
            disabled={inventory.addWmsAccountSaving}
            options={currencyOptions.map((option) => ({
              value: option.value,
              label: t(option.label, { defaultValue: option.value }),
            }))}
          />
        </div>

        {draft.provider === "JFWMS" && (
          <div>
            <label className="form-label-block">
              {t("ecommerce.inventory.authorizationMode")}
            </label>
            <TkSegmented
              value={authorizationMode}
              label={t("ecommerce.inventory.authorizationMode")}
              onChange={(authorizationMode) =>
                inventory.updateAddWmsAccountDraft({ authorizationMode })
              }
              items={[
                {
                  id: "AUTHORIZE",
                  label: t("ecommerce.inventory.authorizationModes.AUTHORIZE"),
                },
                {
                  id: "EXISTING",
                  label: t("ecommerce.inventory.authorizationModes.EXISTING"),
                },
              ]}
              size="sm"
            />
          </div>
        )}

        {showApiToken && (
          <div>
            <label className="form-label-block">
              {t("ecommerce.inventory.apiToken")}{" "}
              {!isEdit && <span className="required">*</span>}
            </label>
            <input
              type="password"
              className="input-full input-mono"
              value={draft.apiToken}
              onChange={(e) =>
                inventory.updateAddWmsAccountDraft({ apiToken: e.target.value })
              }
              placeholder={
                isEdit
                  ? t("ecommerce.inventory.keepCredentialPlaceholder")
                  : t("ecommerce.inventory.apiTokenPlaceholder")
              }
              disabled={inventory.addWmsAccountSaving}
              required={!isEdit}
            />
          </div>
        )}

        {showApiKey && (
          <div>
            <label className="form-label-block">
              {t("ecommerce.inventory.apiKey")}{" "}
              {!isEdit && <span className="required">*</span>}
            </label>
            <input
              type="password"
              className="input-full input-mono"
              value={draft.apiKey}
              onChange={(e) =>
                inventory.updateAddWmsAccountDraft({ apiKey: e.target.value })
              }
              placeholder={
                isEdit
                  ? t("ecommerce.inventory.keepCredentialPlaceholder")
                  : ""
              }
              disabled={inventory.addWmsAccountSaving}
              required={!isEdit}
            />
          </div>
        )}

        {showApiSecret && (
          <div>
            <label className="form-label-block">
              {t("ecommerce.inventory.apiSecret")}{" "}
              {!isEdit && <span className="required">*</span>}
            </label>
            <input
              type="password"
              className="input-full input-mono"
              value={draft.apiSecret}
              onChange={(e) =>
                inventory.updateAddWmsAccountDraft({
                  apiSecret: e.target.value,
                })
              }
              placeholder={
                isEdit
                  ? t("ecommerce.inventory.keepCredentialPlaceholder")
                  : ""
              }
              disabled={inventory.addWmsAccountSaving}
              required={!isEdit}
            />
          </div>
        )}

        {draft.provider === "JFWMS" && authorizationMode === "AUTHORIZE" && (
          <>
            <div>
              <label className="form-label-block">
                {t("ecommerce.inventory.authorizationUser")}{" "}
                <span className="required">*</span>
              </label>
              <input
                type="email"
                className="input-full"
                value={draft.authorizationUser}
                onChange={(e) =>
                  inventory.updateAddWmsAccountDraft({
                    authorizationUser: e.target.value,
                  })
                }
                disabled={inventory.addWmsAccountSaving}
                required
              />
            </div>
            <div>
              <label className="form-label-block">
                {t("ecommerce.inventory.authorizationToken")}{" "}
                <span className="required">*</span>
              </label>
              <input
                type="password"
                className="input-full input-mono"
                value={draft.authorizationToken}
                onChange={(e) =>
                  inventory.updateAddWmsAccountDraft({
                    authorizationToken: e.target.value,
                  })
                }
                disabled={inventory.addWmsAccountSaving}
                required
              />
            </div>
            <div>
              <label className="form-label-block">
                {t("ecommerce.inventory.authorizationDomain")}
              </label>
              <input
                className="input-full input-mono"
                value={draft.authorizationDomain}
                onChange={(e) =>
                  inventory.updateAddWmsAccountDraft({
                    authorizationDomain: e.target.value,
                  })
                }
                placeholder={t(
                  "ecommerce.inventory.authorizationDomainPlaceholder",
                )}
                disabled={inventory.addWmsAccountSaving}
              />
            </div>
          </>
        )}

        {draft.provider === "JFWMS" && authorizationMode === "EXISTING" && (
          <>
            <div>
              <label className="form-label-block">
                {t("ecommerce.inventory.refreshToken")}{" "}
                {!isEdit && <span className="required">*</span>}
              </label>
              <input
                type="password"
                className="input-full input-mono"
                value={draft.refreshToken}
                onChange={(e) =>
                  inventory.updateAddWmsAccountDraft({
                    refreshToken: e.target.value,
                  })
                }
                placeholder={
                  isEdit
                    ? t("ecommerce.inventory.keepCredentialPlaceholder")
                    : ""
                }
                disabled={inventory.addWmsAccountSaving}
                required={!isEdit}
              />
            </div>
            <div>
              <label className="form-label-block">
                {t("ecommerce.inventory.providerUserId")}{" "}
                {!isEdit && <span className="required">*</span>}
              </label>
              <input
                className="input-full input-mono"
                value={draft.providerUserId}
                onChange={(e) =>
                  inventory.updateAddWmsAccountDraft({
                    providerUserId: e.target.value,
                  })
                }
                placeholder={
                  isEdit
                    ? t("ecommerce.inventory.keepCredentialPlaceholder")
                    : ""
                }
                disabled={inventory.addWmsAccountSaving}
                required={!isEdit}
              />
            </div>
          </>
        )}

        <div className="form-hint">
          {t("ecommerce.inventory.credentialsWriteOnlyHint")}
        </div>
        {credentialIssue && (
          <div className="form-hint form-hint-error">
            {t("ecommerce.inventory.credentialMissingFields", {
              fields: requiredCredentialFields
                .map((field) =>
                  t(`ecommerce.inventory.credentialFields.${field}`),
                )
                .join(", "),
            })}
          </div>
        )}

        <div>
          <label className="form-label-block">
            {t("ecommerce.inventory.notes")}
          </label>
          <textarea
            className="input-full textarea-resize-vertical"
            value={draft.notes}
            onChange={(e) =>
              inventory.updateAddWmsAccountDraft({ notes: e.target.value })
            }
            placeholder={t("ecommerce.inventory.notesPlaceholder")}
            rows={3}
            disabled={inventory.addWmsAccountSaving}
          />
        </div>

        {inventory.addWmsAccountError && (
          <div className="form-hint form-hint-error">
            {inventory.addWmsAccountError}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => inventory.setAddWmsAccountModalOpen(false)}
            disabled={inventory.addWmsAccountSaving}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canSubmit || inventory.addWmsAccountSaving}
          >
            {inventory.addWmsAccountSaving
              ? t("common.loading")
              : isEdit
                ? t("common.save")
                : t("ecommerce.inventory.addWmsAccount")}
          </button>
        </div>
      </form>
    </Modal>
  );
});
