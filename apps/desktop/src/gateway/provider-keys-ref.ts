import type { ProviderKeyEntry } from "@rivonclaw/core";

interface ProviderKeysStore {
  getAll(): ProviderKeyEntry[];
}

let _store: ProviderKeysStore | null = null;

export function setProviderKeysStore(store: ProviderKeysStore): void {
  _store = store;
}

export function getProviderKeysStore(): ProviderKeysStore | null {
  return _store;
}
