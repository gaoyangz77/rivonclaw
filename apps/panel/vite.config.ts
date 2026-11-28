import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { DEFAULT_PANEL_DEV_PORT, DEFAULTS } from "@rivonclaw/core";

// The browser build ships only the files the page references, not Desktop's
// installer artwork and office assets that share `../desktop/build`.
const WEB_PUBLIC_FILES = ["brand-mark.svg"];

// On app.tkcopilot.com the page uses the website's brand favicons, which nginx
// serves from the server/web build at these root paths (same files as www).
const DESKTOP_ICON_LINK = '<link rel="icon" href="/icon.ico" />';
const WEB_ICON_LINKS = [
  '<link rel="icon" href="/favicon.ico" sizes="32x32" />',
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
].join("\n    ");

function webPublicFiles() {
  return {
    name: "web-public-files",
    transformIndexHtml(html: string) {
      if (!html.includes(DESKTOP_ICON_LINK)) {
        throw new Error("index.html no longer has the Desktop icon link the web build replaces");
      }
      return html.replace(DESKTOP_ICON_LINK, WEB_ICON_LINKS);
    },
    generateBundle(this: { emitFile(file: object): void }) {
      for (const name of WEB_PUBLIC_FILES) {
        this.emitFile({
          type: "asset",
          fileName: name,
          source: readFileSync(resolve(__dirname, "../desktop/build", name)),
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const web = mode === "web";
  return {
  plugins: web ? [react(), webPublicFiles()] : [react()],
  publicDir: web ? false : "../desktop/build",
  server: {
    port: DEFAULT_PANEL_DEV_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${DEFAULTS.ports.panelDevBackend}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: web ? "dist-web" : "dist",
  },
  test: {
    environment: "jsdom",
    // jsdom has no EventSource; the Panel opens one for Desktop's event stream.
    setupFiles: ["./test/setup-dom.ts"],
    exclude: [
      "**/node_modules/**",
    ],
  },
};
});
