export const TOOL_SPECS_SYNC_QUERY = `
  query ToolSpecsSync {
    toolSpecs {
      id
      name
      category
      displayName
      description
      supportsPersistResult
      resultSchema
      surfaces
      runProfiles
      graphqlOperation
      operationType
      parameters {
        name
        type
        description
        graphqlVar
        required
        defaultValue
        enumValues
        isList
        children {
          name
          type
          description
          graphqlVar
          required
          defaultValue
          enumValues
          isList
          children {
            name
            type
            description
            graphqlVar
            required
            defaultValue
            enumValues
            isList
          }
        }
      }
      contextBindings {
        paramName
        contextField
      }
      restMethod
      restEndpoint
      restContentType
      supportedPlatforms
      prune
    }
  }
`;

export const INIT_ME_QUERY = `
  query {
    me {
      userId
      email
      name
      plan
      createdAt
      enrolledModules
      entitlementKeys
      defaultRunProfileId
      llmKey {
        key
        suspendedUntil
      }
      support {
        telegramDebugProxyToken
      }
    }
  }
`;

export const INIT_SURFACES_QUERY = `
  query {
    surfaces {
      id
      name
      description
      userId
      allowedToolIds
      createdAt
      updatedAt
    }
  }
`;

export const INIT_RUN_PROFILES_QUERY = `
  query {
    runProfiles {
      id
      name
      userId
      surfaceId
      selectedToolIds
    }
  }
`;

export const INIT_SHOPS_QUERY = `
  query {
    shops {
      id
      platform
      platformAppId
      platformShopId
      shopName
      alias
      authStatus
      region
      accessTokenExpiresAt
      refreshTokenExpiresAt
      services {
        customerService {
          enabled
          businessPrompt
          runProfileId
          csDeviceId
          csProviderOverride
          csModelOverride
          escalationChannelId
          escalationRecipientId
          platformSystemPrompt
        }
        customerServiceBilling {
          tier
          balance
          balanceExpiresAt
          periodEnd
        }
        wms {
          enabled
        }
        affiliateService {
          enabled
          runProfileId
          csDeviceId
          businessPrompt
        }
      }
    }
  }
`;

export const INIT_PLATFORM_APPS_QUERY = `
  query {
    platformApps {
      id
      platform
      market
      status
      label
      apiBaseUrl
      authLinkUrl
    }
  }
`;

export const INIT_CREDITS_QUERY = `
  query {
    myCredits {
      id
      service
      quota
      status
      expiresAt
      source
    }
  }
`;

export const INIT_WMS_ACCOUNTS_QUERY = `
  query {
    readWmsAccounts(input: {}) {
      id
      userId
      provider
      label
      endpoint
      status
      lastSyncedAt
      lastSyncError
      notes
      createdAt
      updatedAt
    }
  }
`;

export const INIT_WAREHOUSES_QUERY = `
  query {
    readWarehouses(input: {}) {
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
      status
      lastSyncedAt
      notes
      createdAt
      updatedAt
    }
  }
`;

export const INIT_INVENTORY_GOODS_QUERY = `
  query {
    readInventoryGoods(input: {}) {
      id
      userId
      sku
      name
      status
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
      isBattery
      isHazmat
      imageAssetId
      imageUri
      createdAt
      updatedAt
    }
  }
`;
