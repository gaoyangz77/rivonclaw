// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Shop } from "@rivonclaw/core/models";
import { BalanceBadge } from "./BalanceBadge.js";

const translations: Record<string, string> = {
  "billing.allowed": "Enabled",
  "ecommerce.customerServiceDeviceStatus.notRunning": "Not running",
  "ecommerce.customerServiceDeviceStatus.currentDevice": "Running on this device",
  "ecommerce.customerServiceDeviceStatus.otherDevice": "Running on another device",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => translations[key] ?? key }),
}));

vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({
    billingOverview: {
      shops: [{ shopId: "shop-1", customerService: { allowed: true } }],
    },
  }),
}));

vi.mock("../../../store/RuntimeStatusProvider.js", () => ({
  useRuntimeStatus: () => ({ deviceId: "device-1" }),
}));

function shopWithAssignment(assignment: "unassigned" | "current_device" | "other_device"): Shop {
  return {
    id: "shop-1",
    services: { customerService: { enabled: true } },
    customerServiceDeviceAssignment: () => assignment,
  } as unknown as Shop;
}

afterEach(cleanup);

describe("BalanceBadge", () => {
  it.each([
    ["unassigned", "Not running", "badge-warning"],
    ["current_device", "Running on this device", "badge-success"],
    ["other_device", "Running on another device", "badge-info"],
  ] as const)("renders the %s assignment state", (assignment, label, className) => {
    render(<BalanceBadge shop={shopWithAssignment(assignment)} />);

    expect(screen.getByText("Enabled")).toBeTruthy();
    expect(screen.getByText(label).classList.contains(className)).toBe(true);
  });
});
