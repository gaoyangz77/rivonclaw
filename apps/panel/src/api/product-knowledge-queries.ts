import { gql } from "@apollo/client/core";

export const PRODUCT_KNOWLEDGE_SUMMARY_FIELDS = gql`
  fragment ProductKnowledgeSummaryFields on ProductKnowledge {
    id
    name
    status
    revision
    bindingCount
    usageInstructionsMarkdown
    qaMarkdown
    creativeCasesMarkdown
    archivedAt
    createdAt
    updatedAt
  }
`;

export const PRODUCT_KNOWLEDGE_BINDING_FIELDS = gql`
  fragment ProductKnowledgeBindingFields on ProductKnowledgeBinding {
    id
    productKnowledgeId
    shopId
    productId
    shopNameSnapshot
    platformSnapshot
    shopRegionSnapshot
    productTitleSnapshot
    productCoverImageSnapshot
    productStatusSnapshot
    sellerSkusSnapshot
    createdAt
    updatedAt
  }
`;

export const PRODUCT_KNOWLEDGES_QUERY = gql`
  ${PRODUCT_KNOWLEDGE_SUMMARY_FIELDS}
  query ProductKnowledges($input: ProductKnowledgePageInput) {
    productKnowledges(input: $input) {
      items { ...ProductKnowledgeSummaryFields }
      totalCount
      offset
      limit
    }
  }
`;

export const PRODUCT_KNOWLEDGE_QUERY = gql`
  ${PRODUCT_KNOWLEDGE_SUMMARY_FIELDS}
  ${PRODUCT_KNOWLEDGE_BINDING_FIELDS}
  query ProductKnowledge($id: ID!) {
    productKnowledge(id: $id) {
      ...ProductKnowledgeSummaryFields
      bindings { ...ProductKnowledgeBindingFields }
    }
  }
`;

export const DISCOVER_PRODUCTS_BY_SELLER_SKU_QUERY = gql`
  query DiscoverProductsBySellerSku($sellerSku: String!) {
    discoverProductsBySellerSku(sellerSku: $sellerSku) {
      sellerSku
      searchedShopCount
      successfulShopCount
      candidates {
        shopId
        shopName
        platform
        shopRegion
        productId
        productTitle
        productCoverImage
        productStatus
        matchedSellerSkus
        sellerSkus
        existingProductKnowledgeId
        existingProductKnowledgeName
        existingProductKnowledgeStatus
      }
      shopFailures {
        shopId
        shopName
        message
      }
    }
  }
`;

export const CREATE_PRODUCT_KNOWLEDGE_MUTATION = gql`
  ${PRODUCT_KNOWLEDGE_SUMMARY_FIELDS}
  mutation CreateProductKnowledge($input: CreateProductKnowledgeInput!) {
    createProductKnowledge(input: $input) { ...ProductKnowledgeSummaryFields }
  }
`;

export const UPDATE_PRODUCT_KNOWLEDGE_MUTATION = gql`
  ${PRODUCT_KNOWLEDGE_SUMMARY_FIELDS}
  ${PRODUCT_KNOWLEDGE_BINDING_FIELDS}
  mutation UpdateProductKnowledge($input: UpdateProductKnowledgeInput!) {
    updateProductKnowledge(input: $input) {
      ...ProductKnowledgeSummaryFields
      bindings { ...ProductKnowledgeBindingFields }
    }
  }
`;

export const ARCHIVE_PRODUCT_KNOWLEDGE_MUTATION = gql`
  ${PRODUCT_KNOWLEDGE_SUMMARY_FIELDS}
  mutation ArchiveProductKnowledge($id: ID!, $expectedRevision: Int!) {
    archiveProductKnowledge(id: $id, expectedRevision: $expectedRevision) {
      ...ProductKnowledgeSummaryFields
    }
  }
`;

export const RESTORE_PRODUCT_KNOWLEDGE_MUTATION = gql`
  ${PRODUCT_KNOWLEDGE_SUMMARY_FIELDS}
  mutation RestoreProductKnowledge($id: ID!, $expectedRevision: Int!) {
    restoreProductKnowledge(id: $id, expectedRevision: $expectedRevision) {
      ...ProductKnowledgeSummaryFields
    }
  }
`;

export const LINK_PRODUCTS_TO_KNOWLEDGE_MUTATION = gql`
  ${PRODUCT_KNOWLEDGE_BINDING_FIELDS}
  mutation LinkProductsToKnowledge($input: LinkProductsToKnowledgeInput!) {
    linkProductsToKnowledge(input: $input) {
      linked { ...ProductKnowledgeBindingFields }
      failures {
        shopId
        productId
        code
        message
        existingProductKnowledgeId
        existingProductKnowledgeName
      }
    }
  }
`;

export const UNLINK_PRODUCT_KNOWLEDGE_BINDING_MUTATION = gql`
  mutation UnlinkProductKnowledgeBinding($bindingId: ID!) {
    unlinkProductKnowledgeBinding(bindingId: $bindingId)
  }
`;
