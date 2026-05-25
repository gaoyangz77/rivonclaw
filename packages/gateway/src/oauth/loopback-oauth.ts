import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import type { Socket } from "node:net";

export interface LoopbackOAuthCallbackOptions {
  providerLabel: string;
  preferredPort: number;
  fallbackPorts?: number[];
  callbackPath: string;
  expectedState: string;
  timeoutMs: number;
  allowEphemeralPort?: boolean;
  onProgress?: (message: string) => void;
  successTitle?: string;
  successBody?: string;
  staleTitle?: string;
  staleBody?: string;
}

export interface LoopbackOAuthCallback {
  port: number;
  redirectUri: string;
  usedPreferredPort: boolean;
  waitForCallback: Promise<{ code: string; state: string }>;
  close: (reason?: Error) => void;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlPage(title: string, body: string): string {
  return (
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
    `<title>${escapeHtml(title)}</title></head><body>` +
    `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>` +
    "</body></html>"
  );
}

function sendHtml(res: ServerResponse, status: number, title: string, body: string): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(htmlPage(title, body));
}

export async function startLoopbackOAuthCallback(
  options: LoopbackOAuthCallbackOptions,
): Promise<LoopbackOAuthCallback> {
  const hostname = "127.0.0.1";
  const allowEphemeralPort = options.allowEphemeralPort ?? true;
  const sockets = new Set<Socket>();
  let timeout: NodeJS.Timeout | undefined;
  let settled = false;

  let resolveCallback!: (value: { code: string; state: string }) => void;
  let rejectCallback!: (err: Error) => void;
  const waitForCallback = new Promise<{ code: string; state: string }>((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  const server = createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", `http://${hostname}`);
      if (requestUrl.pathname !== options.callbackPath) {
        sendHtml(res, 404, "Not Found", "Callback route not found.");
        return;
      }

      const error = requestUrl.searchParams.get("error");
      const code = requestUrl.searchParams.get("code")?.trim();
      const state = requestUrl.searchParams.get("state")?.trim();

      if (error) {
        sendHtml(res, 400, "OAuth Error", `Authentication failed: ${error}`);
        setImmediate(() => finish(new Error(`${options.providerLabel} OAuth error: ${error}`)));
        return;
      }

      if (!code || !state) {
        sendHtml(
          res,
          400,
          "OAuth Error",
          "Missing OAuth code or state. Return to the app and try again.",
        );
        return;
      }

      if (state !== options.expectedState) {
        sendHtml(
          res,
          200,
          options.staleTitle ?? "Session Expired",
          options.staleBody ??
            "This authorization link is from a previous attempt. Return to the app and try again.",
        );
        return;
      }

      sendHtml(
        res,
        200,
        options.successTitle ?? "Authentication Complete",
        options.successBody ?? "You can close this window and return to the app.",
      );
      setImmediate(() => finish(undefined, { code, state }));
    } catch (err) {
      sendHtml(res, 500, "OAuth Error", "Internal error while processing OAuth callback.");
      setImmediate(() => finish(err instanceof Error ? err : new Error("OAuth callback failed")));
    }
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  function listen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.off("listening", onListening);
        reject(err);
      };
      const onListening = () => {
        server.off("error", onError);
        const addr = server.address();
        resolve(typeof addr === "object" && addr ? addr.port : port);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, hostname);
    });
  }

  let port: number | undefined;
  let usedPreferredPort = true;

  const fixedPorts = [options.preferredPort, ...(options.fallbackPorts ?? [])];
  let lastBindError: unknown;
  for (const candidatePort of fixedPorts) {
    try {
      port = await listen(candidatePort);
      usedPreferredPort = candidatePort === options.preferredPort;
      if (!usedPreferredPort) {
        options.onProgress?.(
          `${options.providerLabel} callback port ${options.preferredPort} was unavailable; using ${port}.`,
        );
      }
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EADDRINUSE" && code !== "EACCES") {
        throw err;
      }
      lastBindError = err;
    }
  }

  if (port === undefined) {
    if (!allowEphemeralPort) {
      throw lastBindError;
    }
    usedPreferredPort = false;
    port = await listen(0);
    options.onProgress?.(
      `${options.providerLabel} callback port ${options.preferredPort} was unavailable; using ${port}.`,
    );
  }

  const redirectUri = `http://${hostname}:${port}${options.callbackPath}`;
  timeout = setTimeout(() => {
    finish(new Error(`Timed out waiting for ${options.providerLabel} OAuth callback`));
  }, options.timeoutMs);
  options.onProgress?.(`Waiting for ${options.providerLabel} OAuth callback on ${redirectUri}...`);

  function finish(err?: Error, result?: { code: string; state: string }): void {
    if (settled) return;
    settled = true;
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    for (const socket of sockets) socket.destroy();
    try {
      server.close();
    } catch {
      // ignore close errors
    }
    if (err) {
      rejectCallback(err);
    } else if (result) {
      resolveCallback(result);
    }
  }

  return {
    port,
    redirectUri,
    usedPreferredPort,
    waitForCallback,
    close: (reason?: Error) =>
      finish(reason ?? new Error(`${options.providerLabel} OAuth callback closed`)),
  };
}
