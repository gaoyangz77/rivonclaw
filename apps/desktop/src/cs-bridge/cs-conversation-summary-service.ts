import { randomUUID } from "node:crypto";
import { createLogger } from "@rivonclaw/logger";
import { GQL } from "@rivonclaw/core";
import type { AuthSessionManager } from "../auth/session.js";
import { openClawConnector } from "../openclaw/index.js";
import { requestAgent } from "../gateway/agent-tooling-readiness.js";
import { GET_CONVERSATION_MESSAGES_QUERY } from "../cloud/cs-queries.js";
import {
  readConversationSummary,
  writeConversationSummary,
  type CustomerServiceMessageCursor,
  type CustomerServiceSummaryRecord,
} from "./cs-session-cursor-store.js";

const log = createLogger("cs-conversation-summary");
const CONVERSATION_MESSAGES_PAGE_SIZE = 10;
const MAX_CONVERSATION_MESSAGE_PAGES = 30;

type ChatHistoryMessage = Record<string, unknown>;

interface ConversationMessagesResult {
  ecommerceGetConversationMessages?: GQL.CustomerServiceMessageSummaryPage;
}

function messageTimeKey(message: GQL.CustomerServiceMessageSummary): number {
  const raw = message.createTime;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : Number.POSITIVE_INFINITY;
}

function compareOpaqueIndex(a: unknown, b: unknown): number {
  const left = String(a ?? "");
  const right = String(b ?? "");
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    if (left.length !== right.length) return left.length - right.length;
    return left.localeCompare(right);
  }
  return left.localeCompare(right);
}

function sortMessages(messages: GQL.CustomerServiceMessageSummary[]): GQL.CustomerServiceMessageSummary[] {
  return [...messages].sort((a, b) => (
    messageTimeKey(a) - messageTimeKey(b) ||
    compareOpaqueIndex(a.index, b.index) ||
    compareOpaqueIndex(a.messageId, b.messageId)
  ));
}

function messageCursor(message: GQL.CustomerServiceMessageSummary | undefined): CustomerServiceMessageCursor | null {
  if (!message) return null;
  const cursor: CustomerServiceMessageCursor = {
    messageId: message.messageId ?? undefined,
    messageIndex: message.index ?? undefined,
    createTime: message.createTime ?? undefined,
  };
  if (!cursor.messageId && !cursor.messageIndex && cursor.createTime == null) return null;
  return cursor;
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
  if (contentText?.trim()) return contentText.trim();
  const text = message.text;
  return typeof text === "string" && text.trim() ? text.trim() : undefined;
}

function latestAssistantText(messages: ChatHistoryMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    const text = extractVisibleText(message);
    if (text) return text;
  }
  return undefined;
}

async function fetchAllConversationMessages(input: {
  authSession: AuthSessionManager;
  shopId: string;
  conversationId: string;
  locale?: string;
}): Promise<GQL.CustomerServiceMessageSummary[]> {
  const byKey = new Map<string, GQL.CustomerServiceMessageSummary>();
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_CONVERSATION_MESSAGE_PAGES; page += 1) {
    const result = await input.authSession.graphqlFetch<ConversationMessagesResult>(
      GET_CONVERSATION_MESSAGES_QUERY,
      {
        shopId: input.shopId,
        conversationId: input.conversationId,
        pageSize: CONVERSATION_MESSAGES_PAGE_SIZE,
        pageToken,
        locale: input.locale,
      },
    );
    const messagePage = result.ecommerceGetConversationMessages;
    for (const message of messagePage?.items ?? []) {
      const key = message.messageId ?? `${message.createTime ?? ""}:${message.index ?? ""}:${message.text ?? ""}`;
      byKey.set(key, message);
    }
    pageToken = messagePage?.nextPageToken ?? undefined;
    if (!pageToken) break;
  }
  return sortMessages([...byKey.values()]);
}

