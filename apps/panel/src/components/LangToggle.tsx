import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { trackEvent } from "../api/index.js";
import { updateSettings } from "../api/settings.js";
import { LANGUAGE_OPTIONS, normalizeLanguageCode } from "../i18n/languages.js";
import { GlobeIcon } from "./icons.js";

export function LangToggle({ popupDirection = "up" }: { popupDirection?: "up" | "down" }) {
  const { t, i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeLanguage = normalizeLanguageCode(i18n.resolvedLanguage ?? i18n.language);

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
    <div className="lang-menu-wrapper" ref={menuRef}>
      <button
        className="lang-menu-trigger"
        onClick={() => setMenuOpen((v) => !v)}
        title={t("common.language")}
      >
        <GlobeIcon />
      </button>
      {menuOpen && (
        <div className={`lang-menu-popup ${popupDirection === "down" ? "lang-menu-popup-down" : ""}`}>
          {LANGUAGE_OPTIONS.map((language) => (
            <button
              key={language.code}
              className={`lang-menu-option${activeLanguage === language.code ? " lang-menu-option-active" : ""}`}
              onClick={() => {
                i18n.changeLanguage(language.code);
                updateSettings({ locale: language.code }).catch(() => {});
                setMenuOpen(false);
                trackEvent("ui.language_changed", { language: language.code });
              }}
            >
              {language.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
