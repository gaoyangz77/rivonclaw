import type { MiddlewareHandler } from "hono";
import { jwtVerify, decodeJwt } from "jose";
import { sql } from "../db/client.js";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);

  let userId: string;
  try {
    const payload = decodeJwt(token);
    if (typeof payload.sub !== "string") throw new Error("missing sub");
    userId = payload.sub;
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }

  const [user] = await sql<{ jwt_secret: string }[]>`
    SELECT jwt_secret FROM users WHERE id = ${userId}
  `;
  if (!user) return c.json({ error: "User not found" }, 401);

  try {
    const secret = new TextEncoder().encode(user.jwt_secret);
    await jwtVerify(token, secret);
  } catch {
    return c.json({ error: "Token verification failed" }, 401);
  }

  c.set("userId", userId);
  await next();
};
