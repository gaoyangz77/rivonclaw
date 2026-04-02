import type { Storage } from "@rivonclaw/storage";

let _storage: Storage | null = null;

export function setStorageRef(s: Storage): void {
  _storage = s;
}

export function getStorageRef(): Storage | null {
  return _storage;
}
