import { gql } from "@apollo/client/core";

export const WAREHOUSE_ADDRESS_FIELDS_FRAGMENT = gql`
  fragment WarehouseAddressFields on WarehouseAddress {
    addressLine1
    addressLine2
    city
    district
    fullAddress
    postalCode
    region
    regionCode
    state
  }
`;

export const WMS_ACCOUNT_FIELDS_FRAGMENT = gql`
  fragment WmsAccountFields on WmsAccount {
    id
    userId
    provider
    label
    endpoint
    declaredValueCurrency
    status
    lastSyncedAt
    lastSyncError
    notes
    createdAt
    updatedAt
  }
`;

export const WAREHOUSE_FIELDS_FRAGMENT = gql`
  ${WAREHOUSE_ADDRESS_FIELDS_FRAGMENT}
  fragment WarehouseFields on Warehouse {
    id
    userId
    provider
    warehouseType
    name
    code
    externalWarehouseId
    sourceId
    regionCode
    address {
      ...WarehouseAddressFields
    }
    status
    lastSyncedAt
    notes
    createdAt
    updatedAt
  }
`;

export const SHOP_WAREHOUSE_FIELDS_FRAGMENT = gql`
  ${WAREHOUSE_ADDRESS_FIELDS_FRAGMENT}
  fragment ShopWarehouseFields on ShopWarehouse {
    id
    userId
    shopId
    platformWarehouseId
    platformEntityId
    platformSubType
    warehouseId
    warehouseType
    name
    regionCode
    address {
      ...WarehouseAddressFields
    }
    effectStatus
    isDefault
    status
    lastSyncedAt
    notes
    createdAt
    updatedAt
  }
`;

export const INVENTORY_GOOD_FIELDS_FRAGMENT = gql`
  fragment InventoryGoodFields on InventoryGood {
    id
    userId
    sku
    name
    barcode
    gtin
    hsCode
    countryOfOrigin
    weightValue
    weightUnit
    lengthValue
    widthValue
    heightValue
    dimensionUnit
    declaredValue
    declaredValueCurrency
    imageAssetId
    imageUri
    isBattery
    isHazmat
    status
    createdAt
    updatedAt
  }
`;

export const READ_WMS_ACCOUNTS_QUERY = gql`
  ${WMS_ACCOUNT_FIELDS_FRAGMENT}
  query ReadWmsAccounts($input: ReadWmsAccountsInput!) {
    readWmsAccounts(input: $input) {
      ...WmsAccountFields
    }
  }
`;

export const READ_WAREHOUSES_QUERY = gql`
  ${WAREHOUSE_FIELDS_FRAGMENT}
  query ReadWarehouses($input: ReadWarehousesInput!) {
    readWarehouses(input: $input) {
      ...WarehouseFields
    }
  }
`;

export const READ_SHOP_WAREHOUSES_QUERY = gql`
  ${SHOP_WAREHOUSE_FIELDS_FRAGMENT}
  query ReadShopWarehouses($input: ReadShopWarehousesInput!) {
    readShopWarehouses(input: $input) {
      ...ShopWarehouseFields
    }
  }
`;

export const READ_INVENTORY_GOODS_QUERY = gql`
  ${INVENTORY_GOOD_FIELDS_FRAGMENT}
  query ReadInventoryGoods($input: ReadInventoryGoodsInput!) {
    readInventoryGoods(input: $input) {
      ...InventoryGoodFields
    }
  }
`;

export const READ_WMS_INVENTORY_GOOD_COVERAGE_QUERY = gql`
  query ReadWmsInventoryGoodCoverage($wmsAccountId: ID!) {
    readWmsInventoryGoodCoverage(wmsAccountId: $wmsAccountId) {
      wmsAccountId
      provider
      recognizedWmsGoodsCount
      unrecognizedWmsInventoryGoods {
        sku
        name
        gtin
        barcode
        hsCode
        countryOfOrigin
        weightValue
        weightUnit
        lengthValue
        widthValue
        heightValue
        dimensionUnit
        declaredValue
        declaredValueCurrency
        imageUrl
        isBattery
        isHazmat
        reason
      }
    }
  }
`;

export const SYNC_WMS_INVENTORY_GOODS_MUTATION = gql`
  ${INVENTORY_GOOD_FIELDS_FRAGMENT}
  mutation SyncWmsInventoryGoods($wmsAccountId: ID!, $overrideExisting: Boolean) {
    syncWmsInventoryGoods(wmsAccountId: $wmsAccountId, overrideExisting: $overrideExisting) {
      wmsAccountId
      overrideExisting
      fetched
      created
      updated
      skippedExisting
      imageImported
      imageFailed
      failed
      goods {
        ...InventoryGoodFields
      }
      errors {
        sku
        message
      }
    }
  }
`;

export const WRITE_INVENTORY_GOODS_MUTATION = gql`
  ${INVENTORY_GOOD_FIELDS_FRAGMENT}
  mutation WriteInventoryGoods($inputs: [WriteInventoryGoodInput!]!) {
    writeInventoryGoods(inputs: $inputs) {
      ...InventoryGoodFields
    }
  }
`;

export const WRITE_WMS_ACCOUNTS_MUTATION = gql`
  ${WMS_ACCOUNT_FIELDS_FRAGMENT}
  mutation WriteWmsAccounts($inputs: [WriteWmsAccountInput!]!) {
    writeWmsAccounts(inputs: $inputs) {
      account {
        ...WmsAccountFields
      }
      sync {
        wmsAccountId
        provider
        warehousesSynced
      }
    }
  }
`;

export const SYNC_WMS_WAREHOUSES_MUTATION = gql`
  mutation SyncWmsWarehouses($wmsAccountId: ID!) {
    syncWmsWarehouses(wmsAccountId: $wmsAccountId) {
      wmsAccountId
      provider
      warehousesSynced
    }
  }
`;

export const SYNC_SHOP_WAREHOUSES_MUTATION = gql`
  ${SHOP_WAREHOUSE_FIELDS_FRAGMENT}
  mutation SyncShopWarehouses($shopId: ID!) {
    syncShopWarehouses(shopId: $shopId) {
      platformWarehouses {
        ...ShopWarehouseFields
      }
      officialFulfillmentWarehouses {
        ...ShopWarehouseFields
      }
    }
  }
`;

export const WRITE_SHOP_WAREHOUSE_MAPPINGS_MUTATION = gql`
  ${SHOP_WAREHOUSE_FIELDS_FRAGMENT}
  mutation WriteShopWarehouseMappings($inputs: [WriteShopWarehouseMappingInput!]!) {
    writeShopWarehouseMappings(inputs: $inputs) {
      ...ShopWarehouseFields
    }
  }
`;
