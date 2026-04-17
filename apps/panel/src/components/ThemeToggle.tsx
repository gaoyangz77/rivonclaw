import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { trackEvent } from "../api/index.js";
import { useRuntimeStatus } from "../store/RuntimeStatusProvider.js";
import { MonitorIcon, SunIcon, MoonIcon } from "./icons.js";
import type { IconProps } from "./icons.js";

type ThemePreference = "system" | "light" | "dark";

function isThemePreference(v: string): v is ThemePreference {
  return v === "system" || v === "light" || v === "dark";
}

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const THEME_ICON: Record<ThemePreference, (props: IconProps) => React.JSX.Element> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export const ThemeToggle = observer(function ThemeToggle() {
  const { t } = useTranslation();
  const runtimeStatus = useRuntimeStatus();
  const rawTheme = runtimeStatus.appSettings.panelTheme;
  const themePreference: ThemePreference = isThemePreference(rawTheme) ? rawTheme : "system";
  const accent = runtimeStatus.appSettings.panelAccent;
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(getSystemTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const effectiveTheme = themePreference === "system" ? systemTheme : themePreference;

  // Listen for OS theme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Apply theme attribute whenever effective theme changes (driven by MST).
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [effectiveTheme]);

  // Apply accent color reactively from MST (SSE-synced).
  useLayoutEffect(() => {
    if (accent && accent !== "blue") {
      document.documentElement.setAttribute("data-accent", accent);
    } else {
      document.documentElement.removeAttribute("data-accent");
    }
  }, [accent]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function chooseTheme(mode: ThemePreference) {
    setMenuOpen(false);
    trackEvent("ui.theme_changed", { theme: mode });
    // MST action writes through Desktop -> SQLite -> SSE patch back;
    // the useLayoutEffect above reacts to the updated panelTheme.
    runtimeStatus.appSettings.setPanelTheme(mode).catch(() => {});
  }

  const TriggerIcon = THEME_ICON[themePreference];

  return (
    <div className="theme-menu-wrapper" ref={menuRef}>
      <button
        className="theme-menu-trigger"
        onClick={() => setMenuOpen((v) => !v)}
        title={t(`theme.${themePreference}`)}
      >
        <TriggerIcon />
      </button>
      {menuOpen && (
        <div className="theme-menu-popup">
          {(["system", "light", "dark"] as const).map((mode) => {
            const Icon = THEME_ICON[mode];
            return (
              <button
                key={mode}
                className={`theme-menu-option${themePreference === mode ? " theme-menu-option-active" : ""}`}
                onClick={() => chooseTheme(mode)}
              >
                <span className="theme-menu-option-icon"><Icon /></span>
                <span>{t(`theme.${mode}`)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
