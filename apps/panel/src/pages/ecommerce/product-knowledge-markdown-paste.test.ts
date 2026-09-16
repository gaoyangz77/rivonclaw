import { describe, expect, it } from "vitest";
import { looksLikeMarkdown } from "./product-knowledge-markdown-paste.js";

describe("looksLikeMarkdown", () => {
  it.each([
    ["a heading", "## 使用说明\n\n先摇匀再使用。"],
    ["a bullet list", "- 每日一次\n- 饭后服用"],
    ["an asterisk list", "* first\n* second"],
    ["an ordered list", "1. 打开包装\n2. 取出一包"],
    ["a blockquote", "> 请勿与热水同服"],
    ["a fenced code block", "```\nconfig\n```"],
    ["a thematic break", "上半部分\n\n---\n\n下半部分"],
    ["a table", "| 规格 | 数量 |\n| --- | --- |\n| 30 包 | 1 盒 |"],
    ["bold text", "适合 **乳糖不耐受** 人群"],
    ["a link", "详见 [官网说明](https://example.com/guide)"],
    ["an image", "![正面图](https://example.com/a.png)"],
    ["a media card", '::media{src="media://0123456789abcdef01234567" name="a.png"}'],
    ["markers indented by the source", "  ## Indented heading"],
  ])("renders %s", (_label, text) => {
    expect(looksLikeMarkdown(text)).toBe(true);
  });

  it.each([
    ["empty text", ""],
    ["whitespace", "  \n "],
    ["a plain sentence", "每日一次，饭后服用。"],
    ["prose with a colon", "Note: this ships tomorrow"],
    ["a bare URL", "https://example.com/guide"],
    ["a decimal number", "3.14 is close to pi"],
    ["a hyphenated word at line start", "-free formula"],
    ["an emphasis-looking single asterisk", "5 * 3 = 15"],
    ["rendered list text copied from a web page", "每日一次\n饭后服用\n避光保存"],
  ])("keeps %s literal", (_label, text) => {
    expect(looksLikeMarkdown(text)).toBe(false);
  });
});
