import { describe, expect, it } from "vitest";
import {
  appendCursorPageBuffer,
  emptyCursorPageBuffer,
  replaceCursorPageBufferFirstPage,
} from "./cursor-page-buffer.js";

type Row = { id: string; state: string };
const key = (row: Row) => row.id;
const rows = (start: number, end: number, state = "original"): Row[] =>
  Array.from({ length: end - start + 1 }, (_, index) => ({
    id: `row-${start + index}`,
    state,
  }));

describe("cursor page buffer", () => {
  it("keeps the advanced cursor and loaded tail when a poll refreshes page 1", () => {
    const queryKey = "realtime:all";
    const first = replaceCursorPageBufferFirstPage(
      emptyCursorPageBuffer<Row>(queryKey),
      queryKey,
      { items: rows(1, 20), nextCursor: "after-20" },
      key,
    );
    const second = appendCursorPageBuffer(
      first,
      queryKey,
      { items: rows(21, 40), nextCursor: "after-40" },
      key,
    );
    const third = appendCursorPageBuffer(
      second,
      queryKey,
      { items: rows(41, 60), nextCursor: "after-60" },
      key,
    );
    const refreshed = replaceCursorPageBufferFirstPage(
      third,
      queryKey,
      {
        items: [{ id: "row-new", state: "fresh" }, ...rows(1, 19, "refreshed")],
        nextCursor: "page-1-cursor-must-not-win",
      },
      key,
    );

    expect(refreshed.items).toHaveLength(61);
    expect(refreshed.items.slice(0, 3)).toEqual([
      { id: "row-new", state: "fresh" },
      { id: "row-1", state: "refreshed" },
      { id: "row-2", state: "refreshed" },
    ]);
    expect(refreshed.items.at(-1)?.id).toBe("row-60");
    expect(refreshed.nextCursor).toBe("after-60");
  });

  it("starts from the new first page when the query filters change", () => {
    const oldKey = "realtime:all";
    const loaded = appendCursorPageBuffer(
      replaceCursorPageBufferFirstPage(
        emptyCursorPageBuffer<Row>(oldKey),
        oldKey,
        { items: rows(1, 20), nextCursor: "after-20" },
        key,
      ),
      oldKey,
      { items: rows(21, 40), nextCursor: "after-40" },
      key,
    );

    expect(
      replaceCursorPageBufferFirstPage(
        loaded,
        "history:all",
        { items: [{ id: "history-1", state: "fresh" }], nextCursor: "history-cursor" },
        key,
      ),
    ).toEqual({
      queryKey: "history:all",
      items: [{ id: "history-1", state: "fresh" }],
      nextCursor: "history-cursor",
      loadedMore: false,
    });
  });
});
