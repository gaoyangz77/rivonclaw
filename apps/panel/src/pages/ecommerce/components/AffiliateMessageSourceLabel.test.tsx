import { GQL } from "@rivonclaw/core";
import { act, cleanup, render, screen } from "@testing-library/react";
import { applySnapshot, types } from "mobx-state-tree";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n/index.js";
import { runtimeStatusStore } from "../../../store/runtime-status-store.js";
import { AffiliateMessageSourceLabel } from "./AffiliateMessageSourceLabel.js";

const fixture = vi.hoisted(() => ({ store: {} as { shops: unknown } }));
vi.mock("../../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => fixture.store }));
const Shop = types.model({
  id: types.identifier,
  alias: types.maybeNull(types.string),
  shopName: types.maybeNull(types.string),
});
const Store = types.model({ shops: types.array(Shop) });
const message = {
  channel: GQL.AffiliateMessageChannel.PlatformChat,
  shopId: "mx-2",
  shopName: "Windboss MX",
  accountLabel: "TikTok Shop / Windboss MX",
};

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  fixture.store = Store.create({
    shops: [
      { id: "mx-2", alias: "MXTK-02", shopName: "Windboss MX" },
      { id: "mx-6", alias: "MXTK-06", shopName: "Windboss MX" },
    ],
  });
});
afterEach(() => {
  cleanup();
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: false });
});

describe("creator message shop identity", () => {
  it("prefers alias using the message shop ID even when shop names are duplicated", () => {
    const { container } = render(<AffiliateMessageSourceLabel message={message} />);
    expect(container.textContent).toBe("MXTK-02");
    expect(screen.queryByText("Windboss MX")).toBeNull();
    expect(screen.queryByText("MXTK-06")).toBeNull();
  });
  it("uses the same identity for scoped timeline payloads without accountLabel", () => {
    const { container } = render(
      <AffiliateMessageSourceLabel message={{ ...message, accountLabel: null }} />,
    );
    expect(container.textContent).toBe("MXTK-02");
  });
  it("updates when shop snapshots arrive or replace existing MST nodes", () => {
    const store = Store.create({ shops: [] });
    fixture.store = store;
    const { container } = render(<AffiliateMessageSourceLabel message={message} />);
    expect(container.textContent).toBe("Windboss MX");
    act(() =>
      applySnapshot(store.shops, [{ id: "mx-2", alias: " MXTK-02 ", shopName: "Windboss MX" }]),
    );
    expect(container.textContent).toBe("MXTK-02");
    act(() => applySnapshot(store.shops, []));
    expect(container.textContent).toBe("Windboss MX");
  });
  it.each([
    { alias: null, shopName: "Windboss MX", expected: "Windboss MX" },
    { alias: "   ", shopName: "Windboss MX", expected: "Windboss MX" },
    { alias: "MXTK-02", shopName: null, expected: "MXTK-02" },
  ])("uses alias or falls back to name: $expected", ({ alias, shopName, expected }) => {
    fixture.store = Store.create({ shops: [{ id: "mx-2", alias, shopName }] });
    const { container } = render(
      <AffiliateMessageSourceLabel message={{ ...message, shopName: null }} />,
    );
    expect(container.textContent).toBe(expected);
  });
  it("falls back safely when only a legacy account label exists", () => {
    const { container } = render(
      <AffiliateMessageSourceLabel message={{ ...message, shopId: null, shopName: null }} />,
    );
    expect(container.textContent).toBe("TikTok Shop / Windboss MX");
    expect(container.querySelector('[data-tk-private="text"]')).not.toBeNull();
  });
  it("keeps aliases readable without exposing the shop name in privacy mode", () => {
    applySnapshot(runtimeStatusStore.appSettings, { privacyMode: true });
    render(<AffiliateMessageSourceLabel message={message} />);
    expect(screen.getByText("MXTK-02").closest("[data-tk-private]")).toBeNull();
    expect(screen.getByText("MXTK-02").getAttribute("title")).toBe("MXTK-02");
    expect(screen.queryByText("Windboss MX")).toBeNull();
  });
  it("protects the fallback shop name and its tooltip in privacy mode", () => {
    applySnapshot(runtimeStatusStore.appSettings, { privacyMode: true });
    fixture.store = Store.create({ shops: [] });
    render(<AffiliateMessageSourceLabel message={message} />);
    expect(screen.getByText("Windboss MX").getAttribute("data-tk-private")).toBe("text");
    expect(screen.getByText("Windboss MX").getAttribute("title")).toBeNull();
  });
  it.each([GQL.AffiliateMessageChannel.Whatsapp, GQL.AffiliateMessageChannel.Email])(
    "preserves direct-contact account names for %s",
    (channel) => {
      const { container } = render(
        <AffiliateMessageSourceLabel
          message={{ ...message, channel, accountLabel: "BD account" }}
        />,
      );
      expect(container.textContent).toBe("BD account");
    },
  );
});
