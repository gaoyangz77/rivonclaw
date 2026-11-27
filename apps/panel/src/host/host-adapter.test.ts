import { describe, expect, it } from "vitest";
import { SSE_SNAPSHOT_EVENTS } from "@rivonclaw/core/api-contract";
import {
  HOST_CAPABILITIES,
  HOST_DESKTOP_ONLY_EVENTS,
  HOST_SHARED_EVENTS,
} from "./host-adapter.js";

describe("host event catalogue", () => {
  it("lists each event once, as shared or Desktop-only", () => {
    const all = [...HOST_SHARED_EVENTS, ...HOST_DESKTOP_ONLY_EVENTS];
    expect(new Set(all).size).toBe(all.length);
  });

  it("covers every snapshot frame Desktop's stream announces", () => {
    const known = new Set<string>([...HOST_SHARED_EVENTS, ...HOST_DESKTOP_ONLY_EVENTS]);
    for (const snapshot of SSE_SNAPSHOT_EVENTS) expect(known.has(snapshot)).toBe(true);
  });

  it("has no duplicate capability names", () => {
    expect(new Set(HOST_CAPABILITIES).size).toBe(HOST_CAPABILITIES.length);
  });
});
