import {
  createContext,
  type ReactNode,
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
import { ImageIcon, VideoIcon } from "../../../components/icons.js";
import {
  MEDIA_IMAGE_MIME_TYPES,
  MEDIA_VIDEO_MIME_TYPES,
  checkMediaFile,
  uploadProductKnowledgeMedia,
} from "../../../api/uploads.js";
import {
  isMediaUri,
  rememberMediaAsset,
  resolveMediaUrl,
  useMediaAsset,
} from "../hooks/useProductKnowledgeMedia.js";
import "./ProductKnowledgeMarkdownEditor.css";
import { looksLikeMarkdown } from "../product-knowledge-markdown-paste.js";
import { createEditorTranslation } from "../product-knowledge-editor-translation.js";

const ROOT_CONTENT_CLASS = "product-knowledge-rich-editor-content";

/**
 * Markdown-aware paste applies only to the top-level rich-text surface. Source
 * mode is CodeMirror and must paste literally, and a table cell is a nested
 * editor — its nearest content-editable is not the root one — where headings
 * and lists do not belong.
 */
function isRootRichTextTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;
  return element?.closest('[contenteditable="true"]')?.classList.contains(ROOT_CONTENT_CLASS) ?? false;
}

/**
 * Shared by the editor shell and the toolbar button MDXEditor renders inside
 * its own tree. Only stable callbacks and primitives cross this boundary.
 */
