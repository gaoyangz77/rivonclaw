import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard (ADR-123, web host): a source file may call Desktop-local REST,
 * directly or through an `api/*` function, only if it is on this list. Every
 * entry is either a page the web host does not serve (its route `requires` a
 * Desktop capability) or code that checks `hostSupports()` / goes through the
 * host adapter before the call. Adding a consumer here is a decision: say which.
 */
const DESKTOP_ONLY_PAGE = "page not served by the web host";
const GATED = "gated by hostSupports() or served through the host adapter";

const ALLOWED: Record<string, string> = {
  // Shell
  "App.tsx": GATED, // updates, changelog, welcome, settings: desktopUpdates / desktopSettings / host.settings
  "routes.tsx": GATED, // trackEvent is a no-op without desktopSettings
  "components/LangToggle.tsx": GATED,
  "components/ThemeToggle.tsx": GATED,
  "components/HelpLink.tsx": GATED, // desktopAuthFlows
  "components/OpenInBrowserButton.tsx": GATED, // desktopSettings in BottomActions
  "components/banners/UpdateBanner.tsx": GATED, // desktopUpdates in GlobalBannerStack
  "components/images/RemoteMediaImage.tsx": GATED, // mediaCache
  "components/modals/AuthModal.tsx": GATED, // desktopAuthFlows: never opened on web
  "components/modals/TelemetryConsentModal.tsx": GATED, // desktopSettings in App
  "components/modals/AddChannelAccountModal.tsx": DESKTOP_ONLY_PAGE,
  "components/modals/FeishuSetupModal.tsx": DESKTOP_ONLY_PAGE,
  "components/modals/ManageAllowlistModal.tsx": DESKTOP_ONLY_PAGE,
  "components/modals/QrLoginModal.tsx": DESKTOP_ONLY_PAGE,
  // Pages
  "pages/channels/ChannelAccountsTable.tsx": DESKTOP_ONLY_PAGE,
  "pages/channels/ChannelsPage.tsx": DESKTOP_ONLY_PAGE,
  "pages/channels/poll-gateway.ts": DESKTOP_ONLY_PAGE,
  "pages/chat/SessionTabBar.tsx": DESKTOP_ONLY_PAGE,
  "pages/chat/controllers/ChatGatewayController.ts": DESKTOP_ONLY_PAGE,
  "pages/chat/hooks/useChatExamples.ts": DESKTOP_ONLY_PAGE,
  "pages/crons/CronsPage.tsx": DESKTOP_ONLY_PAGE,
  "pages/crons/hooks/useCronForm.ts": DESKTOP_ONLY_PAGE,
  "pages/crons/useCronManager.ts": DESKTOP_ONLY_PAGE,
  "pages/extras/ExtrasPage.tsx": DESKTOP_ONLY_PAGE,
  "pages/settings/hooks/useAppSettingsToggles.ts": DESKTOP_ONLY_PAGE,
  "pages/settings/hooks/useAppearanceSettings.ts": DESKTOP_ONLY_PAGE,
  "pages/settings/hooks/useDoctorRunner.ts": DESKTOP_ONLY_PAGE,
  "pages/settings/hooks/useLogUpload.ts": DESKTOP_ONLY_PAGE,
  "pages/settings/hooks/useOpenClawStateDir.ts": DESKTOP_ONLY_PAGE,
  "pages/skills/SkillsPage.tsx": DESKTOP_ONLY_PAGE,
  "pages/stt/SttPage.tsx": DESKTOP_ONLY_PAGE,
  "pages/usage/KeyUsagePage.tsx": DESKTOP_ONLY_PAGE,
  "pages/welcome/WelcomePage.tsx": DESKTOP_ONLY_PAGE,
  // Shared pages: the call sits behind the gate in the api layer or the hook
  "pages/ecommerce/AffiliateTeamPage.tsx": GATED, // fetchChannelStatus / fetchAllowlist return empty without `channels`
  "pages/ecommerce/hooks/useEscalation.ts": GATED, // same
  "pages/ecommerce/hooks/useDeviceBinding.ts": GATED, // csBridge
  // Store models
  "store/entity-store.ts": GATED, // trackEvent, syncOfficialPresetSkills (localSkills)
  "store/models/AppSettingsModel.ts": GATED, // settings go through host.settings; telemetry/auto-launch only from the Settings page
  "store/models/ChannelAccountModel.ts": DESKTOP_ONLY_PAGE,
  "store/models/ChannelManagerModel.ts": DESKTOP_ONLY_PAGE,
  "store/models/CustomerServiceWorkspaceModel.ts": GATED, // csBridge (start AI, escalation response, telemetry)
};

const SRC = join(__dirname, ".");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const files = walk(SRC).map((f) => ({ path: relative(SRC, f), text: readFileSync(f, "utf8") }));
const rel = (p: string) => p.replace(/\\/g, "/");

/** `api/*` exports that reach Desktop REST (not cloud REST, not the host adapter). */
function desktopApiFunctions(): string[] {
  const names: string[] = [];
  for (const file of files.filter((f) => rel(f.path).startsWith("api/") && !/\/(cloud-client|apollo-client|client)\.ts$/.test(rel(f.path)))) {
    for (const part of file.text.split(/\nexport /).slice(1)) {
      const match = /^(?:async )?function (\w+)/.exec(part);
      if (match && /fetchJson|fetchVoid|cachedFetch|new EventSource/.test(part) && /API\[|SSE\[|"\/status"/.test(part)) {
        names.push(match[1]!);
      }
    }
  }
  return names;
}

describe("Desktop REST consumers", () => {
  it("only allow-listed files call Desktop REST directly", () => {
    const direct = files
      .filter((f) => !rel(f.path).startsWith("api/") && !rel(f.path).startsWith("host/"))
      .filter((f) => /\b(?:fetchJson|fetchVoid)\b|\bAPI\["|new EventSource/.test(f.text))
      .map((f) => rel(f.path))
      .filter((p) => !(p in ALLOWED));
    expect(direct, "add the file to ALLOWED with a reason, or route it through the host adapter").toEqual([]);
  });

  it("only allow-listed files use an api/* function that reaches Desktop REST", () => {
    const names = desktopApiFunctions();
    expect(names.length).toBeGreaterThan(20);
    const offenders: string[] = [];
    for (const file of files) {
      const path = rel(file.path);
      if (path.startsWith("api/") || path.startsWith("host/") || path in ALLOWED) continue;
      const used = names.filter((n) => new RegExp(`\\b${n}\\b`).test(file.text));
      if (used.length) offenders.push(`${path}: ${used.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("every allow-listed file still exists and still has a reason to be listed", () => {
    const present = new Set(files.map((f) => rel(f.path)));
    expect(Object.keys(ALLOWED).filter((p) => !present.has(p))).toEqual([]);
  });
});
