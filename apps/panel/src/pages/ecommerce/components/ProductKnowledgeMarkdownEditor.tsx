import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ButtonWithTooltip,
  CreateLink,
  type DirectiveDescriptor,
  type DirectiveEditorProps,
  DiffSourceToggleWrapper,
  InsertTable,
  ListsToggle,
  MDXEditor,
  type MDXEditorMethods,
  Separator,
  type ToMarkdownOptions,
  UndoRedo,
  diffSourcePlugin,
  directivesPlugin,
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
import { VideoIcon } from "../../../components/icons.js";
import {
  MEDIA_VIDEO_MIME_TYPES,
  checkMediaFile,
  isSupportedMediaVideo,
  uploadProductKnowledgeMedia,
} from "../../../api/uploads.js";
import {
  isMediaUri,
  rememberMediaUrl,
  resolveMediaUrl,
  useMediaUrl,
} from "../hooks/useProductKnowledgeMedia.js";
import "./ProductKnowledgeMarkdownEditor.css";

/**
 * Shared by the editor shell and the toolbar button MDXEditor renders inside
 * its own tree. Only stable callbacks and primitives cross this boundary.
 */
type MediaEditorApi = {
  insertVideoFile: (file: File) => Promise<void>;
  readOnly: boolean;
};

const MediaEditorContext = createContext<MediaEditorApi | null>(null);

type TextHandler = NonNullable<NonNullable<ToMarkdownOptions["handlers"]>["text"]>;

/**
 * Directive support escapes every `:` that is followed by a letter inside prose,
 * so a merchant's "Note:this ships" would be rewritten to "Note\:this ships" the
 * first time the document is saved. The escape exists to stop the colon
 * re-parsing as a text directive — but `escapeUnknownTextDirectives` already
 * turns every text directive without a descriptor back into plain text on the
 * way in, so the round trip is stable without it and the backslash only mutates
 * stored knowledge (which the Agent reads verbatim).
 *
 * Only that one pattern is dropped. A line *starting* with `::` is left escaped:
 * that one really would re-read as a directive block.
 */
const writeTextWithoutDirectiveColonEscape: TextHandler = (node, _parent, state, info) => {
  const unsafe = state.unsafe;
  state.unsafe = unsafe.filter(
    (pattern) => !(pattern.character === ":" && pattern.after === "[A-Za-z]"),
  );
  try {
    return state.safe((node as { value: string }).value, info);
  } finally {
    state.unsafe = unsafe;
  }
};

const TO_MARKDOWN_OPTIONS: ToMarkdownOptions = {
  handlers: { text: writeTextWithoutDirectiveColonEscape },
};

