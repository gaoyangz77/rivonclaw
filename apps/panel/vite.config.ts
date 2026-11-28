import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { DEFAULT_PANEL_DEV_PORT, DEFAULTS } from "@rivonclaw/core";

// The browser build ships only the files the page references, not Desktop's
// installer artwork and office assets that share `../desktop/build`.
const WEB_PUBLIC_FILES = ["brand-mark.svg"];

// On app.tkcopilot.com the page uses the website's brand favicons, which nginx
// serves from the server/web build at these root paths (same files as www).
const desktopIconLink = (base: string) => `<link rel="icon" href="${base}icon.ico" />`;
const WEB_ICON_LINKS = [
  '<link rel="icon" href="/favicon.ico" sizes="32x32" />',
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
].join("\n    ");

// `pnpm dev:web` (scripts/dev-web.mjs) serves the Panel and server/web on one
// origin, and both are Vite dev servers whose module URLs (`/@vite/client`,
// `/node_modules/.vite/…`, `/src/…`) would collide. The Panel's dev server
// therefore lives under this prefix; the dev proxy sends page navigations there.
const WEB_DEV_BASE = "/__panel/";
const WEB_DEV_DEFAULT_PORT = 5192;

function webPublicFiles(): Plugin {
  let base = "/";
  return {
    name: "web-public-files",
    configResolved(config) {
      base = config.base;
    },
    // `publicDir` is off in the web build, so serve the same files by hand in dev.
    configureServer(server) {
      // Registered before Vite's own base handling, so the dev base is still on the URL.
      const { base: devBase } = server.config;
      server.middlewares.use((req, res, next) => {
        const name = WEB_PUBLIC_FILES.find((file) => req.url?.split("?")[0] === `${devBase}${file}`);
        if (!name) return next();
        res.setHeader("Content-Type", "image/svg+xml");
        res.end(readFileSync(resolve(__dirname, "../desktop/build", name)));
      });
    },
    // After Vite's own pass, which prefixes the dev base onto the icon's href.
    transformIndexHtml: {
      order: "post",
      handler(html: string) {
        const link = desktopIconLink(base);
        if (!html.includes(link)) {
          throw new Error("index.html no longer has the Desktop icon link the web build replaces");
        }
        return html.replace(link, WEB_ICON_LINKS);
      },
    },
    generateBundle() {
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

export default defineConfig(({ mode, command }) => {
  const web = mode === "web";
  const webDev = web && command === "serve";
  return {
  base: webDev ? WEB_DEV_BASE : "/",
  plugins: web ? [react(), webPublicFiles()] : [react()],
  publicDir: web ? false : "../desktop/build",
  server: web
    ? {
        port: Number(process.env.PANEL_WEB_DEV_PORT ?? WEB_DEV_DEFAULT_PORT),
        strictPort: true,
      }
    : {
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
