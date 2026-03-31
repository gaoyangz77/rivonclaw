import { test as base, type ElectronApplication, type Page } from "@playwright/test";
import { _electron } from "playwright";
import path from "node:path";
import dotenv from "dotenv";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createConnection } from "node:net";

// Load e2e/.env via dotenv in every worker process.
// Playwright config's env changes don't propagate to Electron test workers.
dotenv.config({ path: path.resolve(__dirname, ".env") });

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

/**
 * Wait for a TCP port to start accepting connections (gateway readiness check).
 *
 * The ChatPage's GatewayChatClient uses exponential backoff (800ms → 15s max)
 * when reconnecting. Under parallel e2e load, the gateway may take several
 * seconds to start listening, and the backoff schedule can misalign — the
 * client sleeps 15s right when the gateway becomes ready. Waiting at the TCP
 * level (500ms poll, no backoff) decouples the fixture from the browser-side
 * retry schedule and makes the connection time deterministic.
 */
async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const listening = await new Promise<boolean>((resolve) => {
      const sock = createConnection({ port, host: "127.0.0.1" });
      sock.once("connect", () => { sock.destroy(); resolve(true); });
      sock.once("error", () => resolve(false));
    });
    if (listening) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Gateway port ${port} did not start listening within ${timeoutMs}ms`);
}

/**
 * Compute unique ports for a Playwright worker based on its index.
 *
 * Workers start at offset 100 (not 0) so worker-0 never collides with a
 * running production RivonClaw instance that uses the same default ports.
 * The vendor derives its browser CDP port from the gateway port
 * (gateway + 2 + 9 = gateway + 11), so matching gateway ports would cause
 * the test to connect to the production Chrome instead of launching its own.
 */
function computePorts(workerIndex: number): WorkerPorts {
  const offset = (workerIndex + 1) * 100;
  return {
    gateway: DEFAULT_GATEWAY_PORT + offset,
    panel: DEFAULT_PANEL_PORT + offset,
    proxy: DEFAULT_PROXY_ROUTER_PORT + offset,
  };
}

/** Create a unique temp directory for data isolation. */
function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "rivonclaw-e2e-"));
}

/** Build a clean env for Electron with data + port isolation. */
function buildEnv(tempDir: string, ports: WorkerPorts): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  delete env.ELECTRON_RUN_AS_NODE;

  // Isolate all persistent state to the temp directory
  env.RIVONCLAW_DB_PATH = path.join(tempDir, "db.sqlite");
  env.RIVONCLAW_SECRETS_DIR = path.join(tempDir, "secrets");
  env.OPENCLAW_STATE_DIR = path.join(tempDir, "openclaw");

  // Assign unique ports so parallel workers don't collide
  env.RIVONCLAW_GATEWAY_PORT = String(ports.gateway);
  env.RIVONCLAW_PANEL_PORT = String(ports.panel);
  env.RIVONCLAW_PROXY_ROUTER_PORT = String(ports.proxy);


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

    // NOTE: Chrome cleanup removed — session-state-agent tests (the only
    // tests that launched Chrome via ManagedBrowserService) have been deleted.
    // If browser-profile tests return, track spawned PIDs in a file under
    // tempDir instead of scanning all processes (pkill/pgrep -f takes 20-50s
    // on macOS due to slow proc_info kernel calls).
    if (testFailed) {
      // Keep temp dir for debugging — print its path
      console.log(`[e2e] Test FAILED — temp dir preserved: ${tempDir}`);
    } else {
      // Retry once: detached gateway processes may still hold file handles
      // briefly after ensurePortFree, causing ENOTEMPTY on first attempt.
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        await new Promise((r) => setTimeout(r, 500));
        rmSync(tempDir, { recursive: true, force: true });
      }
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


/**
 * Returning-user fixture: skips onboarding to reach the main page.
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

  window: async ({ electronApp, apiBase, ports }, use) => {
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

    // If onboarding is shown, skip it to reach the main page
    if (await window.locator(".onboarding-page").isVisible()) {
      await window.locator(".btn-ghost").click();
      await window.waitForSelector(".sidebar-brand", { timeout: 45_000 });
    }

    // Wait for the gateway port to accept TCP connections first.
    // This decouples the fixture from ChatPage's WebSocket exponential backoff
    // (800ms → 15s max), which can misalign with gateway readiness under load.
    await waitForPort(ports.gateway, 45_000);

    // Now that the gateway is listening, the ChatPage's next reconnect attempt
    // will succeed. Worst case: one max-backoff cycle (15s) if the client is
    // currently sleeping between retries, plus handshake time.
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
