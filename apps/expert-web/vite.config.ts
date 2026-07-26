import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const EXPERT_WEB_DEV_PORT = Number(process.env.EXPERT_WEB_DEV_PORT ?? 5181);

export default defineConfig({
  plugins: [react()],
  server: {
    port: EXPERT_WEB_DEV_PORT,
    strictPort: true,
    proxy: {
      "/api/graphql": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          graphql: ["@apollo/client", "graphql", "graphql-ws"],
          state: ["mobx", "mobx-react-lite", "mobx-state-tree"],
          markdown: ["react-markdown", "remark-gfm"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});
