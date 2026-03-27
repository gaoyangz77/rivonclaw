import { createLogger } from "@rivonclaw/logger";
import { resolveOpenClawConfigPath, resolveOpenClawStateDir, readExistingConfig, writeChannelAccount, removeChannelAccount } from "@rivonclaw/gateway";
import type { ChannelsStatusSnapshot } from "@rivonclaw/core";
import { DEFAULTS, formatError } from "@rivonclaw/core";
import { resolveCredentialsDir } from "@rivonclaw/core/node";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { sendChannelMessage } from "../channels/channel-senders.js";
import { syncOwnerAllowFrom } from "../auth/owner-sync.js";
import { getRpcClient } from "../gateway/rpc-client-ref.js";
import type { RouteHandler } from "./api-context.js";
import { sendJson, parseBody, proxiedFetch } from "./route-utils.js";

const log = createLogger("panel-server");

// --- Pairing Store Helpers ---

interface PairingRequest {
  id: string;
  code: string;
  createdAt: string;
  lastSeenAt: string;
  meta?: Record<string, string>;
}

interface PairingStore {
  version: number;
  requests: PairingRequest[];
}

interface AllowFromStore {
  version: number;
  allowFrom: string[];
}

function resolvePairingPath(channelId: string): string {
  return join(resolveCredentialsDir(), `${channelId}-pairing.json`);
}

function resolveAllowFromPath(channelId: string, accountId?: string): string {
  const credDir = resolveCredentialsDir();
  const normalized = accountId?.trim().toLowerCase() || "";
  if (normalized) {
    return join(credDir, `${channelId}-${normalized}-allowFrom.json`);
  }
  return join(credDir, `${channelId}-allowFrom.json`);
}

