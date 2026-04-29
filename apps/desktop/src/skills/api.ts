import { join } from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import AdmZip from "adm-zip";
import { formatError, getApiBaseUrl } from "@rivonclaw/core";
import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { sendJson, parseBody, proxiedFetch, parseSkillFrontmatter, invalidateSkillsSnapshot, getUserSkillsDir } from "../infra/api/route-utils.js";

const log = createLogger("skills-routes");

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
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
  const skillsDir = getUserSkillsDir();
  try {
    let entries: string[];
    try {
      entries = await fs.readdir(skillsDir);
    } catch {
      sendJson(res, 200, { skills: [] });
      return;
    }

    const skills: Array<{ slug: string; name?: string; description?: string; author?: string; version?: string }> = [];
    for (const entry of entries) {
      const entryPath = join(skillsDir, entry);
      const stat = await fs.stat(entryPath);
      if (!stat.isDirectory()) continue;

      let fmMeta: { name?: string; description?: string; author?: string; version?: string } = {};
      try {
        const content = await fs.readFile(join(entryPath, "SKILL.md"), "utf-8");
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
      });
    }
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
    const skillDir = join(skillsDir, body.slug);
    await fs.mkdir(skillDir, { recursive: true });

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

      const zipPath = join(skillDir, `${body.slug}.zip`);
      try {
        await fs.writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(skillDir, true);
      } finally {
        await fs.rm(zipPath, { force: true });
      }
    } else {
      await fs.writeFile(join(skillDir, "SKILL.md"), body.content, "utf-8");
    }

    invalidateSkillsSnapshot();
    sendJson(res, 200, { ok: true });
  } catch (err: unknown) {
    const msg = formatError(err);
    sendJson(res, 200, { ok: false, error: msg });
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
  registry.register(API["skills.writeTemplate"], writeTemplate);
  registry.register(API["skills.delete"], deleteSkill);
  registry.register(API["skills.openFolder"], openFolder);
}
