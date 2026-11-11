import { describe, expect, it } from "vitest";
import { parseOrderSearch, pastedOrderSearch } from "./order-search.js";

describe("parseOrderSearch", () => {
  it("splits a pasted column and typed separators, keeping order and dropping repeats", () => {
    expect(parseOrderSearch(" 576001\n576002，576003; 576001\t576004、576005 ")).toEqual([
      "576001",
      "576002",
      "576003",
      "576004",
      "576005",
    ]);
  });

  it("reads an empty box as no search", () => {
    expect(parseOrderSearch(" , \n")).toEqual([]);
  });
});

describe("pastedOrderSearch", () => {
  it("keeps line breaks as separators", () => {
    expect(parseOrderSearch(pastedOrderSearch("576001\r\n576002\r576003\n"))).toEqual([
      "576001",
      "576002",
      "576003",
    ]);
  });
});
