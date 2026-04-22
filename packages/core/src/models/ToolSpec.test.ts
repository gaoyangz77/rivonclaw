import { describe, expect, it } from "vitest";
import { ToolModel } from "./ToolSpec.js";

describe("ToolModel", () => {
  it("preserves isList on nested tool parameter specs", () => {
    const tool = ToolModel.create({
      id: "ECOM_UPDATE_INVENTORY",
      name: "ecom_update_inventory",
      displayName: "Ecom Update Inventory",
      description: "Update inventory in bulk",
      category: "ECOMMERCE",
      operationType: "mutation",
      graphqlOperation: "mutation { ecommerceUpdateInventory }",
      parameters: [
        {
          name: "updates",
          type: "object",
          description: "Inventory updates",
          graphqlVar: "updates",
          required: true,
          isList: true,
          children: [
            {
              name: "skuId",
              type: "string",
              description: "SKU ID",
              graphqlVar: "skuId",
              required: true,
            },
            {
              name: "quantity",
              type: "number",
              description: "New quantity",
              graphqlVar: "quantity",
              required: true,
            },
          ],
        },
      ],
    });

    expect(tool.parameters[0]?.isList).toBe(true);
    expect(tool.parameters[0]?.children[0]?.name).toBe("skuId");
  });
});