/** Directive attribute values are double-quoted; keep them unambiguous. */
function directiveAttributeValue(value: string): string {
  return value.replace(/[\r\n"\\]+/g, " ").trim();
}

export function videoDirectiveMarkdown(uri: string, title: string): string {
  const safeTitle = directiveAttributeValue(title);
  const titleAttribute = safeTitle ? ` title="${safeTitle}"` : "";
  return `::video{src="${uri}"${titleAttribute}}`;
}

function VideoDirectiveEditor({ mdastNode }: DirectiveEditorProps) {
  const { t } = useTranslation();
  const src = mdastNode.attributes?.src ?? undefined;
  const title = mdastNode.attributes?.title ?? "";
  const { url, state } = useMediaUrl(src ?? undefined);

  return (
    <figure className="product-knowledge-video">
      {state === "ready" && url ? (
        <video className="product-knowledge-video-player" controls preload="metadata" src={url}>
          {t("ecommerce.productKnowledge.mediaVideoUnsupported")}
        </video>
      ) : (
        <div className="product-knowledge-video-placeholder">
          {state === "resolving"
            ? t("ecommerce.productKnowledge.mediaResolving")
            : t("ecommerce.productKnowledge.mediaUnavailable")}
        </div>
      )}
      {title ? <figcaption className="product-knowledge-video-caption">{title}</figcaption> : null}
    </figure>
  );
}

/**
 * Enabling `directivesPlugin` makes MDXEditor parse every `:`/`::`/`:::`
 * construct, and a directive with no descriptor aborts the whole import. This
 * catch-all keeps pre-existing knowledge content loadable: the mdast node is
 * held intact and written back unchanged on save.
 *
 * It deliberately skips text directives. An ordinary colon inside a sentence
 * ("Note:this ships tomorrow") parses as one, and `escapeUnknownTextDirectives`
 * turns those back into the text the merchant typed — but only while no
 * descriptor claims them.
 */
function UnknownDirectiveEditor({ mdastNode }: DirectiveEditorProps) {
  const { t } = useTranslation();
  return (
    <div className="product-knowledge-unknown-directive">
      {t("ecommerce.productKnowledge.mediaUnknownBlock", { name: mdastNode.name })}
    </div>
  );
}

const VIDEO_DIRECTIVE_DESCRIPTOR: DirectiveDescriptor = {
  name: "video",
  type: "leafDirective",
  testNode: (node) => node.name === "video",
  attributes: ["src", "title"],
  hasChildren: false,
  Editor: VideoDirectiveEditor,
};

const UNKNOWN_DIRECTIVE_DESCRIPTOR: DirectiveDescriptor = {
  name: "unknown",
  testNode: (node) => node.type !== "textDirective",
  attributes: [],
  hasChildren: false,
  Editor: UnknownDirectiveEditor,
};

function InsertVideoButton() {
  const { t } = useTranslation();
  const api = useContext(MediaEditorContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!api) return null;

  return (
    <>
      <ButtonWithTooltip
        disabled={api.readOnly || busy}
        onClick={() => inputRef.current?.click()}
        title={t("ecommerce.productKnowledge.mediaInsertVideo")}
      >
        <VideoIcon aria-hidden="true" />
        <span className="sr-only">{t("ecommerce.productKnowledge.mediaInsertVideo")}</span>
      </ButtonWithTooltip>
      <input
        accept={MEDIA_VIDEO_MIME_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          void api.insertVideoFile(file).finally(() => setBusy(false));
        }}
        ref={inputRef}
        type="file"
      />
    </>
  );
}

function videoFilesFrom(transfer: DataTransfer | null): File[] {
  return Array.from(transfer?.files ?? []).filter(isSupportedMediaVideo);
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const describeRejection = useCallback(
    (file: File): string | null => {
      const rejection = checkMediaFile(file);
      if (!rejection) return null;
      if (rejection.reason === "unsupported-type") {
        return t("ecommerce.productKnowledge.mediaUnsupportedType", { name: file.name });
      }
      return t("ecommerce.productKnowledge.mediaTooLarge", {
        name: file.name,
        limit: Math.round(rejection.maxBytes / (1024 * 1024)),
      });
    },
    [t],
  );

  /**
   * MDXEditor calls this for drops, pastes and the image dialog. The returned
   * string is what lands in the Markdown, so it must be the stable
   * `media://` URI rather than the (rotating) object-storage URL.
   */
  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      const rejection = describeRejection(file);
      if (rejection) {
        setUploadError(rejection);
        throw new Error(rejection);
      }
      setUploadError(null);
      setUploading(true);
      try {
        const uploaded = await uploadProductKnowledgeMedia(file);
        rememberMediaUrl(uploaded.uri, uploaded.publicUrl);
        return uploaded.uri;
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : t("ecommerce.productKnowledge.mediaUploadFailed"),
        );
        throw error;
      } finally {
        setUploading(false);
      }
    },
    [describeRejection, t],
  );

  const previewImage = useCallback(async (src: string): Promise<string> => {
    if (!isMediaUri(src)) return src;
    try {
      return (await resolveMediaUrl(src)) ?? src;
    } catch {
      // Leave the URI in place so MDXEditor paints its broken-image state and
      // a later re-render retries the lookup.
      return src;
    }
  }, []);

  const insertVideoFile = useCallback(
    async (file: File): Promise<void> => {
      const rejection = describeRejection(file);
      if (rejection) {
        setUploadError(rejection);
        return;
      }
      setUploadError(null);
      setUploading(true);
      try {
        const uploaded = await uploadProductKnowledgeMedia(file);
        rememberMediaUrl(uploaded.uri, uploaded.publicUrl);
        const editor = editorRef.current;
        // `insertMarkdown` is a no-op while the document has no selection, which
        // is exactly the state after picking a file from the toolbar or dropping
        // one onto an editor that was never focused. Focusing first keeps an
        // existing cursor and otherwise falls back to the end of the document.
        editor?.focus(
          () => editor.insertMarkdown(videoDirectiveMarkdown(uploaded.uri, file.name)),
          { defaultSelection: "rootEnd" },
        );
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : t("ecommerce.productKnowledge.mediaUploadFailed"),
        );
      } finally {
        setUploading(false);
      }
    },
    [describeRejection, t],
  );

  const mediaApi = useMemo<MediaEditorApi>(
    () => ({ insertVideoFile, readOnly }),
    [insertVideoFile, readOnly],
  );

  // Kept in a ref so the plugin list below can stay built once: MDXEditor
  // re-creates its realm when the plugin array identity changes.
  const handlersRef = useRef({ uploadImage, previewImage });
  handlersRef.current = { uploadImage, previewImage };

  const plugins = useMemo(() => [
    headingsPlugin({ allowedHeadingLevels: [2, 3, 4] }),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    imagePlugin({
      imageUploadHandler: (file) => handlersRef.current.uploadImage(file),
      imagePreviewHandler: (src) => handlersRef.current.previewImage(src),
    }),
    directivesPlugin({
      directiveDescriptors: [VIDEO_DIRECTIVE_DESCRIPTOR, UNKNOWN_DIRECTIVE_DESCRIPTOR],
      escapeUnknownTextDirectives: true,
    }),
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
          <InsertVideoButton />
        </DiffSourceToggleWrapper>
      ),
    }),
  ], []);

  useEffect(() => {
    if (!editorRef.current || editorRef.current.getMarkdown() === value) return;
    editorRef.current.setMarkdown(value);
  }, [value]);

  // Videos are intercepted before Lexical sees the event: MDXEditor's image
  // plugin filters drops and pastes down to `image/*` and leaves video files to
  // the browser's default handling, which would paste a file name.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || readOnly) return;

    const onDrop = (event: DragEvent) => {
      const files = videoFilesFrom(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      void files.reduce(
        (chain, file) => chain.then(() => insertVideoFile(file)),
        Promise.resolve(),
      );
    };
    const onDragOver = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.items ?? []).some((item) =>
        (MEDIA_VIDEO_MIME_TYPES as readonly string[]).includes(item.type),
      )) {
        event.preventDefault();
      }
    };
    const onPaste = (event: ClipboardEvent) => {
      const files = videoFilesFrom(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      void files.reduce(
        (chain, file) => chain.then(() => insertVideoFile(file)),
        Promise.resolve(),
      );
    };

    container.addEventListener("drop", onDrop, true);
    container.addEventListener("dragover", onDragOver, true);
    container.addEventListener("paste", onPaste, true);
    return () => {
      container.removeEventListener("drop", onDrop, true);
      container.removeEventListener("dragover", onDragOver, true);
      container.removeEventListener("paste", onPaste, true);
    };
  }, [insertVideoFile, readOnly]);

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
    <MediaEditorContext.Provider value={mediaApi}>
      <div className="product-knowledge-media-editor" ref={containerRef}>
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
          toMarkdownOptions={TO_MARKDOWN_OPTIONS}
          trim={false}
          translation={(_key, defaultValue) => editorTranslations[defaultValue] ?? defaultValue}
        />
        {uploading ? (
          <p className="product-knowledge-media-status" role="status">
            {t("ecommerce.productKnowledge.mediaUploading")}
          </p>
        ) : null}
        {uploadError ? (
          <p className="product-knowledge-media-error" role="alert">
            {uploadError}
          </p>
        ) : null}
      </div>
    </MediaEditorContext.Provider>
  );
}
