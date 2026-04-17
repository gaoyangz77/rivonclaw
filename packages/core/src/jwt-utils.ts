/**
 * Decode the payload segment of a JWT. Returns `undefined` on malformed input
 * rather than throwing — callers uniformly treat "can't read" as "I don't know".
 *
 * Does NOT verify the signature. Only use for introspecting claims on tokens
 * whose authenticity is already established by prior exchange with the provider
 * (e.g. OpenAI's id_token claim payload for the Codex subscription expiry).
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  if (!token) return undefined;
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
