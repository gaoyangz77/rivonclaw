import { createLogger } from "@rivonclaw/logger";
import {
  assertValidOpenClawConfig,
  readExistingConfig,
  writeOpenClawConfigAtomically,
} from "@rivonclaw/gateway";

const log = createLogger("gateway-config-mutation");

export type OpenClawConfigObject = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Desktop owns the gateway process lifecycle. Keep OpenClaw's file watcher in
 * hybrid mode so file edits can update dynamic/channel state while OpenClaw
 * can still classify settings that require a restart.
 */
export function enforceDesktopGatewayReloadPolicy(config: OpenClawConfigObject): void {
  const gateway = isRecord(config.gateway) ? config.gateway : {};
  const reload = isRecord(gateway.reload) ? gateway.reload : {};
  reload.mode = "hybrid";
  gateway.reload = reload;
  config.gateway = gateway;
}

export function writeDesktopOpenClawConfig(
  configPath: string,
  config: OpenClawConfigObject,
  reason: string,
  strict = false,
): void {
  enforceDesktopGatewayReloadPolicy(config);
  if (strict) assertValidOpenClawConfig(config);
  writeOpenClawConfigAtomically(configPath, config);
  log.debug(`wrote openclaw config (${reason})`);
}

export function mutateDesktopOpenClawConfig(
  configPath: string,
  reason: string,
  mutate: (config: OpenClawConfigObject) => void,
  options?: { strict?: boolean },
): OpenClawConfigObject {
  const config = readExistingConfig(configPath) as OpenClawConfigObject;
  mutate(config);
  writeDesktopOpenClawConfig(configPath, config, reason, options?.strict);
  return config;
}
