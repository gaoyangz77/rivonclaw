import { describe, expect, it, vi } from "vitest";
import { createWebSession, tokenExpiryMs } from "./web-session.js";

function jwt(expSeconds: number): string {
  const payload = btoa(JSON.stringify({ exp: expSeconds })).replace(/=+$/, "");
  return `h.${payload}.s`;
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const USER = { userId: "u1", email: "a@b.c", name: "A" };
const signedIn = (token: string) => respond({ data: { webRefresh: { accessToken: token, user: USER } } });
const noSession = () => respond({ errors: [{ message: "Browser session not found" }], data: null });

describe("browser session (ADR-054)", () => {
  it("reads the expiry out of a JWT and tolerates a token that is not one", () => {
    expect(tokenExpiryMs(jwt(1_700_000_000))).toBe(1_700_000_000_000);
    expect(tokenExpiryMs("opaque")).toBeNull();
  });

  it("boots from the refresh cookie with credentials and keeps the token in memory", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(signedIn("tok-1"));
    const session = createWebSession({ graphqlUrl: "/api/graphql", fetchImpl });

    await expect(session.boot()).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/graphql",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).query).toContain("webRefresh");
    expect(session.peekAccessToken()).toBe("tok-1");
    expect(session.user()).toEqual(USER);
    expect(await session.getAccessToken()).toBe("tok-1");
  });

  it("treats a GraphQL rejection as signed out, and a transport failure as an error", async () => {
    const out = createWebSession({
      graphqlUrl: "/g",
      fetchImpl: vi.fn().mockResolvedValue(noSession()),
    });
    await expect(out.boot()).resolves.toBe(false);
    expect(out.peekAccessToken()).toBeNull();

    const broken = createWebSession({
      graphqlUrl: "/g",
      fetchImpl: vi.fn().mockResolvedValue(respond({}, 502)),
    });
    await expect(broken.boot()).rejects.toThrow(/502/);
  });

  it("shares one in-flight refresh between concurrent callers", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(signedIn("tok"));
    const session = createWebSession({ graphqlUrl: "/g", fetchImpl });
    await Promise.all([session.refresh(), session.refresh(), session.boot()]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refreshes ahead of expiry, not before", async () => {
    let now = 1_000_000;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(signedIn(jwt(now / 1000 + 600)))
      .mockResolvedValueOnce(signedIn("fresh"));
    const session = createWebSession({ graphqlUrl: "/g", fetchImpl, now: () => now });
    await session.boot();

    now += 60_000; // 9 minutes left
    await session.getAccessToken();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    now += 8 * 60_000 + 30_000; // 30 s left, inside the leeway
    expect(await session.getAccessToken()).toBe("fresh");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports expiry only when a session that existed is lost", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(noSession())
      .mockResolvedValueOnce(signedIn("tok"))
      .mockResolvedValueOnce(noSession());
    const session = createWebSession({ graphqlUrl: "/g", fetchImpl });
    const expired = vi.fn();
    session.onExpired(expired);

    await session.boot(); // never signed in: no event
    expect(expired).not.toHaveBeenCalled();

    await session.boot();
    await expect(session.refresh()).resolves.toBe(false);
    expect(expired).toHaveBeenCalledOnce();
    expect(session.peekAccessToken()).toBeNull();
  });

  it("revokes the session on sign-out and drops the token even when the call fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(signedIn("tok"))
      .mockResolvedValueOnce(respond({}, 500));
    const session = createWebSession({ graphqlUrl: "/g", fetchImpl });
    await session.boot();
    await expect(session.signOut()).rejects.toThrow();
    expect(JSON.parse(fetchImpl.mock.calls[1]![1].body).query).toContain("webLogout");
    expect(session.peekAccessToken()).toBeNull();
  });
});
