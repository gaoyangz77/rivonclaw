import { join } from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { formatError, getApiBaseUrl, routeFirstPartyUrl } from "@rivonclaw/core";
import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { sendJson, parseBody, proxiedFetch, parseSkillFrontmatter, invalidateSkillsSnapshot, getUserSkillsDir } from "../infra/api/route-utils.js";

const log = createLogger("skills-routes");

function hashSkillContent(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isSafeSlug(value: string): boolean {
  return Boolean(value) && !value.includes("..") && !value.includes("/") && !value.includes("\\");
}

interface InstalledSkillSnapshot {
  slug: string;
  name?: string;
  description?: string;
  author?: string;
  version?: string;
  sha256?: string;
}

interface OfficialPresetSkillManifestItem {
  serviceId?: string;
  slug: string;
  localSlug?: string;
  displayName?: string;
  description?: string;
  version: string;
  contentKind?: string;
  zipFileName?: string;
  downloadUrl: string;
}

interface OfficialPresetSkillManifest {
  schemaVersion: number;
  generatedAt?: string;
  skills: OfficialPresetSkillManifestItem[];
}

interface OfficialPresetSkillSyncResult {
  installed: number;
  updated: number;
  current: number;
  skippedCustom: number;
  failed: number;
}

async function readInstalledSkills(): Promise<InstalledSkillSnapshot[]> {
  const skillsDir = getUserSkillsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return [];
  }

  const skills: InstalledSkillSnapshot[] = [];
  for (const entry of entries) {
    const entryPath = join(skillsDir, entry);
    const stat = await fs.stat(entryPath);
    if (!stat.isDirectory()) continue;

    let fmMeta: { name?: string; description?: string; author?: string; version?: string } = {};
    let sha256: string | undefined;
    try {
      const content = await fs.readFile(join(entryPath, "SKILL.md"), "utf-8");
      sha256 = hashSkillContent(content);
      fmMeta = parseSkillFrontmatter(content);
    } catch { /* SKILL.md missing or unreadable */ }

    let installMeta: { name?: string; description?: string; author?: string; version?: string } = {};
    try {
      installMeta = JSON.parse(await fs.readFile(join(entryPath, "_meta.json"), "utf-8"));
    } catch { /* _meta.json missing */ }

    skills.push({
      slug: entry,
      name: installMeta.name || fmMeta.name || entry,
      description: installMeta.description || fmMeta.description,
      author: installMeta.author || fmMeta.author,
      version: installMeta.version || fmMeta.version,
      sha256,
    });
  }
  return skills;
}

function normalizeOfficialPresetManifest(raw: unknown): OfficialPresetSkillManifest {
  const manifest = raw as Partial<OfficialPresetSkillManifest>;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.skills)) {
    throw new Error("Invalid official preset skill manifest");
  }
  return {
    schemaVersion: 1,
    generatedAt: typeof manifest.generatedAt === "string" ? manifest.generatedAt : undefined,
    skills: manifest.skills.filter((item): item is OfficialPresetSkillManifestItem => {
      return Boolean(
        item &&
        typeof item.slug === "string" &&
        typeof item.version === "string" &&
        typeof item.downloadUrl === "string",
      );
    }),
  };
}