async function readPairingRequests(channelId: string): Promise<PairingRequest[]> {
  try {
    const filePath = resolvePairingPath(channelId);
    const content = await fs.readFile(filePath, "utf-8");
    const data: PairingStore = JSON.parse(content);
    return Array.isArray(data.requests) ? data.requests : [];
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writePairingRequests(channelId: string, requests: PairingRequest[]): Promise<void> {
  const filePath = resolvePairingPath(channelId);
  const data: PairingStore = { version: 1, requests };
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

async function readAllowFromList(channelId: string, accountId?: string): Promise<string[]> {
  try {
    const filePath = resolveAllowFromPath(channelId, accountId);
    const content = await fs.readFile(filePath, "utf-8");
    const data: AllowFromStore = JSON.parse(content);
    return Array.isArray(data.allowFrom) ? data.allowFrom : [];
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeAllowFromList(channelId: string, allowFrom: string[], accountId?: string): Promise<void> {
  const filePath = resolveAllowFromPath(channelId, accountId);
  const data: AllowFromStore = { version: 1, allowFrom };
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/** Read and merge allowFrom entries from all scoped + legacy files for a channel. */
async function readAllAllowFromLists(channelId: string): Promise<string[]> {
  const credentialsDir = resolveCredentialsDir();
  const prefix = `${channelId}-`;
  const suffix = "-allowFrom.json";
  const allEntries = new Set<string>();

  let files: string[];
  try {
    files = await fs.readdir(credentialsDir);
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  for (const file of files) {
    // Match both legacy "{channelId}-allowFrom.json" and scoped "{channelId}-{accountId}-allowFrom.json"
    if (!file.startsWith(prefix) || !file.endsWith(suffix)) continue;

    try {
      const content = await fs.readFile(join(credentialsDir, file), "utf-8");
      const data: AllowFromStore = JSON.parse(content);
      if (Array.isArray(data.allowFrom)) {
        for (const entry of data.allowFrom) allEntries.add(entry);
      }
    } catch {
      // Skip unreadable files
    }
  }

  return [...allEntries];
}

const APPROVAL_MESSAGES = {
  zh: "✅ [RivonClaw] 您的访问已获批准！现在可以开始和我对话了。",
  en: "✅ [RivonClaw] Your access has been approved! You can start chatting now.",
};

export const handleChannelRoutes: RouteHandler = async (req, res, url, pathname, ctx) => {
  const { storage, secretStore, onRuleChange, onProviderChange, onChannelConfigured } = ctx;

  // GET /api/channels/status
  if (pathname === "/api/channels/status" && req.method === "GET") {
    const rpcClient = getRpcClient();

    if (!rpcClient || !rpcClient.isConnected()) {
      sendJson(res, 503, { error: "Gateway not connected", snapshot: null });
      return true;
    }

    try {
      const probe = url.searchParams.get("probe") === "true";
      // Gateway probes channels serially; each channel probe can take up to 10s
      // (feishu uses a hard-coded default, ignoring the passed timeoutMs).
      // With N configured channels, worst case is N * 10s.
      const probeTimeoutMs = DEFAULTS.desktop.channelProbeTimeoutMs;
      const clientTimeoutMs = probe ? DEFAULTS.polling.channelProbeClientTimeoutMs : DEFAULTS.desktop.channelClientTimeoutMs;

      const snapshot = await rpcClient.request<ChannelsStatusSnapshot>(
        "channels.status",
        { probe, timeoutMs: probeTimeoutMs },
        clientTimeoutMs
      );

      try {
        const configPath = resolveOpenClawConfigPath();
        const fullConfig = readExistingConfig(configPath);
        const channelsCfg = (fullConfig.channels ?? {}) as Record<string, Record<string, unknown>>;

        for (const [channelId, accounts] of Object.entries(snapshot.channelAccounts)) {
          const chCfg = channelsCfg[channelId] ?? {};
          const rootDmPolicy = chCfg.dmPolicy as string | undefined;
          const accountsCfg = (chCfg.accounts ?? {}) as Record<string, Record<string, unknown>>;

          for (const account of accounts) {
            if (!account.dmPolicy) {
              const acctCfg = accountsCfg[account.accountId];
              account.dmPolicy = (acctCfg?.dmPolicy as string) ?? rootDmPolicy ?? "pairing";
            }
          }
        }
      } catch {
        // Non-critical
      }

      sendJson(res, 200, { snapshot });
    } catch (err) {
      log.error("Failed to fetch channels status:", err);
      sendJson(res, 500, { error: String(err), snapshot: null });
    }
    return true;
  }

  // GET /api/channels/accounts/:channelId/:accountId — read config from SQLite
  if (pathname.startsWith("/api/channels/accounts/") && req.method === "GET") {
    const parts = pathname.slice("/api/channels/accounts/".length).split("/");
    if (parts.length !== 2) {
      sendJson(res, 400, { error: "Invalid path format. Expected: /api/channels/accounts/:channelId/:accountId" });
      return true;
    }

    const [channelId, accountId] = parts.map(decodeURIComponent);

    try {
      const account = storage.channelAccounts.get(channelId, accountId);
      if (!account) {
        sendJson(res, 404, { error: "Channel account not found" });
        return true;
      }
      sendJson(res, 200, { channelId: account.channelId, accountId: account.accountId, name: account.name, config: account.config });
    } catch (err) {
      log.error("Failed to get channel account:", err);
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // POST /api/channels/accounts
  if (pathname === "/api/channels/accounts" && req.method === "POST") {
    const body = (await parseBody(req)) as {
      channelId?: string;
      accountId?: string;
      name?: string;
      config?: Record<string, unknown>;
      secrets?: Record<string, string>;
    };

    if (!body.channelId || !body.accountId) {
      sendJson(res, 400, { error: "Missing required fields: channelId, accountId" });
      return true;
    }

    if (!body.config || typeof body.config !== "object") {
      sendJson(res, 400, { error: "Missing required field: config" });
      return true;
    }

    try {
      const configPath = resolveOpenClawConfigPath();
      const accountConfig: Record<string, unknown> = {
        ...body.config,
        enabled: body.config.enabled ?? true,
      };

      if (body.name) {
        accountConfig.name = body.name;
      }

      if (body.secrets && typeof body.secrets === "object") {
        for (const [secretKey, secretValue] of Object.entries(body.secrets)) {
          if (secretValue) {
            const storeKey = `channel-${body.channelId}-${body.accountId}-${secretKey}`;
            await secretStore.set(storeKey, secretValue);
            log.info(`Stored secret for ${body.channelId}/${body.accountId}: ${secretKey}`);
            accountConfig[secretKey] = secretValue;
          }
        }
      }

      writeChannelAccount({
        configPath,
        channelId: body.channelId,
        accountId: body.accountId,
        config: accountConfig,
      });

      // Persist non-secret config to SQLite (source of truth for EasyClaw read-back)
      storage.channelAccounts.upsert(body.channelId, body.accountId, body.name ?? null, body.config);

      sendJson(res, 201, { ok: true, channelId: body.channelId, accountId: body.accountId });
      onProviderChange?.({ configOnly: true });
      onChannelConfigured?.(body.channelId);
    } catch (err) {
      log.error("Failed to create channel account:", err);
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // PUT /api/channels/accounts/:channelId/:accountId
  if (pathname.startsWith("/api/channels/accounts/") && req.method === "PUT") {
    const parts = pathname.slice("/api/channels/accounts/".length).split("/");
    if (parts.length !== 2) {
      sendJson(res, 400, { error: "Invalid path format. Expected: /api/channels/accounts/:channelId/:accountId" });
      return true;
    }

    const [channelId, accountId] = parts.map(decodeURIComponent);
    const body = (await parseBody(req)) as {
      name?: string;
      config?: Record<string, unknown>;
      secrets?: Record<string, string>;
    };

    if (!body.config || typeof body.config !== "object") {
      sendJson(res, 400, { error: "Missing required field: config" });
      return true;
    }

    try {
      const configPath = resolveOpenClawConfigPath();
      const existingFullConfig = readExistingConfig(configPath);
      const existingChannels = (existingFullConfig.channels ?? {}) as Record<string, unknown>;
      const existingChannel = (existingChannels[channelId] ?? {}) as Record<string, unknown>;
      const existingAccounts = (existingChannel.accounts ?? {}) as Record<string, unknown>;
      const existingAccountConfig = (existingAccounts[accountId] ?? {}) as Record<string, unknown>;

      const accountConfig: Record<string, unknown> = { ...existingAccountConfig, ...body.config };

      if (body.name !== undefined) {
        accountConfig.name = body.name;
      }

      if (body.secrets && typeof body.secrets === "object") {
        for (const [secretKey, secretValue] of Object.entries(body.secrets)) {
          const storeKey = `channel-${channelId}-${accountId}-${secretKey}`;
          if (secretValue) {
            await secretStore.set(storeKey, secretValue);
            log.info(`Updated secret for ${channelId}/${accountId}: ${secretKey}`);
            accountConfig[secretKey] = secretValue;
          } else {
            await secretStore.delete(storeKey);
            log.info(`Deleted secret for ${channelId}/${accountId}: ${secretKey}`);
          }
        }
      }

      writeChannelAccount({ configPath, channelId, accountId, config: accountConfig });

      // Persist non-secret config to SQLite (source of truth for EasyClaw read-back)
      storage.channelAccounts.upsert(channelId, accountId, body.name ?? null, body.config);

      sendJson(res, 200, { ok: true, channelId, accountId });
      onProviderChange?.({ configOnly: true });
      onChannelConfigured?.(channelId);
    } catch (err) {
      log.error("Failed to update channel account:", err);
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // DELETE /api/channels/accounts/:channelId/:accountId
  if (pathname.startsWith("/api/channels/accounts/") && req.method === "DELETE") {
    const parts = pathname.slice("/api/channels/accounts/".length).split("/");
    if (parts.length !== 2) {
      sendJson(res, 400, { error: "Invalid path format. Expected: /api/channels/accounts/:channelId/:accountId" });
      return true;
    }

    const [channelId, accountId] = parts.map(decodeURIComponent);

    try {
      const configPath = resolveOpenClawConfigPath();
      const allSecretKeys = await secretStore.listKeys();
      const accountSecretPrefix = `channel-${channelId}-${accountId}-`;
      for (const key of allSecretKeys) {
        if (key.startsWith(accountSecretPrefix)) {
          await secretStore.delete(key);
          log.info(`Deleted secret: ${key}`);
        }
      }

      removeChannelAccount({ configPath, channelId, accountId });

      // WeChat plugin stores its own state files (account index + credential files).
      // Clean them up so the plugin doesn't re-register the account on reload.
      if (channelId === "openclaw-weixin") {
        const weixinStateDir = join(resolveOpenClawStateDir(), "openclaw-weixin");
        // Remove credential file
        await fs.rm(join(weixinStateDir, "accounts", `${accountId}.json`), { force: true });
        // Remove accountId from index
        try {
          const indexPath = join(weixinStateDir, "accounts.json");
          const raw = await fs.readFile(indexPath, "utf-8");
          const ids: string[] = JSON.parse(raw);
          const updated = ids.filter((id: string) => id !== accountId);
          await fs.writeFile(indexPath, JSON.stringify(updated, null, 2), "utf-8");
        } catch { /* index file may not exist */ }
      }

      // Remove from SQLite
      storage.channelAccounts.delete(channelId, accountId);

      sendJson(res, 200, { ok: true, channelId, accountId });
      onProviderChange?.({ configOnly: true });
    } catch (err) {
      log.error("Failed to delete channel account:", err);
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // GET /api/pairing/requests/:channelId
  if (pathname.startsWith("/api/pairing/requests/") && req.method === "GET") {
    const channelId = decodeURIComponent(pathname.slice("/api/pairing/requests/".length));
    if (!channelId) {
      sendJson(res, 400, { error: "Channel ID is required" });
      return true;
    }

    try {
      const requests = await readPairingRequests(channelId);
      sendJson(res, 200, { requests });
    } catch (err) {
      log.error(`Failed to list pairing requests for ${channelId}:`, err);
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // GET /api/pairing/allowlist/:channelId
  if (pathname.startsWith("/api/pairing/allowlist/") && req.method === "GET") {
    const channelId = decodeURIComponent(pathname.slice("/api/pairing/allowlist/".length).split("/")[0]);
    if (!channelId) {
      sendJson(res, 400, { error: "Channel ID is required" });
      return true;
    }

    try {
      const allowlist = await readAllAllowFromLists(channelId);
      const meta = storage.channelRecipients.getRecipientMeta(channelId);
      const labels: Record<string, string> = {};
      const owners: Record<string, boolean> = {};
      for (const [id, data] of Object.entries(meta)) {
        if (data.label) labels[id] = data.label;
        owners[id] = data.isOwner;
      }
      sendJson(res, 200, { allowlist, labels, owners });
    } catch (err) {
      log.error(`Failed to read allowlist for ${channelId}:`, err);
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // PUT /api/pairing/allowlist/:channelId/:entry/label
  if (pathname.match(/^\/api\/pairing\/allowlist\/[^/]+\/[^/]+\/label$/) && req.method === "PUT") {
    const segments = pathname.slice("/api/pairing/allowlist/".length).split("/");
    const channelId = decodeURIComponent(segments[0]);
    const recipientId = decodeURIComponent(segments[1]);
    const body = (await parseBody(req)) as { label?: string };

    if (typeof body.label !== "string") {
      sendJson(res, 400, { error: "Missing required field: label" });
      return true;
    }

    try {
      if (body.label.trim()) {
        storage.channelRecipients.setLabel(channelId, recipientId, body.label.trim());
      } else {
        storage.channelRecipients.delete(channelId, recipientId);
      }
      sendJson(res, 200, { ok: true });
    } catch (err) {
      log.error(`Failed to set recipient label:`, err);
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // PUT /api/pairing/allowlist/:channelId/:entry/owner
  if (pathname.match(/^\/api\/pairing\/allowlist\/[^/]+\/[^/]+\/owner$/) && req.method === "PUT") {
    const segments = pathname.slice("/api/pairing/allowlist/".length).split("/");
    const channelId = decodeURIComponent(segments[0]);
    const recipientId = decodeURIComponent(segments[1]);
    const body = (await parseBody(req)) as { isOwner?: boolean };

    if (typeof body.isOwner !== "boolean") {
      sendJson(res, 400, { error: "Missing required field: isOwner (boolean)" });
      return true;
    }

    try {
      storage.channelRecipients.ensureExists(channelId, recipientId);
      storage.channelRecipients.setOwner(channelId, recipientId, body.isOwner);

      // Write ownerAllowFrom to config and let the gateway's chokidar watcher
      // handle the reload automatically (~500ms debounce). Don't call
      // onProviderChange — that would cause a double restart.
      const configPath = resolveOpenClawConfigPath();
      syncOwnerAllowFrom(storage, configPath);

      sendJson(res, 200, { ok: true });
    } catch (err) {
      log.error(`Failed to set recipient owner:`, err);
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // POST /api/pairing/approve
  if (pathname === "/api/pairing/approve" && req.method === "POST") {
    const body = (await parseBody(req)) as {
      channelId?: string;
      code?: string;
      locale?: string;
    };

    if (!body.channelId || !body.code) {
      sendJson(res, 400, { error: "Missing required fields: channelId, code" });
      return true;
    }

    try {
      const requests = await readPairingRequests(body.channelId);
      const codeUpper = body.code.trim().toUpperCase();
      const requestIndex = requests.findIndex(r => r.code.toUpperCase() === codeUpper);

      if (requestIndex < 0) {
        sendJson(res, 404, { error: "Pairing code not found or expired" });
        return true;
      }

      const request = requests[requestIndex];
      const accountId = request.meta?.accountId;

      requests.splice(requestIndex, 1);
      await writePairingRequests(body.channelId, requests);

      const allowlist = await readAllowFromList(body.channelId, accountId);
      if (!allowlist.includes(request.id)) {
        allowlist.push(request.id);
        await writeAllowFromList(body.channelId, allowlist, accountId);
      }

      // Auto-assign owner to first-ever recipient across all channels
      const isFirstRecipient = !storage.channelRecipients.hasAnyOwner();
      storage.channelRecipients.ensureExists(body.channelId, request.id, isFirstRecipient);
      if (isFirstRecipient) {
        // Write ownerAllowFrom to config; chokidar handles the reload (~500ms debounce)
        const configPath = resolveOpenClawConfigPath();
        syncOwnerAllowFrom(storage, configPath);
      }

      sendJson(res, 200, { ok: true, id: request.id, entry: request });

      log.info(`Approved pairing for ${body.channelId}: ${request.id}`);

      const locale = (body.locale === "zh" ? "zh" : "en") as "zh" | "en";
      const confirmMsg = APPROVAL_MESSAGES[locale];
      sendChannelMessage(body.channelId, request.id, confirmMsg, proxiedFetch).then(ok => {
        if (ok) log.info(`Sent approval confirmation to ${body.channelId} user ${request.id}`);
      });
    } catch (err) {
      log.error("Failed to approve pairing:", err);
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // DELETE /api/pairing/allowlist/:channelId/:entry
  if (pathname.startsWith("/api/pairing/allowlist/") && req.method === "DELETE") {
    const parts = pathname.slice("/api/pairing/allowlist/".length).split("/");
    if (parts.length !== 2) {
      sendJson(res, 400, { error: "Invalid path format. Expected: /api/pairing/allowlist/:channelId/:entry" });
      return true;
    }

    const [channelId, entry] = parts.map(decodeURIComponent);

    try {
      let changed = false;
      const credentialsDir = resolveCredentialsDir();
      const prefix = `${channelId}-`;
      const suffix = "-allowFrom.json";

      let files: string[];
      try {
        files = await fs.readdir(credentialsDir);
      } catch (err: any) {
        if (err.code === "ENOENT") files = [];
        else throw err;
      }

      // Remove entry from all matching allowFrom files (legacy + scoped)
      for (const file of files) {
        if (!file.startsWith(prefix) || !file.endsWith(suffix)) continue;
        const filePath = join(credentialsDir, file);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const data: AllowFromStore = JSON.parse(content);
          if (!Array.isArray(data.allowFrom)) continue;
          const filtered = data.allowFrom.filter((e: string) => e !== entry);
          if (filtered.length !== data.allowFrom.length) {
            await fs.writeFile(filePath, JSON.stringify({ version: 1, allowFrom: filtered }, null, 2) + "\n", "utf-8");
            changed = true;
          }
        } catch {
          // Skip unreadable files
        }
      }

      if (changed) {
        log.info(`Removed from ${channelId} allowlist: ${entry}`);
      }

      // Clean up recipient data and sync owner config
      storage.channelRecipients.delete(channelId, entry);
      // Write ownerAllowFrom to config; chokidar handles the reload (~500ms debounce)
      const configPath = resolveOpenClawConfigPath();
      syncOwnerAllowFrom(storage, configPath);

      // Mobile channel: also clean up the pairing record and stop the sync engine
      if (channelId === "mobile" && ctx.mobileManager) {
        const allPairings = ctx.mobileManager.getAllPairings();
        const match = allPairings.find(p => p.pairingId === entry || p.id === entry);
        if (match) {
          ctx.mobileManager.disconnectPairing(match.id);
          const rpcClient = getRpcClient();
          if (rpcClient?.isConnected()) {
            rpcClient.request("mobile_chat_stop_sync", {
              pairingId: match.pairingId || entry,
            }).catch((err: any) => {
              log.error("Failed to stop mobile sync via RPC:", err);
            });
          }
        }
      }

      const remaining = await readAllAllowFromLists(channelId);
      sendJson(res, 200, { ok: true, changed, allowFrom: remaining });
    } catch (err) {
      log.error("Failed to remove from allowlist:", err);
      sendJson(res, 500, { error: String(err) });
    }
    return true;
  }

  // POST /api/channels/qr-login/start
  if (pathname === "/api/channels/qr-login/start" && req.method === "POST") {
    const rpcClient = getRpcClient();
    if (!rpcClient || !rpcClient.isConnected()) {
      sendJson(res, 503, { error: "Gateway not connected" });
      return true;
    }

    const body = (await parseBody(req)) as { accountId?: string };

    try {
      const result = await rpcClient.request<{ qrDataUrl?: string; message: string }>(
        "web.login.start",
        { accountId: body.accountId }
      );
      sendJson(res, 200, result);
    } catch (err) {
      log.error("Failed to start QR login:", err);
      sendJson(res, 500, { error: formatError(err) });
    }
    return true;
  }

  // POST /api/channels/qr-login/wait
  if (pathname === "/api/channels/qr-login/wait" && req.method === "POST") {
    const rpcClient = getRpcClient();
    if (!rpcClient || !rpcClient.isConnected()) {
      sendJson(res, 503, { error: "Gateway not connected" });
      return true;
    }

    const body = (await parseBody(req)) as { accountId?: string; timeoutMs?: number };
    // web.login.wait is a long-poll: the gateway blocks until the user scans
    // or the server-side timeout expires. Set the RPC timeout higher than the
    // server-side poll timeout so the RPC doesn't abort prematurely.
    const serverPollMs = body.timeoutMs ?? 60_000;
    const rpcTimeoutMs = serverPollMs + 15_000;

    try {
      const result = await rpcClient.request<{ connected: boolean; message: string; accountId?: string }>(
        "web.login.wait",
        { accountId: body.accountId, timeoutMs: body.timeoutMs },
        rpcTimeoutMs,
      );
      sendJson(res, 200, result);
    } catch (err) {
      log.error("Failed to wait for QR login:", err);
      sendJson(res, 500, { error: formatError(err) });
    }
    return true;
  }

  // --- Legacy Channels ---
  if (pathname === "/api/channels" && req.method === "GET") {
    const channels = storage.channels.getAll();
    sendJson(res, 200, { channels });
    return true;
  }

  if (pathname === "/api/channels" && req.method === "POST") {
    const body = (await parseBody(req)) as {
      channelType?: string;
      enabled?: boolean;
      accountId?: string;
      settings?: Record<string, unknown>;
    };
    const id = crypto.randomUUID();
    const channel = storage.channels.create({
      id,
      channelType: body.channelType ?? "",
      enabled: body.enabled ?? true,
      accountId: body.accountId ?? "",
      settings: body.settings ?? {},
    });
    onRuleChange?.("channel-created", id);
    sendJson(res, 201, channel);
    return true;
  }

  if (pathname.startsWith("/api/channels/") && req.method === "DELETE") {
    const id = pathname.slice("/api/channels/".length);
    if (!id.includes("/")) {
      const deleted = storage.channels.delete(id);
      if (deleted) {
        onRuleChange?.("channel-deleted", id);
        sendJson(res, 200, { ok: true });
      } else {
        sendJson(res, 404, { error: "Channel not found" });
      }
      return true;
    }
  }

  return false;
};
