/**
 * Tests for parseRawMessages — specifically the expired image placeholder
 * injection when the gateway strips image data from history.
 */
import { describe, it, expect } from "vitest";
import { parseRawMessages, IMAGE_EXPIRED_PLACEHOLDER } from "../../src/pages/chat/chat-utils.js";

describe("parseRawMessages — stripped image handling", () => {
  it("appends expired placeholder when content has image blocks with empty data", () => {
    const raw = [
      {
        role: "user" as const,
        content: [
          { type: "text", text: "hello" },
          { type: "image", data: "", mimeType: "image/png" },
        ],
        timestamp: 1000,
      },
    ];

    const result = parseRawMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("hello");
    expect(result[0].text).toContain(IMAGE_EXPIRED_PLACEHOLDER);
    // No images should be extracted (data is empty)
    expect(result[0].images).toBeUndefined();
  });

  it("does not append expired placeholder when image blocks have valid data", () => {
    const raw = [
      {
        role: "user" as const,
        content: [
          { type: "text", text: "hello" },
          { type: "image", data: "base64data", mimeType: "image/png" },
        ],
        timestamp: 2000,
      },
    ];

    const result = parseRawMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].text).not.toContain(IMAGE_EXPIRED_PLACEHOLDER);
    expect(result[0].images).toHaveLength(1);
    expect(result[0].images![0].data).toBe("base64data");
  });

  it("creates message entry for image-only content with stripped blocks (not skipped)", () => {
    const raw = [
      {
        role: "user" as const,
        content: [
          { type: "image", data: "" },
        ],
        timestamp: 3000,
      },
    ];

    const result = parseRawMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(IMAGE_EXPIRED_PLACEHOLDER);
    expect(result[0].images).toBeUndefined();
  });

  it("does not append expired placeholder when content has no image blocks", () => {
    const raw = [
      {
        role: "user" as const,
        content: [{ type: "text", text: "just text" }],
        timestamp: 4000,
      },
    ];

    const result = parseRawMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("just text");
    expect(result[0].text).not.toContain(IMAGE_EXPIRED_PLACEHOLDER);
  });

  it("appends expired placeholder for assistant messages with stripped images", () => {
    const raw = [
      {
        role: "assistant" as const,
        content: [
          { type: "text", text: "here is the image" },
          { type: "image", data: "" },
        ],
        timestamp: 5000,
      },
    ];

    const result = parseRawMessages(raw);
    // First entry should be the text+placeholder message
    const textMsg = result.find((m) => m.role === "assistant" && m.text.includes("here is the image"));
    expect(textMsg).toBeDefined();
    expect(textMsg!.text).toContain(IMAGE_EXPIRED_PLACEHOLDER);
  });
});
