import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { arch, platform, release } from "node:os";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("gateway:openai-codex-compatibility-proxy");

const LOOPBACK_HOST = "127.0.0.1";
// OpenClaw appends `/responses` to the configured provider base URL. The
// upstream `/backend-api/codex` prefix remains private to this fixed proxy.
const CODEX_RESPONSES_PATH = "/responses";
const OPENAI_CODEX_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";
const MAX_REQUEST_BYTES = 32 * 1024 * 1024;

/**
 * TEMPORARY: this is the minimum Codex transport version used by our GPT-5.6
 * catalog overlay while the pinned OpenClaw runtime still emits the legacy
 * full Responses payload. Remove the proxy together with that overlay after
 * the vendor runtime natively supports GPT-5.6 Responses Lite.
 */
export const OPENAI_CODEX_COMPATIBILITY_CLIENT_VERSION = "0.146.0-alpha.3.1";
export const OPENAI_CODEX_COMPATIBILITY_ORIGINATOR = "Codex Desktop";

function compatibilityOsName(): string {
  switch (platform()) {
    case "darwin":
      return "Mac OS";
    case "win32":
      return "Windows";
    case "linux":
      return "Linux";
    default:
      return platform();
  }
}

const REQUEST_HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const RESPONSE_HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export interface OpenAICodexCompatibilityProxyOptions {
  fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response>;
  port?: number;
}

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeResponsesLitePayload(payload: JsonRecord): string {
  const input = Array.isArray(payload.input) ? payload.input : [];
  const inputShapes = input.map((item) => {
    if (!isJsonRecord(item)) return typeof item;
    const contentTypes = Array.isArray(item.content)
      ? item.content.map((content) =>
          isJsonRecord(content) && typeof content.type === "string" ? content.type : typeof content,
        )
      : [];
    return {
      type: item.type,
      role: item.role,
      keys: Object.keys(item).sort(),
      contentTypes,
    };
  });
  return JSON.stringify({
    model: payload.model,
    keys: Object.keys(payload).sort(),
    inputShapes,
    additionalToolCount:
      isJsonRecord(input[0]) && Array.isArray(input[0].tools) ? input[0].tools.length : 0,
    reasoning: payload.reasoning,
  });
}

/**
 * Converts the pinned vendor's full Responses payload into the Responses Lite
 * shape required by GPT-5.6. Tool schemas and conversation items are preserved;
 * only their protocol-level placement changes.
 */
export function adaptOpenAICodexRequestForResponsesLite(
  payload: unknown,
  sessionId?: string,
): JsonRecord {
  if (!isJsonRecord(payload) || typeof payload.model !== "string") {
    throw new Error("Invalid OpenAI Codex request payload");
  }
  if (!payload.model.startsWith("gpt-5.6")) {
    throw new Error(`Unsupported compatibility model: ${payload.model}`);
  }

  const input = Array.isArray(payload.input) ? [...payload.input] : [];
  const tools = Array.isArray(payload.tools) ? payload.tools : [];
  const prefix: JsonRecord[] = [
    {
      type: "additional_tools",
      role: "developer",
      tools,
    },
  ];
  if (typeof payload.instructions === "string" && payload.instructions.length > 0) {
    prefix.push({
      type: "message",
      role: "developer",
      content: [{ type: "input_text", text: payload.instructions }],
    });
  }

  const reasoning = isJsonRecord(payload.reasoning) ? { ...payload.reasoning } : undefined;
  if (reasoning) {
    delete reasoning.summary;
    reasoning.context = "all_turns";
  }

  const adapted: JsonRecord = {
    ...payload,
    input: [...prefix, ...input],
    parallel_tool_calls: false,
  };
  delete adapted.instructions;
  delete adapted.tools;
  // Responses Lite controls output budgeting server-side and rejects the
  // legacy Responses API field emitted by the pinned OpenClaw transport.
  delete adapted.max_output_tokens;
  if (reasoning) adapted.reasoning = reasoning;

  if (sessionId) {
    adapted.client_metadata = {
      session_id: sessionId,
      thread_id: sessionId,
      "x-codex-window-id": `${sessionId}:0`,
    };
  }
  return adapted;
}

/**
 * Narrow loopback reverse proxy for the temporary GPT-5.6 Codex overlay.
 *
 * The upstream URL is fixed and credentials are only forwarded in-memory. The
 * server deliberately has no generic proxy route, so another local caller
 * cannot use it to reach arbitrary destinations.
 */
export class OpenAICodexCompatibilityProxy {
  private readonly fetchFn: OpenAICodexCompatibilityProxyOptions["fetchFn"];
  private readonly requestedPort: number;
  private server: Server | null = null;
  private readonly activeRequests = new Set<AbortController>();

