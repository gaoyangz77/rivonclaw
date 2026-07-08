import { gql } from "@apollo/client/core";

const BILLING_USAGE_FIELDS = gql`
  fragment BillingUsageFields on BillingUsageStatus {
    metric
    window
    usedPercent
    remainingPercent
    refreshAt
  }
`;

const BILLING_ENTITLEMENT_FIELDS = gql`
  ${BILLING_USAGE_FIELDS}
  fragment BillingEntitlementFields on BillingEntitlementStatus {
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
      ...BillingUsageFields
    }
  }
`;

const PAYMENT_FIELDS = gql`
  fragment PaymentFields on Payment {
    __typename
    id
    userId
    provider
    method
    status
    currency
    amountMinor
    billingActivatedAt
    billingPlanId
    billingProduct
    billingScopeId
    billingScopeType
    subject
    description
    merchantOrderId
    providerPaymentId
    providerOrderId
    providerSubscriptionId
    checkoutUrl
    qrCode
    lastError
    createdAt
    updatedAt
    paidAt
    expiresAt
    lastProviderEventAt
  }
`;

export const BILLING_OVERVIEW_QUERY = gql`
  ${BILLING_ENTITLEMENT_FIELDS}
  query BillingOverview {
    billingOverview {
      __typename
      accountLlm {
        planId
        entitlement {
          ...BillingEntitlementFields
        }
      }
      shops {
        shopId
        shopName
        customerService {
          ...BillingEntitlementFields
        }
        inventory {
          ...BillingEntitlementFields
        }
        affiliate {
          ...BillingEntitlementFields
        }
        analytics {
          ...BillingEntitlementFields
        }
      }
    }
  }
`;

export const BILLING_PLAN_DEFINITIONS_QUERY = gql`
  query BillingPlanDefinitions {
    billingPlanDefinitions {
      __typename
      planId
      name
      product
      priceCurrency
      priceMonthly
      priceMonthlyCny
      priceMonthlyCnyMinor
      usdToCnyRate
      exchangeRateDate
      metered
    }
  }
`;

export const READ_PAYMENTS_QUERY = gql`
  ${PAYMENT_FIELDS}
  query ReadPayments($input: ReadPaymentsInput) {
    readPayments(input: $input) {
      ...PaymentFields
    }
  }
`;

export const START_BILLING_SUBSCRIPTION_MUTATION = gql`
  ${PAYMENT_FIELDS}
  mutation StartBillingSubscription($input: StartBillingSubscriptionInput!) {
    startBillingSubscription(input: $input) {
      action
      payment {
        ...PaymentFields
      }
    }
  }
`;

export const REFRESH_PAYMENT_MUTATION = gql`
  ${PAYMENT_FIELDS}
  mutation RefreshPayment($paymentId: ID!) {
    refreshPayment(paymentId: $paymentId) {
      ...PaymentFields
    }
  }
`;

export const CANCEL_BILLING_SUBSCRIPTION_MUTATION = gql`
  mutation CancelBillingSubscriptionAtPeriodEnd($input: CancelBillingSubscriptionInput!) {
    cancelBillingSubscriptionAtPeriodEnd(input: $input) {
      id
      planId
      product
      scopeType
      scopeId
      provider
      status
      currency
      amountMinor
      currentPeriodStart
      currentPeriodEnd
      graceUntil
      cancelAtPeriodEnd
      updatedAt
    }
  }
`;

export const CREATE_STRIPE_BILLING_PORTAL_SESSION_MUTATION = gql`
  mutation CreateStripeBillingPortalSession($input: CreateStripeBillingPortalSessionInput!) {
    createStripeBillingPortalSession(input: $input) {
      url
    }
  }
`;
