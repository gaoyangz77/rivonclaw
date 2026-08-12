import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertTable,
  ListsToggle,
  MDXEditor,
  type MDXEditorMethods,
  Separator,
  UndoRedo,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

export function ProductKnowledgeMarkdownEditor({
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder: string;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const editorRef = useRef<MDXEditorMethods>(null);
  const plugins = useMemo(() => [
    headingsPlugin({ allowedHeadingLevels: [2, 3, 4] }),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    imagePlugin(),
    tablePlugin(),
    thematicBreakPlugin(),
    markdownShortcutPlugin(),
    diffSourcePlugin({ viewMode: "rich-text" }),
    toolbarPlugin({
      toolbarContents: () => (
        <DiffSourceToggleWrapper options={["rich-text", "source"]}>
          <UndoRedo />
          <Separator />
          <BlockTypeSelect />
          <Separator />
          <BoldItalicUnderlineToggles options={["Bold", "Italic"]} />
          <Separator />
          <ListsToggle options={["bullet", "number"]} />
          <CreateLink />
          <InsertTable />
        </DiffSourceToggleWrapper>
      ),
    }),
  ], []);

  useEffect(() => {
    if (!editorRef.current || editorRef.current.getMarkdown() === value) return;
    editorRef.current.setMarkdown(value);
  }, [value]);

  const editorTranslations: Record<string, string> = {
    Undo: t("ecommerce.productKnowledge.editorUndo"),
    Redo: t("ecommerce.productKnowledge.editorRedo"),
    "Block type": t("ecommerce.productKnowledge.editorBlockType"),
    Bold: t("ecommerce.productKnowledge.editorBold"),
    Italic: t("ecommerce.productKnowledge.editorItalic"),
    "Bulleted list": t("ecommerce.productKnowledge.editorBulletedList"),
    "Numbered list": t("ecommerce.productKnowledge.editorNumberedList"),
    "Create link": t("ecommerce.productKnowledge.editorCreateLink"),
    "Insert Table": t("ecommerce.productKnowledge.editorInsertTable"),
    "Rich text": t("ecommerce.productKnowledge.editorRichText"),
    "Source mode": t("ecommerce.productKnowledge.editorSourceMode"),
  };

  return (
    <MDXEditor
      ref={editorRef}
      className="product-knowledge-rich-editor"
      contentEditableClassName="product-knowledge-rich-editor-content"
      markdown={value}
      onChange={(markdown, initialMarkdownNormalize) => {
        if (!initialMarkdownNormalize) onChange(markdown);
      }}
      placeholder={placeholder}
      plugins={plugins}
      readOnly={readOnly}
      spellCheck
      trim={false}
      translation={(_key, defaultValue) => editorTranslations[defaultValue] ?? defaultValue}
    />
  );
}
