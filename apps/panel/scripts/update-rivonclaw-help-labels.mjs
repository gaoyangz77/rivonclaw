#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";
import { createServer } from "vite";

const panelRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(panelRoot, "../..");
const referencesDir = resolve(repoRoot, "server/preset-skills/rivonclaw-help/references");
const supportedLanguages = ["en", "zh", "de", "es", "fr", "id", "it", "th"];
const supportedHelpLanguages = ["en", "zh"];
const uiMarkerPattern = /`i18n:([A-Za-z0-9_.-]+)`/g;
const helpMarkerPattern = /`help:([A-Za-z0-9_.-]+)`/g;

function readNestedValue(resource, key) {
  return key.split(".").reduce((value, segment) => {
    if (!value || typeof value !== "object") return undefined;
    return value[segment];
  }, resource);
}

function collectKeys(content, pattern) {
  return [...new Set([...content.matchAll(pattern)].map((match) => match[1]))];
}

function sameStringSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

async function loadPages() {
  const entries = await readdir(referencesDir);
  const markdownFiles = entries.filter((name) => name.endsWith(".md")).sort();
  const expectedBundles = new Set(
    markdownFiles.map((name) => `${basename(name, ".md")}.i18n.json`),
  );
  const orphanBundles = entries
    .filter((name) => name.endsWith(".i18n.json") && !expectedBundles.has(name))
    .sort();
  if (orphanBundles.length) {
    throw new Error(`Orphan page i18n bundles: ${orphanBundles.join(", ")}`);
  }

  return Promise.all(
    markdownFiles.map(async (markdownFile) => {
      const stem = basename(markdownFile, ".md");
      const bundleFile = `${stem}.i18n.json`;
      const bundlePath = resolve(referencesDir, bundleFile);
      const [markdown, bundleText] = await Promise.all([
        readFile(resolve(referencesDir, markdownFile), "utf8"),
        readFile(bundlePath, "utf8"),
      ]);
      return {
        markdownFile,
        bundleFile,
        bundlePath,
        markdown,
        bundleText,
        bundle: JSON.parse(bundleText),
      };
    }),
  );
}

function validateAndNormalizeHelp(page, allHelpKeys) {
  const topLevelKeys = Object.keys(page.bundle).sort();
  if (JSON.stringify(topLevelKeys) !== JSON.stringify(["help", "ui"])) {
    throw new Error(`${page.bundleFile} must contain exactly the top-level keys: help, ui`);
  }

  const referenced = collectKeys(page.markdown, helpMarkerPattern);
  const mapping = page.bundle.help;
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw new Error(`${page.bundleFile} help must be an object`);
  }

  const available = Object.keys(mapping);
  const missing = referenced.filter((key) => !available.includes(key));
  const unused = available.filter((key) => !referenced.includes(key));
  if (missing.length || unused.length) {
    throw new Error(
      [
        missing.length ? `${page.bundleFile} missing help keys: ${missing.join(", ")}` : "",
        unused.length ? `${page.bundleFile} unused help keys: ${unused.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const normalized = {};
  for (const key of referenced) {
    if (allHelpKeys.has(key)) {
      throw new Error(`Help key ${key} is referenced by more than one page`);
    }
    allHelpKeys.add(key);

    const translations = mapping[key];
    const languages = Object.keys(translations ?? {}).sort();
    if (JSON.stringify(languages) !== JSON.stringify([...supportedHelpLanguages].sort())) {
      throw new Error(
        `Help content ${key} must contain exactly: ${supportedHelpLanguages.join(", ")}`,
      );
    }
    for (const language of supportedHelpLanguages) {
      if (typeof translations[language] !== "string" || !translations[language].trim()) {
        throw new Error(`Missing help-content translation for ${key} in ${language}`);
      }
    }

    const englishUiKeys = collectKeys(translations.en, uiMarkerPattern);
    const chineseUiKeys = collectKeys(translations.zh, uiMarkerPattern);
    if (!sameStringSet(englishUiKeys, chineseUiKeys)) {
      throw new Error(
        `Help content ${key} must reference the same i18n keys in en and zh\n` +
          `en: ${englishUiKeys.sort().join(", ")}\n` +
          `zh: ${chineseUiKeys.sort().join(", ")}`,
      );
    }
    normalized[key] = translations;
  }
  return normalized;
}

function buildUiMapping(page, help, languageResources) {
  const keys = collectKeys(`${page.markdown}\n${JSON.stringify(help)}`, uiMarkerPattern).sort();
  const mapping = {};
  for (const key of keys) {
    mapping[key] = {};
    for (const language of supportedLanguages) {
      const value = readNestedValue(languageResources[language]?.translation, key);
      if (typeof value !== "string" || !value.trim()) {
        throw new Error(`Missing string translation for ${key} in ${language}`);
      }
      mapping[key][language] = value;
    }
  }
  return mapping;
}

async function buildExpectedBundles(pages) {
  const vite = await createServer({
    root: panelRoot,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });

  try {
    const { LANGUAGE_RESOURCES, SUPPORTED_LANGUAGE_CODES } =
      await vite.ssrLoadModule("/src/i18n/languages.ts");
    const actualLanguages = [...SUPPORTED_LANGUAGE_CODES];
    if (JSON.stringify(actualLanguages) !== JSON.stringify(supportedLanguages)) {
      throw new Error(
        `Supported language set changed: expected ${supportedLanguages.join(", ")}, got ${actualLanguages.join(", ")}`,
      );
    }

    const allHelpKeys = new Set();
    return pages.map((page) => {
      const help = validateAndNormalizeHelp(page, allHelpKeys);
      const ui = buildUiMapping(page, help, LANGUAGE_RESOURCES);
      return {
        page,
        expected: `${JSON.stringify({ help, ui }, null, 2)}\n`,
      };
    });
  } finally {
    await vite.close();
  }
}

const pages = await loadPages();
const expectedBundles = await buildExpectedBundles(pages);
if (process.argv.includes("--check")) {
  const stale = expectedBundles
    .filter(({ page, expected }) => page.bundleText !== expected)
    .map(({ page }) => page.bundleFile);
  if (stale.length) {
    throw new Error(
      `RivonClaw help page bundles are stale: ${stale.join(", ")}. Run the help-labels command.`,
    );
  }
  console.log(`rivonclaw-help content and UI labels are current across ${pages.length} pages`);
} else {
  await Promise.all(
    expectedBundles.map(({ page, expected }) => writeFile(page.bundlePath, expected, "utf8")),
  );
  console.log(`Updated rivonclaw-help content and UI labels across ${pages.length} pages`);
}
