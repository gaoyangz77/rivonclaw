import { join } from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import AdmZip from "adm-zip";
import { formatError, getApiBaseUrl } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import type { RouteHandler } from "./api-context.js";
import { sendJson, parseBody, proxiedFetch, parseSkillFrontmatter, invalidateSkillsSnapshot, getUserSkillsDir } from "./route-utils.js";

const log = createLogger("panel-server");

export const handleSkillsRoutes: RouteHandler = async (req, res, url, pathname, ctx) => {
  const { vendorDir } = ctx;

  if (pathname === "/api/skills/bundled-slugs" && req.method === "GET") {
    const bundledSkillsDir = join(vendorDir, "skills");
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
    return true;
  }

  if (pathname === "/api/skills/installed" && req.method === "GET") {
    const skillsDir = getUserSkillsDir();
    try {
      let entries: string[];
      try {
        entries = await fs.readdir(skillsDir);
      } catch {
        sendJson(res, 200, { skills: [] });
        return true;
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
    return true;
  }

  if (pathname === "/api/skills/install" && req.method === "POST") {
    const body = (await parseBody(req)) as { slug?: string; lang?: string; meta?: { name?: string; description?: string; author?: string; version?: string } };
    if (!body.slug) {
      sendJson(res, 400, { error: "Missing required field: slug" });
      return true;
    }
    if (body.slug.includes("..") || body.slug.includes("/") || body.slug.includes("\\")) {
      sendJson(res, 400, { error: "Invalid slug" });
      return true;
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
        return true;
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
    return true;
  }

  if (pathname === "/api/skills/write-template" && req.method === "POST") {
    const body = (await parseBody(req)) as { slug?: string; content?: string };
    if (!body.slug || !body.content) {
      sendJson(res, 400, { error: "Missing required fields: slug, content" });
      return true;
    }
    if (body.slug.includes("..") || body.slug.includes("/") || body.slug.includes("\\")) {
      sendJson(res, 400, { error: "Invalid slug" });
      return true;
    }

    try {
      const skillsDir = getUserSkillsDir();
      const skillDir = join(skillsDir, body.slug);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(join(skillDir, "SKILL.md"), body.content, "utf-8");
      invalidateSkillsSnapshot();
      sendJson(res, 200, { ok: true });
    } catch (err: unknown) {
      const msg = formatError(err);
      sendJson(res, 200, { ok: false, error: msg });
    }
    return true;
  }

  if (pathname === "/api/skills/delete" && req.method === "POST") {
    const body = (await parseBody(req)) as { slug?: string };
    if (!body.slug) {
      sendJson(res, 400, { error: "Missing required field: slug" });
      return true;
    }
    if (body.slug.includes("..") || body.slug.includes("/") || body.slug.includes("\\")) {
      sendJson(res, 400, { error: "Invalid slug" });
      return true;
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
    return true;
  }

  if (pathname === "/api/skills/open-folder" && req.method === "POST") {
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
    return true;
  }

  return false;
};
