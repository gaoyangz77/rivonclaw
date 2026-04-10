import type { AuthSessionManager } from "./session.js";

let _authSession: AuthSessionManager | null = null;

export function setAuthSession(session: AuthSessionManager): void {
  _authSession = session;
}

export function getAuthSession(): AuthSessionManager | null {
  return _authSession;
}
