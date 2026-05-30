import { useCallback, useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Extract plain text from React children (recursively). */
function extractChildText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractChildText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractChildText((node as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return "";
}

/** Module-level constants to avoid re-creation on every render. */
const mdRemarkPlugins = [remarkGfm];
const mdComponents = {
  img: ({ alt, src }: { alt?: string; src?: string }) => (
    <img src={src} alt={alt ?? ""} className="chat-bubble-img" />
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  pre: ({ children }: { children?: ReactNode }) => {
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
