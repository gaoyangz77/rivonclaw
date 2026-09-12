import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "../../../i18n/index.js";
import {
  CreatorDetailScopeControl,
  CreatorGlobalInformation,
} from "./CreatorDetailScopeControl.js";

afterEach(cleanup);
describe("creator scope header", () => {
  it.each(["zh", "en", "de", "es", "fr", "id", "it", "th"])(
    "localizes the styled selector and global boundary in %s",
    async (language) => {
      await i18n.changeLanguage(language);
      const onChange = vi.fn();
      render(
        <>
          <CreatorDetailScopeControl
            value=""
            shops={[{ id: "1", text: "Shop One", sensitive: false }]}
            onChange={onChange}
          />
          <CreatorGlobalInformation />
        </>,
      );
      const key = "ecommerce.affiliateWorkspace.creatorScope.view";
      expect(i18n.t(key)).not.toBe(key);
      expect(document.querySelector("select")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: i18n.t(key) }));
      fireEvent.click(screen.getByText("Shop One"));
      expect(onChange).toHaveBeenCalledWith("1");
      expect(document.querySelector(".custom-select-dropdown")).toBeNull();
      expect(
        screen.getByText(i18n.t("ecommerce.affiliateWorkspace.creatorScope.globalHint")),
      ).toBeTruthy();
    },
  );
  it("can return to global and disables switching during an operation", async () => {
    await i18n.changeLanguage("zh");
    const onChange = vi.fn();
    const props = {
      value: "1",
      shops: [{ id: "1", text: "Shop One", sensitive: false }],
      onChange,
    };
    const view = render(<CreatorDetailScopeControl {...props} />);
    const name = i18n.t("ecommerce.affiliateWorkspace.creatorScope.view");
    fireEvent.click(screen.getByRole("button", { name }));
    fireEvent.click(
      screen.getByText(i18n.t("ecommerce.affiliateWorkspace.creatorScope.globalView")),
    );
    expect(onChange).toHaveBeenCalledWith("");
    view.rerender(<CreatorDetailScopeControl {...props} disabled />);
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
  });
});
