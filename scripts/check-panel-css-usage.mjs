#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const SOURCE_ROOT = join(REPO_ROOT, "apps", "panel", "src");
const FIX = process.argv.includes("--fix");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".html"]);
const THIRD_PARTY_CLASS_PREFIXES = ["mdxeditor-", "recharts-", "epr-"];
const SKIP_DIRECTORIES = new Set(["dist", "node_modules", ".git"]);

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) walk(filePath, files);
    else files.push(filePath);
  }
  return files;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectDynamicClassPrefixes(source) {
  const prefixes = new Set();
  for (const template of source.matchAll(/`([^`]*)`/g)) {
    if (!template[1].includes("${")) continue;
    for (const fragment of template[1].split(/\$\{[^}]*\}/)) {
      for (const token of fragment.split(/\s+/)) {
        if (/^[A-Za-z_-][\w-]*-$/.test(token)) prefixes.add(token);
      }
    }
  }
  return prefixes;
}

function createClassUsage(sourceFiles) {
  const sources = sourceFiles.map((filePath) => readFileSync(filePath, "utf8"));
  const combinedSource = sources.join("\n");
  const dynamicPrefixes = new Set();
  for (const source of sources) {
    for (const prefix of collectDynamicClassPrefixes(source)) dynamicPrefixes.add(prefix);
  }

  return function isClassUsed(className) {
    if (THIRD_PARTY_CLASS_PREFIXES.some((prefix) => className.startsWith(prefix))) return true;
    if ([...dynamicPrefixes].some((prefix) => className.startsWith(prefix))) return true;
    return new RegExp(
      `(^|[^_a-zA-Z0-9-])${escapeRegExp(className)}([^_a-zA-Z0-9-]|$)`,
    ).test(combinedSource);
  };
}

function findBlockEnd(css, openingBrace, limit) {
  let depth = 1;
  let cursor = openingBrace + 1;
  while (cursor < limit && depth > 0) {
    if (css.startsWith("/*", cursor)) {
      const commentEnd = css.indexOf("*/", cursor + 2);
      cursor = commentEnd === -1 ? limit : commentEnd + 2;
      continue;
    }
    if (css[cursor] === '"' || css[cursor] === "'") {
      const quote = css[cursor++];
      while (cursor < limit) {
        if (css[cursor] === "\\") cursor += 2;
        else if (css[cursor++] === quote) break;
      }
      continue;
    }
    if (css[cursor] === "{") depth += 1;
    else if (css[cursor] === "}") depth -= 1;
    cursor += 1;
  }
  return cursor;
}

function collectUnusedRules(css, isClassUsed, start = 0, end = css.length, results = []) {
  let cursor = start;
  let tokenStart = start;

  while (cursor < end) {
    if (css.startsWith("/*", cursor)) {
      const commentEnd = css.indexOf("*/", cursor + 2);
      cursor = commentEnd === -1 ? end : commentEnd + 2;
      if (tokenStart < cursor) tokenStart = cursor;
      continue;
    }
    if (css[cursor] === '"' || css[cursor] === "'") {
      const quote = css[cursor++];
      while (cursor < end) {
        if (css[cursor] === "\\") cursor += 2;
        else if (css[cursor++] === quote) break;
      }
      continue;
    }
    if (css[cursor] === ";") {
      cursor += 1;
      tokenStart = cursor;
      continue;
    }
    if (css[cursor] !== "{") {
      cursor += 1;
      continue;
    }

    const prelude = css.slice(tokenStart, cursor).trim();
    const blockEnd = findBlockEnd(css, cursor, end);
    const closingBrace = blockEnd - 1;
    const isConditionalAtRule = /^@(media|supports|container|layer)\b/.test(prelude);

    if (isConditionalAtRule) {
      collectUnusedRules(css, isClassUsed, cursor + 1, closingBrace, results);
    } else if (!prelude.startsWith("@")) {
      const classes = [
        ...new Set(
          [...prelude.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map(
            (match) => match[1],
          ),
        ),
      ];
      if (classes.length > 0 && classes.every((className) => !isClassUsed(className))) {
        results.push({ start: tokenStart, end: blockEnd, selector: prelude, classes });
      }
    }

    cursor = blockEnd;
    tokenStart = blockEnd;
  }

  return results;
}

function removeRanges(source, ranges) {
  let result = source;
  for (const range of [...ranges].sort((left, right) => right.start - left.start)) {
    result = result.slice(0, range.start) + result.slice(range.end);
  }
  return result.replace(/@(?:media|supports|container|layer)[^{]+\{\s*\}/g, "");
}

const allFiles = walk(SOURCE_ROOT);
const sourceFiles = allFiles.filter((filePath) => SOURCE_EXTENSIONS.has(extname(filePath)));
const cssFiles = allFiles.filter((filePath) => filePath.endsWith(".css"));
const isClassUsed = createClassUsage(sourceFiles);
const violations = [];

for (const cssFile of cssFiles) {
  const css = readFileSync(cssFile, "utf8");
  const unusedRules = collectUnusedRules(css, isClassUsed);
  if (unusedRules.length === 0) continue;

  if (FIX) {
    writeFileSync(cssFile, removeRanges(css, unusedRules));
    console.log(
      `pruned ${unusedRules.length} unused rule(s) from ${relative(REPO_ROOT, cssFile)}`,
    );
    continue;
  }

  for (const rule of unusedRules) {
    violations.push(
      `${relative(REPO_ROOT, cssFile)}: ${rule.selector.replace(/\s+/g, " ").slice(0, 160)}`,
    );
  }
}

if (violations.length > 0) {
  console.error("Unused Panel CSS rules:\n" + violations.join("\n"));
  console.error("\nRemove them, or run `pnpm --filter @rivonclaw/panel css:prune`.");
  process.exit(1);
}

if (!FIX) console.log("Panel CSS usage check passed.");
