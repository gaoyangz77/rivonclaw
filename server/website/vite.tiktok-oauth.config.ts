import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/tiktok-oauth-callback",
  base: "/api/tiktok/oauth/callback/",
  build: {
    outDir: "../../site/api/tiktok/oauth/callback",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/tiktok-oauth-callback/index.html"),
    },
  },
});
