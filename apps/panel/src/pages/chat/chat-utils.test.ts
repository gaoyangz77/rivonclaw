import { describe, expect, it } from "vitest";
import {
  cleanMessageText,
  mergeChatMessagesDedup,
  mergeTerminalError,
  parseRawMessages,
} from "./chat-utils.js";

describe("chat-utils media handling", () => {
  it("strips generated MEDIA image path directives from assistant text", () => {
    expect(
      cleanMessageText(
        "Here is the chart.\n\nMEDIA:/Users/example/.rivonclaw/openclaw/workspace/chart.png",
      ),
    ).toBe("Here is the chart.");

    expect(cleanMessageText("MEDIA:/Users/example/.rivonclaw/openclaw/workspace/chart.webp")).toBe(
      "",
    );
  });

  it("parses gateway-managed image URL blocks for display", () => {
    const [message] = parseRawMessages([
      {
        role: "assistant",
        timestamp: 1785189190702,
        content: [
          {
            type: "image",
            url: "/api/chat/media/outgoing/agent%3Amain%3Apanel/attachment/full",
            openUrl: "/api/chat/media/outgoing/agent%3Amain%3Apanel/attachment/full",
            alt: "chart.jpg",
            mimeType: "image/jpeg",
            width: 2048,
            height: 1172,
          },
        ],
      },
    ]);

    expect(message?.images).toEqual([
      {
        data: "",
        url: "/api/chat/media/outgoing/agent%3Amain%3Apanel/attachment/full",
        openUrl: "/api/chat/media/outgoing/agent%3Amain%3Apanel/attachment/full",
        alt: "chart.jpg",
        mimeType: "image/jpeg",
        width: 2048,
        height: 1172,
      },
    ]);
    expect(message?.text).toBe("");
  });

  it("drops local timeout errors once the same run has assistant media", () => {
    const merged = mergeChatMessagesDedup(
      [
        {
          role: "assistant",
          text: "",
          timestamp: 2000,
          idempotencyKey: "run-1:assistant-media",
          images: [
            {
              url: "/api/chat/media/outgoing/session/attachment/full",
              mimeType: "image/png",
            },
          ],
        },
      ],
      [
        {
          role: "assistant",
          text: "⚠ Request timed out.",
          timestamp: 1900,
          idempotencyKey: "run-1:local-error",
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.images).toHaveLength(1);
  });

  it("does not re-append cached terminal errors when history already has run output", () => {
    const messages = [
      {
        role: "assistant" as const,
        text: "",
        timestamp: 2000,
        idempotencyKey: "run-2:assistant-media",
        images: [
          {
            url: "/api/chat/media/outgoing/session/attachment/full",
            mimeType: "image/png",
          },
        ],
      },
    ];

    expect(
      mergeTerminalError(messages, {
        runId: "run-2",
        text: "⚠ Request timed out.",
        timestamp: 1900,
      }),
    ).toEqual(messages);
  });
});
