import { beforeEach, describe, expect, it } from "vitest";
import i18n from "../../i18n/index.js";
import {
  createEditorTranslation,
  MDX_EDITOR_TRANSLATION_KEYS,
} from "./product-knowledge-editor-translation.js";

const translate = () => createEditorTranslation(i18n.t.bind(i18n));

describe("Product Knowledge editor translation", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh");
  });

  it("translates block types, filling the heading level", () => {
    const t = translate();
    expect(t("toolbar.blockTypes.paragraph", "Paragraph")).toBe("正文");
    expect(t("toolbar.blockTypes.quote", "Quote")).toBe("引用");
    expect(t("toolbar.blockTypes.heading", "Heading {{level}}", { level: 2 })).toBe("标题 2");
  });

  it("fills the undo and redo shortcut instead of showing the placeholder", () => {
    const t = translate();
    expect(t("toolbar.undo", "Undo {{shortcut}}", { shortcut: "⌘Z" })).toBe("撤销 ⌘Z");
    expect(t("toolbar.redo", "Redo {{shortcut}}", { shortcut: "⇧⌘Z" })).toBe("重做 ⇧⌘Z");
  });

  it("still fills placeholders for a label it has no translation for", () => {
    expect(translate()("toolbar.somethingNew", "Level {{level}} of {{total}}", { level: 1, total: 3 }))
      .toBe("Level 1 of 3");
  });

  it("has every mapped label in both English and Chinese", () => {
    const missing = Object.values(MDX_EDITOR_TRANSLATION_KEYS).flatMap((key) =>
      ["en", "zh"]
        .filter((lng) => !i18n.exists(`ecommerce.productKnowledge.${key}`, { lng }))
        .map((lng) => `${lng}:${key}`),
    );
    expect(missing).toEqual([]);
  });
});
