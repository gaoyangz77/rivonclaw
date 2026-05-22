import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Extract plain text from React children (recursively). */
function extractChildText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractChildText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractChildText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return "";
}

/** Module-level constants to avoid re-creation on every render. */
const mdRemarkPlugins = [remarkGfm];
const mdComponents = {
  img: ({ alt, src }: { alt?: string; src?: string }) => (
    <img src={src} alt={alt ?? ""} className="chat-bubble-img" />
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => {
    const code = extractChildText(children);
    return (
      <pre className="chat-code-block-wrap">
        {children}
        <CodeBlockCopyButton text={code} />
      </pre>
    );
  },
};

export function MarkdownMessage({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={mdRemarkPlugins} components={mdComponents}>
      {text}
    </ReactMarkdown>
  );
}

/** 15 lines × 14px font × 1.6 line-height = 336px */
const COLLAPSE_THRESHOLD_PX = 336;

/**
 * Wraps assistant message content and collapses it when taller than ~15 lines.
 * Uses CSS max-height + gradient fade for the collapsed state.
 */
export function CollapsibleContent({ children, defaultCollapsed = true }: { children: React.ReactNode; defaultCollapsed?: boolean }) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [needsCollapse, setNeedsCollapse] = useState(false);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (el) setNeedsCollapse(el.scrollHeight > COLLAPSE_THRESHOLD_PX);
  }, [children]);

  return (
    <>
      <div
        ref={contentRef}
        className={needsCollapse && collapsed ? "chat-bubble-collapsible chat-bubble-collapsed" : "chat-bubble-collapsible"}
      >
        {children}
      </div>
      {needsCollapse && (
        <button
          className={`chat-bubble-collapse-toggle${collapsed ? "" : " chat-bubble-collapse-toggle-expanded"}`}
          onClick={() => setCollapsed((v) => !v)}
        >
          <span className="chat-bubble-collapse-label">
            {collapsed ? t("chat.expandMessage", "Show more") : t("chat.collapseMessage", "Show less")}
          </span>
          <svg className="chat-bubble-collapse-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      )}
    </>
  );
}

function CodeBlockCopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      className={`chat-code-copy${copied ? " chat-code-copy-done" : ""}`}
      onClick={handleCopy}
      title={copied ? t("common.copied") : t("common.copy")}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}

/**
 * Collapsible display for tool call arguments.
 * Toggle button renders inline in the header; expanded JSON renders below.
 */
export function ToolArgsDisplay({ args }: { args: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const formatted = JSON.stringify(args, null, 2);

  return (
    <>
      <button
        className={`chat-tool-args-toggle${expanded ? " chat-tool-args-toggle-expanded" : ""}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <svg className="chat-tool-args-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
        <span>{t("chat.toolArgsLabel", "Parameters")}</span>
      </button>
      {expanded && (
        <pre className="chat-tool-args-code">{formatted}</pre>
      )}
    </>
  );
}

export function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      className={`chat-bubble-copy${copied ? " chat-bubble-copy-done" : ""}`}
      onClick={handleCopy}
      data-tooltip={copied ? t("common.copied") : t("common.copy")}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}
