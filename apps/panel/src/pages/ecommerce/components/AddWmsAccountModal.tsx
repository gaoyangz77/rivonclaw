import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { Modal } from "../../../components/modals/Modal.js";
import { Select } from "../../../components/inputs/Select.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

const currencyOptions = Object.values(GQL.Currency).map((currency) => ({
  value: currency,
  label: `ecommerce.inventory.currencies.${currency}`,
}));

export const AddWmsAccountModal = observer(function AddWmsAccountModal() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const inventory = entityStore.ecommerceInventory;
  const draft = inventory.addWmsAccountDraft;
  const isEdit = inventory.isEditingWmsAccount;

  const canSubmit = Boolean(
    draft.provider
    && draft.label.trim()
    && draft.endpoint.trim()
    && draft.declaredValueCurrency
    && (isEdit || draft.apiToken.trim()),
  );

  return (
    <Modal
      isOpen={inventory.addWmsAccountModalOpen}
      onClose={() => {
        if (!inventory.addWmsAccountSaving) {
          inventory.setAddWmsAccountModalOpen(false);
        }
      }}
      title={isEdit ? t("ecommerce.inventory.editWmsAccount") : t("ecommerce.inventory.addWmsAccount")}
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
          <label className="form-label-block">
            {t("ecommerce.inventory.provider")} <span className="required">*</span>
          </label>
          <Select
            value={draft.provider}
            onChange={(provider) => inventory.updateAddWmsAccountDraft({ provider })}
            className="input-full"
            options={[
              { value: "YEJOIN", label: t("ecommerce.inventory.providers.YEJOIN") },
            ]}
          />
        </div>

        <div>
          <label className="form-label-block">
            {t("ecommerce.inventory.label")} <span className="required">*</span>
          </label>
          <input
            className="input-full"
            value={draft.label}
            onChange={(e) => inventory.updateAddWmsAccountDraft({ label: e.target.value })}
            placeholder={t("ecommerce.inventory.labelPlaceholder")}
            disabled={inventory.addWmsAccountSaving}
            required
          />
        </div>

        <div>
          <label className="form-label-block">
            {t("ecommerce.inventory.endpoint")} <span className="required">*</span>
          </label>
          <input
            className="input-full input-mono"
            value={draft.endpoint}
            onChange={(e) => inventory.updateAddWmsAccountDraft({ endpoint: e.target.value })}
            placeholder={t("ecommerce.inventory.endpointPlaceholder")}
            disabled={inventory.addWmsAccountSaving}
            required
          />
        </div>

        <div>
          <label className="form-label-block">
            {t("ecommerce.inventory.currency")} <span className="required">*</span>
          </label>
          <Select
            value={draft.declaredValueCurrency}
            onChange={(declaredValueCurrency) => inventory.updateAddWmsAccountDraft({ declaredValueCurrency })}
            className="input-full"
            placeholder={t("ecommerce.inventory.selectCurrency")}
            disabled={inventory.addWmsAccountSaving}
            options={currencyOptions.map((option) => ({
              value: option.value,
              label: t(option.label, { defaultValue: option.value }),
            }))}
          />
        </div>

        <div>
          <label className="form-label-block">
            {t("ecommerce.inventory.apiToken")} {!isEdit && <span className="required">*</span>}
          </label>
          <input
            type="password"
            className="input-full input-mono"
            value={draft.apiToken}
            onChange={(e) => inventory.updateAddWmsAccountDraft({ apiToken: e.target.value })}
            placeholder={isEdit ? t("ecommerce.inventory.apiTokenEditPlaceholder") : t("ecommerce.inventory.apiTokenPlaceholder")}
            disabled={inventory.addWmsAccountSaving}
            required={!isEdit}
          />
          <div className="form-hint">
            {isEdit ? t("ecommerce.inventory.apiTokenEditHint") : t("ecommerce.inventory.apiTokenHint")}
          </div>
        </div>

        <div>
          <label className="form-label-block">{t("ecommerce.inventory.notes")}</label>
          <textarea
            className="input-full textarea-resize-vertical"
            value={draft.notes}
            onChange={(e) => inventory.updateAddWmsAccountDraft({ notes: e.target.value })}
            placeholder={t("ecommerce.inventory.notesPlaceholder")}
            rows={3}
            disabled={inventory.addWmsAccountSaving}
          />
        </div>

        {inventory.addWmsAccountError && (
          <div className="form-hint form-hint-error">{inventory.addWmsAccountError}</div>
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
