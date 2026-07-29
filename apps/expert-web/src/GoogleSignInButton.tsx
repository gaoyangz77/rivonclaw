import { useEffect, useRef, useState } from "react";
import type { Language } from "./i18n.js";

const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services";
const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface GoogleCredentialResponse {
  credential?: string;
}
interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        ux_mode: "popup";
        auto_select: false;
        cancel_on_tap_outside: true;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type: "standard";
          theme: "outline";
          size: "large";
          text: "continue_with";
          shape: "rectangular";
          width: number;
          locale: string;
        },
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

let googleScriptPromise: Promise<GoogleIdentityServices> | undefined;

function loadGoogleIdentityServices(): Promise<GoogleIdentityServices> {
  if (window.google?.accounts.id) return Promise.resolve(window.google);
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.google?.accounts.id) resolve(window.google);
      else reject(new Error("Google Identity Services did not initialize"));
    };
    const fail = () => reject(new Error("Google Identity Services could not be loaded"));
    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  }).catch((error) => {
    googleScriptPromise = undefined;
    throw error;
  });

  return googleScriptPromise;
}

export interface GoogleSignInButtonProps {
  clientId: string;
  language: Language;
  disabled?: boolean;
  loadingLabel: string;
  onCredential: (credential: string) => void;
  onError: () => void;
}

export function GoogleSignInButton({
  clientId,
  language,
  disabled = false,
  loadingLabel,
  onCredential,
  onError,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const errorRef = useRef(onError);
  const [ready, setReady] = useState(false);

  callbackRef.current = onCredential;
  errorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    setReady(false);
    container.replaceChildren();
    void loadGoogleIdentityServices()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (response) => {
            if (response.credential) callbackRef.current(response.credential);
            else errorRef.current();
          },
        });
        google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: Math.max(240, Math.min(400, containerRef.current.clientWidth || 400)),
          locale: language,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) errorRef.current();
      });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [clientId, language]);

  return (
    <div
      className={`google-button-shell${disabled ? " is-disabled" : ""}`}
      aria-busy={!ready || disabled}
    >
      {!ready ? <span className="google-button-loading">{loadingLabel}</span> : null}
      <div ref={containerRef} />
    </div>
  );
}
