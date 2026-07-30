import { describe, expect, it, vi } from "vitest";
import { ShopModel } from "./ShopModel.js";

function createShop(input?: {
  customerServiceEnabled?: boolean;
  customerServiceDeviceId?: string | null;
  affiliateServiceEnabled?: boolean;
  affiliateServiceDeviceId?: string | null;
  affiliateRunProfileId?: string | null;
}) {
  const mutate = vi.fn().mockResolvedValue({
    data: { updateShop: { id: "shop-1" } },
  });
  const shop = ShopModel.create(
    {
      id: "shop-1",
      platform: "TIKTOK_SHOP",
      platformShopId: "platform-shop-1",
      shopName: "Test Shop",
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      services: {
        customerService: {
          enabled: input?.customerServiceEnabled ?? false,
          csDeviceId: input?.customerServiceDeviceId ?? null,
        },
        affiliateService: {
          enabled: input?.affiliateServiceEnabled ?? false,
          deviceId: input?.affiliateServiceDeviceId ?? null,
          runProfileId: input?.affiliateRunProfileId ?? null,
        },
      },
    },
    { apolloClient: { mutate } },
  );
  return { mutate, shop };
}

function updateInput(mutate: ReturnType<typeof vi.fn>): unknown {
  return mutate.mock.calls[0]?.[0]?.variables?.input;
}

describe("ShopModel service lifecycle actions", () => {
  it("binds customer service to the current device when enabling an unbound shop", async () => {
    const { mutate, shop } = createShop();

    await shop.setCustomerServiceEnabled(true, " device-1 ");

    expect(updateInput(mutate)).toEqual({
      services: {
        customerService: {
          enabled: true,
          csDeviceId: "device-1",
        },
      },
    });
  });

  it("preserves an existing customer-service device when enabling", async () => {
    const { mutate, shop } = createShop({ customerServiceDeviceId: "device-2" });

    await shop.setCustomerServiceEnabled(true, "device-1");

    expect(updateInput(mutate)).toEqual({
      services: { customerService: { enabled: true } },
    });
  });

  it("preserves the customer-service device when disabling", async () => {
    const { mutate, shop } = createShop({
      customerServiceEnabled: true,
      customerServiceDeviceId: "device-1",
    });

    await shop.setCustomerServiceEnabled(false, null);

    expect(updateInput(mutate)).toEqual({
      services: { customerService: { enabled: false } },
    });
  });

  it("binds affiliate service and supplies its default run profile when enabling", async () => {
    const { mutate, shop } = createShop();

    await shop.setAffiliateServiceEnabled(true, "device-1");

    expect(updateInput(mutate)).toEqual({
      services: {
        affiliateService: {
          enabled: true,
          runProfileId: "AFFILIATE_OPERATOR",
          deviceId: "device-1",
        },
      },
    });
  });

  it("preserves existing affiliate device and run-profile settings when enabling", async () => {
    const { mutate, shop } = createShop({
      affiliateServiceDeviceId: "device-2",
      affiliateRunProfileId: "custom-profile",
    });

    await shop.setAffiliateServiceEnabled(true, "device-1");

    expect(updateInput(mutate)).toEqual({
      services: { affiliateService: { enabled: true } },
    });
  });

  it("does not enable an unbound service before the current device is available", async () => {
    const customerService = createShop();
    const affiliateService = createShop();

    await expect(customerService.shop.setCustomerServiceEnabled(true, null)).rejects.toThrow(
      "Current device ID is unavailable",
    );
    await expect(affiliateService.shop.setAffiliateServiceEnabled(true, "")).rejects.toThrow(
      "Current device ID is unavailable",
    );
    expect(customerService.mutate).not.toHaveBeenCalled();
    expect(affiliateService.mutate).not.toHaveBeenCalled();
  });

  it("uses explicit MST actions for customer-service and affiliate device binding", async () => {
    const customerService = createShop();
    await customerService.shop.bindCustomerServiceToDevice("device-1");
    expect(updateInput(customerService.mutate)).toEqual({
      services: { customerService: { csDeviceId: "device-1" } },
    });

    const affiliateService = createShop();
    await affiliateService.shop.bindAffiliateServiceToDevice("device-1");
    expect(updateInput(affiliateService.mutate)).toEqual({
      services: { affiliateService: { deviceId: "device-1" } },
    });
  });
});
