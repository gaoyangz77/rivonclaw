import { gql } from "@apollo/client/core";
import { CS_CONVERSATION_INBOX_ITEM_FIELDS_FRAGMENT } from "./shops-queries.js";

export const BAD_REVIEW_FIELDS_FRAGMENT = gql`
  fragment BadReviewFields on EcomBadReview {
    id
    shopId
    shopName
    platformReviewId
    orderId
    hasBuyer
    rating
    title
    content
    reviewTime
    source
    importBatchId
    shopFollowUpMode
    handlingStatus
    handlingChangedAt
    replyState
    replyCheckedAt
    handlingEvents {
      from
      to
      note
      source
      at
    }
    aiFollowUpStatus
    conversationId
    conversationAiEnabled
    reachoutState
    reachoutSentCount
    reachoutMaxAttempts
    reachoutNextAt
  }
`;

export const READ_BAD_REVIEWS_QUERY = gql`
  ${BAD_REVIEW_FIELDS_FRAGMENT}
  query ReadBadReviews($input: EcomBadReviewsInput!) {
    page: ecommerceBadReviews(input: $input) {
      items {
        ...BadReviewFields
      }
      totalCount
    }
  }
`;

const BAD_REVIEW_IMPORT_RESULT_FIELDS_FRAGMENT = gql`
  fragment BadReviewImportResultFields on EcomBadReviewImportResult {
    importBatchId
    rows {
      rowNumber
      orderId
      rowClass
      problem
      shopId
      shopName
      rating
      reviewTime
      status
    }
  }
`;

export const PREVIEW_BAD_REVIEW_IMPORT_MUTATION = gql`
  ${BAD_REVIEW_IMPORT_RESULT_FIELDS_FRAGMENT}
  mutation PreviewBadReviewImport($rows: [EcomBadReviewImportRowInput!]!) {
    result: ecommercePreviewBadReviewImport(rows: $rows) {
      ...BadReviewImportResultFields
    }
  }
`;

export const APPLY_BAD_REVIEW_IMPORT_MUTATION = gql`
  ${BAD_REVIEW_IMPORT_RESULT_FIELDS_FRAGMENT}
  mutation ApplyBadReviewImport($rows: [EcomBadReviewImportRowInput!]!) {
    result: ecommerceApplyBadReviewImport(rows: $rows) {
      ...BadReviewImportResultFields
    }
  }
`;

export const START_BAD_REVIEW_FOLLOW_UP_MUTATION = gql`
  ${BAD_REVIEW_FIELDS_FRAGMENT}
  ${CS_CONVERSATION_INBOX_ITEM_FIELDS_FRAGMENT}
  mutation StartBadReviewFollowUp($shopId: ID!, $reviewId: ID!) {
    result: ecommerceStartBadReviewFollowUp(shopId: $shopId, reviewId: $reviewId) {
      review {
        ...BadReviewFields
      }
      conversation {
        ...CustomerServiceConversationInboxItemFields
      }
    }
  }
`;

export const UPDATE_BAD_REVIEW_FOLLOW_UP_STATUS_MUTATION = gql`
  ${BAD_REVIEW_FIELDS_FRAGMENT}
  mutation UpdateBadReviewFollowUpStatus(
    $shopId: ID!
    $reviewId: ID!
    $status: ProductReviewHandlingStatus!
    $note: String
  ) {
    review: ecommerceUpdateBadReviewFollowUpStatus(
      shopId: $shopId
      reviewId: $reviewId
      status: $status
      note: $note
    ) {
      ...BadReviewFields
    }
  }
`;
