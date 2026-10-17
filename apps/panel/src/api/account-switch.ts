import { API, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson } from "./client.js";

/** Tokens stay in Desktop. A new document discards all previous Apollo/detail state. */
export async function switchToMember(memberId: string): Promise<void> {
  const session = await fetchJson<{ memberLoginAvailable?: boolean }>(
    clientPath(API["auth.session"]),
  );
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
}

export async function returnToOwner(): Promise<void> {
  await fetchJson(clientPath(API["auth.returnToOwner"]), { method: "POST" });
  window.location.assign("/account/profile");
}
