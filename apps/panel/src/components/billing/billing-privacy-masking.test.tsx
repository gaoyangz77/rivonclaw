// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { applySnapshot } from "mobx-state-tree";
import { runtimeStatusStore } from "../../store/runtime-status-store.js";
import { shopDisplayLabel } from "../../lib/shop-display.js";
import { Modal } from "../modals/Modal.js";
import { ShopServiceCheckoutModal } from "./ShopServiceCheckoutModal.js";

/**
 * The billing surfaces were the last two places a platform-issued shop name
 * stayed readable while privacy mode was on: the checkout dropdown and the
 * shop-service detail modal's title. Both receive an already-resolved string,
 * so the sensitivity has to be threaded alongside it — these tests pin that
 * thread at both ends.
 */

const mockState = vi.hoisted(() => ({
  store: {
    checkoutScopeId: null,
    activeCheckout: null,
    checkoutError: null,
    checkoutNotice: null,
    paymentInFlight: false,
    clearActiveCheckout: () => {},
  } as any,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => mockState.store,
}));

function setPrivacyMode(enabled: boolean) {
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: enabled });
}

afterEach(() => {
  cleanup();
  setPrivacyMode(false);
});

/** The caller-side resolution the checkout modal depends on. */
function checkoutShops() {
  return [
    { id: "shop-alias", alias: "Five Shop", shopName: "Holylegend & DIYCOM" },
    { id: "shop-named", alias: null, shopName: "Windboss Benessere" },
  ].map((shop) => {
    const label = shopDisplayLabel(shop, shop.id);
    return { shopId: shop.id, shopName: label.text, shopNameSensitive: label.sensitive };
  });
}

function renderCheckout() {
  render(
    <ShopServiceCheckoutModal
      isOpen
      onClose={() => {}}
      title="billing.subscribeCustomerService"
      plans={[]}
      shops={checkoutShops()}
    />,
  );
  const trigger = document.querySelector<HTMLButtonElement>(".custom-select-trigger");
  expect(trigger, "checkout shop dropdown did not render").not.toBeNull();
  fireEvent.click(trigger as HTMLButtonElement);
}

describe("shop names in the billing checkout dropdown", () => {
  it("marks the platform shop name and leaves the operator's alias readable", () => {
    setPrivacyMode(true);
    renderCheckout();

    // The alias-resolved shop is selected, so it renders twice: once in the
    // trigger, once in the option list. Neither may be marked.
    const aliasNodes = screen.getAllByText("Five Shop");
    expect(aliasNodes.length).toBeGreaterThan(0);
    for (const node of aliasNodes) {
      expect(node.hasAttribute("data-tk-private")).toBe(false);
    }

    expect(screen.getByText("Windboss Benessere").getAttribute("data-tk-private")).toBe("text");
  });

  it("keeps the label a plain string so the dropdown can still search on it", () => {
    renderCheckout();

    const marked = screen.getByText("Windboss Benessere");
    expect(marked.textContent).toBe("Windboss Benessere");
  });
});

describe("shop names in a modal title", () => {
  it("marks the visible heading while the dialog's accessible label keeps the name", () => {
    setPrivacyMode(true);
    render(
      <Modal
        isOpen
        onClose={() => {}}
        title="Windboss Benessere · Customer service"
        titleSensitive
      >
        <p>body</p>
      </Modal>,
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("Windboss Benessere · Customer service");
    expect(heading.querySelector("[data-tk-private='text']")).not.toBeNull();

    // The accessible name still resolves to the full string: a screen reader
    // speaks to its own operator, so masking it would cost information and buy
    // no privacy.
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(dialog.getAttribute("aria-label")).toBeNull();
  });

  it("keeps the accessible label a plain string when the visible header is hidden", () => {
    setPrivacyMode(true);
    render(
      <Modal isOpen onClose={() => {}} title="Windboss Benessere" titleSensitive hideHeader>
        <p>body</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Windboss Benessere");
  });

  it("leaves an unmarked title alone, even while privacy mode is on", () => {
    setPrivacyMode(true);
    render(
      <Modal isOpen onClose={() => {}} title="Shop services">
        <p>body</p>
      </Modal>,
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.querySelector("[data-tk-private='text']")).toBeNull();
    expect(heading.textContent).toBe("Shop services");
  });
});

describe("shop-service detail modal wiring", () => {
  /**
   * `ShopServiceDetailModal` is private to `AccountBillingSection`, and
   * exporting it only to test it would widen the module's surface. Pinning the
   * two lines that carry the decision keeps the wiring from silently reverting
   * to the plain-string title it used to have.
   */
  it("derives the title's sensitivity from the row label", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/billing/AccountBillingSection.tsx"),
      "utf8",
    );

    expect(source).toContain("const titleSensitive = serviceKey !== null && rowLabel.sensitive;");
    expect(source).toContain("titleSensitive={titleSensitive}");
  });
});
