import type {
  App,
  BrowserWindow,
  Details as ChildProcessGoneDetails,
  Event as ElectronEvent,
  RenderProcessGoneDetails,
} from "electron";

const DEFAULT_SAMPLE_INTERVAL_MS = 1_000;
const DEFAULT_WARN_LAG_MS = 2_000;

type DiagnosticLogger = {
  warn: (...args: unknown[]) => unknown;
  error: (...args: unknown[]) => unknown;
};

export type ResponsivenessMonitorOptions = {
  app: App;
  window: BrowserWindow;
  powerMonitor?: {
    on(event: "suspend" | "resume", listener: () => void): unknown;
    removeListener(event: "suspend" | "resume", listener: () => void): unknown;
  };
  log: DiagnosticLogger;
  sampleIntervalMs?: number;
  warnLagMs?: number;
  now?: () => number;
};

/**
 * Capture enough process-level evidence to distinguish a stalled renderer from
 * a blocked Electron main loop. The timer reports the delay after the loop
 * becomes responsive again, which is when logging is possible.
 */
export function startResponsivenessMonitor({
  app,
  window,
  powerMonitor,
  log,
  sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS,
  warnLagMs = DEFAULT_WARN_LAG_MS,
  now = performance.now.bind(performance),
}: ResponsivenessMonitorOptions): () => void {
  const webContents = window.webContents;
  let suspended = false;
  let expectedAt = now() + sampleIntervalMs;
  const timer = setInterval(() => {
    const observedAt = now();
    if (suspended) {
      expectedAt = observedAt + sampleIntervalMs;
      return;
    }
    const lagMs = Math.max(0, observedAt - expectedAt);
    expectedAt = observedAt + sampleIntervalMs;
    if (lagMs >= warnLagMs) {
      log.warn("Electron main event loop was delayed", {
        lagMs: Math.round(lagMs),
        sampleIntervalMs,
      });
    }
  }, sampleIntervalMs);
  timer.unref();

  const onUnresponsive = () => {
    log.warn("Panel renderer became unresponsive", {
      webContentsId: webContents.id,
    });
  };
  const onResponsive = () => {
    log.warn("Panel renderer became responsive", {
      webContentsId: webContents.id,
    });
  };
  const onRenderProcessGone = (_event: ElectronEvent, details: RenderProcessGoneDetails) => {
    log.error("Panel render process exited", {
      webContentsId: webContents.id,
      reason: details.reason,
      exitCode: details.exitCode,
    });
  };
  const onChildProcessGone = (_event: ElectronEvent, details: ChildProcessGoneDetails) => {
    log.error("Electron child process exited", {
      type: details.type,
      reason: details.reason,
      exitCode: details.exitCode,
      serviceName: details.serviceName,
      name: details.name,
    });
  };
  const onSuspend = () => {
    suspended = true;
  };
  const onResume = () => {
    suspended = false;
    expectedAt = now() + sampleIntervalMs;
  };

  window.on("unresponsive", onUnresponsive);
  window.on("responsive", onResponsive);
  webContents.on("render-process-gone", onRenderProcessGone);
  app.on("child-process-gone", onChildProcessGone);
  powerMonitor?.on("suspend", onSuspend);
  powerMonitor?.on("resume", onResume);

  return () => {
    clearInterval(timer);
    window.removeListener("unresponsive", onUnresponsive);
    window.removeListener("responsive", onResponsive);
    webContents.removeListener("render-process-gone", onRenderProcessGone);
    app.removeListener("child-process-gone", onChildProcessGone);
    powerMonitor?.removeListener("suspend", onSuspend);
    powerMonitor?.removeListener("resume", onResume);
  };
}
