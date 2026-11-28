#!/usr/bin/env node
/**
 * `pnpm dev:web` — review the browser app (app.tkcopilot.com) on localhost, with
 * hot reload and no deploy.
 *
 * One localhost origin (http://app.localhost:5190), because the browser session is an HttpOnly refresh
 * cookie that is host-only (ADR-054): the Panel web host, the real server/web
 * pages (login, OAuth, Expert, manual) and GraphQL over HTTP and WebSocket must
 * share it. A small proxy in this file is that origin; it reproduces the
 * app-host routing of production nginx (see `dev-web-routes.mjs`) in front of
 *
 *   - the Panel in web mode, Vite dev (apps/panel, under /__panel/),
 *   - the server/web dev server (server/web),
 *   - a backend: the local mock-cloud (default), a local backend or staging.
 *
 *   pnpm dev:web                       mock-cloud on :4300 (started if not running)
 *   pnpm dev:web -- --backend local    a backend on http://localhost:4100
 *   pnpm dev:web -- --backend staging  https://api-stg.rivonclaw.com
 *
 * Ctrl-C stops every child. Ports: DEV_WEB_PORT (origin, 5190),
 * WEB_DEV_PORT (server/web, 5191), PANEL_WEB_DEV_PORT (Panel, 5192),
 * MOCK_CLOUD_PORT (mock, 4300).
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PANEL_BASE, route, routeUpgrade } from "./dev-web-routes.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WWW_ORIGIN = "https://www.tkcopilot.com";
const STAGING_API = "https://api-stg.rivonclaw.com";
const LOCAL_BACKEND = "http://localhost:4100";
const STARTUP_TIMEOUT_MS = 180_000;

const port = (name, fallback) => Number(process.env[name] ?? fallback);
const ORIGIN_PORT = port("DEV_WEB_PORT", 5190);
const WEB_PORT = port("WEB_DEV_PORT", 5191);
const PANEL_PORT = port("PANEL_WEB_DEV_PORT", 5192);
const MOCK_PORT = port("MOCK_CLOUD_PORT", 4300);

const BACKENDS = {
  mock: { label: "mock-cloud", url: `http://127.0.0.1:${MOCK_PORT}` },
  local: { label: "local backend", url: LOCAL_BACKEND },
  staging: { label: "staging (api-stg)", url: STAGING_API },
};

class UserError extends Error {}

function parseArgs(argv) {
  let backend = "mock";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--backend") backend = argv[(i += 1)] ?? "";
    else if (arg.startsWith("--backend=")) backend = arg.slice("--backend=".length);
    else throw new UserError(`Unknown argument ${JSON.stringify(arg)}. Usage: pnpm dev:web [-- --backend mock|local|staging]`);
  }
  if (!(backend in BACKENDS)) {
    throw new UserError(`Unknown --backend ${JSON.stringify(backend)}. Expected one of: ${Object.keys(BACKENDS).join(", ")}.`);
  }
  return { backend };
}

// ---------------------------------------------------------------------------
// Ports and readiness
// ---------------------------------------------------------------------------

// No host: bind the wildcard address, so a listener on IPv4 or IPv6 loopback
// alike (Vite binds `localhost`, which may be `::1`) makes the port busy.
function isPortFree(portNumber) {
  return new Promise((done) => {
    const probe = net.createServer();
    probe.once("error", () => done(false));
    probe.listen(portNumber, () => probe.close(() => done(true)));
  });
}

async function requirePortsFree(entries) {
  for (const [name, portNumber, envVar] of entries) {
    if (!(await isPortFree(portNumber))) {
      throw new UserError(
        `Port ${portNumber} (${name}) is already in use. Stop whatever holds it (lsof -iTCP:${portNumber} -sTCP:LISTEN) or pick another with ${envVar}=<port>.`,
      );
    }
  }
}

async function httpStatus(url, init) {
  try {
    return (await fetch(url, { ...init, signal: AbortSignal.timeout(5_000) })).status;
  } catch {
    return null;
  }
}

async function waitFor(name, url, child) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new UserError(`${name} exited with code ${child.exitCode} before it was ready (see its output above).`);
    }
    const status = await httpStatus(url);
    if (status !== null && status < 500) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new UserError(`${name} did not answer ${url} within ${STARTUP_TIMEOUT_MS / 1000}s.`);
}

/** A `__typename` POST: proves the target is a GraphQL endpoint that answers. Returns why not, or null. */
async function graphqlProblem(url) {
  try {
    const response = await fetch(`${url}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
      signal: AbortSignal.timeout(15_000),
    });
    return response.status === 200 ? null : `it answered HTTP ${response.status}`;
  } catch (error) {
    return error.cause?.code ?? error.message;
  }
}

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

const children = [];
let shuttingDown = false;
let originServer = null;

function start(name, command, args, { cwd, env = {} }) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    // Its own process group, so shutdown reaches the grandchildren (pnpm -> vite).
    detached: true,
  });
  const prefix = `[${name}] `;
  for (const stream of [child.stdout, child.stderr]) {
    let pending = "";
    stream.on("data", (chunk) => {
      const lines = (pending + chunk).split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) process.stdout.write(prefix + line + "\n");
    });
  }
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`\n${prefix}exited unexpectedly (${signal ?? `code ${code}`}); stopping everything.`);
      void shutdown(1);
    }
  });
  children.push({ name, child });
  return child;
}

function isAlive(child) {
  return child.exitCode === null && child.signalCode === null;
}

function signalGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (children.length > 0) console.log("\nStopping...");
  originServer?.closeAllConnections();
  originServer?.close();
  const running = children.map(({ child }) => child).filter(isAlive);
  for (const child of running) signalGroup(child, "SIGTERM");
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline && running.some(isAlive)) {
    await new Promise((done) => setTimeout(done, 100));
  }
  for (const child of running.filter(isAlive)) signalGroup(child, "SIGKILL");
  process.exit(exitCode);
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

async function startBackend(kind) {
  const backend = BACKENDS[kind];
  if (kind === "mock") {
    const mockDir = resolve(ROOT, "mock-cloud");
    if ((await httpStatus(`${backend.url}/__control/health`)) === 200) {
      console.log(`Reusing the mock-cloud already running on ${backend.url}.`);
      return backend;
    }
    if (!(await isPortFree(MOCK_PORT))) {
      throw new UserError(`Port ${MOCK_PORT} (mock-cloud) is held by something that is not a mock-cloud. Free it or set MOCK_CLOUD_PORT.`);
    }
    if (!existsSync(resolve(mockDir, "package.json"))) {
      throw new UserError(`mock-cloud is not checked out at ${mockDir}. Clone it there, or use --backend local|staging.`);
    }
    if (!existsSync(resolve(mockDir, "node_modules"))) {
      throw new UserError(`mock-cloud has no dependencies installed: cd ${mockDir} && pnpm install`);
    }
    const child = start("mock", "pnpm", ["start"], { cwd: mockDir, env: { MOCK_CLOUD_PORT: String(MOCK_PORT) } });
    await waitFor("mock-cloud", `${backend.url}/__control/health`, child);
    return backend;
  }
  const problem = await graphqlProblem(backend.url);
  if (problem !== null) {
    throw new UserError(
      kind === "local"
        ? `No backend answers a GraphQL request at ${backend.url}/graphql (${problem}). Start it (server/backend) or use the default mock.`
        : `Staging at ${backend.url}/graphql did not answer a GraphQL request (${problem}). Check your network.`,
    );
  }
  return backend;
}

// ---------------------------------------------------------------------------
// The origin
// ---------------------------------------------------------------------------

function targetOf(destination, backendUrl) {
  if (destination === "panel") return new URL(`http://localhost:${PANEL_PORT}`);
  if (destination === "server-web") return new URL(`http://localhost:${WEB_PORT}`);
  return new URL(backendUrl);
}

const isBackend = (destination) => destination.startsWith("backend");

function transportOf(target) {
  return target.protocol === "https:" ? https : http;
}

/**
 * Request headers for the target. A backend gets its own `Host` (it may be a
 * virtual host, and staging is behind TLS); the dev servers get the browser's,
 * so their absolute URLs and HMR point back at this origin.
 */
function forwardHeaders(req, target, destination) {
  const headers = { ...req.headers };
  if (isBackend(destination)) headers.host = target.host;
  return headers;
}

/**
 * The backend's cookie is meant for its own HTTPS host; on `http://localhost` a
 * `Secure` or `Domain` attribute would make the browser drop it or refuse to
 * send it back. It stays host-only, which is the property that matters.
 */
function localizeSetCookie(value) {
  return value
    .split(/;\s*/)
    .filter((part) => !/^(?:secure|domain=.*|partitioned)$/i.test(part))
    .join("; ");
}

function proxyHttp(req, res, destination, path, backendUrl) {
  const target = targetOf(destination, backendUrl);
  const upstream = transportOf(target).request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path,
      headers: forwardHeaders(req, target, destination),
    },
    (upstreamRes) => {
      const headers = { ...upstreamRes.headers };
      if (isBackend(destination) && headers["set-cookie"]) {
        headers["set-cookie"] = headers["set-cookie"].map(localizeSetCookie);
      }
      res.writeHead(upstreamRes.statusCode ?? 502, headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    console.error(`[origin] ${req.method} ${req.url} -> ${destination}: ${error.message || error.code}`);
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`dev:web could not reach ${destination}: ${error.message || error.code}\n`);
  });
  req.pipe(upstream);
}

