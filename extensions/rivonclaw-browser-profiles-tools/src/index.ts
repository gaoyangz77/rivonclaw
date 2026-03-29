/**
 * Browser Profiles Tools Plugin
 *
 * Pure tool provider + cookie lifecycle manager.
 * Registers browser profile management tools and handles cookie
 * persistence across browser sessions via CDP.
 *
 * Tool access control is handled by capability-manager (W30).
 * This plugin does NOT manage context, prompts, or permissions.
 */

import { defineRivonClawPlugin } from "@rivonclaw/plugin-sdk";
import { pushCookiesForRestore, pushCdpPort, restoreCookies, captureCookies, pullCapturedCookies, clearAll as clearCookieState } from "./cookie-handler.js";
import type { CdpCookie } from "./cdp-transport.js";

export default defineRivonClawPlugin({
  id: "rivonclaw-browser-profiles-tools",
  name: "Browser Profiles Tools",
  tools: [], // Tools now registered via defineClientTool → rivonclaw-local-tools
  toolVisibility: "managed",

  setup(api) {
    // ── Browser session lifecycle: cookie restore/capture ────────────
    api.on(
      "browser_session_start",
      async (
        event: { profile?: string; action: string },
        _ctx: { sessionKey?: string; profile?: string },
      ) => {
        const profile = event.profile ?? "openclaw";
        const result = await restoreCookies(profile);
        if (result.restored > 0) {
          api.logger.info(`Restored ${result.restored} cookies for profile "${profile}"`);
        }
      },
    );

    api.on(
      "browser_session_end",
      async (
        event: { profile?: string; action: string },
        _ctx: { sessionKey?: string; profile?: string },
      ) => {
        const profile = event.profile ?? "openclaw";
        const result = await captureCookies(profile);
        if (result.captured > 0) {
          api.logger.info(`Captured ${result.captured} cookies for profile "${profile}"`);
        }
      },
    );

    // ── Gateway methods: cookie exchange with Desktop ────────────
    if (typeof api.registerGatewayMethod === "function") {
      api.registerGatewayMethod("browser_profiles_push_cookies", ({ params, respond }) => {
        const profileName = params.profileName as string | undefined;
        const cookies = params.cookies as CdpCookie[] | undefined;
        const cdpPort = params.cdpPort as number | undefined;
        if (!profileName) {
          respond(false, undefined, { code: "INVALID_PARAMS", message: "Missing profileName" });
          return;
        }
        if (cookies) {
          pushCookiesForRestore(profileName, cookies, cdpPort);
        } else if (cdpPort !== undefined) {
          pushCdpPort(profileName, cdpPort);
        }
        respond(true, { ok: true });
      });

      api.registerGatewayMethod("browser_profiles_pull_cookies", ({ params, respond }) => {
        const profileName = params.profileName as string | undefined;
        if (!profileName) {
          respond(false, undefined, { code: "INVALID_PARAMS", message: "Missing profileName" });
          return;
        }
        const cookies = pullCapturedCookies(profileName);
        respond(true, { cookies });
      });
    }

    // ── Clean up on gateway stop ────────────────
    api.on("gateway_stop", () => {
      clearCookieState();
    });
  },
});
