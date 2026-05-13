import { openClawConnector } from "../openclaw/index.js";

export interface OpenClawSessionAnchor {
  sessionMessageTimestampMs?: number;
  sessionMessageText?: string;
}

type ChatHistoryMessage = Record<string, unknown>;

function timestampToMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function extractTextFromContent(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  const chunks: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const text = (block as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) chunks.push(text);
  }
  return chunks.length ? chunks.join("\n") : undefined;
}

function extractVisibleText(message: ChatHistoryMessage): string | undefined {
  const contentText = extractTextFromContent(message.content);
  if (contentText?.trim()) return contentText;
  const text = message.text;
  return typeof text === "string" && text.trim() ? text : undefined;
}

/**
 * Read the newest user turn from an OpenClaw session. We intentionally anchor
 * on user turns rather than assistant turns: for service agents, user turns are
 * the work packages actually supplied to the LLM, while assistant turns may be
 * merchant summaries, aborted drafts, or proposal notes that were not platform
 * messages.
 */
export async function readLatestUserSessionAnchor(sessionKey: string): Promise<OpenClawSessionAnchor | undefined> {
  const history = await openClawConnector.request<{ messages?: ChatHistoryMessage[] }>("chat.history", {
    sessionKey,
    limit: 20,
    maxChars: 40_000,
  });
  const messages = history?.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    const sessionMessageText = extractVisibleText(message);
    const sessionMessageTimestampMs = timestampToMs(message.timestamp);
    if (!sessionMessageText && sessionMessageTimestampMs == null) continue;
    return { sessionMessageText, sessionMessageTimestampMs };
  }
  return undefined;
}
