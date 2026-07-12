import { describe, expect, it } from "vitest";
import { Kind, parse, type SelectionNode, type SelectionSetNode } from "graphql";
import {
  AffiliateDecisionThresholdsConfigModel,
  AffiliateServiceConfigModel,
  CustomerServiceConfigModel,
  ShopModel,
  WmsSettingsModel,
} from "../../../../packages/core/src/models/Shop.js";
import { INIT_SHOPS_QUERY } from "./init-queries.js";
import {
  OAUTH_COMPLETE_SUBSCRIPTION,
  SHOP_UPDATED_SUBSCRIPTION,
} from "./backend-subscription-client.js";

function modelPropertyNames(model: unknown): string[] {
  return Object.keys((model as { properties?: Record<string, unknown> }).properties ?? {});
}

function requiredShopLeafPaths(): string[] {
  const paths: string[] = [];

  for (const field of modelPropertyNames(ShopModel)) {
    if (field !== "services") paths.push(field);
  }

  for (const field of modelPropertyNames(CustomerServiceConfigModel)) {
    if (field === "unpaidOrderReachoutStages") {
      paths.push(
        "services.customerService.unpaidOrderReachoutStages.id",
        "services.customerService.unpaidOrderReachoutStages.enabled",
        "services.customerService.unpaidOrderReachoutStages.delayMinutes",
        "services.customerService.unpaidOrderReachoutStages.messageTemplate",
      );
      continue;
    }
    if (field === "unpaidOrderReachoutExperiment") {
      paths.push(
        "services.customerService.unpaidOrderReachoutExperiment.enabled",
        "services.customerService.unpaidOrderReachoutExperiment.holdoutPercent",
        "services.customerService.unpaidOrderReachoutExperiment.experimentId",
        "services.customerService.unpaidOrderReachoutExperiment.startedAt",
      );
      continue;
    }
    if (field === "reviewOptimization") {
      paths.push(
        "services.customerService.reviewOptimization.enabled",
        "services.customerService.reviewOptimization.badReviewReachout.enabled",
        "services.customerService.reviewOptimization.badReviewReachout.stars",
        "services.customerService.reviewOptimization.badReviewReachout.recentDays",
      );
      continue;
    }
    paths.push(`services.customerService.${field}`);
  }

  for (const field of modelPropertyNames(WmsSettingsModel)) {
    paths.push(`services.wms.${field}`);
  }

  for (const field of modelPropertyNames(AffiliateServiceConfigModel)) {
    if (field !== "decisionThresholds") {
      paths.push(`services.affiliateService.${field}`);
    }
  }
  for (const field of modelPropertyNames(AffiliateDecisionThresholdsConfigModel)) {
    paths.push(`services.affiliateService.decisionThresholds.${field}`);
  }

  return paths.sort();
}

function fieldName(selection: SelectionNode): string | null {
  return selection.kind === Kind.FIELD ? selection.name.value : null;
}

function selectionByName(
  selectionSet: SelectionSetNode | undefined,
  name: string,
): SelectionNode | undefined {
  return selectionSet?.selections.find((selection) => fieldName(selection) === name);
}

function selectionSetAtPath(documentSource: string, path: string[]): SelectionSetNode {
  const document = parse(documentSource);
  const operation = document.definitions.find((definition) => (
    definition.kind === Kind.OPERATION_DEFINITION
  ));
  if (!operation || operation.kind !== Kind.OPERATION_DEFINITION) {
    throw new Error("GraphQL document does not contain an operation");
  }

  let selectionSet = operation.selectionSet;
  for (const segment of path) {
    const selection = selectionByName(selectionSet, segment);
    if (!selection || selection.kind !== Kind.FIELD || !selection.selectionSet) {
      throw new Error(`GraphQL selection path is missing: ${path.join(".")}`);
    }
    selectionSet = selection.selectionSet;
  }
  return selectionSet;
}

function collectLeafPaths(selectionSet: SelectionSetNode, prefix = ""): Set<string> {
  const paths = new Set<string>();

  for (const selection of selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) continue;
    const name = selection.name.value;
    if (name === "__typename") continue;

    const path = prefix ? `${prefix}.${name}` : name;
    if (selection.selectionSet) {
      for (const childPath of collectLeafPaths(selection.selectionSet, path)) {
        paths.add(childPath);
      }
    } else {
      paths.add(path);
    }
  }

  return paths;
}

describe("Desktop Shop GraphQL selection sets", () => {
  const operations = [
    {
      name: "INIT_SHOPS_QUERY shops",
      document: INIT_SHOPS_QUERY,
      shopPath: ["shops"],
    },
    {
      name: "OAUTH_COMPLETE_SUBSCRIPTION oauthComplete.shops",
      document: OAUTH_COMPLETE_SUBSCRIPTION,
      shopPath: ["oauthComplete", "shops"],
    },
    {
      name: "SHOP_UPDATED_SUBSCRIPTION shopUpdated",
      document: SHOP_UPDATED_SUBSCRIPTION,
      shopPath: ["shopUpdated"],
    },
  ] as const;

  it("requests every field required by the shared Shop MST model", () => {
    const requiredPaths = requiredShopLeafPaths();

    for (const operation of operations) {
      const selectedPaths = collectLeafPaths(
        selectionSetAtPath(operation.document, [...operation.shopPath]),
      );
      const missingPaths = requiredPaths.filter((path) => !selectedPaths.has(path));

      expect(missingPaths, `${operation.name} is missing Shop fields`).toEqual([]);
    }
  });
});
