import { describe, expect, it, vi, beforeEach } from "vitest";

const files = new Map<string, string>();

vi.mock("@rivonclaw/core/node", async (importOriginal) => ({
  ...await importOriginal<typeof import("@rivonclaw/core/node")>(),
  resolveCredentialsDir: () => "/tmp/rivonclaw-cs-cursor-test",
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    promises: {
      readFile: vi.fn(async (path: string) => {
        const value = files.get(path);
        if (value == null) {
          const err = new Error("not found") as NodeJS.ErrnoException;
          err.code = "ENOENT";
          throw err;
        }
        return value;
      }),
      writeFile: vi.fn(async (path: string, value: string) => {
        files.set(path, value);
      }),
      mkdir: vi.fn(async () => undefined),
    },
  };
});

const {
  advanceOpenClawSessionCursor,
  compareMessageCursor,
  readConversationSummary,
  readOpenClawSessionCursor,
  writeConversationSummary,
} = await import("./cs-session-cursor-store.js");

describe("cs-session-cursor-store", () => {
  beforeEach(() => {
    files.clear();
  });

  it("orders numeric message indexes without lexicographic regression", () => {
    expect(compareMessageCursor({ messageIndex: "10" }, { messageIndex: "9" })).toBeGreaterThan(0);
    expect(compareMessageCursor({ messageIndex: "9" }, { messageIndex: "10" })).toBeLessThan(0);
  });

  it("advances OpenClaw session cursor without allowing stale dispatches to move it backward", async () => {
    await advanceOpenClawSessionCursor({
      shopId: "shop-1",
      conversationId: "conv-1",
      cursor: { messageId: "m-10", messageIndex: "10", createTime: 100 },
      sessionKey: "cs:tiktok:conv-1",
      runId: "run-newer",
    });

    await advanceOpenClawSessionCursor({
      shopId: "shop-1",
      conversationId: "conv-1",
      cursor: { messageId: "m-9", messageIndex: "9", createTime: 99 },
      sessionKey: "cs:tiktok:conv-1",
      runId: "run-stale",
    });

    const cursor = await readOpenClawSessionCursor({
      shopId: "shop-1",
      conversationId: "conv-1",
    });
    expect(cursor).toMatchObject({
      messageId: "m-10",
      messageIndex: "10",
      createTime: 100,
      runId: "run-newer",
    });
  });

  it("stores summaries and prunes records older than 3 years", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T00:00:00.000Z"));
    try {
      await writeConversationSummary({
        shopId: "shop-1",
        conversationId: "conv-1",
        cursor: { messageId: "m-10", messageIndex: "10", createTime: 100 },
        summary: "Buyer asked about shipping. Staff promised an update.",
        messageCount: 10,
        sessionKey: "agent:main:cs-summary:conv-1",
        runId: "run-summary",
      });

      expect(await readConversationSummary({ shopId: "shop-1", conversationId: "conv-1" })).toMatchObject({
        summary: "Buyer asked about shipping. Staff promised an update.",
        messageIndex: "10",
        messageCount: 10,
      });

      vi.setSystemTime(new Date("2029-05-22T00:00:00.000Z"));

      expect(await readConversationSummary({ shopId: "shop-1", conversationId: "conv-1" })).toBeUndefined();
      expect(await readOpenClawSessionCursor({ shopId: "shop-1", conversationId: "conv-1" })).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
