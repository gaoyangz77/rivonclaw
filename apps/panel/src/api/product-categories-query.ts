import { ApolloLink, gql } from "@apollo/client/core";
import { PRODUCT_CATEGORIES_QUERY } from "@rivonclaw/core/models";

export const PRODUCT_CATEGORIES_SYNC_QUERY = gql(PRODUCT_CATEGORIES_QUERY);

export function createCategoryRefreshLink() {
  return new ApolloLink((operation, forward) => {
    if (
      operation.operationName === "ProductCategoriesSync" &&
      operation.getContext().forceCategoriesRefresh === true
    ) {
      operation.extensions = {
        ...operation.extensions,
        rivonclaw: { forceCategoriesRefresh: true },
      };
    }
    return forward(operation);
  });
}
