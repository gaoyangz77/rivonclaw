/**
 * Which process answers a request on the `pnpm dev:web` origin.
 *
 * Reproduces the app-host routing of production nginx
 * (`server/nginx/templates/default.conf.template`, the `app.*` server block;
 * summarized in `server/docs/panel-web-host-rollout.md`) with two Vite dev
 * servers behind it instead of two static builds. Keep the path lists in sync
 * with that block; `dev-web-routes.test.mjs` pins them.
 *
 * `route()` is pure so the table can be tested without sockets.
 */

/** Prefix the Panel's dev server lives under (`WEB_DEV_BASE` in apps/panel/vite.config.ts). */
export const PANEL_BASE = "/__panel/";

/** server/web pages (`server/web/app/routes.ts`), exact as in nginx. */
const SERVER_WEB_PAGE_RE =
  /^\/(?:expert(?:\/.*)?|manual(?:\/.*)?|account\/(?:login|register|desktop-login|session-transfer)(?:\/.*)?|oauth\/(?:tiktok\/(?:start|callback(?:\/.*)?)(?:\/.*)?|mcp\/authorize)|shops\/claim(?:\/.*)?|payment\/success|api\/tiktok\/oauth\/callback)$/;

/** Marketing pages live on www; nginx redirects them. */
const MARKETING_RE = /^\/(?:zh|terms|privacy|tutorials|demo|tools)(?:\/.*)?$/;

/** The brand favicons come from server/web's public directory. */
const BRAND_ICON_RE = /^\/(?:favicon\.(?:ico|svg)|apple-touch-icon\.png)$/;

/** Files of the Panel's web bundle that nginx serves from its root (`WEB_PUBLIC_FILES`). */
const PANEL_ROOT_FILES = new Set(["/brand-mark.svg"]);

/** Backend business endpoints nginx proxies as-is; `/api/graphql` is handled separately. */
const BACKEND_API_RE =
  /^\/api\/(?:uploads\/(?:images|media)|ecommerce\/.*|tiktok\/ads\/oauth\/callback)$/;

/**
 * @typedef {{ to: "backend", path: string }
 *   | { to: "backend-graphql" }
 *   | { to: "panel", path: string }
 *   | { to: "server-web" }
 *   | { to: "redirect-www" }
 *   | { to: "api-not-found" }} Route
 */

/**
 * @param {string} pathname URL path without the query string.
 * @param {{ wantsHtml: boolean }} request `wantsHtml`: the request is a page
 *   navigation (`Accept: text/html`).
 * @returns {Route}
 */
export function route(pathname, { wantsHtml }) {
  if (pathname === "/api/graphql") return { to: "backend-graphql" };
  if (pathname.startsWith(PANEL_BASE)) return { to: "panel", path: pathname };
  if (SERVER_WEB_PAGE_RE.test(pathname)) return { to: "server-web" };
  if (MARKETING_RE.test(pathname)) return { to: "redirect-www" };
  if (BACKEND_API_RE.test(pathname)) return { to: "backend", path: pathname };
  if (pathname.startsWith("/api/")) return { to: "api-not-found" };
  // `/web-assets/` and `/assets/` are server/web's public files; the Panel has
  // no hashed assets in dev, so nginx's "Panel first" fallback is moot here.
  if (pathname.startsWith("/web-assets/") || pathname.startsWith("/assets/")) return { to: "server-web" };
  if (BRAND_ICON_RE.test(pathname)) return { to: "server-web" };
  if (PANEL_ROOT_FILES.has(pathname)) return { to: "panel", path: PANEL_BASE.slice(0, -1) + pathname };
  // Everything else is the Panel in production. In dev, server/web's Vite also
  // serves module URLs at the root (`/@vite/client`, `/app/…`, `/node_modules/…`),
  // which are never page navigations; only navigations belong to the Panel.
  if (wantsHtml) return { to: "panel", path: `${PANEL_BASE}index.html` };
  return { to: "server-web" };
}

/** Where a WebSocket upgrade goes: the GraphQL socket, the Panel's HMR, or server/web's HMR. */
export function routeUpgrade(pathname) {
  if (pathname === "/api/graphql") return { to: "backend-graphql" };
  if (pathname.startsWith(PANEL_BASE)) return { to: "panel", path: pathname };
  return { to: "server-web" };
}
