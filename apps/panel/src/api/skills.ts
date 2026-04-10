import { fetchJson, cachedFetch, invalidateCache } from "./client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";

// --- Skills Marketplace (local operations) ---

export interface InstalledSkill {
  slug: string;
  name: string;
  description: string;
  author: string;
  version: string;
  filePath: string;
  installedAt: string;
}

export interface SkillCategory {
  id: string;
  name_en: string;
  name_zh: string;
  count: number;
}

export async function fetchInstalledSkills(): Promise<InstalledSkill[]> {
  return cachedFetch("installed-skills", async () => {
    const data = await fetchJson<{ skills: InstalledSkill[] }>(clientPath(API["skills.installed"]));
    return data.skills;
  }, 5000);
}

export async function installSkill(
  slug: string,
  lang?: string,
  meta?: { name?: string; description?: string; author?: string; version?: string },
): Promise<{ ok: boolean; error?: string }> {
  const result = await fetchJson<{ ok: boolean; error?: string }>(clientPath(API["skills.install"]), {
    method: "POST",
    body: JSON.stringify({ slug, lang, meta }),
  });
  invalidateCache("installed-skills");
  return result;
}

export async function writeSkillTemplate(slug: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const result = await fetchJson<{ ok: boolean; error?: string }>(clientPath(API["skills.writeTemplate"]), {
    method: "POST",
    body: JSON.stringify({ slug, content }),
  });
  invalidateCache("installed-skills");
  return result;
}

export async function deleteSkill(slug: string): Promise<{ ok: boolean; error?: string }> {
  const result = await fetchJson<{ ok: boolean; error?: string }>(clientPath(API["skills.delete"]), {
    method: "POST",
    body: JSON.stringify({ slug }),
  });
  invalidateCache("installed-skills");
  return result;
}

export async function openSkillsFolder(): Promise<void> {
  await fetchJson(clientPath(API["skills.openFolder"]), { method: "POST" });
}

export async function fetchBundledSlugs(): Promise<Set<string>> {
  return cachedFetch("bundled-slugs", async () => {
    const data = await fetchJson<{ slugs: string[] }>(clientPath(API["skills.bundledSlugs"]));
    return new Set(data.slugs);
  }, 60_000);
}
