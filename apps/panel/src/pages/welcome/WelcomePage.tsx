import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { trackEvent, updateSettings } from "../../api/index.js";
import { AuthModal } from "../../components/modals/AuthModal.js";
import { BottomActions } from "../../components/BottomActions.js";
import { AccountIcon, EcommerceIcon, UserPlusIcon } from "../../components/icons.js";

const WELCOME_PAGE_COMPLETED_KEY = "welcome_page_completed";

export function WelcomePage({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("register");
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    trackEvent("welcome.started", { language: i18n.language });
  }, [i18n.language]);

  async function complete(mode: "guest" | "auth") {
    setCompleting(true);
    try {
      await updateSettings({ [WELCOME_PAGE_COMPLETED_KEY]: "1" });
    } catch {
      // Do not trap the user on the welcome page if local settings persistence fails.
    } finally {
      trackEvent(mode === "guest" ? "welcome.skipped_as_guest" : "welcome.completed", { mode });
      setCompleting(false);
      onComplete();
    }
  }

  function openAuth(tab: "login" | "register") {
    setAuthTab(tab);
    setAuthOpen(true);
  }

  return (
    <div className="welcome-page">
      <BottomActions />
      <div className="welcome-top-controls">
        <button
          className="btn-ghost welcome-skip-guest"
          onClick={() => complete("guest")}
          disabled={completing}
        >
          {t("welcome.useAsGuest")}
        </button>
      </div>

      <main className="welcome-card" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <div className="welcome-kicker">
            <EcommerceIcon size={16} />
            <span>{t("welcome.kicker")}</span>
          </div>
          <h1 id="welcome-title">{t("welcome.accountTitle")}</h1>
          <p>{t("welcome.accountDesc")}</p>
        </div>

        <div className="welcome-choice-grid">
          <button
            type="button"
            className="welcome-choice-button welcome-choice-button-primary"
            onClick={() => openAuth("register")}
          >
            <span className="welcome-choice-icon"><UserPlusIcon size={24} /></span>
            <strong>{t("welcome.createAccountTitle")}</strong>
            <span>{t("welcome.createAccountDesc")}</span>
          </button>
          <button
            type="button"
            className="welcome-choice-button"
            onClick={() => openAuth("login")}
          >
            <span className="welcome-choice-icon"><AccountIcon size={24} /></span>
            <strong>{t("welcome.loginTitle")}</strong>
            <span>{t("welcome.loginDesc")}</span>
          </button>
        </div>

      </main>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialTab={authTab}
        modeSwitch="inlineLink"
        onSuccess={() => complete("auth")}
      />
    </div>
  );
}
