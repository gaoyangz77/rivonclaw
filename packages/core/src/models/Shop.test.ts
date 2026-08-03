import { describe, expect, it } from "vitest";
import { ShopModel } from "./Shop.js";

function createShop(csDeviceId: string | null) {
  return ShopModel.create({
    id: "shop-1",
    platform: "TIKTOK_SHOP",
    platformShopId: "platform-shop-1",
    shopName: "Shop 1",
    services: {
      customerService: {
        enabled: true,
        csDeviceId,
      },
    },
  });
}

describe("ShopModel customer-service device assignment", () => {
  it("distinguishes unassigned, current-device, and other-device routing", () => {
    expect(createShop(null).customerServiceDeviceAssignment("device-1")).toBe("unassigned");
    expect(createShop("  ").customerServiceDeviceAssignment("device-1")).toBe("unassigned");
    expect(createShop("device-1").customerServiceDeviceAssignment("device-1")).toBe(
      "current_device",
    );
    expect(createShop("device-2").customerServiceDeviceAssignment("device-1")).toBe(
      "other_device",
    );
    expect(createShop("device-2").customerServiceDeviceAssignment(null)).toBe("other_device");
  });
});
