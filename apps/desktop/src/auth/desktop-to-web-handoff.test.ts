import { describe, expect, it, vi } from "vitest";
import {
  createDesktopToWebAuthorizationUrl,
  findDesktopWebSessionDeepLink,
  parseDesktopWebSessionDeepLink,
} from "./desktop-to-web-handoff.js";

const requestId = `mcp_auth_${"a".repeat(43)}`;
const returnPath = `/oauth/mcp/authorize?request_id=${requestId}`;

function deepLink(surface = "GLOBAL") {
  const url = new URL("tkcopilot://web-session");
  url.searchParams.set("returnPath", returnPath);
  url.searchParams.set("surface", surface);
  return url.toString();
}

describe("Desktop-to-web MCP handoff", () => {
  it("accepts only a canonical MCP authorization deep link", () => {
    expect(parseDesktopWebSessionDeepLink(deepLink())).toEqual({
      returnPath,
      surface: "GLOBAL",
    });
    expect(parseDesktopWebSessionDeepLink(deepLink("CN_RELAY"))).toEqual({
      returnPath,
      surface: "CN_RELAY",
    });

    expect(
      parseDesktopWebSessionDeepLink(
        `tkcopilot://web-session?returnPath=${encodeURIComponent("/expert")}&surface=GLOBAL`,
      ),
    ).toBeUndefined();
    expect(
      parseDesktopWebSessionDeepLink(`${deepLink()}&next=https://attacker.example`),
    ).toBeUndefined();
    expect(
      parseDesktopWebSessionDeepLink(
        "tkcopilot://web-session?returnPath=%2Foauth%2Fmcp%2Fauthorize%3Frequest_id%3Dmcp_auth_short&surface=GLOBAL",
      ),
    ).toBeUndefined();
  });

  it("finds a valid deep link in process arguments", () => {
    expect(findDesktopWebSessionDeepLink(["electron", "--flag", deepLink()])).toBe(deepLink());
    expect(
      findDesktopWebSessionDeepLink(["electron", "tkcopilot://attribution?payload=x"]),
    ).toBeUndefined();
  });

  it("requests a one-time browser handoff without returning an account token", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      createDesktopToWebLogin: {
        authorizationUrl: "https://www.tkcopilot.com/account/login?handoff=single-use-ticket",
      },
    });

    await expect(
      createDesktopToWebAuthorizationUrl({ graphqlFetch } as never, {
        returnPath,
        surface: "GLOBAL",
      }),
    ).resolves.toBe("https://www.tkcopilot.com/account/login?handoff=single-use-ticket");
    expect(graphqlFetch).toHaveBeenCalledWith(expect.stringContaining("createDesktopToWebLogin"), {
      returnPath,
      surface: "GLOBAL",
    });
  });
});
