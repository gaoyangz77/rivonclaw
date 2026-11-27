import { API, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson } from "../../api/client.js";
import type { HostAuth, HostAuthSession } from "../host-adapter.js";

/** `fetchJson` and the cloud upload helpers raise this window event on a 401. */
export const AUTH_EXPIRED_EVENT = "rivonclaw:auth-expired";

/**
 * Auth through Desktop (ADR-045): Desktop owns the tokens, Panel only asks
 * for session state and triggers login/logout over local REST. The user
 * entity reaches the entity store through Desktop's SSE patches.
 */
export function createDesktopAuth(): HostAuth {
  const auth: HostAuth = {
    getSession() {
      return fetchJson<HostAuthSession>(clientPath(API["auth.session"]));
    },

    async login(input) {
      await fetchJson(clientPath(API["auth.login"]), {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    async register(input) {
      await fetchJson(clientPath(API["auth.register"]), {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    async logout() {
      await fetch(API["auth.logout"].path, { method: "POST" });
    },

    onSessionExpired(handler) {
      window.addEventListener(AUTH_EXPIRED_EVENT, handler);
      return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
    },

    /** Tokens stay in Desktop. A new document discards all previous Apollo/detail state. */
    async switchToMember(memberId) {
      const session = await auth.getSession();
      if (session.memberLoginAvailable !== true) {
        throw Object.assign(new Error("Desktop must restart to load account switching"), {
          code: "ACCOUNT_SWITCH_CLIENT_UNAVAILABLE",
        });
      }
      await fetchJson(clientPath(API["auth.loginAsMember"]), {
        method: "POST",
        body: JSON.stringify({ memberId }),
      });
      window.location.assign("/account/profile");
    },

    startSignIn(returnPath) {
      window.dispatchEvent(new CustomEvent("rivonclaw:open-auth", { detail: { path: returnPath } }));
    },

    async returnToOwner() {
      await fetchJson(clientPath(API["auth.returnToOwner"]), { method: "POST" });
      window.location.assign("/account/profile");
    },
  };
  return auth;
}
