#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const SOURCE_ROOT = join(REPO_ROOT, "apps", "panel", "src");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIRECTORIES = new Set(["dist", "node_modules", ".git"]);
const SOURCE_CSS_IMPORT = /\bimport\s+(?:(?:[^"';]+?)\s+from\s+)?["']([^"']+\.css)["']/g;
const CSS_IMPORT = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/g;

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) walk(filePath, files);
    else files.push(filePath);
  }
  return files;
}

function normalizeLocalImport(importer, importPath) {
  if (!importPath.startsWith(".")) return null;
  return resolve(dirname(importer), importPath.split(/[?#]/, 1)[0]);
}

function displayPath(filePath) {
  return relative(REPO_ROOT, filePath).replaceAll("\\", "/");
}

const allFiles = walk(SOURCE_ROOT);
const sourceFiles = allFiles.filter((filePath) => SOURCE_EXTENSIONS.has(extname(filePath)));
const cssFiles = allFiles.filter((filePath) => filePath.endsWith(".css"));
const cssFileSet = new Set(cssFiles.map((filePath) => resolve(filePath)));
const roots = new Set();
const graph = new Map(cssFiles.map((filePath) => [resolve(filePath), new Set()]));
const violations = [];

for (const sourceFile of sourceFiles) {
  const source = readFileSync(sourceFile, "utf8");
  SOURCE_CSS_IMPORT.lastIndex = 0;
  for (const match of source.matchAll(SOURCE_CSS_IMPORT)) {
    const importedFile = normalizeLocalImport(sourceFile, match[1]);
    if (!importedFile) continue;
    if (!existsSync(importedFile)) {
      violations.push(
        `Missing CSS import: ${displayPath(sourceFile)} -> ${match[1]}`,
      );
      continue;
    }
    if (!cssFileSet.has(importedFile)) {
      violations.push(
        `CSS import leaves Panel source: ${displayPath(sourceFile)} -> ${match[1]}`,
      );
      continue;
    }
    roots.add(importedFile);
  }
}

let edgeCount = 0;
for (const cssFile of cssFiles) {
  const source = readFileSync(cssFile, "utf8");
  const imports = graph.get(resolve(cssFile));
  const seenImports = new Set();
  CSS_IMPORT.lastIndex = 0;

  for (const match of source.matchAll(CSS_IMPORT)) {
    const importedFile = normalizeLocalImport(cssFile, match[1]);
    if (!importedFile) continue;
    if (!existsSync(importedFile)) {
      violations.push(`Missing CSS import: ${displayPath(cssFile)} -> ${match[1]}`);
      continue;
    }
    if (!cssFileSet.has(importedFile)) {
      violations.push(
        `CSS import leaves Panel source: ${displayPath(cssFile)} -> ${match[1]}`,
      );
      continue;
    }
    if (seenImports.has(importedFile)) {
      violations.push(`Duplicate CSS import in ${displayPath(cssFile)}: ${match[1]}`);
      continue;
    }
    seenImports.add(importedFile);
    imports.add(importedFile);
    edgeCount += 1;
  }
}

const state = new Map();
const reachable = new Set();

function visit(filePath, stack = []) {
  const currentState = state.get(filePath);
  if (currentState === "done") return;
  if (currentState === "visiting") {
    const cycleStart = stack.indexOf(filePath);
    const cycle = [...stack.slice(cycleStart), filePath].map(displayPath).join(" -> ");
    violations.push(`CSS import cycle: ${cycle}`);
    return;
  }

  state.set(filePath, "visiting");
  reachable.add(filePath);
  for (const importedFile of graph.get(filePath) ?? []) {
    visit(importedFile, [...stack, filePath]);
  }
  state.set(filePath, "done");
}

for (const root of roots) visit(root);

for (const cssFile of cssFileSet) {
  if (!reachable.has(cssFile)) {
    violations.push(
      `Unreachable CSS file: ${displayPath(cssFile)} is not loaded by TS/TSX or another CSS file.`,
    );
  }
}

if (violations.length > 0) {
  console.error(`Panel CSS graph violations:\n${violations.join("\n")}`);
  process.exit(1);
}

console.log(
  `Panel CSS graph check passed (${cssFiles.length} files, ${edgeCount} CSS imports, ${roots.size} source roots).`,
);
