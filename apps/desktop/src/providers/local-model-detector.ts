import { DEFAULTS } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import { request } from "node:http";

const log = createLogger("local-model-detector");

export interface LocalModelServer {
  type: "ollama" | "lmstudio" | "vllm" | "custom";
  baseUrl: string;
  version?: string;
  status: "detected" | "offline";
}

interface ProbeTarget {
  type: LocalModelServer["type"];
  host: string;
  port: number;
  versionPath: string;
}

const PROBE_TARGETS: ProbeTarget[] = [
  // Probe uses IPv4 literal to avoid DNS resolution (localhost may resolve to ::1 on IPv6 systems).
  { type: "ollama", host: "127.0.0.1", port: DEFAULTS.ollama.port, versionPath: "/api/version" },
];

const PROBE_TIMEOUT_MS = DEFAULTS.desktop.probeTimeoutMs;

/** HTTP GET using node:http — see local-model-fetcher.ts for rationale. */
function httpGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(new URL(url), (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("Connection timed out"));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Probe a single local model server.
 * Returns a detected server or null if unreachable.
 */
async function probeServer(target: ProbeTarget): Promise<LocalModelServer | null> {
  const url = `http://${target.host}:${target.port}${target.versionPath}`;

  try {
    const { status, body } = await httpGet(url, PROBE_TIMEOUT_MS);
    if (status < 200 || status >= 300) return null;
    const data = JSON.parse(body) as { version?: string };
    return {
      type: target.type,
      baseUrl: `http://${target.host}:${target.port}`,
      version: data.version,
      status: "detected",
    };
  } catch {
    return null;
  }
}

/**
 * Detect all running local model servers by probing known ports.
 */
export async function detectLocalServers(): Promise<LocalModelServer[]> {
  const results = await Promise.all(PROBE_TARGETS.map(probeServer));
  const detected = results.filter((r): r is LocalModelServer => r !== null);
  log.info(`Detected ${detected.length} local model server(s)`);
  return detected;
}
