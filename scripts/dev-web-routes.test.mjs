import assert from "node:assert/strict";
import { test } from "node:test";

import { route, routeUpgrade } from "./dev-web-routes.mjs";

const page = { wantsHtml: true };
const asset = { wantsHtml: false };

test("the root and every unknown page navigation is the Panel's entry page", () => {
  for (const path of ["/", "/shops", "/campaigns/abc", "/account/billing", "/welcome"]) {
    assert.deepEqual(route(path, page), { to: "panel", path: "/__panel/index.html" }, path);
  }
});

test("server/web pages are server/web", () => {
  for (const path of [
    "/account/login",
    "/account/register",
    "/account/desktop-login",
    "/account/session-transfer",
    "/expert",
    "/expert/anything",
    "/manual/getting-started",
    "/oauth/tiktok/start",
    "/oauth/tiktok/callback/us",
    "/oauth/mcp/authorize",
    "/shops/claim",
    "/payment/success",
    "/api/tiktok/oauth/callback",
  ]) {
    assert.deepEqual(route(path, page), { to: "server-web" }, path);
  }
});

test("Panel account pages are not server/web pages", () => {
  for (const path of ["/account/usage", "/account/billing", "/account/settings", "/account/profile"]) {
    assert.equal(route(path, page).to, "panel", path);
  }
});

test("marketing paths redirect to www", () => {
  for (const path of ["/zh", "/zh/tools/find-creators/", "/terms", "/privacy", "/tutorials/x", "/demo", "/tools"]) {
    assert.deepEqual(route(path, page), { to: "redirect-www" }, path);
  }
});

test("GraphQL and the backend REST endpoints go to the backend, other /api paths are 404", () => {
  assert.deepEqual(route("/api/graphql", asset), { to: "backend-graphql" });
  assert.deepEqual(route("/api/uploads/media", asset), { to: "backend", path: "/api/uploads/media" });
  assert.deepEqual(route("/api/ecommerce/affiliate/upload-draft-attachment", asset).to, "backend");
  assert.deepEqual(route("/api/tiktok/ads/oauth/callback", page).to, "backend");
  assert.deepEqual(route("/api/skills/x", asset), { to: "api-not-found" });
  assert.deepEqual(route("/api/uploads/other", asset), { to: "api-not-found" });
});

test("public files: brand icons and assets are server/web, brand-mark is the Panel's", () => {
  for (const path of ["/favicon.ico", "/favicon.svg", "/apple-touch-icon.png", "/assets/brand/logo.svg", "/web-assets/x.js"]) {
    assert.deepEqual(route(path, asset), { to: "server-web" }, path);
  }
  assert.deepEqual(route("/brand-mark.svg", asset), { to: "panel", path: "/__panel/brand-mark.svg" });
});

test("module requests at the root belong to server/web's dev server, the Panel's are prefixed", () => {
  for (const path of ["/@vite/client", "/app/entry.client.tsx", "/node_modules/.vite/deps/react.js", "/src/AuthForm.tsx"]) {
    assert.deepEqual(route(path, asset), { to: "server-web" }, path);
  }
  assert.deepEqual(route("/__panel/src/main.tsx", asset), { to: "panel", path: "/__panel/src/main.tsx" });
});

test("upgrades: GraphQL to the backend, Panel HMR to the Panel, the rest to server/web", () => {
  assert.deepEqual(routeUpgrade("/api/graphql"), { to: "backend-graphql" });
  assert.deepEqual(routeUpgrade("/__panel/"), { to: "panel", path: "/__panel/" });
  assert.deepEqual(routeUpgrade("/"), { to: "server-web" });
});
