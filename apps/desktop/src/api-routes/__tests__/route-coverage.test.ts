import { describe, it, expect } from "vitest";
import { API, SSE } from "@rivonclaw/core/api-contract";
import { RouteRegistry } from "../route-registry.js";
import { registerAuthHandlers } from "../handlers/auth.js";
import { registerDepsHandlers } from "../handlers/deps.js";
import { registerRulesHandlers } from "../handlers/rules.js";
import { registerChatSessionsHandlers } from "../handlers/chat-sessions.js";
import { registerUsageHandlers } from "../handlers/usage.js";
import { registerToolRegistryHandlers } from "../handlers/tool-registry.js";
import { registerSkillsHandlers } from "../handlers/skills.js";
import { registerSettingsHandlers } from "../handlers/settings.js";
import { registerProviderHandlers } from "../handlers/providers.js";
import { registerCsBridgeHandlers } from "../handlers/cs-bridge.js";
import { registerChannelsHandlers } from "../handlers/channels.js";
import { registerBrowserProfilesHandlers } from "../handlers/browser-profiles.js";
import { registerMobileChatHandlers } from "../handlers/mobile-chat.js";
import { registerCloudGraphqlHandlers } from "../handlers/cloud-graphql.js";
import { registerCloudRestHandlers } from "../handlers/cloud-rest.js";
import { registerDoctorHandlers } from "../handlers/doctor.js";

/**
 * Endpoints handled by panel-server.ts closure code (not via the registry).
 * If you move one of these to a handler, remove it from here — the test
 * will fail if it's both registered AND in this list.
 */
const PANEL_SERVER_CLOSURE_ROUTES = new Set([
  // Inline SSE endpoints in panel-server.ts
  "SSE:chat.events",
  "SSE:store.stream",
  "SSE:status.stream",
  // Inline REST endpoints in panel-server.ts (use closure-captured callbacks)
  "API:app.changelog",
  "API:app.updateDownload",
  "API:app.updateCancel",
  "API:app.updateDownloadStatus",
  "API:app.updateInstall",
]);

function buildFullRegistry(): RouteRegistry {
  const registry = new RouteRegistry();
  registerAuthHandlers(registry);
  registerDepsHandlers(registry);
  registerRulesHandlers(registry);
  registerChatSessionsHandlers(registry);
  registerUsageHandlers(registry);
  registerToolRegistryHandlers(registry);
  registerSkillsHandlers(registry);
  registerSettingsHandlers(registry);
  registerProviderHandlers(registry);
  registerCsBridgeHandlers(registry);
  registerChannelsHandlers(registry);
  registerBrowserProfilesHandlers(registry);
  registerMobileChatHandlers(registry);
  registerCloudGraphqlHandlers(registry);
  registerCloudRestHandlers(registry);
  registerDoctorHandlers(registry);
  return registry;
}

describe("API contract ↔ route registry coverage", () => {
  const registry = buildFullRegistry();
  const registeredPaths = new Set(
    registry.listRoutes().map((r) => `${r.method}:${r.path}`),
  );

  it("every API contract entry is either registered or in the closure allowlist", () => {
    const missing: string[] = [];
    for (const [key, entry] of Object.entries(API)) {
      const registryKey = `${entry.method}:${entry.path}`;
      const closureKey = `API:${key}`;
      if (!registeredPaths.has(registryKey) && !PANEL_SERVER_CLOSURE_ROUTES.has(closureKey)) {
        missing.push(`API["${key}"] (${entry.method} ${entry.path})`);
      }
    }
    expect(missing, `Unregistered API endpoints:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("every SSE contract entry is either registered or in the closure allowlist", () => {
    const missing: string[] = [];
    for (const [key, entry] of Object.entries(SSE)) {
      const registryKey = `${entry.method}:${entry.path}`;
      const closureKey = `SSE:${key}`;
      if (!registeredPaths.has(registryKey) && !PANEL_SERVER_CLOSURE_ROUTES.has(closureKey)) {
        missing.push(`SSE["${key}"] (${entry.method} ${entry.path})`);
      }
    }
    expect(missing, `Unregistered SSE endpoints:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("closure allowlist entries are not also registered (no stale allowlist)", () => {
    const stale: string[] = [];
    for (const closureKey of PANEL_SERVER_CLOSURE_ROUTES) {
      const [prefix, key] = closureKey.split(":", 2) as [string, string];
      const contract = prefix === "API" ? API : SSE;
      const entry = (contract as Record<string, { method: string; path: string }>)[key];
      if (!entry) continue;
      const registryKey = `${entry.method}:${entry.path}`;
      if (registeredPaths.has(registryKey)) {
        stale.push(`${closureKey} is registered — remove from PANEL_SERVER_CLOSURE_ROUTES`);
      }
    }
    expect(stale, `Stale closure allowlist entries:\n  ${stale.join("\n  ")}`).toEqual([]);
  });
});