async function fetchOfficialPresetManifest(ctx: ApiContext): Promise<OfficialPresetSkillManifest> {
  const manifestUrl = routeFirstPartyUrl("https://www.rivonclaw.com/skills/manifest.json").toString();
  const response = await proxiedFetch(ctx.proxyRouterPort, manifestUrl, {
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Manifest returned ${response.status}: ${errText}`);
  }
  return normalizeOfficialPresetManifest(await response.json());
}

async function installOfficialPresetZip(
  ctx: ApiContext,
  item: OfficialPresetSkillManifestItem,
): Promise<void> {
  const localSlug = item.localSlug || item.slug;
  if (!isSafeSlug(localSlug)) {
    throw new Error(`Invalid localSlug: ${localSlug}`);
  }
  const downloadUrl = parseHttpUrl(routeFirstPartyUrl(item.downloadUrl).toString());
  if (!downloadUrl) {
    throw new Error(`Invalid downloadUrl for ${localSlug}`);
  }

  const response = await proxiedFetch(ctx.proxyRouterPort, downloadUrl, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ZIP returned ${response.status}: ${errText}`);
  }

  const skillsDir = getUserSkillsDir();
  await fs.mkdir(skillsDir, { recursive: true });
  const tempDir = join(skillsDir, `.official-preset-${localSlug}-${Date.now()}`);
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
    for (const entry of zip.getEntries()) {
      const entryName = entry.entryName.replace(/\\/g, "/");
      if (!entryName.startsWith(`${localSlug}/`)) {
        throw new Error(`ZIP for ${localSlug} contains unexpected entry: ${entry.entryName}`);
      }
    }
    zip.extractAllTo(tempDir, true);

    const extractedSkillDir = join(tempDir, localSlug);
    await fs.access(join(extractedSkillDir, "SKILL.md"));
    await fs.rm(join(skillsDir, localSlug), { recursive: true, force: true });
    await fs.rename(extractedSkillDir, join(skillsDir, localSlug));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

// ── GET /api/skills/bundled-slugs ──

const bundledSlugs: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  const bundledSkillsDir = join(ctx.vendorDir, "skills");
  try {
    const entries = await fs.readdir(bundledSkillsDir);
    const slugs: string[] = [];
    for (const entry of entries) {
      const stat = await fs.stat(join(bundledSkillsDir, entry));
      if (stat.isDirectory()) slugs.push(entry);
    }
    sendJson(res, 200, { slugs });
  } catch {
    sendJson(res, 200, { slugs: [] });
  }
};

// ── GET /api/skills/installed ──

const installed: EndpointHandler = async (_req, res, _url, _params, _ctx) => {
  try {
    const skills = await readInstalledSkills();
    sendJson(res, 200, { skills });
  } catch (err: unknown) {
    const msg = formatError(err);
    sendJson(res, 500, { error: msg });
  }
};

// ── POST /api/skills/install ──

const install: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  const body = (await parseBody(req)) as { slug?: string; lang?: string; meta?: { name?: string; description?: string; author?: string; version?: string } };
  if (!body.slug) {
    sendJson(res, 400, { error: "Missing required field: slug" });
    return;
  }
  if (body.slug.includes("..") || body.slug.includes("/") || body.slug.includes("\\")) {
    sendJson(res, 400, { error: "Invalid slug" });
    return;
  }

  const lang = body.lang ?? "en";
  const apiBase = getApiBaseUrl(lang);
  const downloadUrl = `${apiBase}/api/skills/${encodeURIComponent(body.slug)}/download`;

  try {
    const response = await proxiedFetch(ctx.proxyRouterPort, downloadUrl, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const errText = await response.text();
      sendJson(res, 200, { ok: false, error: `Server returned ${response.status}: ${errText}` });
      return;
    }

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    const skillsDir = getUserSkillsDir();
    const skillDir = join(skillsDir, body.slug);
    await fs.mkdir(skillDir, { recursive: true });

    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(skillDir, true);

    if (body.meta) {
      await fs.writeFile(join(skillDir, "_meta.json"), JSON.stringify(body.meta), "utf-8");
    }

    invalidateSkillsSnapshot();
    sendJson(res, 200, { ok: true });
  } catch (err: unknown) {
    const msg = formatError(err);
    sendJson(res, 200, { ok: false, error: msg });
  }
};

// ── POST /api/skills/write-template ──

const writeTemplate: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  const body = (await parseBody(req)) as { slug?: string; content?: string };
  if (!body.slug || !body.content) {
    sendJson(res, 400, { error: "Missing required fields: slug, content" });
    return;
  }
  if (body.slug.includes("..") || body.slug.includes("/") || body.slug.includes("\\")) {
    sendJson(res, 400, { error: "Invalid slug" });
    return;
  }

  try {
    const skillsDir = getUserSkillsDir();
    await fs.mkdir(skillsDir, { recursive: true });

    const downloadUrl = parseHttpUrl(body.content);
    if (downloadUrl) {
      const response = await proxiedFetch(ctx.proxyRouterPort, downloadUrl, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const errText = await response.text();
        sendJson(res, 200, { ok: false, error: `Server returned ${response.status}: ${errText}` });
        return;
      }

      const zipPath = join(skillsDir, `${body.slug}.zip`);
      try {
        await fs.writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(skillsDir, true);
      } finally {
        await fs.rm(zipPath, { force: true });
      }
    } else {
      const skillDir = join(skillsDir, body.slug);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(join(skillDir, "SKILL.md"), body.content, "utf-8");
    }

    invalidateSkillsSnapshot();
    sendJson(res, 200, { ok: true });
  } catch (err: unknown) {
    const msg = formatError(err);
    sendJson(res, 200, { ok: false, error: msg });
  }
};

