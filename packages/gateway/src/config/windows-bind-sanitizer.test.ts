import { describe, it, expect } from "vitest";
import {
  windowsPathToPosix,
  normalizeBindSpec,
  sanitizeWindowsBinds,
} from "./windows-bind-sanitizer.js";

describe("windowsPathToPosix", () => {
  it("converts drive-letter backslash paths", () => {
    expect(windowsPathToPosix("E:\\OpenClaw")).toBe("/e/OpenClaw");
    expect(windowsPathToPosix("C:\\Users\\kai\\workspace")).toBe(
      "/c/Users/kai/workspace",
    );
  });

  it("converts drive-letter forward-slash paths", () => {
    expect(windowsPathToPosix("E:/OpenClaw")).toBe("/e/OpenClaw");
  });

  it("handles drive root (trailing backslash)", () => {
    expect(windowsPathToPosix("D:\\")).toBe("/d");
  });

  it("handles drive root (trailing forward slash)", () => {
    expect(windowsPathToPosix("D:/")).toBe("/d");
  });

  it("lowercases the drive letter", () => {
    expect(windowsPathToPosix("C:\\Foo")).toBe("/c/Foo");
    expect(windowsPathToPosix("c:\\Foo")).toBe("/c/Foo");
  });

  it("passes POSIX paths through unchanged", () => {
    expect(windowsPathToPosix("/home/user/docs")).toBe("/home/user/docs");
    expect(windowsPathToPosix("/var/log")).toBe("/var/log");
  });

  it("passes relative paths through unchanged", () => {
    expect(windowsPathToPosix("relative/path")).toBe("relative/path");
  });
});

describe("normalizeBindSpec", () => {
  it("converts Windows bind spec to POSIX", () => {
    expect(normalizeBindSpec("E:\\OpenClaw:E:\\OpenClaw:rw")).toBe(
      "/e/OpenClaw:/e/OpenClaw:rw",
    );
  });

  it("converts drive-root bind spec", () => {
    expect(normalizeBindSpec("D:\\:D:\\:rw")).toBe("/d:/d:rw");
  });

  it("handles mixed host Windows / container POSIX", () => {
    expect(normalizeBindSpec("C:\\Users\\kai:/workspace:ro")).toBe(
      "/c/Users/kai:/workspace:ro",
    );
  });

  it("passes POSIX bind specs through unchanged", () => {
    expect(normalizeBindSpec("/home/user:/home/user:ro")).toBe(
      "/home/user:/home/user:ro",
    );
  });

  it("handles bind spec without options", () => {
    expect(normalizeBindSpec("E:\\Data:E:\\Data")).toBe("/e/Data:/e/Data");
  });

  it("handles empty and whitespace strings", () => {
    expect(normalizeBindSpec("")).toBe("");
    expect(normalizeBindSpec("  ")).toBe("");
  });
});

describe("sanitizeWindowsBinds", () => {
  it("converts an array of Windows bind specs", () => {
    expect(
      sanitizeWindowsBinds([
        "E:\\OpenClaw:E:\\OpenClaw:rw",
        "D:\\:D:\\:rw",
      ]),
    ).toEqual(["/e/OpenClaw:/e/OpenClaw:rw", "/d:/d:rw"]);
  });

  it("returns undefined for non-array input", () => {
    expect(sanitizeWindowsBinds(undefined)).toBeUndefined();
    expect(sanitizeWindowsBinds("not-an-array")).toBeUndefined();
  });

  it("filters out non-string entries", () => {
    expect(sanitizeWindowsBinds(["/a:/a:ro", 42, null])).toEqual([
      "/a:/a:ro",
    ]);
  });

  it("leaves POSIX specs unchanged", () => {
    const posix = ["/home/user:/home/user:ro", "/var/log:/var/log:ro"];
    expect(sanitizeWindowsBinds(posix)).toEqual(posix);
  });
});
