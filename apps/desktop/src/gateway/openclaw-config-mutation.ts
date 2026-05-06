import { writeFileSync } from "node:fs";
import { createLogger } from "@rivonclaw/logger";
import { readExistingConfig } from "@rivonclaw/gateway";

const log = createLogger("gateway-config-mutation");

export type OpenClawConfigObject = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Desktop owns the gateway process lifecycle. Keep OpenClaw's file watcher in
 * hot mode so file edits can update dynamic/channel state, but cannot escalate
 * into an in-process gateway restart.
 */
export function enforceDesktopGatewayReloadPolicy(config: OpenClawConfigObject): void {
  const gateway = isRecord(config.gateway) ? config.gateway : {};
  const reload = isRecord(gateway.reload) ? gateway.reload : {};
  reload.mode = "hot";
  gateway.reload = reload;
  config.gateway = gateway;
}

export function writeDesktopOpenClawConfig(
  configPath: string,
  config: OpenClawConfigObject,
  reason: string,
): void {
  enforceDesktopGatewayReloadPolicy(config);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  log.debug(`wrote openclaw config (${reason})`);
}

export function mutateDesktopOpenClawConfig(
  configPath: string,
  reason: string,
  mutate: (config: OpenClawConfigObject) => void,
): OpenClawConfigObject {
  const config = readExistingConfig(configPath) as OpenClawConfigObject;
  mutate(config);
  writeDesktopOpenClawConfig(configPath, config, reason);
  return config;
}
