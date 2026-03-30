import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "@rivonclaw/core";
import { getDefaultModelForProvider, reconstructProxyUrl, formatError } from "@rivonclaw/core";
import { resolveAgentSessionsDir } from "@rivonclaw/core/node";
import { readFullModelCatalog } from "@rivonclaw/gateway";
import { createLogger } from "@rivonclaw/logger";
import { validateProviderApiKey, validateCustomProviderApiKey, fetchCustomProviderModels } from "../providers/provider-validator.js";
import { rootStore } from "../store/desktop-store.js";
import type { RouteHandler } from "./api-context.js";
import { sendJson, parseBody } from "./route-utils.js";

const log = createLogger("panel-server");

/**
 * Check whether the active session's token usage risks exceeding the new
 * model's context window (>80% of capacity). Returns a warning object when
 * the risk is detected, or `undefined` otherwise.
 *
 * Failures are silently swallowed — this is advisory-only and must never
 * block the model switch.
 */
async function checkContextOverflowRisk(
  newModelId: string,
  provider: string,
  vendorDir: string | undefined,
): Promise<{ currentTokens: number; newContextWindow: number } | undefined> {
  try {
    // 1. Read the active session's totalTokens from sessions.json
    const storePath = join(resolveAgentSessionsDir(), "sessions.json");
    if (!existsSync(storePath)) return undefined;

    const store = JSON.parse(readFileSync(storePath, "utf-8")) as
      Record<string, { totalTokens?: number }>;

    // Find the maximum totalTokens across all sessions — the "main" session
    // is typically the one that matters, but the key name is opaque. Using
    // the max is a safe heuristic.
    let currentTokens = 0;
    for (const entry of Object.values(store)) {
      if (typeof entry.totalTokens === "number" && entry.totalTokens > currentTokens) {
        currentTokens = entry.totalTokens;
      }
    }

    if (currentTokens === 0) return undefined;

    // 2. Look up the new model's contextWindow from the catalog
    const catalog = await readFullModelCatalog(undefined, vendorDir);
    const providerModels = catalog[provider];
    if (!providerModels) return undefined;

    const modelEntry = providerModels.find((m) => m.id === newModelId);
    if (!modelEntry?.contextWindow) return undefined;

    // 3. Warn if usage exceeds 80% of the new model's context window
    if (currentTokens > modelEntry.contextWindow * 0.8) {
      return { currentTokens, newContextWindow: modelEntry.contextWindow };
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export const handleProviderRoutes: RouteHandler = async (req, res, url, pathname, ctx) => {
  const { storage, secretStore, onOAuthFlow, onOAuthAcquire, onOAuthSave, onOAuthManualComplete, onOAuthPoll, onTelemetryTrack, vendorDir, snapshotEngine } = ctx;

  // --- Provider Keys ---
  if (pathname === "/api/provider-keys" && req.method === "GET") {
    const keys = storage.providerKeys.getAll();

    const keysWithProxy = await Promise.all(
      keys.map(async (key) => {
        if (!key.proxyBaseUrl) {
          return key;
        }
        const credentials = await secretStore.get(`proxy-auth-${key.id}`);
        const proxyUrl = credentials ? reconstructProxyUrl(key.proxyBaseUrl, credentials) : key.proxyBaseUrl;
        return { ...key, proxyUrl };
      })
    );

    sendJson(res, 200, { keys: keysWithProxy });
    return true;
  }

  if (pathname === "/api/provider-keys" && req.method === "POST") {
    const body = (await parseBody(req)) as {
      provider?: string;
      label?: string;
      model?: string;
      apiKey?: string;
      proxyUrl?: string;
      authType?: "api_key" | "oauth" | "local" | "custom";
      baseUrl?: string;
      customProtocol?: "openai" | "anthropic";
      customModelsJson?: string;
      inputModalities?: string[];
    };

    const isLocal = body.authType === "local";
    const isCustom = body.authType === "custom";

    if (!body.provider) {
      sendJson(res, 400, { error: "Missing required field: provider" });
      return true;
    }
    if (!isLocal && !body.apiKey) {
      sendJson(res, 400, { error: "Missing required field: apiKey" });
      return true;
    }

    if (isCustom) {
      // Custom provider validation
      if (!body.baseUrl || !body.customProtocol || !body.customModelsJson) {
        sendJson(res, 400, { error: "Custom providers require baseUrl, customProtocol, and customModelsJson" });
        return true;
      }
      let models: string[];
      try {
        models = JSON.parse(body.customModelsJson);
        if (!Array.isArray(models) || models.length === 0) throw new Error("empty");
      } catch {
        sendJson(res, 400, { error: "customModelsJson must be a non-empty JSON array of model IDs" });
        return true;
      }
      const validation = await validateCustomProviderApiKey(
        body.baseUrl, body.apiKey!, body.customProtocol, models[0], ctx.proxyRouterPort, body.proxyUrl || undefined,
      );
      if (!validation.valid) {
        sendJson(res, 422, { error: validation.error || "Invalid API key" });
        return true;
      }
    } else if (!isLocal) {
      const validation = await validateProviderApiKey(body.provider, body.apiKey!, ctx.proxyRouterPort, body.proxyUrl || undefined, body.model || undefined);
      if (!validation.valid) {
        sendJson(res, 422, { error: validation.error || "Invalid API key" });
        return true;
      }
    }

    const model = body.model || (isCustom ? "" : getDefaultModelForProvider(body.provider as LLMProvider)?.modelId) || "";
    const label = body.label || "Default";

    // Proxy URL validation (fail fast before MST action)
    if (body.proxyUrl?.trim()) {
      try {
        const { parseProxyUrl } = await import("@rivonclaw/core");
        parseProxyUrl(body.proxyUrl.trim());
      } catch (error) {
        sendJson(res, 400, { error: `Invalid proxy URL: ${formatError(error)}` });
        return true;
      }
    }

    // MST action: full create transaction (SQLite + Keychain + syncActiveKey + MST state + gateway sync)
    const { entry, shouldActivate } = await rootStore.providerKeyCreate({
      provider: body.provider,
      label,
      model,
      apiKey: body.apiKey,
      proxyUrl: body.proxyUrl,
      authType: body.authType,
      baseUrl: body.baseUrl,
      customProtocol: body.customProtocol,
      customModelsJson: body.customModelsJson,
      inputModalities: body.inputModalities,
    });

    onTelemetryTrack?.("provider.key_added", { provider: body.provider, isFirst: shouldActivate });

    sendJson(res, 201, entry);
    return true;
  }

  // Provider key activate: POST /api/provider-keys/:id/activate
  if (pathname.startsWith("/api/provider-keys/") && pathname.endsWith("/activate") && req.method === "POST") {
    const id = pathname.slice("/api/provider-keys/".length, -"/activate".length);
    const entry = storage.providerKeys.getById(id);
    if (!entry) {
      sendJson(res, 404, { error: "Key not found" });
      return true;
    }

    // Usage tracking (stays in route handler — API-layer concern)
    const oldActive = storage.providerKeys.getActive();
    if (oldActive && snapshotEngine) {
      await snapshotEngine.recordDeactivation(oldActive.id, oldActive.provider, oldActive.model);
    }
    if (snapshotEngine) {
      await snapshotEngine.recordActivation(entry.id, entry.provider, entry.model);
    }

    // MST action: full activate transaction
    await rootStore.providerKeyActivate(id);

    onTelemetryTrack?.("provider.activated", { provider: entry.provider });

    sendJson(res, 200, { ok: true });
    return true;
  }

  // Provider key refresh models: POST /api/provider-keys/:id/refresh-models
  if (pathname.startsWith("/api/provider-keys/") && pathname.endsWith("/refresh-models") && req.method === "POST") {
    const id = pathname.slice("/api/provider-keys/".length, -"/refresh-models".length);
    const entry = storage.providerKeys.getById(id);
    if (!entry) {
      sendJson(res, 404, { error: "Key not found" });
      return true;
    }
    if (entry.authType !== "custom" || entry.customProtocol !== "openai") {
      sendJson(res, 400, { error: "Refresh models is only supported for custom OpenAI-compatible providers" });
      return true;
    }
    if (!entry.baseUrl) {
      sendJson(res, 400, { error: "Custom provider is missing baseUrl" });
      return true;
    }
    const apiKey = await secretStore.get(`provider-key-${id}`);
    if (!apiKey) {
      sendJson(res, 400, { error: "No API key found for this provider" });
      return true;
    }

    let proxyUrl: string | undefined;
    if (entry.proxyBaseUrl) {
      const credentials = await secretStore.get(`proxy-auth-${id}`);
      proxyUrl = credentials ? reconstructProxyUrl(entry.proxyBaseUrl, credentials) : entry.proxyBaseUrl;
    }

    const result = await fetchCustomProviderModels(entry.baseUrl, apiKey, ctx.proxyRouterPort, proxyUrl);
    if (result.error) {
      sendJson(res, 422, { error: result.error });
      return true;
    }

    // MST action: refresh models transaction (FIX: now includes gateway sync for active keys)
    const updated = await rootStore.providerKeyRefreshModels(id, result.models!);

    sendJson(res, 200, updated);
    return true;
  }

  // Provider key with ID: PUT /api/provider-keys/:id, DELETE /api/provider-keys/:id
  if (pathname.startsWith("/api/provider-keys/")) {
    const id = pathname.slice("/api/provider-keys/".length);
    if (!id.includes("/")) {
      if (req.method === "PUT") {
        const body = (await parseBody(req)) as { label?: string; model?: string; proxyUrl?: string; baseUrl?: string; inputModalities?: string[]; customModelsJson?: string; apiKey?: string };
        const existing = storage.providerKeys.getById(id);
        if (!existing) {
          sendJson(res, 404, { error: "Key not found" });
          return true;
        }

        // Proxy URL validation (fail fast before MST action)
        if (body.proxyUrl !== undefined && body.proxyUrl !== "" && body.proxyUrl !== null) {
          try {
            const { parseProxyUrl } = await import("@rivonclaw/core");
            parseProxyUrl(body.proxyUrl.trim());
          } catch (error) {
            sendJson(res, 400, { error: `Invalid proxy URL: ${formatError(error)}` });
            return true;
          }
        }

        // Usage tracking (stays in route handler — API-layer concern)
        const modelChanging = !!(body.model && body.model !== existing.model);
        if (modelChanging && existing.isDefault && snapshotEngine) {
          await snapshotEngine.recordDeactivation(existing.id, existing.provider, existing.model);
        }

        // MST action: full update transaction
        const { updated } = await rootStore.providerKeyUpdate(id, {
          label: body.label,
          model: body.model,
          apiKey: body.apiKey,
          proxyUrl: body.proxyUrl,
          baseUrl: body.baseUrl,
          inputModalities: body.inputModalities,
          customModelsJson: body.customModelsJson,
        });

        if (modelChanging && existing.isDefault && snapshotEngine && body.model) {
          await snapshotEngine.recordActivation(existing.id, existing.provider, body.model);
        }

        const response: Record<string, unknown> = { ...updated };

        if (modelChanging && existing.isDefault && body.model) {
          const warning = await checkContextOverflowRisk(body.model, existing.provider, vendorDir);
          if (warning) {
            response.contextWarning = warning;
          }
        }

        sendJson(res, 200, response);
        return true;
      }

      if (req.method === "DELETE") {
        const existing = storage.providerKeys.getById(id);
        if (!existing) {
          sendJson(res, 404, { error: "Key not found" });
          return true;
        }

        // MST action: full delete transaction (SQLite + Keychain + promotion + syncActiveKey + MST state + gateway sync)
        await rootStore.providerKeyDelete(id);

        sendJson(res, 200, { ok: true });
        return true;
      }
    }
  }

  // --- Custom Provider: Fetch Models ---
  if (pathname === "/api/custom-provider/fetch-models" && req.method === "POST") {
    const body = (await parseBody(req)) as {
      baseUrl?: string;
      apiKey?: string;
      protocol?: string;
      proxyUrl?: string;
    };
    if (!body.baseUrl || !body.apiKey) {
      sendJson(res, 400, { error: "Missing required fields: baseUrl, apiKey" });
      return true;
    }
    if (body.protocol !== "openai") {
      sendJson(res, 400, { error: "Model fetching is only supported for OpenAI-compatible providers" });
      return true;
    }
    const result = await fetchCustomProviderModels(body.baseUrl, body.apiKey, ctx.proxyRouterPort, body.proxyUrl || undefined);
    if (result.error) {
      sendJson(res, 422, { error: result.error });
      return true;
    }
    sendJson(res, 200, { models: result.models });
    return true;
  }

  // --- Local Models ---
  if (pathname === "/api/local-models/detect" && req.method === "GET") {
    const { detectLocalServers } = await import("../providers/local-model-detector.js");
    const servers = await detectLocalServers();
    sendJson(res, 200, { servers });
    return true;
  }

  if (pathname === "/api/local-models/models" && req.method === "GET") {
    const baseUrl = url.searchParams.get("baseUrl");
    if (!baseUrl) {
      sendJson(res, 400, { error: "Missing required parameter: baseUrl" });
      return true;
    }
    const { fetchOllamaModels } = await import("../providers/local-model-fetcher.js");
    const models = await fetchOllamaModels(baseUrl);
    sendJson(res, 200, { models });
    return true;
  }

  if (pathname === "/api/local-models/health" && req.method === "POST") {
    const body = (await parseBody(req)) as { baseUrl?: string };
    if (!body.baseUrl) {
      sendJson(res, 400, { error: "Missing required field: baseUrl" });
      return true;
    }
    const { checkHealth } = await import("../providers/local-model-fetcher.js");
    const result = await checkHealth(body.baseUrl);
    sendJson(res, 200, result);
    return true;
  }

  // --- Model Catalog ---
  if (pathname === "/api/models" && req.method === "GET") {
    const catalog = await readFullModelCatalog(undefined, vendorDir);

    // Custom providers store their model list in customModelsJson but
    // readFullModelCatalog only covers built-in providers.  The gateway's
    // models.json is updated asynchronously after restart, so right after
    // a custom provider is created the catalog won't include its models yet.
    // Inject them from storage to close this race window.
    const allKeys = storage.providerKeys.getAll();
    for (const key of allKeys) {
      if (key.customModelsJson) {
        try {
          const models: string[] = JSON.parse(key.customModelsJson);
          const existing = catalog[key.provider] ?? [];
          const existingIds = new Set(existing.map((e) => e.id));
          const extras = models
            .filter((id) => !existingIds.has(id))
            .map((id) => ({ id, name: id }));
          if (extras.length > 0) {
            catalog[key.provider] = [...existing, ...extras];
          }
        } catch {
          // Invalid JSON in customModelsJson — skip
        }
      }
    }

    sendJson(res, 200, { models: catalog });
    return true;
  }

  // --- OAuth Flow ---
  if (pathname === "/api/oauth/start" && req.method === "POST") {
    const body = (await parseBody(req)) as { provider?: string };
    if (!body.provider) {
      sendJson(res, 400, { error: "Missing required field: provider" });
      return true;
    }
    if (onOAuthAcquire) {
      try {
        const result = await onOAuthAcquire(body.provider);
        sendJson(res, 200, { ok: true, ...result });
      } catch (err) {
        log.error("OAuth acquire failed:", err);
        const detail = err instanceof Error ? (err as Error & { detail?: string }).detail : undefined;
        sendJson(res, 500, { error: formatError(err), detail });
      }
      return true;
    }
    if (!onOAuthFlow) {
      sendJson(res, 501, { error: "OAuth flow not available" });
      return true;
    }
    try {
      const result = await onOAuthFlow(body.provider);
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      log.error("OAuth flow failed:", err);
      const detail = err instanceof Error ? (err as Error & { detail?: string }).detail : undefined;
      sendJson(res, 500, { error: formatError(err), detail });
    }
    return true;
  }

  if (pathname === "/api/oauth/save" && req.method === "POST") {
    const body = (await parseBody(req)) as { provider?: string; proxyUrl?: string; label?: string; model?: string };
    if (!body.provider) {
      sendJson(res, 400, { error: "Missing required field: provider" });
      return true;
    }
    if (!onOAuthSave) {
      sendJson(res, 501, { error: "OAuth save not available" });
      return true;
    }
    try {
      const result = await onOAuthSave(body.provider, {
        proxyUrl: body.proxyUrl,
        label: body.label,
        model: body.model,
      });
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      log.error("OAuth save failed:", err);
      const message = formatError(err);
      const detail = err instanceof Error ? (err as Error & { detail?: string }).detail : undefined;
      const status = message.includes("Invalid") || message.includes("expired") || message.includes("validation") ? 422 : 500;
      sendJson(res, status, { error: message, detail });
    }
    return true;
  }

  if (pathname === "/api/oauth/manual-complete" && req.method === "POST") {
    const body = (await parseBody(req)) as { provider?: string; callbackUrl?: string };
    if (!body.provider || !body.callbackUrl) {
      sendJson(res, 400, { error: "Missing required fields: provider, callbackUrl" });
      return true;
    }
    if (!onOAuthManualComplete) {
      sendJson(res, 501, { error: "Manual OAuth complete not available" });
      return true;
    }
    try {
      const result = await onOAuthManualComplete(body.provider, body.callbackUrl);
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      log.error("OAuth manual complete failed:", err);
      const detail = err instanceof Error ? (err as Error & { detail?: string }).detail : undefined;
      sendJson(res, 500, { error: formatError(err), detail });
    }
    return true;
  }

  // ── OAuth status polling ──
  if (pathname === "/api/oauth/status" && req.method === "GET") {
    const flowId = url.searchParams.get("flowId");
    if (!flowId) {
      sendJson(res, 400, { ok: false, error: "Missing flowId parameter" });
      return true;
    }
    if (!onOAuthPoll) {
      sendJson(res, 501, { ok: false, error: "OAuth polling not supported" });
      return true;
    }
    const status = onOAuthPoll(flowId);
    sendJson(res, 200, { ok: true, ...status });
    return true;
  }

  return false;
};
