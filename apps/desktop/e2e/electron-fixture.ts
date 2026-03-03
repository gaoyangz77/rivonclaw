import { test as base, type ElectronApplication, type Page } from "@playwright/test";
import { _electron } from "playwright";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createConnection } from "node:net";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const electronPath = require("electron") as unknown as string;

/** Default ports — each parallel worker offsets by workerIndex * 100. */
const DEFAULT_GATEWAY_PORT = 28789;
const DEFAULT_PANEL_PORT = 3210;
const DEFAULT_PROXY_ROUTER_PORT = 9999;

export type WorkerPorts = {
  gateway: number;
  panel: number;
  proxy: number;
};

/**
 * Kill any process listening on the given port, then wait until free.
 *
 * In parallel mode each worker uses unique ports, so we ONLY kill by port —
 * never by process name (killall/taskkill /IM) as that would kill gateways
 * belonging to other workers.
 */
async function ensurePortFree(port: number): Promise<void> {
  if (process.platform === "win32") {
    try {
      const out = execSync("netstat -ano", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], shell: "cmd.exe" });
      const pids = new Set<string>();
      for (const line of out.split("\n")) {
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) pids.add(pid);
        }
      }
      for (const pid of pids) {
        try { execSync(`taskkill /T /F /PID ${pid}`, { stdio: "ignore", shell: "cmd.exe" }); } catch {}
      }
    } catch {}
  } else {
    // Kill by port (lsof is fast — ~100ms on macOS)
    try { execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" }); } catch {}
  }

  // Wait until the port is actually free (up to 5s)
  for (let i = 0; i < 50; i++) {
    const inUse = await new Promise<boolean>((resolve) => {
      const sock = createConnection({ port, host: "127.0.0.1" });
      sock.once("connect", () => { sock.destroy(); resolve(true); });
      sock.once("error", () => resolve(false));
    });
    if (!inUse) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Compute unique ports for a Playwright worker based on its index. */
function computePorts(workerIndex: number): WorkerPorts {
  const offset = workerIndex * 100;
  return {
    gateway: DEFAULT_GATEWAY_PORT + offset,
    panel: DEFAULT_PANEL_PORT + offset,
    proxy: DEFAULT_PROXY_ROUTER_PORT + offset,
  };
}

/** Create a unique temp directory for data isolation. */
function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "easyclaw-e2e-"));
}

/** Build a clean env for Electron with data + port isolation. */
function buildEnv(tempDir: string, ports: WorkerPorts): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;

  // Isolate all persistent state to the temp directory
  env.EASYCLAW_DB_PATH = path.join(tempDir, "db.sqlite");
  env.EASYCLAW_SECRETS_DIR = path.join(tempDir, "secrets");
  env.OPENCLAW_STATE_DIR = path.join(tempDir, "openclaw");

  // Assign unique ports so parallel workers don't collide
  env.EASYCLAW_GATEWAY_PORT = String(ports.gateway);
  env.EASYCLAW_PANEL_PORT = String(ports.panel);
  env.EASYCLAW_PROXY_ROUTER_PORT = String(ports.proxy);

  // Skip the file-based gateway lock (acquireGatewayLock).  The lock uses
  // os.tmpdir()/openclaw-<uid>/gateway.<hash>.lock — a shared directory.
  // On macOS the stale-lock check only calls isPidAlive (no argv verification),
  // so PID reuse makes the lock appear active → 5 s timeout → GatewayLockError.
  // Combined with the launcher's exponential backoff (1-2-4-8-16 s) a single
  // false-positive lock collision cascades past the 30 s fixture timeout.
  // In E2E each test already has its own state dir, so the file lock adds no
  // safety — the port bind (EADDRINUSE) is sufficient.
  env.OPENCLAW_ALLOW_MULTI_GATEWAY = "1";

  return env;
}

type ElectronFixtures = {
  ports: WorkerPorts;
  apiBase: string;
  electronApp: ElectronApplication;
  window: Page;
};

