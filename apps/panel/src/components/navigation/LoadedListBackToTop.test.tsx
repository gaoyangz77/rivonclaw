import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import { LoadedListBackToTop } from "./LoadedListBackToTop.js";

let resize: ResizeObserverCallback;
const disconnect = vi.fn();
beforeEach(async () => {
  await i18n.changeLanguage("zh");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(enabled = false, scrollTop = 700) {
  // jsdom has no layout; provide only the real scroll host's geometry.
  const wrapper = document.createElement("div");
  wrapper.style.overflowY = "auto";
  wrapper.scrollTop = scrollTop;
  wrapper.scrollTo = vi.fn();
  wrapper.getBoundingClientRect = () => ({ right: 1000, bottom: 650 }) as DOMRect;
  document.body.append(wrapper);
  const tree = (next: boolean) => <LoadedListBackToTop enabled={next} />;
  const view = render(tree(enabled), { container: wrapper });
  return { wrapper, view, tree };
}

it("appears only after a successful append, hides at the top and resets with the list", () => {
  const { wrapper, view, tree } = mount();
  expect(screen.queryByRole("button", { name: "回到顶部" })).toBeNull();
  view.rerender(tree(true));
  expect(screen.getByRole("button", { name: "回到顶部" })).toBeTruthy();
  wrapper.scrollTop = 0;
  fireEvent.scroll(wrapper);
  expect(screen.queryByRole("button", { name: "回到顶部" })).toBeNull();
  wrapper.scrollTop = 900;
  fireEvent.scroll(wrapper);
  view.rerender(tree(false));
  expect(screen.queryByRole("button", { name: "回到顶部" })).toBeNull();
  expect(disconnect).toHaveBeenCalled();
});

it("scrolls the nearest vertical region without moving outer pages or horizontal scroll", () => {
  const { wrapper } = mount(true);
  wrapper.scrollLeft = 150;
  const pageScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "回到顶部" }));
  expect(wrapper.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  expect(wrapper.scrollLeft).toBe(150);
  expect(pageScroll).not.toHaveBeenCalled();
});

it("respects reduced motion and translates the accessible label", async () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  const { wrapper } = mount(true);
  await act(() => i18n.changeLanguage("en"));
  fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
  expect(wrapper.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
});

it("keeps the modal control inside its actual scroll region and focus trap", () => {
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.style.transform = "translate(-50%, -50%)";
  dialog.getBoundingClientRect = () => ({ right: 1100, bottom: 700 }) as DOMRect;
  document.body.append(dialog);
  const { wrapper } = mount();
  dialog.append(wrapper);
  render(<LoadedListBackToTop enabled />, { container: wrapper });
  const rail = wrapper.querySelector<HTMLElement>(".loaded-list-back-to-top")!;
  expect(rail.classList.contains("loaded-list-back-to-top-modal")).toBe(true);
  expect(rail.parentElement).toBe(wrapper);
  act(() => resize([], {} as ResizeObserver));
  fireEvent.click(screen.getByRole("button", { name: "回到顶部" }));
  expect(wrapper.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
});

it("supports document scrolling when there is no nested scroll region", () => {
  document.documentElement.scrollTop = 600;
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<LoadedListBackToTop enabled />);
  fireEvent.click(screen.getByRole("button", { name: "回到顶部" }));
  expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  document.documentElement.scrollTop = 0;
  fireEvent.scroll(window);
  expect(screen.queryByRole("button", { name: "回到顶部" })).toBeNull();
});

it("skips an auto-overflow wrapper that does not actually scroll", () => {
  const { wrapper, view } = mount();
  const inner = document.createElement("div");
  inner.style.overflowY = "auto";
  view.unmount();
  wrapper.append(inner);
  render(<LoadedListBackToTop enabled />, { container: inner });
  const button = screen.getByRole("button", { name: "回到顶部" });
  expect(button.closest(".loaded-list-back-to-top")?.parentElement).toBe(wrapper);
  fireEvent.click(button);
  expect(wrapper.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
});

it("starts tracking a short list when a later append makes it scrollable", () => {
  const { wrapper } = mount(true, 0);
  expect(screen.queryByRole("button", { name: "回到顶部" })).toBeNull();
  wrapper.scrollTop = 700;
  fireEvent.scroll(wrapper);
  fireEvent.click(screen.getByRole("button", { name: "回到顶部" }));
  expect(wrapper.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
});