function proxyUpgrade(req, socket, head, destination, path, backendUrl) {
  const target = targetOf(destination, backendUrl);
  const upstream = transportOf(target).request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port,
    method: req.method,
    path,
    headers: forwardHeaders(req, target, destination),
  });
  upstream.on("upgrade", (upstreamRes, upstreamSocket, upstreamHead) => {
    const lines = [`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}`];
    for (let i = 0; i < upstreamRes.rawHeaders.length; i += 2) {
      lines.push(`${upstreamRes.rawHeaders[i]}: ${upstreamRes.rawHeaders[i + 1]}`);
    }
    socket.write(lines.join("\r\n") + "\r\n\r\n");
    if (upstreamHead.length) socket.write(upstreamHead);
    upstreamSocket.pipe(socket).pipe(upstreamSocket);
    upstreamSocket.on("error", () => socket.destroy());
    socket.on("error", () => upstreamSocket.destroy());
  });
  upstream.on("response", (upstreamRes) => {
    // The target refused the upgrade with a plain HTTP answer: relay the status, then close.
    socket.end(`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\nConnection: close\r\n\r\n`);
  });
  upstream.on("error", (error) => {
    console.error(`[origin] upgrade ${req.url} -> ${destination}: ${error.message || error.code}`);
    socket.destroy();
  });
  upstream.end(head);
}

