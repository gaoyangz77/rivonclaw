import { flow, getEnv, getRoot, types } from "mobx-state-tree";
import type { GQL } from "@rivonclaw/core";
import {
  READ_INVENTORY_GOODS_QUERY,
  READ_WMS_INVENTORY_GOOD_COVERAGE_QUERY,
  READ_SHOP_WAREHOUSES_QUERY,
  READ_WAREHOUSES_QUERY,
  READ_WMS_ACCOUNTS_QUERY,
  SYNC_SHOP_WAREHOUSES_MUTATION,
  SYNC_WMS_INVENTORY_GOODS_MUTATION,
  SYNC_WMS_WAREHOUSES_MUTATION,
  WRITE_INVENTORY_GOODS_MUTATION,
  WRITE_SHOP_WAREHOUSE_MAPPINGS_MUTATION,
  WRITE_WMS_ACCOUNTS_MUTATION,
} from "../../api/inventory-queries.js";
import { uploadInventoryGoodImage } from "../../api/uploads.js";
import type { PanelStoreEnv } from "../types.js";

const AddWmsAccountDraftModel = types.model("AddWmsAccountDraft", {
  id: types.maybeNull(types.string),
  provider: types.optional(types.string, "YEJOIN"),
  label: types.optional(types.string, ""),
  endpoint: types.optional(types.string, ""),
  declaredValueCurrency: types.optional(types.string, ""),
  apiToken: types.optional(types.string, ""),
  notes: types.optional(types.string, ""),
  originalEndpoint: types.optional(types.string, ""),
});

const InventoryGoodDraftModel = types.model("InventoryGoodDraft", {
  id: types.maybeNull(types.string),
  sku: types.optional(types.string, ""),
  name: types.optional(types.string, ""),
  gtin: types.optional(types.string, ""),
  barcode: types.optional(types.string, ""),
  hsCode: types.optional(types.string, ""),
  countryOfOrigin: types.optional(types.string, ""),
  weightValue: types.optional(types.string, ""),
  weightUnit: types.optional(types.string, ""),
  lengthValue: types.optional(types.string, ""),
  widthValue: types.optional(types.string, ""),
  heightValue: types.optional(types.string, ""),
  dimensionUnit: types.optional(types.string, ""),
  declaredValue: types.optional(types.string, ""),
  declaredValueCurrency: types.optional(types.string, ""),
  isBattery: types.optional(types.boolean, false),
  isHazmat: types.optional(types.boolean, false),
  imageAssetId: types.maybeNull(types.string),
  imageUri: types.maybeNull(types.string),
  imagePreviewUrl: types.maybeNull(types.string),
  clearImage: types.optional(types.boolean, false),
});

export interface InventoryGoodFormSource {
  id: string;
  sku: string;
  name: string;
  gtin?: string | null;
  barcode?: string | null;
  hsCode?: string | null;
  countryOfOrigin?: string | null;
  weightValue?: number | null;
  weightUnit?: string | null;
  lengthValue?: number | null;
  widthValue?: number | null;
  heightValue?: number | null;
  dimensionUnit?: string | null;
  declaredValue?: number | null;
  declaredValueCurrency?: string | null;
  isBattery?: boolean | null;
  isHazmat?: boolean | null;
  imageUri?: string | null;
}

