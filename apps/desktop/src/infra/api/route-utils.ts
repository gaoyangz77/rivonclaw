import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createLogger } from "@rivonclaw/logger";
import { resolveUserSkillsDir, resolveAgentSessionsDir } from "@rivonclaw/core/node";
import { proxyNetwork } from "../proxy/proxy-aware-network.js";

const log = createLogger("panel-server");

/** Directory where user-installed skills are stored.
 *  Lazy function (not a constant) because OPENCLAW_STATE_DIR may be set
 *  after module import (see main.ts migration override at line 277). */
export function getUserSkillsDir(): string {
  return resolveUserSkillsDir();
}

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

export function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw.length > 0 ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Fetch through local proxy router so GFW-blocked APIs (Telegram, LINE, etc.)
 * can reach their targets via the system proxy.
 *
 * The port parameter is kept for call-site compatibility but is ignored —
 * proxyNetwork manages the proxy-router port centrally.
 */
export async function proxiedFetch(proxyRouterPort: number, url: string | URL, init?: RequestInit): Promise<Response> {
  return proxyNetwork.fetch(url, init);
}

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Extracts name, description, author, version from between --- delimiters.
 */
export function parseSkillFrontmatter(content: string): { name?: string; description?: string; author?: string; version?: string } {
  const lines = content.split("\n");
  let fmStart = -1;
  let fmEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() === "---") {
      if (fmStart === -1) {
        fmStart = i;
      } else {
        fmEnd = i;
        break;
      }
    }
  }
  if (fmStart === -1 || fmEnd === -1) return {};

  const result: { name?: string; description?: string; author?: string; version?: string } = {};
  for (let i = fmStart + 1; i < fmEnd; i++) {
    const line = lines[i]!;
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (!m) continue;
    const key = m[1]!.trim();
    const val = m[2]!.trim();
    if (key === "name") result.name = val;
    else if (key === "description") result.description = val;
    else if (key === "author") result.author = val;
    else if (key === "version") result.version = val;
  }
  return result;
}

/**
 * Invalidate the cached skills snapshot in the gateway session store.
 */
export function invalidateSkillsSnapshot(): void {
  try {
    const storePath = join(resolveAgentSessionsDir(), "sessions.json");
    if (!existsSync(storePath)) return;
    const store = JSON.parse(readFileSync(storePath, "utf-8")) as Record<string, Record<string, unknown>>;
    let changed = false;
    for (const entry of Object.values(store)) {
      if (entry.skillsSnapshot) {
        delete entry.skillsSnapshot;
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(storePath, JSON.stringify(store, null, 2), "utf-8");
      log.info("Cleared cached skillsSnapshot from session store");
    }
  } catch (err) {
    log.warn("Failed to invalidate skills snapshot:", err);
  }
}
