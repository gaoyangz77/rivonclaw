import type { HostAdapter, HostCapability } from "./host-adapter.js";

export * from "./host-adapter.js";

let installed: HostAdapter | null = null;

/**
 * Install the host this Panel session runs on. Called once at startup, before
 * anything renders. Tests call it again to swap hosts.
 */
export function installHost(host: HostAdapter): void {
  installed = host;
}

/** The installed host. Throws before `installHost()`: no code path may guess a host. */
export function getHost(): HostAdapter {
  if (!installed) {
    throw new Error("Host adapter not installed - installHost() must run before the Panel starts");
  }
  return installed;
}

/** True when the installed host provides every listed capability. */
export function hostSupports(...required: readonly HostCapability[]): boolean {
  const { capabilities } = getHost();
  return required.every((capability) => capabilities.has(capability));
}