function formatMessageForPrompt(message: GQL.CustomerServiceMessageSummary, index: number): string {
  const role = message.sender?.role ?? "UNKNOWN";
  const nickname = message.sender?.nickname ? ` / ${message.sender.nickname}` : "";
  const text = message.text?.trim() || `[${message.type ?? "MESSAGE"}]`;
  return [
    `${index + 1}. [${role}${nickname}]`,
    `   messageId: ${message.messageId ?? ""}`,
    `   messageIndex: ${message.index ?? ""}`,
    `   createTime: ${message.createTime ?? ""}`,
    `   type: ${message.type ?? ""}`,
    `   text: ${text}`,
  ].join("\n");
}

function buildSummaryPrompt(input: {
  shopId: string;
  conversationId: string;
  messages: GQL.CustomerServiceMessageSummary[];
  locale?: string;
}): string {
  const uiLocale = input.locale?.trim() || "en";
  return [
    "You are summarizing an ecommerce customer-service conversation for an operator.",
    "Use only the conversation transcript below. Do not call tools.",
    `Write the summary in the operator's current client UI language. The current UI locale is "${uiLocale}".`,
    "If the locale is Chinese, write natural Chinese. If it is English, write natural English. For any other locale, use that locale's primary language.",
    "",
    "The summary should be concise but operationally useful:",
    "- current customer issue",
    "- important facts already discussed",
    "- promises or actions already made by staff/AI",
    "- unresolved next step, if any",
    "",
    `Shop ID: ${input.shopId}`,
    `Conversation ID: ${input.conversationId}`,
    "",
    "Transcript:",
    ...input.messages.map(formatMessageForPrompt),
  ].join("\n");
}

export async function getLocalConversationSummary(input: {
  shopId: string;
  conversationId: string;
}): Promise<CustomerServiceSummaryRecord | undefined> {
  return readConversationSummary(input);
}

export async function generateConversationSummary(input: {
  authSession: AuthSessionManager;
  shopId: string;
  conversationId: string;
  locale?: string;
}): Promise<CustomerServiceSummaryRecord> {
  const messages = await fetchAllConversationMessages(input);
  if (messages.length === 0) {
    throw new Error("No conversation messages available to summarize");
  }
  const cursor = messageCursor(messages[messages.length - 1]);
  if (!cursor) {
    throw new Error("Cannot anchor summary because the latest message has no cursor");
  }

  const sessionKey = `agent:main:cs-summary:${input.shopId}:${input.conversationId}:${randomUUID()}`;
  const prompt = buildSummaryPrompt({ ...input, messages });
  const response = await requestAgent<{ runId?: string }>({
    sessionKey,
    message: prompt,
    extraSystemPrompt: "You are a one-shot customer-service summarizer. Do not call tools. Return only the operator-facing summary.",
    modelRun: true,
    promptMode: "raw",
    deliver: false,
    idempotencyKey: `cs-summary:${input.shopId}:${input.conversationId}:${Date.now()}`,
  });
  const runId = response?.runId;
  if (!runId) throw new Error("Summary agent run was not accepted");

  try {
    const wait = await openClawConnector.request<{ status?: string; error?: unknown }>("agent.wait", {
      runId,
      timeoutMs: 120_000,
    });
    if (wait?.status !== "ok") {
      throw new Error(wait?.status === "timeout" ? "Summary generation timed out" : `Summary generation ended with status ${wait?.status ?? "unknown"}`);
    }
    const history = await openClawConnector.request<{ messages?: ChatHistoryMessage[] }>("chat.history", {
      sessionKey,
      limit: 20,
      maxChars: 40_000,
    });
    const summary = latestAssistantText(history?.messages ?? []);
    if (!summary) throw new Error("Summary agent produced no visible summary");
    const stored = await writeConversationSummary({
      shopId: input.shopId,
      conversationId: input.conversationId,
      cursor,
      summary,
      messageCount: messages.length,
      sessionKey,
      runId,
    });
    if (!stored) throw new Error("Failed to store generated summary");
    return stored;
  } finally {
    openClawConnector.request("sessions.delete", {
      key: sessionKey,
      deleteTranscript: true,
      emitLifecycleHooks: false,
    }).catch((err) => {
      log.warn("Failed to delete temporary CS summary session", {
        sessionKey,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}