// ── POST /api/skills/sync-official-presets ──

const syncOfficialPresets: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  const body = (await parseBody(req).catch(() => ({}))) as { mode?: "safe" | "force" };
  const mode = body.mode === "force" ? "force" : "safe";
  const result: OfficialPresetSkillSyncResult = {
    installed: 0,
    updated: 0,
    current: 0,
    skippedCustom: 0,
    failed: 0,
  };

  try {
    const manifest = await fetchOfficialPresetManifest(ctx);
    const installedSkills = await readInstalledSkills();
    const localBySlug = new Map(installedSkills.map((skill) => [skill.slug, skill]));
    let wroteAny = false;

    for (const item of manifest.skills) {
      const localSlug = item.localSlug || item.slug;
      const localSkill = localBySlug.get(localSlug);
      const shouldInstall = !localSkill;
      const localVersion = localSkill?.version?.trim();
      const shouldSkipCustom = Boolean(localSkill) && !localVersion && mode !== "force";
      const shouldUpdate = Boolean(localSkill) && !shouldSkipCustom && (mode === "force" || localVersion !== item.version);

      if (shouldSkipCustom) {
        result.skippedCustom += 1;
        continue;
      }

      if (!shouldInstall && !shouldUpdate) {
        result.current += 1;
        continue;
      }

      try {
        await installOfficialPresetZip(ctx, item);
        wroteAny = true;
        if (shouldInstall) result.installed += 1;
        if (shouldUpdate) result.updated += 1;
      } catch (err) {
        result.failed += 1;
        log.warn(`Failed to sync official preset skill ${localSlug}:`, err);
      }
    }

    if (wroteAny) {
      invalidateSkillsSnapshot();
    }
    sendJson(res, 200, { ok: result.failed === 0, result });
  } catch (err: unknown) {
    sendJson(res, 200, { ok: false, error: formatError(err), result });
  }
};

// ── POST /api/skills/delete ──

const deleteSkill: EndpointHandler = async (req, res, _url, _params, _ctx) => {
  const body = (await parseBody(req)) as { slug?: string };
  if (!body.slug) {
    sendJson(res, 400, { error: "Missing required field: slug" });
    return;
  }
  if (body.slug.includes("..") || body.slug.includes("/") || body.slug.includes("\\")) {
    sendJson(res, 400, { error: "Invalid slug" });
    return;
  }
  const skillsDir = getUserSkillsDir();
  try {
    await fs.rm(join(skillsDir, body.slug), { recursive: true, force: true });
    invalidateSkillsSnapshot();
    sendJson(res, 200, { ok: true });
  } catch (err: unknown) {
    const msg = formatError(err);
    sendJson(res, 500, { error: msg });
  }
};

// ── POST /api/skills/open-folder ──

const openFolder: EndpointHandler = async (_req, res, _url, _params, _ctx) => {
  const skillsDir = getUserSkillsDir();
  await fs.mkdir(skillsDir, { recursive: true });
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "explorer"
    : "xdg-open";
  execFile(cmd, [skillsDir], (err) => {
    if (err) {
      sendJson(res, 500, { error: err.message });
    } else {
      sendJson(res, 200, { ok: true });
    }
  });
};

// ── Registration ──

export function registerSkillsHandlers(registry: RouteRegistry): void {
  registry.register(API["skills.bundledSlugs"], bundledSlugs);
  registry.register(API["skills.installed"], installed);
  registry.register(API["skills.install"], install);
  registry.register(API["skills.syncOfficialPresets"], syncOfficialPresets);
  registry.register(API["skills.writeTemplate"], writeTemplate);
  registry.register(API["skills.delete"], deleteSkill);
  registry.register(API["skills.openFolder"], openFolder);
}
