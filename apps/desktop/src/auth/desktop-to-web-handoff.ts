import { CREATE_DESKTOP_TO_WEB_LOGIN_MUTATION } from "../cloud/auth-queries.js";
import type { AuthSessionManager } from "./session.js";

const DEEP_LINK_SCHEME = "tkcopilot:";
const DEEP_LINK_HOST = "web-session";
const MAX_DEEP_LINK_LENGTH = 2_048;
const MCP_RETURN_PATH_RE = /^\/oauth\/mcp\/authorize\?request_id=mcp_auth_[A-Za-z0-9_-]{43}$/;

export type DesktopWebSurface = "GLOBAL" | "CN_RELAY";

export interface DesktopWebSessionRequest {
  returnPath: string;
  surface: DesktopWebSurface;
}

export function parseDesktopWebSessionDeepLink(
  rawUrl: string,
): DesktopWebSessionRequest | undefined {
  if (!rawUrl || rawUrl.length > MAX_DEEP_LINK_LENGTH) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return undefined;
  }

  if (
    parsed.protocol !== DEEP_LINK_SCHEME ||
    parsed.hostname !== DEEP_LINK_HOST ||
    (parsed.pathname && parsed.pathname !== "/") ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    parsed.searchParams.size !== 2 ||
    parsed.searchParams.getAll("returnPath").length !== 1 ||
    parsed.searchParams.getAll("surface").length !== 1
  ) {
    return undefined;
  }

  const returnPath = parsed.searchParams.get("returnPath") ?? "";
  const surface = parsed.searchParams.get("surface");
  if (!MCP_RETURN_PATH_RE.test(returnPath) || (surface !== "GLOBAL" && surface !== "CN_RELAY")) {
    return undefined;
  }

  return { returnPath, surface };
}

export function findDesktopWebSessionDeepLink(args: string[]): string | undefined {
  return args.find((arg) => parseDesktopWebSessionDeepLink(arg) !== undefined);
}

export async function createDesktopToWebAuthorizationUrl(
  authSession: Pick<AuthSessionManager, "graphqlFetch">,
  request: DesktopWebSessionRequest,
): Promise<string> {
  const result = await authSession.graphqlFetch<{
    createDesktopToWebLogin: { authorizationUrl: string };
  }>(CREATE_DESKTOP_TO_WEB_LOGIN_MUTATION, {
    returnPath: request.returnPath,
    surface: request.surface,
  });
  const authorizationUrl = result.createDesktopToWebLogin?.authorizationUrl;
  if (!authorizationUrl)
    throw new Error("Desktop-to-web login did not return an authorization URL");
  return authorizationUrl;
}
