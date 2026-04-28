import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { ImageAssetPreview } from "../../../components/images/ImageAssetPreview.js";
import { Modal } from "../../../components/modals/Modal.js";
import { Select } from "../../../components/inputs/Select.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { inventoryGoodImageUrl } from "../../../store/models/InventoryGoodModel.js";

const currencyOptions = Object.values(GQL.Currency).map((currency) => ({
  value: currency,
  label: `ecommerce.inventory.currencies.${currency}`,
}));

const countryOptions = Object.values(GQL.InventoryCountryCode).map((country) => ({
  value: country,
  label: `ecommerce.inventory.countries.${country}`,
}));

export const InventoryGoodModal = observer(function InventoryGoodModal() {
  const { t } = useTranslation();
  const entityStore = useEntityStore();
  const inventory = entityStore.ecommerceInventory;
  const draft = inventory.inventoryGoodDraft;
  const isEdit = inventory.isEditingInventoryGood;
  const busy = inventory.inventoryGoodSaving || inventory.inventoryGoodUploadingImage;
  const previewUrl = draft.imagePreviewUrl || inventoryGoodImageUrl(draft.imageUri);
  const canSubmit = Boolean(draft.sku.trim() && draft.name.trim()) && !busy;

  return (
    <Modal
      isOpen={inventory.inventoryGoodModalOpen}
      onClose={() => inventory.closeInventoryGoodModal()}
      title={isEdit ? t("ecommerce.inventory.editInventoryGood") : t("ecommerce.inventory.addInventoryGood")}
      maxWidth={760}
      preventBackdropClose={busy}
    >
      <form
        className="modal-form-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          inventory.saveInventoryGood().catch(() => {});
        }}
      >
        <div className="inventory-good-form-grid">
          <div>
            <label className="form-label-block">
              {t("ecommerce.inventory.sku")} <span className="required">*</span>
            </label>
            <input
              className="input-full input-mono"
              value={draft.sku}
              onChange={(e) => inventory.updateInventoryGoodDraft({ sku: e.target.value })}
              disabled={busy}
              required
            />
          </div>
          <div>
            <label className="form-label-block">
              {t("ecommerce.inventory.name")} <span className="required">*</span>
            </label>
            <input
              className="input-full"
              value={draft.name}
              onChange={(e) => inventory.updateInventoryGoodDraft({ name: e.target.value })}
              disabled={busy}
              required
            />
          </div>
          <div>
            <label className="form-label-block">{t("ecommerce.inventory.gtin")}</label>
            <input className="input-full input-mono" value={draft.gtin} onChange={(e) => inventory.updateInventoryGoodDraft({ gtin: e.target.value })} disabled={busy} />
          </div>
          <div>
            <label className="form-label-block">{t("ecommerce.inventory.barcode")}</label>
            <input className="input-full input-mono" value={draft.barcode} onChange={(e) => inventory.updateInventoryGoodDraft({ barcode: e.target.value })} disabled={busy} />
          </div>
          <div>
            <label className="form-label-block">{t("ecommerce.inventory.hsCode")}</label>
            <input className="input-full input-mono" value={draft.hsCode} onChange={(e) => inventory.updateInventoryGoodDraft({ hsCode: e.target.value })} disabled={busy} />
          </div>
          <div>
            <label className="form-label-block">{t("ecommerce.inventory.countryOfOrigin")}</label>
            <Select
              value={draft.countryOfOrigin}
              onChange={(countryOfOrigin) => inventory.updateInventoryGoodDraft({ countryOfOrigin })}
              className="input-full"
              placeholder={t("common.none")}
              disabled={busy}
              options={countryOptions.map((option) => ({
                value: option.value,
                label: t(option.label, { defaultValue: option.value }),
              }))}
            />
          </div>
          <div>
            <label className="form-label-block">{t("ecommerce.inventory.weight")}</label>
            <div className="inventory-good-inline-fields">
              <input type="number" min="0" step="any" className="input-full" value={draft.weightValue} onChange={(e) => inventory.updateInventoryGoodDraft({ weightValue: e.target.value })} disabled={busy} />
              <Select
                value={draft.weightUnit}
                onChange={(weightUnit) => inventory.updateInventoryGoodDraft({ weightUnit })}
                className="input-full"
                placeholder={t("common.none")}
                options={[
                  { value: "KG", label: "kg" },
                  { value: "G", label: "g" },
                  { value: "LB", label: "lb" },
                  { value: "OZ", label: "oz" },
                ]}
              />
            </div>
          </div>
          <div>
            <label className="form-label-block">{t("ecommerce.inventory.dimensions")}</label>
            <div className="inventory-good-inline-fields inventory-good-dimensions-fields">
              <input type="number" min="0" step="any" className="input-full" value={draft.lengthValue} onChange={(e) => inventory.updateInventoryGoodDraft({ lengthValue: e.target.value })} placeholder="L" disabled={busy} />
              <input type="number" min="0" step="any" className="input-full" value={draft.widthValue} onChange={(e) => inventory.updateInventoryGoodDraft({ widthValue: e.target.value })} placeholder="W" disabled={busy} />
              <input type="number" min="0" step="any" className="input-full" value={draft.heightValue} onChange={(e) => inventory.updateInventoryGoodDraft({ heightValue: e.target.value })} placeholder="H" disabled={busy} />
              <Select
                value={draft.dimensionUnit}
                onChange={(dimensionUnit) => inventory.updateInventoryGoodDraft({ dimensionUnit })}
                className="input-full"
                placeholder={t("common.none")}
                options={[
                  { value: "CM", label: "cm" },
                  { value: "IN", label: "in" },
                ]}
              />
            </div>
          </div>
          <div>
            <label className="form-label-block">{t("ecommerce.inventory.declaredValue")}</label>
            <input type="number" min="0" step="any" className="input-full" value={draft.declaredValue} onChange={(e) => inventory.updateInventoryGoodDraft({ declaredValue: e.target.value })} disabled={busy} />
          </div>
          <div>
            <label className="form-label-block">{t("ecommerce.inventory.currency")}</label>
            <Select
              value={draft.declaredValueCurrency}
              onChange={(declaredValueCurrency) => inventory.updateInventoryGoodDraft({ declaredValueCurrency })}
              className="input-full"
              placeholder={t("common.none")}
              disabled={busy}
              options={currencyOptions.map((option) => ({
                value: option.value,
                label: t(option.label, { defaultValue: option.value }),
              }))}
            />
          </div>
        </div>

        <div className="inventory-good-image-editor">
          <ImageAssetPreview
            src={previewUrl}
            alt={draft.name || draft.sku}
            className="inventory-good-image-preview"
            emptyLabel={t("ecommerce.inventory.noImage")}
            failedLabel={t("ecommerce.inventory.imageLoadFailed")}
          />
          <div className="inventory-good-image-actions">
            <label className={`btn btn-secondary btn-sm${busy ? " btn-disabled" : ""}`}>
              {inventory.inventoryGoodUploadingImage ? t("common.loading") : t("ecommerce.inventory.uploadImage")}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (file) {
                    inventory.uploadInventoryGoodImage(file).catch(() => {});
                  }
                }}
              />
            </label>
            {previewUrl && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => inventory.clearInventoryGoodImage()}
                disabled={busy}
              >
                {t("ecommerce.inventory.clearImage")}
              </button>
            )}
          </div>
        </div>

        <div className="inventory-good-flags">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.isBattery}
              onChange={(e) => inventory.updateInventoryGoodDraft({ isBattery: e.target.checked })}
              disabled={busy}
            />
            <span>{t("ecommerce.inventory.isBattery")}</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.isHazmat}
              onChange={(e) => inventory.updateInventoryGoodDraft({ isHazmat: e.target.checked })}
              disabled={busy}
            />
            <span>{t("ecommerce.inventory.isHazmat")}</span>
          </label>
        </div>

        {inventory.inventoryGoodFormError && (
          <div className="form-hint form-hint-error">{inventory.inventoryGoodFormError}</div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={() => inventory.closeInventoryGoodModal()} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {busy ? t("common.loading") : isEdit ? t("common.save") : t("ecommerce.inventory.addInventoryGood")}
          </button>
        </div>
      </form>
    </Modal>
  );
});
