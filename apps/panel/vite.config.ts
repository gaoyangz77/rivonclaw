import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { DEFAULT_PANEL_DEV_PORT, DEFAULTS } from "@rivonclaw/core";

export default defineConfig({
  plugins: [react()],
  publicDir: "../desktop/build",
  server: {
    port: DEFAULT_PANEL_DEV_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://localhost:${DEFAULTS.ports.panelDevBackend}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    exclude: [
      "**/node_modules/**",
      "test/pages/MobilePage.test.tsx", // source file not yet created
    ],
  },
});
