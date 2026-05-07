import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("gateway:exec-approvals");

const YOLO_POLICY = {
  security: "full",
  ask: "off",
  askFallback: "full",
} as const;

export interface SyncExecApprovalsOptions {
  approvalsPath?: string;
}

function defaultExecApprovalsPath(): string {
  return join(homedir(), ".openclaw", "exec-approvals.json");
}

function readJsonObject(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch (err) {
    log.warn(`Failed to parse exec approvals file at ${filePath}, rewriting managed policy: ${(err as Error).message}`);
    return {};
  }
}

function ensureSocket(
  existing: Record<string, unknown>,
  approvalsPath: string,
): { path: string; token: string } {
  const rawSocket = existing.socket;
  const socket = rawSocket && typeof rawSocket === "object" && !Array.isArray(rawSocket)
    ? rawSocket as Record<string, unknown>
    : {};
  const socketPath = typeof socket.path === "string" && socket.path.trim()
    ? socket.path
    : join(dirname(approvalsPath), "exec-approvals.sock");
  const token = typeof socket.token === "string" && socket.token.trim()
    ? socket.token
    : randomBytes(18).toString("base64url");
  return { path: socketPath, token };
}

function normalizeAgents(existing: Record<string, unknown>): Record<string, unknown> {
  const rawAgents = existing.agents;
  const agents = rawAgents && typeof rawAgents === "object" && !Array.isArray(rawAgents)
    ? rawAgents as Record<string, unknown>
    : {};
  const next: Record<string, unknown> = {};

  for (const [agentId, rawAgent] of Object.entries(agents)) {
    const agent = rawAgent && typeof rawAgent === "object" && !Array.isArray(rawAgent)
      ? rawAgent as Record<string, unknown>
      : {};
    next[agentId] = {
      ...agent,
      ...YOLO_POLICY,
    };
  }

  next["*"] = {
    ...(next["*"] && typeof next["*"] === "object" && !Array.isArray(next["*"])
      ? next["*"] as Record<string, unknown>
      : {}),
    ...YOLO_POLICY,
  };

  return next;
}

/**
 * Keep OpenClaw's host-local exec approval policy aligned with RivonClaw's
 * unattended desktop defaults. OpenClaw combines `tools.exec.*` with this
 * host file and uses the stricter result, so cron/background jobs can still
 * block on Telegram if this file has `ask=on-miss` or `ask=always`.
 */
export function syncExecApprovalsYolo(options: SyncExecApprovalsOptions = {}): string {
  const approvalsPath = options.approvalsPath ?? defaultExecApprovalsPath();
  mkdirSync(dirname(approvalsPath), { recursive: true });

  const existing = readJsonObject(approvalsPath);
  const next = {
    ...existing,
    version: 1,
    socket: ensureSocket(existing, approvalsPath),
    defaults: {
      ...(existing.defaults && typeof existing.defaults === "object" && !Array.isArray(existing.defaults)
        ? existing.defaults as Record<string, unknown>
        : {}),
      ...YOLO_POLICY,
    },
    agents: normalizeAgents(existing),
  };

  writeFileSync(approvalsPath, JSON.stringify(next, null, 2) + "\n", { encoding: "utf-8", mode: 0o600 });
  log.info(`Synced unattended exec approvals policy to ${approvalsPath}`);
  return approvalsPath;
}
