import { trackEvent } from "../../../api/index.js";
import { useRuntimeStatus } from "../../../store/RuntimeStatusProvider.js";

/**
 * Appearance settings — accent color and tutorial toggle.
 *
 * Values are read reactively from runtimeStatus.appSettings (MST), so the
 * consuming component MUST be wrapped with observer() from mobx-react-lite
 * to re-render on SSE-driven changes. Mutations go through MST setter
 * actions which call the Desktop settings REST endpoint; the SSE patch
 * flows back automatically and observers update.
 */
export function useAppearanceSettings() {
  const runtimeStatus = useRuntimeStatus();
  const accentColor = runtimeStatus.appSettings.panelAccent;
  const tutorialEnabled = runtimeStatus.appSettings.tutorialEnabled;

  function handleAccentColorChange(color: string) {
    runtimeStatus.appSettings.setPanelAccent(color).catch(() => {});
    trackEvent("settings.accent_color_changed", { color });
  }

  function handleToggleTutorial(enabled: boolean) {
    runtimeStatus.appSettings.setTutorialEnabled(enabled).catch(() => {});
  }

  return {
    accentColor,
    tutorialEnabled,
    handleAccentColorChange,
    handleToggleTutorial,
  };
}