type MediaEditorApi = {
  insertMediaFile: (file: File) => Promise<void>;
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

/**
 * Both kinds are stored as the same leaf directive. The file name rides along
 * so the Markdown stays readable on its own — `media://<assetId>` identifies
 * the bytes but says nothing about what they are.
 */
export function mediaDirectiveMarkdown(uri: string, name: string): string {
  const safeName = directiveAttributeValue(name);
  const nameAttribute = safeName ? ` name="${safeName}"` : "";
  return `::media{src="${uri}"${nameAttribute}}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/**
 * Media reads as one compact row — thumbnail, file name, kind and size — and
 * opens to full size only when asked. The Markdown holds a `media://` reference,
 * so a wall of full-bleed pictures would misrepresent what is actually stored
 * and bury the text the Agent is meant to read.
 */
function MediaCard({ src, name }: { src?: string; name: string }) {
  const { t } = useTranslation();
  const { asset, state } = useMediaAsset(src);
  const [expanded, setExpanded] = useState(false);
  const isVideo = asset?.kind === "VIDEO";
  const label = name.trim() || t("ecommerce.productKnowledge.mediaUntitled");

  if (state !== "ready" || !asset) {
    return (
      <div className="product-knowledge-media-card product-knowledge-media-card-pending">
        {state === "resolving"
          ? t("ecommerce.productKnowledge.mediaResolving")
          : t("ecommerce.productKnowledge.mediaUnavailable")}
      </div>
    );
  }

  return (
    <figure className="product-knowledge-media-card" data-kind={asset.kind}>
      <button
        aria-expanded={expanded}
        className="product-knowledge-media-card-row"
        onClick={() => setExpanded((open) => !open)}
        type="button"
      >
        <span className="product-knowledge-media-card-thumb">
          {isVideo ? (
            <VideoIcon aria-hidden="true" />
          ) : (
            <img alt="" loading="lazy" src={asset.url} />
          )}
        </span>
        <span className="product-knowledge-media-card-text">
          <span className="product-knowledge-media-card-name">{label}</span>
          <span className="product-knowledge-media-card-meta">
            {isVideo
              ? t("ecommerce.productKnowledge.mediaKindVideo")
              : t("ecommerce.productKnowledge.mediaKindImage")}
            {" · "}
            {formatFileSize(asset.sizeBytes)}
          </span>
        </span>
        <span className="product-knowledge-media-card-action">
          {expanded
            ? t("ecommerce.productKnowledge.mediaCollapse")
            : t("ecommerce.productKnowledge.mediaExpand")}
        </span>
      </button>
      {expanded ? (
        <div className="product-knowledge-media-card-preview">
          {isVideo ? (
            <video controls preload="metadata" src={asset.url}>
              {t("ecommerce.productKnowledge.mediaVideoUnsupported")}
            </video>
          ) : (
            <img alt={label} src={asset.url} />
          )}
        </div>
      ) : null}
    </figure>
  );
}

function MediaDirectiveEditor({ mdastNode }: DirectiveEditorProps) {
  const attributes = mdastNode.attributes ?? {};
  return (
    <MediaCard
      name={attributes.name ?? attributes.title ?? ""}
      src={attributes.src ?? undefined}
    />
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

const MEDIA_DIRECTIVE_DESCRIPTOR: DirectiveDescriptor = {
  name: "media",
  type: "leafDirective",
  testNode: (node) => node.name === "media",
  attributes: ["src", "name"],
  hasChildren: false,
  Editor: MediaDirectiveEditor,
};

/** `::video` is the shape this editor wrote before images joined the same card. */
const VIDEO_DIRECTIVE_DESCRIPTOR: DirectiveDescriptor = {
  name: "video",
  type: "leafDirective",
  testNode: (node) => node.name === "video",
  attributes: ["src", "title"],
  hasChildren: false,
  Editor: MediaDirectiveEditor,
};

const UNKNOWN_DIRECTIVE_DESCRIPTOR: DirectiveDescriptor = {
  name: "unknown",
  testNode: (node) => node.type !== "textDirective",
  attributes: [],
  hasChildren: false,
  Editor: UnknownDirectiveEditor,
};

/**
 * A file picker per media kind. Images are also accepted by drag and paste, but
 * only a toolbar button makes that discoverable, and MDXEditor's own image
 * button opens a dialog offering an external URL — knowledge referencing a URL
 * we do not host is exactly what media:// exists to avoid.
 */
function InsertMediaButton({
  accept,
  icon,
  label,
}: {
  accept: readonly string[];
  icon: ReactNode;
  label: string;
}) {
  const api = useContext(MediaEditorContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!api) return null;

  return (
    <>
      <ButtonWithTooltip
        disabled={api.readOnly || busy}
        onClick={() => inputRef.current?.click()}
        title={label}
      >
        {icon}
        <span className="sr-only">{label}</span>
      </ButtonWithTooltip>
      <input
        accept={accept.join(",")}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          void api.insertMediaFile(file).finally(() => setBusy(false));
        }}
        ref={inputRef}
        type="file"
      />
    </>
  );
}

function InsertImageButton() {
  const { t } = useTranslation();
  return (
    <InsertMediaButton
      accept={MEDIA_IMAGE_MIME_TYPES}
      icon={<ImageIcon aria-hidden="true" />}
      label={t("ecommerce.productKnowledge.mediaInsertImage")}
    />
  );
}

function InsertVideoButton() {
  const { t } = useTranslation();
  return (
    <InsertMediaButton
      accept={MEDIA_VIDEO_MIME_TYPES}
      icon={<VideoIcon aria-hidden="true" />}
      label={t("ecommerce.productKnowledge.mediaInsertVideo")}
    />
  );
}

function mediaFilesFrom(transfer: DataTransfer | null): File[] {
  return Array.from(transfer?.files ?? []).filter((file) => checkMediaFile(file) === null);
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

  const insertMarkdownAtCursor = useCallback((markdown: string): void => {
    const editor = editorRef.current;
    // `insertMarkdown` is a no-op while the document has no selection, which
    // is exactly the state after picking a file from the toolbar or dropping
    // one onto an editor that was never focused. Focusing first keeps an
    // existing cursor (replacing any selected text, as a paste would) and
    // otherwise falls back to the end of the document.
    editor?.focus(
      () => editor.insertMarkdown(markdown),
      { defaultSelection: "rootEnd" },
    );
  }, []);

  const insertMediaFile = useCallback(
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
        rememberMediaAsset(uploaded);
        const markdown = mediaDirectiveMarkdown(uploaded.uri, file.name);
        insertMarkdownAtCursor(markdown);
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : t("ecommerce.productKnowledge.mediaUploadFailed"),
        );
      } finally {
        setUploading(false);
      }
    },
    [describeRejection, insertMarkdownAtCursor, t],
  );

  const mediaApi = useMemo<MediaEditorApi>(
    () => ({ insertMediaFile, readOnly }),
    [insertMediaFile, readOnly],
  );

  // Kept in a ref so the plugin list below can stay built once: MDXEditor
  // re-creates its realm when the plugin array identity changes.
  const handlersRef = useRef({ previewImage });
  handlersRef.current = { previewImage };

  const plugins = useMemo(() => [
    headingsPlugin({ allowedHeadingLevels: [2, 3, 4] }),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    // No imageUploadHandler on purpose: with one set, MDXEditor swallows image
    // drops and pastes and inserts its own `![](…)` node, bypassing the card.
    // The preview handler stays so Markdown already holding `![](media://…)`
    // still displays.
    imagePlugin({
      imagePreviewHandler: (src) => handlersRef.current.previewImage(src),
    }),
    directivesPlugin({
      directiveDescriptors: [
        MEDIA_DIRECTIVE_DESCRIPTOR,
        VIDEO_DIRECTIVE_DESCRIPTOR,
        UNKNOWN_DIRECTIVE_DESCRIPTOR,
      ],
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
          <InsertImageButton />
          <InsertVideoButton />
        </DiffSourceToggleWrapper>
      ),
    }),
  ], []);

  useEffect(() => {
    if (!editorRef.current || editorRef.current.getMarkdown() === value) return;
    editorRef.current.setMarkdown(value);
  }, [value]);

  // Files and Markdown text are intercepted before Lexical sees the event.
  // Without this the browser pastes a file name for a video, an image goes in
  // as MDXEditor's own node instead of the card, and pasted Markdown stays
  // literal.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || readOnly) return;

    const onDrop = (event: DragEvent) => {
      const files = mediaFilesFrom(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      void files.reduce(
        (chain, file) => chain.then(() => insertMediaFile(file)),
        Promise.resolve(),
      );
    };
    const onDragOver = (event: DragEvent) => {
      const draggable = [
        ...(MEDIA_IMAGE_MIME_TYPES as readonly string[]),
        ...(MEDIA_VIDEO_MIME_TYPES as readonly string[]),
      ];
      if (Array.from(event.dataTransfer?.items ?? []).some((item) =>
        draggable.includes(item.type),
      )) {
        event.preventDefault();
      }
    };
    const onPaste = (event: ClipboardEvent) => {
      const files = mediaFilesFrom(event.clipboardData);
      if (files.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        void files.reduce(
          (chain, file) => chain.then(() => insertMediaFile(file)),
          Promise.resolve(),
        );
        return;
      }
      // Raw Markdown pasted into the rich-text view would otherwise land as
      // literal `## ` and `- ` text; render it the way source mode would.
      if (!isRootRichTextTarget(event.target)) return;
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!looksLikeMarkdown(text)) return;
      event.preventDefault();
      event.stopPropagation();
      insertMarkdownAtCursor(text);
    };

    container.addEventListener("drop", onDrop, true);
    container.addEventListener("dragover", onDragOver, true);
    container.addEventListener("paste", onPaste, true);
    return () => {
      container.removeEventListener("drop", onDrop, true);
      container.removeEventListener("dragover", onDragOver, true);
      container.removeEventListener("paste", onPaste, true);
    };
  }, [insertMarkdownAtCursor, insertMediaFile, readOnly]);

  const translation = useMemo(() => createEditorTranslation(t), [t]);

  return (
    <MediaEditorContext.Provider value={mediaApi}>
      <div className="product-knowledge-media-editor" ref={containerRef}>
        <MDXEditor
          ref={editorRef}
          className="product-knowledge-rich-editor"
          contentEditableClassName={ROOT_CONTENT_CLASS}
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
          translation={translation}
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
