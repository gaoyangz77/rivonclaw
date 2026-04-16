import { Menu } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import type { GatewayState } from "@rivonclaw/gateway";

/** Per-locale label set for the tray menu. */
interface TrayLabels {
  state: Record<GatewayState, string>;
  openPanel: string;
  restartGateway: string;
  checkForUpdates: string;
  updateAvailable: string;
  quit: string;
}

/** Supported locale label maps. */
const LABELS: Record<string, TrayLabels> = {
  en: {
    state: {
      running: "Gateway: Running",
      starting: "Gateway: Starting...",
      stopping: "Gateway: Stopping...",
      stopped: "Gateway: Stopped",
    },
    openPanel: "Open Panel",
    restartGateway: "Restart Gateway",
    checkForUpdates: "Check for Updates",
    updateAvailable: "Update Available: v{{version}}",
    quit: "Quit DlxAI",
  },
  zh: {
    state: {
      running: "网关：运行中",
      starting: "网关：启动中…",
      stopping: "网关：停止中…",
      stopped: "网关：已停止",
    },
    openPanel: "打开面板",
    restartGateway: "重启网关",
    checkForUpdates: "检查更新",
    updateAvailable: "有新版本: v{{version}}",
    quit: "退出 DlxAI",
  },
};

/** Callbacks wired into the tray context menu. */
export interface TrayMenuCallbacks {
  onOpenPanel: () => void;
  onRestartGateway: () => void;
  onCheckForUpdates: () => void;
  onQuit: () => void;
  /** If set, shows "Update Available" instead of "Check for Updates". */
  updateInfo?: { latestVersion: string; onDownload: () => void };
}

/**
 * Build the tray context menu.
 *
 * The menu displays the current gateway status (as a disabled label),
 * followed by action items: Open Panel, Restart Gateway, Update, and Quit.
 *
 * @param locale - "en" or "zh"; defaults to "en".
 */
export function buildTrayMenu(
  state: GatewayState,
  callbacks: TrayMenuCallbacks,
  locale: string = "en",
): Menu {
  const labels = LABELS[locale] ?? LABELS.en;
  const isTransitioning = state === "starting" || state === "stopping";

  const updateItem: MenuItemConstructorOptions = callbacks.updateInfo
    ? {
        label: labels.updateAvailable.replace("{{version}}", callbacks.updateInfo.latestVersion),
        click: () => callbacks.updateInfo!.onDownload(),
      }
    : {
        label: labels.checkForUpdates,
        click: callbacks.onCheckForUpdates,
      };

  const template: MenuItemConstructorOptions[] = [
    {
      label: labels.state[state],
      enabled: false,
    },
    { type: "separator" },
    {
      label: labels.openPanel,
      click: callbacks.onOpenPanel,
      enabled: state === "running",
    },
    { type: "separator" },
    {
      label: labels.restartGateway,
      click: callbacks.onRestartGateway,
      enabled: !isTransitioning,
    },
    { type: "separator" },
    updateItem,
    { type: "separator" },
    {
      label: labels.quit,
      click: callbacks.onQuit,
    },
  ];

  return Menu.buildFromTemplate(template);
}
