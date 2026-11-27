import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { DEFAULT_PANEL_DEV_PORT, DEFAULTS } from "@rivonclaw/core";

// The browser build ships only the icons the page references, not Desktop's
// installer artwork and office assets that share `../desktop/build`.
const WEB_PUBLIC_FILES = ["icon.ico", "icon.png", "brand-mark.svg"];

function webPublicFiles() {
  return {
    name: "web-public-files",
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