function startOrigin(backendUrl) {
  originServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const wantsHtml = (req.headers.accept ?? "").includes("text/html");
    const decision = route(url.pathname, { wantsHtml });
    switch (decision.to) {
      case "redirect-www":
        res.writeHead(302, { Location: WWW_ORIGIN + url.pathname + url.search });
        res.end();
        return;
      case "api-not-found":
        res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end('{"error":"Not found"}');
        return;
      case "backend-graphql":
        proxyHttp(req, res, "backend-graphql", "/graphql" + url.search, backendUrl);
        return;
      case "backend":
      case "panel":
        proxyHttp(req, res, decision.to, decision.path + url.search, backendUrl);
        return;
      default:
        proxyHttp(req, res, "server-web", url.pathname + url.search, backendUrl);
    }
  });
  originServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const decision = routeUpgrade(url.pathname);
    const path = decision.to === "backend-graphql" ? "/graphql" + url.search : url.pathname + url.search;
    proxyUpgrade(req, socket, head, decision.to, path, backendUrl);
  });
  return new Promise((done, fail) => {
    originServer.once("error", fail);
    originServer.listen(ORIGIN_PORT, "localhost", done);
  });
}

// ---------------------------------------------------------------------------

async function main() {
  const { backend: kind } = parseArgs(process.argv.slice(2));

  await requirePortsFree([
    ["dev origin", ORIGIN_PORT, "DEV_WEB_PORT"],
    ["server/web", WEB_PORT, "WEB_DEV_PORT"],
    ["Panel", PANEL_PORT, "PANEL_WEB_DEV_PORT"],
  ]);
  for (const [dir, hint] of [
    ["apps/panel", "pnpm install"],
    ["server/web", "cd server/web && npm install"],
  ]) {
    if (!existsSync(resolve(ROOT, dir, "node_modules"))) {
      throw new UserError(`${dir} has no dependencies installed: ${hint}`);
    }
  }

  const backend = await startBackend(kind);

  const panel = start("panel", "pnpm", ["exec", "vite", "--mode", "web"], {
    cwd: resolve(ROOT, "apps/panel"),
    env: { PANEL_WEB_DEV_PORT: String(PANEL_PORT) },
  });
  const web = start("web", "npm", ["run", "dev"], {
    cwd: resolve(ROOT, "server/web"),
    env: { WEB_DEV_PORT: String(WEB_PORT), WEB_DEV_API_TARGET: backend.url },
  });
  await Promise.all([
    waitFor("Panel", `http://localhost:${PANEL_PORT}${PANEL_BASE}`, panel),
    waitFor("server/web", `http://localhost:${WEB_PORT}/account/login`, web),
  ]);

  await startOrigin(backend.url);

  // `app.localhost`, not `localhost`: server/web treats the Panel's root as a
  // Panel page only on a host named `app.*` (`isPanelReturnPath`), so after
  // signing in from `localhost` it would land on its own marketing homepage.
  // Browsers resolve `*.localhost` to the loopback interface, and the cookie
  // stays host-only.
  const origin = `http://app.localhost:${ORIGIN_PORT}`;
  const signIn = kind === "mock" ? "\n  Sign in  demo@brightloom.test, any password, any captcha text" : "";
  console.log(`
  TK Copilot web app, local
  ------------------------------------------------------------
  Open     ${origin}/
  Backend  ${backend.label}  ${backend.url}
  Panel    ${origin}/  (Vite, hot reload; internal :${PANEL_PORT})
  Pages    ${origin}/account/login, /expert, /manual  (server/web; internal :${WEB_PORT})
  GraphQL  ${origin}/api/graphql  (HTTP and WebSocket)${signIn}
  Ctrl-C stops everything.
  ------------------------------------------------------------
`);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => void shutdown(0));

main().catch(async (error) => {
  if (error instanceof UserError) console.error(`\ndev:web: ${error.message}`);
  else console.error(error);
  await shutdown(1);
});