/** Shared logic to launch Electron with data + port isolation. */
async function launchElectronApp(
  use: (app: ElectronApplication) => Promise<void>,
  ports: WorkerPorts,
) {
  // Kill any leftover gateway from a previous test or test-suite run
  // BEFORE launching Electron, so the new gateway never hits EADDRINUSE.
  await ensurePortFree(ports.gateway);
  await ensurePortFree(ports.panel);

  const tempDir = createTempDir();
  const env = buildEnv(tempDir, ports);
  const execPath = process.env.E2E_EXECUTABLE_PATH;
  let app: ElectronApplication;

  // Use a per-test user-data-dir so each instance gets its own
  // single-instance lock. Without this, force-killed prod instances
  // leave a stale lock that blocks subsequent test launches.
  const userDataDir = path.join(tempDir, "electron-data");

  if (execPath) {
    // Prod mode: launch the packaged app binary
    app = await _electron.launch({
      executablePath: execPath,
      args: ["--lang=en", `--user-data-dir=${userDataDir}`],
      env,
    });
  } else {
    const mainPath = path.resolve("dist/main.cjs");
    app = await _electron.launch({
      executablePath: electronPath,
      args: ["--lang=en", mainPath, `--user-data-dir=${userDataDir}`],
      env,
    });
  }

  let testFailed = false;
  try {
    await use(app);
  } catch (err) {
    testFailed = true;
    throw err;
  } finally {
    await app.close();
    // The gateway runs detached and may outlive the Electron process.
    // Kill it by its specific port (safe in parallel — other workers use
    // different ports).
    await ensurePortFree(ports.gateway);
    if (testFailed) {
      // Keep temp dir for debugging — print its path
      console.log(`[e2e] Test FAILED — temp dir preserved: ${tempDir}`);
    } else {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Force the Electron window to the foreground.
 * On Windows, background processes cannot call SetForegroundWindow directly.
 * The setAlwaysOnTop trick bypasses this restriction.
 */
async function bringWindowToFront(electronApp: ElectronApplication) {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    win.setAlwaysOnTop(true);
    win.show();
    win.focus();
    win.setAlwaysOnTop(false);
  });
}

/** Seed a provider key via the gateway REST API. */
async function seedProvider(apiBase: string, opts: {
  provider: string;
  model: string;
  apiKey: string;
}): Promise<void> {
  const res = await fetch(`${apiBase}/api/provider-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: opts.provider,
      label: "E2E Test Key",
      model: opts.model,
      apiKey: opts.apiKey,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to seed provider key: ${res.status} ${text}`);
  }

  const settingsRes = await fetch(`${apiBase}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ "llm-provider": opts.provider }),
  });
  if (!settingsRes.ok) {
    throw new Error(`Failed to set active provider: ${settingsRes.status}`);
  }
}

/**
 * Returning-user fixture: seeds a volcengine provider key via the
 * gateway API when E2E_VOLCENGINE_API_KEY is set. Otherwise, skips
 * onboarding so basic smoke tests still work without real API keys.
 *
 * Always lands on the main page with a fully connected gateway, so
 * individual tests don't race against gateway startup time.
 */
export const test = base.extend<ElectronFixtures>({
  ports: async ({}, use, testInfo) => {
    await use(computePorts(testInfo.workerIndex));
  },

  apiBase: async ({ ports }, use) => {
    await use(`http://127.0.0.1:${ports.panel}`);
  },

  electronApp: async ({ ports }, use) => {
    await launchElectronApp(use, ports);
  },

  window: async ({ electronApp, apiBase }, use) => {
    const window = await electronApp.firstWindow({ timeout: 45_000 });
    await window.waitForLoadState("domcontentloaded");

    // Pre-dismiss telemetry consent so the dialog never blocks test interactions.
    // Must run before React's useEffect checks localStorage.
    await window.evaluate(() => localStorage.setItem("telemetry.consentShown", "1"));

    // Wait for the page to render (onboarding or main page)
    await window.waitForSelector(".onboarding-page, .sidebar-brand", {
      timeout: 45_000,
    });
    await bringWindowToFront(electronApp);

    // If onboarding is shown, either seed a real provider or skip
    if (await window.locator(".onboarding-page").isVisible()) {
      const apiKey = process.env.E2E_VOLCENGINE_API_KEY;
      if (apiKey) {
        await seedProvider(apiBase, {
          provider: "volcengine",
          model: "doubao-seed-1-6-flash-250828",
          apiKey,
        });
        // Provider seeding triggers gateway restarts (config + model change).
        // On Windows each restart is a full stop+start (no SIGUSR1) — needs
        // longer to settle. On macOS/Linux SIGUSR1 graceful reload is fast.
        await window.waitForTimeout(process.platform === "win32" ? 10000 : 2000);
        // Reload to trigger onboarding re-check so the app transitions to
        // the main page now that a provider is configured.
        await window.reload();
      } else {
        // No API key available — skip onboarding to reach the main page
        await window.locator(".btn-ghost").click();
      }
      await window.waitForSelector(".sidebar-brand", { timeout: 45_000 });
    }

    // Wait for the gateway to be fully connected before handing the window
    // to tests. The gateway takes 6-7 s to bind on Windows (extensions load
    // before the port opens) and can restart multiple times after a provider
    // change. Waiting here removes the race from every individual test.
    await window.waitForSelector(".chat-status-dot-connected", {
      timeout: 30_000,
    });

    await use(window);
  },
});

/**
 * Fresh-user fixture: launches with an empty database so the app
 * shows the onboarding page.
 */
export const freshTest = base.extend<ElectronFixtures>({
  ports: async ({}, use, testInfo) => {
    await use(computePorts(testInfo.workerIndex));
  },

  apiBase: async ({ ports }, use) => {
    await use(`http://127.0.0.1:${ports.panel}`);
  },

  electronApp: async ({ ports }, use) => {
    await launchElectronApp(use, ports);
  },

  window: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow({ timeout: 45_000 });
    await window.waitForLoadState("domcontentloaded");
    await window.waitForSelector(".onboarding-page", { timeout: 45_000 });
    await bringWindowToFront(electronApp);

    await use(window);
  },
});

export { expect } from "@playwright/test";
