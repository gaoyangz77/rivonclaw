export const TOOL_SPECS_SYNC_QUERY = `
  query ToolSpecsSync {
    toolSpecs {
      id
      name
      category
      dataScope
      displayName
      description
      supportsPersistResult
      resultSchema
      resultMode
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
        nullable
        defaultValue
        enumValues
        isList
        children {
          name
          type
          description
          graphqlVar
          required
          nullable
          defaultValue
          enumValues
          isList
          children {
            name
            type
            description
            graphqlVar
            required
            nullable
            defaultValue
            enumValues
            isList
            children {
              name
              type
              description
              graphqlVar
              required
              nullable
              defaultValue
              enumValues
              isList
              children {
                name
                type
                description
                graphqlVar
                required
                nullable
                defaultValue
                enumValues
                isList
                children {
                  name
                  type
                  description
                  graphqlVar
                  required
                  nullable
                  defaultValue
                  enumValues
                  isList
                  children {
                    name
                    type
                    description
                    graphqlVar
                    required
                    nullable
                    defaultValue
                    enumValues
                    isList
                  }
                }
              }
            }
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
      createdAt
      enrolledModules
      entitlementKeys
      accountId
      isOwner
      permissionScopes
      roleName
      defaultRunProfileId
      support {
        telegramDebugProxyToken
      }
      agent {
        active
        inviteCode
        enabledAt
        enabledByUserId
        disabledAt
        disabledByUserId
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
      userId
      platform
      platformAppId
      platformShopId
      collectionKey
      shopName
      alias
      authStatus
      region
      accessTokenExpiresAt
      refreshTokenExpiresAt
      services {
        customerService {
          enabled
          pickupReminderEnabled
          unpaidOrderReachoutEnabled
          unpaidOrderReachoutStages { id enabled delayMinutes messageTemplate }
          unpaidOrderReachoutExperiment { enabled holdoutPercent experimentId startedAt }
          businessPrompt
          runProfileId
          csDeviceId
          csProviderOverride
          csModelOverride
          escalationChannelId
          escalationRecipientId
          platformSystemPrompt
          reviewOptimization {
            enabled
            badReviewReachout {
              enabled
              stars
              recentDays
              maxAttempts
            }
          }
        }
        wms {
          enabled
        }
        affiliateService {
          enabled
          runProfileId
          deviceId
          businessPrompt
          campaignDailyCreatorOutreachLimit
          campaignDailyCreatorOutreachLimitRevision
          campaignDailyCreatorOutreachLimitUpdatedAt
          decisionThresholds {
            minExpectedSalesUnits
          }
          samplePerformanceFollowUp {
            enabled
            lowOrderThreshold
            stages { id delayDays }
            revision
            updatedAt
          }
        }
      }
    }
  }
`;

const ADS_ADVERTISER_FIELDS = `
      __typename
      id
      userId
      platform
      ownerType
      advertiserId
      advertiserName
      advertiserRole
      platformStatus
      currency
      timezone
      createdAt
      updatedAt
      auth {
        status
        accessTokenExpiresAt
        refreshTokenExpiresAt
        authorizedAt
        lastRefreshedAt
        lastError
      }
`;

const ADS_STORE_ACCESS_FIELDS = `
      __typename
      id
      userId
      platform
      adsAdvertiserId
      advertiserId
      storeId
      storeName
      storeAuthorizedBcId
      businessCenterId
      storeRole
      storeStatus
      isGmvMaxAvailable
      exclusiveAuthorizedAdvertiserId
      exclusiveAuthorizationStatus
      createdAt
      updatedAt
`;

export const INIT_ADS_ADVERTISERS_QUERY = `
  query {
    adsAdvertisers { ${ADS_ADVERTISER_FIELDS} }
    adsStoreAccesses(status: ACTIVE) { ${ADS_STORE_ACCESS_FIELDS} }
  }
`;

export const ADS_ENTITY_DELTA_QUERY = `
  query AdsEntityDelta($ids: [ID!]!) {
    adsAdvertisers(ids: $ids) { ${ADS_ADVERTISER_FIELDS} }
    adsStoreAccesses(adsAdvertiserIds: $ids, status: ACTIVE) { ${ADS_STORE_ACCESS_FIELDS} }
  }
`;

export const INIT_PLATFORM_APPS_QUERY = `
  query {
    platformApps {
      id
      platform
      market
      sellerType
      status
      label
      apiBaseUrl
      authLinkUrl
    }
  }
`;

export const INIT_BILLING_OVERVIEW_QUERY = `
  query {
    billingOverview {
      accountServices {
        product
        entitlement {
          scopeType scopeId coverageScopeType coverageScopeId product allowed code source validUntil
          subscription {
            planId provider status currency amountMinor currentPeriodStart currentPeriodEnd
            graceUntil renewalMode cancelAtPeriodEnd
          }
          usage { metric window usedPercent remainingPercent refreshAt }
        }
      }
      accountLlm {
        planId
        entitlement {
          scopeType
          scopeId
          product
          allowed
          code
          source
          subscription {
            planId
            provider
            status
            currency
            amountMinor
            currentPeriodStart
            currentPeriodEnd
            graceUntil
            renewalMode
            cancelAtPeriodEnd
          }
          validUntil
          usage {
            metric
            window
            usedPercent
            remainingPercent
            refreshAt
          }
        }
      }
      shops {
        shopId
        shopName
        customerService {
          scopeType
          scopeId
          coverageScopeType
          coverageScopeId
          product
          allowed
          code
          source
          subscription {
            planId
            provider
            status
            currency
            amountMinor
            currentPeriodStart
            currentPeriodEnd
            graceUntil
            renewalMode
            cancelAtPeriodEnd
          }
          validUntil
          usage {
            metric
            window
            usedPercent
            remainingPercent
            refreshAt
          }
        }
        inventory {
          scopeType
          scopeId
          product
          allowed
          code
          source
          subscription {
            planId
            provider
            status
            currency
            amountMinor
            currentPeriodStart
            currentPeriodEnd
            graceUntil
            renewalMode
            cancelAtPeriodEnd
          }
          validUntil
          usage {
            metric
            window
            usedPercent
            remainingPercent
            refreshAt
          }
        }
        affiliate {
          scopeType
          scopeId
          product
          allowed
          code
          source
          subscription {
            planId
            provider
            status
            currency
            amountMinor
            currentPeriodStart
            currentPeriodEnd
            graceUntil
            renewalMode
            cancelAtPeriodEnd
          }
          validUntil
          usage {
            metric
            window
            usedPercent
            remainingPercent
            refreshAt
          }
        }
        analytics {
          scopeType
          scopeId
          product
          allowed
          code
          source
          subscription {
            planId
            provider
            status
            currency
            amountMinor
            currentPeriodStart
            currentPeriodEnd
            graceUntil
            renewalMode
            cancelAtPeriodEnd
          }
          validUntil
          usage {
            metric
            window
            usedPercent
            remainingPercent
            refreshAt
          }
        }
      }
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
