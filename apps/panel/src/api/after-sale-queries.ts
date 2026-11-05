import { gql } from "@apollo/client/core";

export const AFTER_SALE_REQUEST_FIELDS_FRAGMENT = gql`
  fragment AfterSaleRequestFields on EcomAfterSaleRequest {
    kind
    requestId
    shopId
    shopName
    orderId
    status
    requestType
    role
    reason
    reasonText
    currency
    refundTotal
    isQuickRefund
    sellerNextAction
    sellerActionDeadline
    createTime
    updateTime
    needsReview
    sellerDecision
    sellerDecidedAt
    decisionAwaitingPlatform
    lines {
      lineItemId
      orderLineItemId
      productId
      productName
      skuId
      skuName
      sellerSku
      productImageUrl
      currency
      refundTotal
    }
  }
`;

export const READ_AFTER_SALE_REQUESTS_QUERY = gql`
  ${AFTER_SALE_REQUEST_FIELDS_FRAGMENT}
  query ReadAfterSaleRequests($input: EcomAfterSaleRequestsInput!) {
    page: ecommerceAfterSaleRequests(input: $input) {
      items {
        ...AfterSaleRequestFields
      }
      nextCursor
      totalCount
    }
  }
`;

export const READ_AFTER_SALE_REQUEST_QUERY = gql`
  ${AFTER_SALE_REQUEST_FIELDS_FRAGMENT}
  query ReadAfterSaleRequest($shopId: String!, $kind: EcomAfterSaleRequestKind!, $requestId: String!) {
    request: ecommerceAfterSaleRequest(shopId: $shopId, kind: $kind, requestId: $requestId) {
      ...AfterSaleRequestFields
    }
  }
`;

export const READ_AFTER_SALE_RETURN_RECORDS_QUERY = gql`
  query ReadAfterSaleReturnRecords($shopId: String!, $returnId: String!) {
    records: ecommerceGetReturnRecords(shopId: $shopId, returnId: $returnId) {
      event
      role
      description
      reasonText
      note
      createTime
      images {
        url
        width
        height
      }
      videos {
        url
        coverUrl
        durationMillis
        width
        height
      }
    }
  }
`;

export const READ_AFTER_SALE_REJECT_REASONS_QUERY = gql`
  query ReadAfterSaleRejectReasons($shopId: String!, $returnOrCancelId: String!) {
    reasons: ecommerceGetRejectReasons(shopId: $shopId, returnOrCancelId: $returnOrCancelId) {
      reasonId
      reasonText
    }
  }
`;

export const APPROVE_AFTER_SALE_RETURN_MUTATION = gql`
  mutation ApproveAfterSaleReturn(
    $shopId: String!
    $returnId: String!
    $decision: EcomApproveReturnDecision!
  ) {
    ecommerceApproveReturn(shopId: $shopId, returnId: $returnId, decision: $decision)
  }
`;

export const APPROVE_AFTER_SALE_REFUND_MUTATION = gql`
  mutation ApproveAfterSaleRefund($shopId: String!, $returnId: String!) {
    ecommerceApproveRefund(shopId: $shopId, returnId: $returnId)
  }
`;

export const APPROVE_AFTER_SALE_CANCELLATION_MUTATION = gql`
  mutation ApproveAfterSaleCancellation($shopId: String!, $cancelId: String!) {
    ecommerceApproveCancellation(shopId: $shopId, cancelId: $cancelId)
  }
`;

/** The order behind a request, read live from TikTok when the detail opens (ADR-099 Decision 10). */
export const READ_AFTER_SALE_ORDER_QUERY = gql`
  query ReadAfterSaleOrder($shopId: String!, $orderId: String!) {
    order: ecommerceGetOrder(shopId: $shopId, orderId: $orderId) {
      orderId
      status
      createTime
      paidTime
      deliveryTime
      totalAmount
      currency
      paymentMethodName
      shippingProvider
      trackingNumber
      recipientAddress {
        name
        fullAddress
        phone
      }
      lineItems {
        orderLineItemId
        productName
        quantity
        sellerSku
        skuName
        skuImage
        salePrice
        currency
        displayStatus
        trackingNumber
      }
    }
  }
`;

/** Carrier events of the order, read live once the order has a tracking number. */
export const READ_AFTER_SALE_ORDER_TRACKING_QUERY = gql`
  query ReadAfterSaleOrderTracking($shopId: String!, $orderId: String!) {
    tracking: ecommerceGetFulfillmentTracking(shopId: $shopId, orderId: $orderId) {
      shippingProvider
      trackingNumber
      events {
        description
        updateTimeMillis
      }
    }
  }
`;
