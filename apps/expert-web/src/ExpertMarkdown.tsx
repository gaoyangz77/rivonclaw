import { useCallback, useState, type ReactElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "./i18n.js";

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

const remarkPlugins = [remarkGfm];
const components = {
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <div className="expert-code-block">
      <pre>{children}</pre>
      <CodeCopyButton text={extractChildText(children)} />
    </div>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="markdown-table-scroll">
      <table>{children}</table>
    </div>
  ),
};

export function ExpertMarkdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown components={components} remarkPlugins={remarkPlugins}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

function CodeCopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => setCopied(false));
  }, [text]);

  return (
    <button
      aria-label={copied ? t("workspace.copied") : t("workspace.copyCode")}
      className="code-copy-button"
      onClick={copy}
      title={copied ? t("workspace.copied") : t("workspace.copyCode")}
      type="button"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

export function CopyIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <rect height="13" rx="2" stroke="currentColor" strokeWidth="1.8" width="13" x="8" y="8" />
      <path
        d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M13.5 6.5 17.5 10.5M4 20l4.2-.9L19 6.3a2.1 2.1 0 0 0-3-3L5.1 16.2 4 20Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
