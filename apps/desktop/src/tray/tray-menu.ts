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
    quit: "Quit TK Copilot",
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
    quit: "退出 TK匠",
  },
  de: {
    state: {
      running: "Gateway: Läuft",
      starting: "Gateway: Wird gestartet...",
      stopping: "Gateway: Wird gestoppt...",
      stopped: "Gateway: Gestoppt",
    },
    openPanel: "Panel öffnen",
    restartGateway: "Gateway neu starten",
    checkForUpdates: "Nach Updates suchen",
    updateAvailable: "Update verfügbar: v{{version}}",
    quit: "TK Copilot beenden",
  },
  es: {
    state: {
      running: "Gateway: En ejecución",
      starting: "Gateway: Iniciando...",
      stopping: "Gateway: Deteniendo...",
      stopped: "Gateway: Detenido",
    },
    openPanel: "Abrir panel",
    restartGateway: "Reiniciar gateway",
    checkForUpdates: "Buscar actualizaciones",
    updateAvailable: "Actualización disponible: v{{version}}",
    quit: "Salir de TK Copilot",
  },
  fr: {
    state: {
      running: "Gateway : en cours",
      starting: "Gateway : démarrage...",
      stopping: "Gateway : arrêt...",
      stopped: "Gateway : arrêté",
    },
    openPanel: "Ouvrir le panneau",
    restartGateway: "Redémarrer le gateway",
    checkForUpdates: "Rechercher des mises à jour",
    updateAvailable: "Mise à jour disponible : v{{version}}",
    quit: "Quitter TK Copilot",
  },
  id: {
    state: {
      running: "Gateway: Berjalan",
      starting: "Gateway: Memulai...",
      stopping: "Gateway: Menghentikan...",
      stopped: "Gateway: Berhenti",
    },
    openPanel: "Buka Panel",
    restartGateway: "Mulai ulang Gateway",
    checkForUpdates: "Periksa pembaruan",
    updateAvailable: "Pembaruan tersedia: v{{version}}",
    quit: "Keluar dari TK Copilot",
  },
  it: {
    state: {
      running: "Gateway: In esecuzione",
      starting: "Gateway: Avvio...",
      stopping: "Gateway: Arresto...",
      stopped: "Gateway: Arrestato",
    },
    openPanel: "Apri pannello",
    restartGateway: "Riavvia gateway",
    checkForUpdates: "Controlla aggiornamenti",
    updateAvailable: "Aggiornamento disponibile: v{{version}}",
    quit: "Esci da TK Copilot",
  },
  th: {
    state: {
      running: "Gateway: กำลังทำงาน",
      starting: "Gateway: กำลังเริ่ม...",
      stopping: "Gateway: กำลังหยุด...",
      stopped: "Gateway: หยุดแล้ว",
    },
    openPanel: "เปิดแผงควบคุม",
    restartGateway: "รีสตาร์ท Gateway",
    checkForUpdates: "ตรวจหาการอัปเดต",
    updateAvailable: "มีอัปเดต: v{{version}}",
    quit: "ออกจาก TK Copilot",
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
