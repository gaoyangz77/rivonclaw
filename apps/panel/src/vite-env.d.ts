/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "web" in the browser build (`vite build --mode web`); unset in the Desktop build. */
  readonly VITE_PANEL_HOST?: "web";
}