export const EcommerceInventoryModel = types
  .model("EcommerceInventory", {
    wmsInventoryLoading: types.optional(types.boolean, false),
    wmsInventoryError: types.maybeNull(types.string),
    shopInventoryLoadingIds: types.optional(types.array(types.string), []),
    shopInventoryError: types.maybeNull(types.string),
    addWmsAccountModalOpen: types.optional(types.boolean, false),
    addWmsAccountSaving: types.optional(types.boolean, false),
    addWmsAccountError: types.maybeNull(types.string),
    addWmsAccountDraft: types.optional(AddWmsAccountDraftModel, {}),
    wmsInventoryGoodsSyncModalOpen: types.optional(types.boolean, false),
    wmsInventoryGoodsSyncAccountId: types.maybeNull(types.string),
    wmsInventoryGoodsCoverageLoading: types.optional(types.boolean, false),
    wmsInventoryGoodsSyncing: types.optional(types.boolean, false),
    wmsInventoryGoodsSyncError: types.maybeNull(types.string),
    wmsInventoryGoodsCoverage: types.maybeNull(types.frozen<GQL.WmsInventoryGoodCoveragePayload>()),
    wmsInventoryGoodsSyncResult: types.maybeNull(types.frozen<GQL.SyncWmsInventoryGoodsPayload>()),
    inventoryGoodsDrawerOpen: types.optional(types.boolean, false),
    inventoryGoodsLoading: types.optional(types.boolean, false),
    inventoryGoodsError: types.maybeNull(types.string),
    inventoryGoodsSearch: types.optional(types.string, ""),
    inventoryGoodsPage: types.optional(types.number, 1),
    inventoryGoodsPageSize: types.optional(types.number, 100),
    inventoryGoodsVisibleColumns: types.optional(types.array(types.string), [
      "image",
      "good",
      "measurements",
      "declaredValue",
    ]),
    inventoryGoodModalOpen: types.optional(types.boolean, false),
    inventoryGoodSaving: types.optional(types.boolean, false),
    inventoryGoodUploadingImage: types.optional(types.boolean, false),
    inventoryGoodFormError: types.maybeNull(types.string),
    inventoryGoodDraft: types.optional(InventoryGoodDraftModel, {}),
    selectedInventoryGoodIds: types.optional(types.array(types.string), []),
    deletingInventoryGoodIds: types.optional(types.array(types.string), []),
    expandedWmsAccountIds: types.optional(types.array(types.string), []),
    deletingWmsAccountIds: types.optional(types.array(types.string), []),
    expandedShopWarehouseIds: types.optional(types.array(types.string), []),
    shopWarehouseTabByShopId: types.optional(types.map(types.string), {}),
    syncingWmsAccountIds: types.optional(types.array(types.string), []),
    syncingShopIds: types.optional(types.array(types.string), []),
    savingShopWarehouseMappingIds: types.optional(types.array(types.string), []),
  })
  .views((self) => ({
    isWmsAccountExpanded(id: string) {
      return self.expandedWmsAccountIds.includes(id);
    },
    isShopWarehouseExpanded(id: string) {
      return self.expandedShopWarehouseIds.includes(id);
    },
    getShopWarehouseTab(shopId: string) {
      return self.shopWarehouseTabByShopId.get(shopId) === "official" ? "official" : "thirdParty";
    },
    isWmsAccountSyncing(id: string) {
      return self.syncingWmsAccountIds.includes(id);
    },
    isWmsAccountDeleting(id: string) {
      return self.deletingWmsAccountIds.includes(id);
    },
    isWmsInventoryGoodsWorkflowBusy(id: string) {
      return self.wmsInventoryGoodsSyncAccountId === id
        && (self.wmsInventoryGoodsCoverageLoading || self.wmsInventoryGoodsSyncing);
    },
    get isEditingWmsAccount() {
      return Boolean(self.addWmsAccountDraft.id);
    },
    get isEditingInventoryGood() {
      return Boolean(self.inventoryGoodDraft.id);
    },
    get inventoryGoodsOffset() {
      return Math.max(self.inventoryGoodsPage - 1, 0) * self.inventoryGoodsPageSize;
    },
    get filteredInventoryGoods() {
      const search = self.inventoryGoodsSearch.trim().toLowerCase();
      const goods = getRoot<any>(self).inventoryGoods ?? [];
      return goods
        .filter((good: { status?: string }) => good.status !== "ARCHIVED")
        .filter((good: {
          sku?: string | null;
          name?: string | null;
          barcode?: string | null;
          gtin?: string | null;
          hsCode?: string | null;
        }) => {
          if (!search) return true;
          return [
            good.sku,
            good.name,
            good.barcode,
            good.gtin,
            good.hsCode,
          ].some((value) => value?.toLowerCase().includes(search));
        });
    },
    get inventoryGoodsFilteredCount() {
      return (self as any).filteredInventoryGoods.length;
    },
    get inventoryGoodsPageCount() {
      return Math.max(1, Math.ceil((self as any).inventoryGoodsFilteredCount / self.inventoryGoodsPageSize));
    },
    get pagedInventoryGoods() {
      return (self as any).filteredInventoryGoods.slice(
        (self as any).inventoryGoodsOffset,
        (self as any).inventoryGoodsOffset + self.inventoryGoodsPageSize,
      );
    },
    get inventoryGoodsHasNextPage() {
      return (self as any).inventoryGoodsOffset + self.inventoryGoodsPageSize < (self as any).filteredInventoryGoods.length;
    },
    isInventoryGoodsColumnVisible(column: string) {
      return self.inventoryGoodsVisibleColumns.includes(column);
    },
    isInventoryGoodSelected(id: string) {
      return self.selectedInventoryGoodIds.includes(id);
    },
    isInventoryGoodDeleting(id: string) {
      return self.deletingInventoryGoodIds.includes(id);
    },
    isShopInventoryLoading(shopId: string) {
      return self.shopInventoryLoadingIds.includes(shopId) || self.syncingShopIds.includes(shopId);
    },
    isShopSyncing(shopId: string) {
      return self.syncingShopIds.includes(shopId);
    },
    isShopWarehouseMappingSaving(shopWarehouseId: string) {
      return self.savingShopWarehouseMappingIds.includes(shopWarehouseId);
    },
  }))
  .actions((self) => {
    const client = () => getEnv<PanelStoreEnv>(self).apolloClient;
    const root = () => getRoot<any>(self);

    function pushUnique(list: string[], value: string) {
      if (!list.includes(value)) list.push(value);
    }

    function removeValue(list: string[], value: string) {
      const idx = list.indexOf(value);
      if (idx >= 0) list.splice(idx, 1);
    }

    function messageFromError(err: unknown) {
      return err instanceof Error ? err.message : "Request failed";
    }

    const wmsAccountsInput: GQL.ReadWmsAccountsInput = {};
    const warehousesInput: GQL.ReadWarehousesInput = {};
    function shopWarehousesInput(shopId: string): GQL.ReadShopWarehousesInput {
      return { shopId };
    }

    function inventoryGoodsInput(): GQL.ReadInventoryGoodsInput {
      return {
        limit: 500,
        status: "ACTIVE" as GQL.InventoryGoodStatus,
      };
    }

    function resetInventoryGoodDraft() {
      self.inventoryGoodDraft.id = null;
      self.inventoryGoodDraft.sku = "";
      self.inventoryGoodDraft.name = "";
      self.inventoryGoodDraft.gtin = "";
      self.inventoryGoodDraft.barcode = "";
      self.inventoryGoodDraft.hsCode = "";
      self.inventoryGoodDraft.countryOfOrigin = "";
      self.inventoryGoodDraft.weightValue = "";
      self.inventoryGoodDraft.weightUnit = "";
      self.inventoryGoodDraft.lengthValue = "";
      self.inventoryGoodDraft.widthValue = "";
      self.inventoryGoodDraft.heightValue = "";
      self.inventoryGoodDraft.dimensionUnit = "";
      self.inventoryGoodDraft.declaredValue = "";
      self.inventoryGoodDraft.declaredValueCurrency = "";
      self.inventoryGoodDraft.isBattery = false;
      self.inventoryGoodDraft.isHazmat = false;
      self.inventoryGoodDraft.imageAssetId = null;
      self.inventoryGoodDraft.imageUri = null;
      self.inventoryGoodDraft.imagePreviewUrl = null;
      self.inventoryGoodDraft.clearImage = false;
    }

    function optionalText(value: string) {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }

    function optionalNumber(value: string, fieldName: string) {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${fieldName} must be a non-negative number`);
      }
      return parsed;
    }

    function buildInventoryGoodInput(): GQL.WriteInventoryGoodInput {
      const draft = self.inventoryGoodDraft;
      const input: GQL.WriteInventoryGoodInput = {
        id: draft.id ?? undefined,
        sku: draft.sku.trim(),
        name: draft.name.trim(),
        gtin: optionalText(draft.gtin),
        barcode: optionalText(draft.barcode),
        hsCode: optionalText(draft.hsCode),
        countryOfOrigin: optionalText(draft.countryOfOrigin) as GQL.InventoryCountryCode | null,
        weightValue: optionalNumber(draft.weightValue, "weightValue"),
        weightUnit: optionalText(draft.weightUnit) as GQL.InventoryWeightUnit | null,
        lengthValue: optionalNumber(draft.lengthValue, "lengthValue"),
        widthValue: optionalNumber(draft.widthValue, "widthValue"),
        heightValue: optionalNumber(draft.heightValue, "heightValue"),
        dimensionUnit: optionalText(draft.dimensionUnit) as GQL.InventoryDimensionUnit | null,
        declaredValue: optionalNumber(draft.declaredValue, "declaredValue"),
        declaredValueCurrency: optionalText(draft.declaredValueCurrency) as GQL.Currency | null,
        isBattery: draft.isBattery,
        isHazmat: draft.isHazmat,
      };
      if (draft.clearImage) {
        input.imageAssetId = null;
      } else if (draft.imageAssetId || draft.imageUri) {
        input.imageAssetId = draft.imageAssetId;
        input.imageUri = draft.imageUri;
      }
      return input;
    }

    return {
      setAddWmsAccountModalOpen(open: boolean) {
        self.addWmsAccountModalOpen = open;
        self.addWmsAccountError = null;
        if (open) {
          self.addWmsAccountDraft.id = null;
          self.addWmsAccountDraft.provider = "YEJOIN";
          self.addWmsAccountDraft.label = "";
          self.addWmsAccountDraft.endpoint = "";
          self.addWmsAccountDraft.declaredValueCurrency = "";
          self.addWmsAccountDraft.apiToken = "";
          self.addWmsAccountDraft.notes = "";
          self.addWmsAccountDraft.originalEndpoint = "";
        }
      },
      openEditWmsAccountModal(account: {
        id: string;
        provider: string;
        label: string;
        endpoint: string;
        declaredValueCurrency?: string | null;
        notes?: string | null;
      }) {
        self.addWmsAccountError = null;
        self.addWmsAccountDraft.id = account.id;
        self.addWmsAccountDraft.provider = account.provider;
        self.addWmsAccountDraft.label = account.label;
        self.addWmsAccountDraft.endpoint = account.endpoint;
        self.addWmsAccountDraft.declaredValueCurrency = account.declaredValueCurrency ?? "";
        self.addWmsAccountDraft.apiToken = "";
        self.addWmsAccountDraft.notes = account.notes ?? "";
        self.addWmsAccountDraft.originalEndpoint = account.endpoint;
        self.addWmsAccountModalOpen = true;
      },
      updateAddWmsAccountDraft(patch: {
        provider?: string;
        label?: string;
        endpoint?: string;
        declaredValueCurrency?: string;
        apiToken?: string;
        notes?: string;
      }) {
        if (typeof patch.provider === "string") self.addWmsAccountDraft.provider = patch.provider;
        if (typeof patch.label === "string") self.addWmsAccountDraft.label = patch.label;
        if (typeof patch.endpoint === "string") self.addWmsAccountDraft.endpoint = patch.endpoint;
        if (typeof patch.declaredValueCurrency === "string") self.addWmsAccountDraft.declaredValueCurrency = patch.declaredValueCurrency;
        if (typeof patch.apiToken === "string") self.addWmsAccountDraft.apiToken = patch.apiToken;
        if (typeof patch.notes === "string") self.addWmsAccountDraft.notes = patch.notes;
      },
      toggleWmsAccountExpanded(id: string) {
        if (self.expandedWmsAccountIds.includes(id)) {
          removeValue(self.expandedWmsAccountIds, id);
        } else {
          self.expandedWmsAccountIds.push(id);
        }
      },
      toggleShopWarehouseExpanded(id: string) {
        if (self.expandedShopWarehouseIds.includes(id)) {
          removeValue(self.expandedShopWarehouseIds, id);
        } else {
          self.expandedShopWarehouseIds.push(id);
        }
      },
      setShopWarehouseTab(shopId: string, tab: "thirdParty" | "official") {
        self.shopWarehouseTabByShopId.set(shopId, tab);
      },
      closeWmsInventoryGoodsSyncModal() {
        if (self.wmsInventoryGoodsCoverageLoading || self.wmsInventoryGoodsSyncing) return;
        self.wmsInventoryGoodsSyncModalOpen = false;
        self.wmsInventoryGoodsSyncAccountId = null;
        self.wmsInventoryGoodsCoverage = null;
        self.wmsInventoryGoodsSyncResult = null;
        self.wmsInventoryGoodsSyncError = null;
      },
      setInventoryGoodsDrawerOpen(open: boolean) {
        self.inventoryGoodsDrawerOpen = open;
        self.inventoryGoodsError = null;
        if (open) {
          (self as any).fetchInventoryGoods().catch(() => {});
        } else {
          self.selectedInventoryGoodIds.clear();
        }
      },
      setInventoryGoodsSearch(search: string) {
        self.inventoryGoodsSearch = search;
        self.inventoryGoodsPage = 1;
        self.selectedInventoryGoodIds.clear();
      },
      applyInventoryGoodsFilters() {
        self.inventoryGoodsPage = 1;
        self.selectedInventoryGoodIds.clear();
        return Promise.resolve();
      },
      resetInventoryGoodsFilters() {
        self.inventoryGoodsSearch = "";
        self.inventoryGoodsPage = 1;
        self.selectedInventoryGoodIds.clear();
        return Promise.resolve();
      },
      toggleInventoryGoodsColumn(column: string) {
        if (self.inventoryGoodsVisibleColumns.includes(column)) {
          removeValue(self.inventoryGoodsVisibleColumns, column);
        } else {
          self.inventoryGoodsVisibleColumns.push(column);
        }
      },
      goToInventoryGoodsPage(page: number) {
        const maxPage = (self as any).inventoryGoodsPageCount;
        const nextPage = Math.min(Math.max(Math.floor(page), 1), maxPage);
        if (nextPage === self.inventoryGoodsPage) return Promise.resolve();
        self.inventoryGoodsPage = nextPage;
        self.selectedInventoryGoodIds.clear();
        return Promise.resolve();
      },
      nextInventoryGoodsPage() {
        if (!(self as any).inventoryGoodsHasNextPage) return Promise.resolve();
        return (self as any).goToInventoryGoodsPage(self.inventoryGoodsPage + 1);
      },
      previousInventoryGoodsPage() {
        if (self.inventoryGoodsPage <= 1) return Promise.resolve();
        return (self as any).goToInventoryGoodsPage(self.inventoryGoodsPage - 1);
      },
      openAddInventoryGoodModal() {
        self.inventoryGoodFormError = null;
        resetInventoryGoodDraft();
        self.inventoryGoodModalOpen = true;
      },
      openEditInventoryGoodModal(good: InventoryGoodFormSource) {
        self.inventoryGoodFormError = null;
        resetInventoryGoodDraft();
        self.inventoryGoodDraft.id = good.id;
        self.inventoryGoodDraft.sku = good.sku;
        self.inventoryGoodDraft.name = good.name;
        self.inventoryGoodDraft.gtin = good.gtin ?? "";
        self.inventoryGoodDraft.barcode = good.barcode ?? "";
        self.inventoryGoodDraft.hsCode = good.hsCode ?? "";
        self.inventoryGoodDraft.countryOfOrigin = good.countryOfOrigin ?? "";
        self.inventoryGoodDraft.weightValue = good.weightValue == null ? "" : String(good.weightValue);
        self.inventoryGoodDraft.weightUnit = good.weightUnit ?? "";
        self.inventoryGoodDraft.lengthValue = good.lengthValue == null ? "" : String(good.lengthValue);
        self.inventoryGoodDraft.widthValue = good.widthValue == null ? "" : String(good.widthValue);
        self.inventoryGoodDraft.heightValue = good.heightValue == null ? "" : String(good.heightValue);
        self.inventoryGoodDraft.dimensionUnit = good.dimensionUnit ?? "";
        self.inventoryGoodDraft.declaredValue = good.declaredValue == null ? "" : String(good.declaredValue);
        self.inventoryGoodDraft.declaredValueCurrency = good.declaredValueCurrency ?? "";
        self.inventoryGoodDraft.isBattery = good.isBattery ?? false;
        self.inventoryGoodDraft.isHazmat = good.isHazmat ?? false;
        self.inventoryGoodDraft.imageAssetId = null;
        self.inventoryGoodDraft.imageUri = good.imageUri ?? null;
        self.inventoryGoodDraft.imagePreviewUrl = null;
        self.inventoryGoodModalOpen = true;
      },
      closeInventoryGoodModal() {
        if (self.inventoryGoodSaving || self.inventoryGoodUploadingImage) return;
        self.inventoryGoodModalOpen = false;
        self.inventoryGoodFormError = null;
      },
      updateInventoryGoodDraft(patch: Partial<{
        sku: string;
        name: string;
        gtin: string;
        barcode: string;
        hsCode: string;
        countryOfOrigin: string;
        weightValue: string;
        weightUnit: string;
        lengthValue: string;
        widthValue: string;
        heightValue: string;
        dimensionUnit: string;
        declaredValue: string;
        declaredValueCurrency: string;
        isBattery: boolean;
        isHazmat: boolean;
      }>) {
        Object.assign(self.inventoryGoodDraft, patch);
        self.inventoryGoodDraft.clearImage = false;
      },
      clearInventoryGoodImage() {
        self.inventoryGoodDraft.imageAssetId = null;
        self.inventoryGoodDraft.imageUri = null;
        self.inventoryGoodDraft.imagePreviewUrl = null;
        self.inventoryGoodDraft.clearImage = true;
      },
      toggleInventoryGoodSelected(id: string) {
        if (self.selectedInventoryGoodIds.includes(id)) {
          removeValue(self.selectedInventoryGoodIds, id);
        } else {
          self.selectedInventoryGoodIds.push(id);
        }
      },
      setAllInventoryGoodsSelected(ids: string[], selected: boolean) {
        self.selectedInventoryGoodIds.clear();
        if (selected) {
          ids.forEach((id) => self.selectedInventoryGoodIds.push(id));
        }
      },
      fetchInventoryGoods: flow(function* () {
        self.inventoryGoodsLoading = true;
        self.inventoryGoodsError = null;
        try {
          yield client().query<{ readInventoryGoods: GQL.InventoryGood[] }>({
            query: READ_INVENTORY_GOODS_QUERY,
            variables: { input: inventoryGoodsInput() },
            fetchPolicy: "network-only",
          });
        } catch (err) {
          self.inventoryGoodsError = messageFromError(err);
          throw err;
        } finally {
          self.inventoryGoodsLoading = false;
        }
      }),
      uploadInventoryGoodImage: flow(function* (file: File) {
        self.inventoryGoodUploadingImage = true;
        self.inventoryGoodFormError = null;
        try {
          const uploaded = yield uploadInventoryGoodImage(file);
          self.inventoryGoodDraft.imageAssetId = uploaded.assetId;
          self.inventoryGoodDraft.imageUri = uploaded.uri;
          self.inventoryGoodDraft.imagePreviewUrl = uploaded.previewUrl ?? uploaded.publicUrl ?? null;
          self.inventoryGoodDraft.clearImage = false;
          return uploaded;
        } catch (err) {
          self.inventoryGoodFormError = messageFromError(err);
          throw err;
        } finally {
          self.inventoryGoodUploadingImage = false;
        }
      }),
      saveInventoryGood: flow(function* () {
        self.inventoryGoodSaving = true;
        self.inventoryGoodFormError = null;
        try {
          const input = buildInventoryGoodInput();
          if (!input.sku || !input.name) {
            throw new Error("SKU and name are required");
          }
          yield client().mutate<{ writeInventoryGoods: GQL.InventoryGood[] }>({
            mutation: WRITE_INVENTORY_GOODS_MUTATION,
            variables: { inputs: [input] },
          });
          yield (self as any).fetchInventoryGoods();
          self.inventoryGoodModalOpen = false;
        } catch (err) {
          self.inventoryGoodFormError = messageFromError(err);
          throw err;
        } finally {
          self.inventoryGoodSaving = false;
        }
      }),
      archiveInventoryGood: flow(function* (id: string) {
        pushUnique(self.deletingInventoryGoodIds, id);
        self.inventoryGoodsError = null;
        try {
          yield client().mutate<{ writeInventoryGoods: GQL.InventoryGood[] }>({
            mutation: WRITE_INVENTORY_GOODS_MUTATION,
            variables: { inputs: [{ id, status: "ARCHIVED" }] },
          });
          yield (self as any).fetchInventoryGoods();
          removeValue(self.selectedInventoryGoodIds, id);
        } catch (err) {
          self.inventoryGoodsError = messageFromError(err);
          throw err;
        } finally {
          removeValue(self.deletingInventoryGoodIds, id);
        }
      }),
      archiveSelectedInventoryGoods: flow(function* () {
        const ids = [...self.selectedInventoryGoodIds];
        if (ids.length === 0) return;
        ids.forEach((id) => pushUnique(self.deletingInventoryGoodIds, id));
        self.inventoryGoodsError = null;
        try {
          yield client().mutate<{ writeInventoryGoods: GQL.InventoryGood[] }>({
            mutation: WRITE_INVENTORY_GOODS_MUTATION,
            variables: {
              inputs: ids.map((id) => ({ id, status: "ARCHIVED" })),
            },
          });
          yield (self as any).fetchInventoryGoods();
          self.selectedInventoryGoodIds.clear();
        } catch (err) {
          self.inventoryGoodsError = messageFromError(err);
          throw err;
        } finally {
          ids.forEach((id) => removeValue(self.deletingInventoryGoodIds, id));
        }
      }),
      fetchWmsInventory: flow(function* () {
        self.wmsInventoryLoading = true;
        self.wmsInventoryError = null;
        try {
          yield Promise.all([
            client().query<{ readWmsAccounts: GQL.WmsAccount[] }>({
              query: READ_WMS_ACCOUNTS_QUERY,
              variables: { input: wmsAccountsInput },
              fetchPolicy: "network-only",
            }),
            client().query<{ readWarehouses: GQL.Warehouse[] }>({
              query: READ_WAREHOUSES_QUERY,
              variables: { input: warehousesInput },
              fetchPolicy: "network-only",
            }),
          ]);
        } catch (err) {
          self.wmsInventoryError = messageFromError(err);
          throw err;
        } finally {
          self.wmsInventoryLoading = false;
        }
      }),
      saveWmsAccount: flow(function* () {
        const isEdit = Boolean(self.addWmsAccountDraft.id);
        const apiToken = self.addWmsAccountDraft.apiToken.trim();
        const input: GQL.WriteWmsAccountInput = {
          id: self.addWmsAccountDraft.id ?? undefined,
          provider: self.addWmsAccountDraft.provider as GQL.WmsAccountProvider,
          label: self.addWmsAccountDraft.label.trim(),
          endpoint: self.addWmsAccountDraft.endpoint.trim(),
          declaredValueCurrency: self.addWmsAccountDraft.declaredValueCurrency as GQL.Currency,
          notes: self.addWmsAccountDraft.notes.trim() || null,
        };
        if (!isEdit || apiToken) input.apiToken = apiToken;
        const expectsWarehouseSync = !isEdit
          || self.addWmsAccountDraft.endpoint.trim() !== self.addWmsAccountDraft.originalEndpoint
          || Boolean(apiToken);

        self.addWmsAccountSaving = true;
        self.addWmsAccountError = null;
        try {
          const result = yield client().mutate<{ writeWmsAccounts: GQL.WriteWmsAccountPayload[] }>({
            mutation: WRITE_WMS_ACCOUNTS_MUTATION,
            variables: { inputs: [input] },
          });
          const graphQLErrors = (result as any).errors as Array<{ message?: string }> | undefined;
          if (graphQLErrors?.length) {
            throw new Error(graphQLErrors[0]?.message ?? "Failed to add WMS account");
          }
          const payload = result.data?.writeWmsAccounts?.[0];
          if (!payload?.account) {
            throw new Error("No WMS account returned from backend");
          }
          if (expectsWarehouseSync && (!payload.sync || payload.sync.wmsAccountId !== payload.account.id)) {
            throw new Error("WMS account was saved, but warehouse sync did not complete");
          }
          yield Promise.all([
            client().query({ query: READ_WMS_ACCOUNTS_QUERY, variables: { input: wmsAccountsInput }, fetchPolicy: "network-only" }),
            client().query({ query: READ_WAREHOUSES_QUERY, variables: { input: warehousesInput }, fetchPolicy: "network-only" }),
          ]);
          if (!self.expandedWmsAccountIds.includes(payload.account.id)) {
            self.expandedWmsAccountIds.push(payload.account.id);
          }
          self.addWmsAccountModalOpen = false;
          if (expectsWarehouseSync) {
            try {
              yield (self as any).startWmsInventoryGoodsSyncWorkflow(payload.account.id);
            } catch {
              // The WMS account and warehouse sync succeeded. Keep the inventory goods workflow
              // modal open with its own error instead of treating account save as failed.
            }
          }
          return payload;
        } catch (err) {
          self.addWmsAccountError = messageFromError(err);
          throw err;
        } finally {
          self.addWmsAccountSaving = false;
        }
      }),
      createWmsAccount: flow(function* () {
        return yield (self as any).saveWmsAccount();
      }),
      archiveWmsAccount: flow(function* (wmsAccountId: string) {
        pushUnique(self.deletingWmsAccountIds, wmsAccountId);
        self.wmsInventoryError = null;
        try {
          yield client().mutate<{ writeWmsAccounts: GQL.WriteWmsAccountPayload[] }>({
            mutation: WRITE_WMS_ACCOUNTS_MUTATION,
            variables: {
              inputs: [{
                id: wmsAccountId,
                status: "ARCHIVED",
              }],
            },
          });
          yield Promise.all([
            client().query({ query: READ_WMS_ACCOUNTS_QUERY, variables: { input: wmsAccountsInput }, fetchPolicy: "network-only" }),
            client().query({ query: READ_WAREHOUSES_QUERY, variables: { input: warehousesInput }, fetchPolicy: "network-only" }),
          ]);
          removeValue(self.expandedWmsAccountIds, wmsAccountId);
        } catch (err) {
          self.wmsInventoryError = messageFromError(err);
          throw err;
        } finally {
          removeValue(self.deletingWmsAccountIds, wmsAccountId);
        }
      }),
      syncWmsWarehouses: flow(function* (wmsAccountId: string) {
        pushUnique(self.syncingWmsAccountIds, wmsAccountId);
        self.wmsInventoryError = null;
        try {
          yield client().mutate<{ syncWmsWarehouses: GQL.WmsWarehouseSyncPayload }>({
            mutation: SYNC_WMS_WAREHOUSES_MUTATION,
            variables: { wmsAccountId },
          });
          yield Promise.all([
            client().query({ query: READ_WMS_ACCOUNTS_QUERY, variables: { input: wmsAccountsInput }, fetchPolicy: "network-only" }),
            client().query({ query: READ_WAREHOUSES_QUERY, variables: { input: warehousesInput }, fetchPolicy: "network-only" }),
          ]);
        } catch (err) {
          self.wmsInventoryError = messageFromError(err);
          throw err;
        } finally {
          removeValue(self.syncingWmsAccountIds, wmsAccountId);
        }
      }),
      fetchShopInventory: flow(function* (shopId: string) {
        pushUnique(self.shopInventoryLoadingIds, shopId);
        self.shopInventoryError = null;
        try {
          yield Promise.all([
            client().query<{ readShopWarehouses: GQL.ShopWarehouse[] }>({
              query: READ_SHOP_WAREHOUSES_QUERY,
              variables: { input: shopWarehousesInput(shopId) },
              fetchPolicy: "network-only",
            }),
            client().query<{ readWarehouses: GQL.Warehouse[] }>({
              query: READ_WAREHOUSES_QUERY,
              variables: { input: warehousesInput },
              fetchPolicy: "network-only",
            }),
          ]);
        } catch (err) {
          self.shopInventoryError = messageFromError(err);
          throw err;
        } finally {
          removeValue(self.shopInventoryLoadingIds, shopId);
        }
      }),
      syncShopWarehouses: flow(function* (shopId: string) {
        pushUnique(self.syncingShopIds, shopId);
        self.shopInventoryError = null;
        try {
          yield client().mutate<{ syncShopWarehouses: GQL.ShopWarehouseSyncPayload }>({
            mutation: SYNC_SHOP_WAREHOUSES_MUTATION,
            variables: { shopId },
          });
          yield Promise.all([
            client().query({ query: READ_SHOP_WAREHOUSES_QUERY, variables: { input: shopWarehousesInput(shopId) }, fetchPolicy: "network-only" }),
            client().query({ query: READ_WAREHOUSES_QUERY, variables: { input: warehousesInput }, fetchPolicy: "network-only" }),
          ]);
        } catch (err) {
          self.shopInventoryError = messageFromError(err);
          throw err;
        } finally {
          removeValue(self.syncingShopIds, shopId);
        }
      }),
      writeShopWarehouseMapping: flow(function* (shopId: string, shopWarehouseId: string, warehouseId: string | null) {
        pushUnique(self.savingShopWarehouseMappingIds, shopWarehouseId);
        self.shopInventoryError = null;
        try {
          yield client().mutate<{ writeShopWarehouseMappings: GQL.ShopWarehouse[] }>({
            mutation: WRITE_SHOP_WAREHOUSE_MAPPINGS_MUTATION,
            variables: {
              inputs: [{
                shopWarehouseId,
                warehouseId,
              }],
            },
          });
          yield client().query({
            query: READ_SHOP_WAREHOUSES_QUERY,
            variables: { input: shopWarehousesInput(shopId) },
            fetchPolicy: "network-only",
          });
          return root().getShopWarehouse(shopWarehouseId);
        } catch (err) {
          self.shopInventoryError = messageFromError(err);
          throw err;
        } finally {
          removeValue(self.savingShopWarehouseMappingIds, shopWarehouseId);
        }
      }),
      startWmsInventoryGoodsSyncWorkflow: flow(function* (wmsAccountId: string) {
        self.wmsInventoryGoodsSyncModalOpen = true;
        self.wmsInventoryGoodsSyncAccountId = wmsAccountId;
        self.wmsInventoryGoodsCoverage = null;
        self.wmsInventoryGoodsSyncResult = null;
        self.wmsInventoryGoodsSyncError = null;
        self.wmsInventoryGoodsCoverageLoading = true;
        try {
          const result = yield client().query<{ readWmsInventoryGoodCoverage: GQL.WmsInventoryGoodCoveragePayload }>({
            query: READ_WMS_INVENTORY_GOOD_COVERAGE_QUERY,
            variables: { wmsAccountId },
            fetchPolicy: "network-only",
          });
          self.wmsInventoryGoodsCoverage = result.data?.readWmsInventoryGoodCoverage ?? null;
        } catch (err) {
          self.wmsInventoryGoodsSyncError = messageFromError(err);
          throw err;
        } finally {
          self.wmsInventoryGoodsCoverageLoading = false;
        }
      }),
      syncWmsInventoryGoods: flow(function* (overrideExisting: boolean) {
        const wmsAccountId = self.wmsInventoryGoodsSyncAccountId;
        if (!wmsAccountId) return null;
        self.wmsInventoryGoodsSyncing = true;
        self.wmsInventoryGoodsSyncError = null;
        try {
          const result = yield client().mutate<{ syncWmsInventoryGoods: GQL.SyncWmsInventoryGoodsPayload }>({
            mutation: SYNC_WMS_INVENTORY_GOODS_MUTATION,
            variables: { wmsAccountId, overrideExisting },
          });
          const payload = result.data?.syncWmsInventoryGoods ?? null;
          if (!payload) {
            throw new Error("No inventory goods sync result returned from backend");
          }
          self.wmsInventoryGoodsSyncResult = payload;
          yield Promise.all([
            (self as any).fetchInventoryGoods(),
            (self as any).fetchWmsInventory(),
          ]);
          yield (self as any).startWmsInventoryGoodsSyncWorkflow(wmsAccountId);
          self.wmsInventoryGoodsSyncResult = payload;
          return payload;
        } catch (err) {
          self.wmsInventoryGoodsSyncError = messageFromError(err);
          throw err;
        } finally {
          self.wmsInventoryGoodsSyncing = false;
        }
      }),
    };
  });