  constructor(options: OpenAICodexCompatibilityProxyOptions) {
    this.fetchFn = options.fetchFn;
    this.requestedPort = options.port ?? 0;
  }

  getBaseUrl(): string | undefined {
    const address = this.server?.address();
    if (!address || typeof address === "string") return undefined;
    return `http://${LOOPBACK_HOST}:${(address as AddressInfo).port}`;
  }

  async start(): Promise<void> {
    if (this.server) return;

    const server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });

    // The OpenClaw transport probes WebSocket before falling back to SSE.
    // This compatibility boundary intentionally supports only the auditable
    // HTTP/SSE route.
    server.on("upgrade", (_request, socket) => {
      socket.destroy();
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.close();
        reject(error);
      };
      server.once("error", onError);
      server.listen(this.requestedPort, LOOPBACK_HOST, () => {
        server.off("error", onError);
        resolve();
      });
    });

    this.server = server;
    log.info(`OpenAI Codex compatibility proxy listening at ${this.getBaseUrl()}`);
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) return;
    this.server = null;

    for (const controller of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
    server.closeAllConnections();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== "POST" || request.url !== CODEX_RESPONSES_PATH) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const controller = new AbortController();
    this.activeRequests.add(controller);
    response.on("close", () => {
      if (!response.writableEnded) controller.abort();
    });

    try {
      const headers = this.buildUpstreamHeaders(request);
      const adaptedPayload = adaptOpenAICodexRequestForResponsesLite(
        JSON.parse((await this.readRequestBody(request)).toString("utf8")),
        headers.get("session-id") ?? headers.get("session_id") ?? undefined,
      );
      const body = Buffer.from(JSON.stringify(adaptedPayload));
      headers.set("content-type", "application/json");
      headers.set("x-openai-internal-codex-responses-lite", "true");
      const upstream = await this.fetchFn(OPENAI_CODEX_RESPONSES_URL, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      if (!upstream.ok) {
        const requestId = upstream.headers.get("x-request-id") ?? "unknown";
        log.warn(
          `OpenAI Codex Responses Lite upstream rejected status=${upstream.status} requestId=${requestId} shape=${describeResponsesLitePayload(adaptedPayload)}`,
        );
      }

      response.writeHead(upstream.status, this.buildDownstreamHeaders(upstream.headers));
      if (!upstream.body) {
        response.end();
        return;
      }

      for await (const chunk of upstream.body) {
        if (response.destroyed) break;
        response.write(chunk);
      }
      response.end();
    } catch (error) {
      if (controller.signal.aborted) {
        if (!response.destroyed) response.destroy();
        return;
      }
      log.warn(
        `OpenAI Codex compatibility request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      if (!response.headersSent) {
        response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      response.end("OpenAI Codex compatibility request failed");
    } finally {
      this.activeRequests.delete(controller);
    }
  }

  private buildUpstreamHeaders(request: IncomingMessage): Headers {
    const headers = new Headers();
    for (const [name, rawValue] of Object.entries(request.headers)) {
      if (REQUEST_HOP_BY_HOP_HEADERS.has(name) || rawValue === undefined) continue;
      if (Array.isArray(rawValue)) {
        for (const value of rawValue) headers.append(name, value);
      } else {
        headers.set(name, rawValue);
      }
    }

    headers.set("originator", OPENAI_CODEX_COMPATIBILITY_ORIGINATOR);
    headers.set("version", OPENAI_CODEX_COMPATIBILITY_CLIENT_VERSION);
    const sessionId = headers.get("session-id") ?? headers.get("session_id");
    if (sessionId) {
      headers.set("session-id", sessionId);
      headers.set("thread-id", sessionId);
      headers.set("x-codex-window-id", `${sessionId}:0`);
    }
    headers.set(
      "user-agent",
      `${OPENAI_CODEX_COMPATIBILITY_ORIGINATOR}/${OPENAI_CODEX_COMPATIBILITY_CLIENT_VERSION} (${compatibilityOsName()} ${release()}; ${arch()}) dumb (codex_exec; ${OPENAI_CODEX_COMPATIBILITY_CLIENT_VERSION})`,
    );
    // Keep the response stream uncompressed so forwarding cannot accidentally
    // retain an upstream content-encoding header after fetch decompression.
    headers.set("accept-encoding", "identity");
    return headers;
  }

  private buildDownstreamHeaders(upstreamHeaders: Headers): Record<string, string> {
    const headers: Record<string, string> = {};
    upstreamHeaders.forEach((value, name) => {
      if (!RESPONSE_HOP_BY_HOP_HEADERS.has(name)) {
        headers[name] = value;
      }
    });
    return headers;
  }

  private async readRequestBody(request: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        throw new Error(`Request body exceeded ${MAX_REQUEST_BYTES} bytes`);
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }
}
