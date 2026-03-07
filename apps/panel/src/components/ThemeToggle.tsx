import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { trackEvent } from "../api/index.js";

type ThemePreference = "system" | "light" | "dark";

function getInitialPreference(): ThemePreference {
  const stored = localStorage.getItem("theme");
  if (stored === "system" || stored === "dark" || stored === "light") return stored;
  return "system";
}

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const THEME_ICON: Record<ThemePreference, string> = { system: "\u{1F5A5}", light: "\u{2600}\u{FE0F}", dark: "\u{263E}" };

export function ThemeToggle() {
  const { t } = useTranslation();
  const [themePreference, setThemePreference] = useState<ThemePreference>(getInitialPreference);
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

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    localStorage.setItem("theme", themePreference);
  }, [effectiveTheme, themePreference]);

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

  return (
    <div className="theme-menu-wrapper" ref={menuRef}>
      <button
        className="theme-menu-trigger"
        onClick={() => setMenuOpen((v) => !v)}
        title={t(`theme.${themePreference}`)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" />
        </svg>
      </button>
      {menuOpen && (
        <div className="theme-menu-popup">
          {(["system", "light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              className={`theme-menu-option${themePreference === mode ? " theme-menu-option-active" : ""}`}
              onClick={() => { setThemePreference(mode); setMenuOpen(false); trackEvent("ui.theme_changed", { theme: mode }); }}
            >
              <span className="theme-menu-option-icon">{THEME_ICON[mode]}</span>
              <span>{t(`theme.${mode}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
