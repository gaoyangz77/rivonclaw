import type { Translation } from "@mdxeditor/editor";

/**
 * MDXEditor translation keys → Product Knowledge i18n keys.
 *
 * Keyed by MDXEditor's stable translation key, not its English default: the
 * defaults carry placeholders ("Undo {{shortcut}}", "Heading {{level}}"), so a
 * lookup by English text silently never matched them. Covers every label the
 * editor can show with the plugins and toolbar options this page enables.
 */
export const MDX_EDITOR_TRANSLATION_KEYS: Readonly<Record<string, string>> = {
  "contentArea.editableMarkdown": "editorContentAreaLabel",
  "toolbar.undo": "editorUndo",
  "toolbar.redo": "editorRedo",
  "toolbar.blockTypeSelect.placeholder": "editorBlockType",
  "toolbar.blockTypeSelect.selectBlockTypeTooltip": "editorSelectBlockType",
  "toolbar.blockTypes.paragraph": "editorParagraph",
  "toolbar.blockTypes.quote": "editorQuote",
  "toolbar.blockTypes.heading": "editorHeading",
  "toolbar.bold": "editorBold",
  "toolbar.removeBold": "editorRemoveBold",
  "toolbar.italic": "editorItalic",
  "toolbar.removeItalic": "editorRemoveItalic",
  "toolbar.toggleGroup": "editorToolbarGroup",
  "toolbar.bulletedList": "editorBulletedList",
  "toolbar.numberedList": "editorNumberedList",
  "toolbar.link": "editorCreateLink",
  "toolbar.table": "editorInsertTable",
  "toolbar.richText": "editorRichText",
  "toolbar.source": "editorSourceMode",
  "createLink.url": "editorLinkUrl",
  "createLink.urlPlaceholder": "editorLinkUrlPlaceholder",
  "createLink.text": "editorLinkText",
  "createLink.textTooltip": "editorLinkTextTooltip",
  "createLink.title": "editorLinkTitle",
  "createLink.titleTooltip": "editorLinkTitleTooltip",
  "createLink.saveTooltip": "editorLinkSave",
  "createLink.cancelTooltip": "editorLinkCancel",
  "linkPreview.copyToClipboard": "editorLinkCopy",
  "linkPreview.copied": "editorLinkCopied",
  "linkPreview.edit": "editorLinkEdit",
  "linkPreview.remove": "editorLinkRemove",
  "dialog.close": "editorDialogClose",
  "dialogControls.save": "editorDialogSave",
  "dialogControls.cancel": "editorDialogCancel",
  "table.columnMenu": "editorTableColumnMenu",
  "table.rowMenu": "editorTableRowMenu",
  "table.textAlignment": "editorTableTextAlignment",
  "table.alignLeft": "editorTableAlignLeft",
  "table.alignCenter": "editorTableAlignCenter",
  "table.alignRight": "editorTableAlignRight",
  "table.insertColumnLeft": "editorTableInsertColumnLeft",
  "table.insertColumnRight": "editorTableInsertColumnRight",
  "table.deleteColumn": "editorTableDeleteColumn",
  "table.insertRowAbove": "editorTableInsertRowAbove",
  "table.insertRowBelow": "editorTableInsertRowBelow",
  "table.deleteRow": "editorTableDeleteRow",
  "table.deleteTable": "editorTableDelete",
  "imageEditor.editImage": "editorImageEdit",
  "imageEditor.deleteImage": "editorImageDelete",
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Builds MDXEditor's `translation` prop. A custom translation replaces
 * MDXEditor's default one, which is also where placeholders get filled, so this
 * has to interpolate too: mapped keys through i18next, anything unmapped the
 * way MDXEditor's default would, so no label ever shows a raw `{{placeholder}}`.
 */
export function createEditorTranslation(t: TranslateFn): Translation {
  return (key, defaultValue, interpolations = {}) => {
    const ownKey = MDX_EDITOR_TRANSLATION_KEYS[key];
    if (ownKey) return t(`ecommerce.productKnowledge.${ownKey}`, interpolations);
    let value = defaultValue;
    for (const [name, replacement] of Object.entries(interpolations)) {
      value = value.replaceAll(`{{${name}}}`, String(replacement));
    }
    return value;
  };
}
