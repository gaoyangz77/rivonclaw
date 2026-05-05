#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const [versionArg, outputPath] = process.argv.slice(2);
const version =
  versionArg ||
  JSON.parse(await readFile(path.join(repoRoot, "apps/desktop/package.json"), "utf8")).version;

if (!version || version === "0.0.0") {
  throw new Error("Release version is missing or still 0.0.0.");
}

const changelog = JSON.parse(await readFile(path.join(repoRoot, "apps/desktop/changelog.json"), "utf8"));
const entry = changelog.find((item) => item.version === version);

if (!entry) {
  throw new Error(
    `No changelog entry found for version ${version}. Add it to apps/desktop/changelog.json before publishing.`,
  );
}

if (
  !Array.isArray(entry.en) ||
  entry.en.length === 0 ||
  !Array.isArray(entry.zh) ||
  entry.zh.length === 0
) {
  throw new Error(`Changelog entry ${version} must include non-empty en and zh arrays.`);
}

const installationNotes = await readFile(path.join(repoRoot, ".github/RELEASE_BODY.md"), "utf8");
const body = [
  "## What's New",
  "",
  ...entry.en.map((line) => `- ${line}`),
  "",
  "## 更新内容",
  "",
  ...entry.zh.map((line) => `- ${line}`),
  "",
  "---",
  "",
  installationNotes.trimEnd(),
  "",
].join("\n");

if (outputPath) {
  await writeFile(outputPath, body);
} else {
  process.stdout.write(body);
}
